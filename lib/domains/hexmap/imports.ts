/**
 * Maps put together from other maps (design §15). A block's `import:` lists
 * other notes' hex maps; each is drawn in this one at its place, so a region
 * map can be a block that imports its realms, and a realm map can show its
 * neighbours faded around it.
 *
 *   origin: [4, 0]                  # this map's (0,0), in the coordinates it shares with its neighbours
 *   import:
 *     - "[[Rindelbran map]]"        # placed by its own origin
 *     - map: "[[Guinzel map]]"
 *       at: [-12, -4]               # or here: its (0,0) on this map's hex (-12,-4)
 *       show: faint                 # dimmed context: drawn, but not this map's
 *
 * Without `at`, an import lands at its `origin` minus this map's, so maps
 * that share a frame line up by themselves. Imports nest: a map imported in
 * full brings its own full imports, each placed relative to it, so a world
 * map can import a region map that imports its realms. A faint import brings
 * its full imports too, faint (a duchy shows the rest of its realm around it),
 * but not its own faint ones. Each note comes in once, the nearest one first,
 * and the map itself never comes back in.
 *
 * The block's own hexes win: a hex the map has any line on hides what the
 * imports have there, and among imports the earlier one wins. Imported lines
 * get negative line numbers, so edits and error lists leave them alone.
 */

import { hexKey } from "./axial";
import {
  type HexCell,
  type HexRegion,
  readRegionLabel,
  type HexLabelLine,
  type HexMarkerLine,
  type HexStampLine,
  parseHexMap,
  type ParsedHexMap,
} from "./parse-hex-map";

/** One entry of a block's `import:`. */
export interface HexImport {
  /** Link text of the note (`Dunlind map`). */
  link: string;
  /** Where the import's (0,0) lands on this map; unset: by the two origins. */
  at?: [number, number];
  /** Faded underneath, instead of merged in. */
  faint: boolean;
  /** How the regions it declares are named on this map: `border`, `middle`, `none`, or the whole
   *  label object (`{ at: border, color, size, offset, rot, style, halo, caps, spacing }`). */
  label?: Partial<HexRegion>;
}

/** An imported map, read and placed in the host's coordinates. */
export interface PlacedImport {
  /** The note it came from. */
  path: string;
  /** Its block's text, as read: what an edit made from the host is written over. */
  body: string;
  map: ParsedHexMap;
  /** Added to its coordinates to put them on the host. */
  offset: [number, number];
  faint: boolean;
  /** Its entry's `label:`, as region fields to put on its own region (the one linked to its note). */
  label?: Partial<HexRegion>;
  /** The note whose map imported it: the host's, or another import's. */
  via: string;
}

/** Reads a note's first hex map, from a link written in another note. */
export type ReadMap = (link: string, from: string) => Promise<{ path: string; body: string } | null>;

/** How deep imports of imports go. */
const MAX_DEPTH = 4;

function linkText(s: string): string {
  return s
    .trim()
    .replace(/^!?\[\[/, "")
    .replace(/\]\]$/, "")
    .trim();
}

function pairOf(value: unknown): [number, number] | undefined {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.replace(/[()[\]]/g, "").split(",")
      : null;
  if (!list || list.length !== 2) return undefined;
  const [a, b] = list.map((v) => parseInt(String(v), 10));
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : undefined;
}

/** A link as YAML reads it: `"[[Note]]"`, or `[[Note]]` unquoted (a list in a list). */
function linkOf(value: unknown): string | undefined {
  if (typeof value === "string") return linkText(value) || undefined;
  if (Array.isArray(value) && value.length === 1) {
    const inner = value[0];
    if (Array.isArray(inner) && inner.length === 1 && typeof inner[0] === "string")
      return linkText(inner[0]) || undefined;
    if (typeof inner === "string") return linkText(inner) || undefined;
  }
  return undefined;
}

/** The header's `import:` value → its entries; anything unreadable is skipped. */
export function readImports(raw: unknown): HexImport[] {
  if (raw === null || raw === undefined) return [];
  // `import: [[A]]` (YAML: [["A"]]) is one link; `import: "[[A]]"` too.
  const single = linkOf(raw);
  if (single && !(Array.isArray(raw) && raw.length > 1)) return [{ link: single, faint: false }];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: HexImport[] = [];
  for (const item of list) {
    const link = linkOf(item);
    if (link) {
      out.push({ link, faint: false });
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const target = linkOf(o.map ?? o.note ?? o.link);
    if (!target) continue;
    const label = o.label !== undefined ? readRegionLabel(o.label, true) : undefined;
    out.push({
      link: target,
      at: pairOf(o.at),
      faint: o.show === "faint" || o.faint === true,
      ...(label && Object.keys(label).length ? { label } : {}),
    });
  }
  return out;
}

/** Where an import's (0,0) lands on the map importing it. */
export function importOffset(host: ParsedHexMap, entry: HexImport, imported: ParsedHexMap): [number, number] {
  if (entry.at) return entry.at;
  const [hq, hr] = host.origin ?? [0, 0];
  const [iq, ir] = imported.origin ?? [0, 0];
  return [iq - hq, ir - hr];
}

/**
 * Reads a map's imports, and in full imports theirs, placed in the map's
 * coordinates, nearest first. Missing notes, scale mismatches and loops are
 * reported, not thrown.
 */
export async function loadImports(
  host: ParsedHexMap,
  hostPath: string,
  read: ReadMap
): Promise<{ imports: PlacedImport[]; problems: string[] }> {
  const imports: PlacedImport[] = [];
  const problems: string[] = [];
  const seen = new Set([hostPath]);
  // Breadth first, so the nearest copy of a note is the one kept.
  let wave: Array<{ map: ParsedHexMap; path: string; offset: [number, number]; faint: boolean }> = [
    { map: host, path: hostPath, offset: [0, 0], faint: false },
  ];
  for (let depth = 0; depth < MAX_DEPTH && wave.length; depth++) {
    const next: typeof wave = [];
    for (const from of wave) {
      for (const entry of from.map.imports ?? []) {
        // A faint import is only for the map that asked for it (not a neighbour's neighbours).
        if (entry.faint && from.path !== hostPath) continue;
        const found = await read(entry.link, from.path);
        if (!found) {
          problems.push(`import: no hex map in [[${entry.link}]]`);
          continue;
        }
        if (seen.has(found.path)) continue;
        seen.add(found.path);
        const map = parseHexMap(found.body);
        if (
          host.scaleMetres &&
          map.scaleMetres &&
          Math.abs(host.scaleMetres - map.scaleMetres) / host.scaleMetres > 0.01
        ) {
          problems.push(`import: [[${entry.link}]] is at ${map.scale}, this map at ${host.scale} — not drawn`);
          continue;
        }
        const [dq, dr] = importOffset(from.map, entry, map);
        const offset: [number, number] = [from.offset[0] + dq, from.offset[1] + dr];
        // What a faint import brings in (its own full imports: a realm's duchies) is faint too.
        const faint = from.faint || entry.faint;
        imports.push({
          path: found.path,
          body: found.body,
          map,
          offset,
          faint,
          via: from.path,
          ...(entry.label ? { label: entry.label } : {}),
        });
        next.push({ map, path: found.path, offset, faint });
      }
    }
    wave = next;
  }
  return { imports, problems };
}

/** Hexes a map has any line on. */
function ownedHexes(map: ParsedHexMap): Set<string> {
  const out = new Set<string>();
  for (const c of map.cells) out.add(hexKey(c.q, c.r));
  for (const s of map.stamps ?? []) out.add(hexKey(s.q, s.r));
  return out;
}

/**
 * The import a host hex comes from, when the host hasn't the hex itself: the
 * one mergeImports gives it to (full imports before faint, in order).
 */
export function importAt(host: ParsedHexMap, imports: PlacedImport[], q: number, r: number): PlacedImport | undefined {
  if (ownedHexes(host).has(hexKey(q, r))) return undefined;
  return [...imports.filter((i) => !i.faint), ...imports.filter((i) => i.faint)].find((i) =>
    ownedHexes(i.map).has(hexKey(q - i.offset[0], r - i.offset[1]))
  );
}

/**
 * The host with its imports' lines added at their places, under its own:
 * hexes the host (or an earlier import) has are left out, and regions the
 * host doesn't declare are taken from the imports. `taken` starts as the
 * hexes already drawn elsewhere (a faint layer leaves out the merged ones).
 */
export function mergeImports(host: ParsedHexMap, imports: PlacedImport[], taken?: Set<string>): ParsedHexMap {
  if (!imports.length) return host;
  const owned = new Set(taken ?? []);
  for (const k of ownedHexes(host)) owned.add(k);
  const cells: HexCell[] = [];
  const stamps: HexStampLine[] = [];
  const labels: HexLabelLine[] = [];
  const markers: HexMarkerLine[] = [];
  let line = 0;
  // Full imports claim their hexes before faint ones.
  for (const imp of [...imports.filter((i) => !i.faint), ...imports.filter((i) => i.faint)]) {
    const [dq, dr] = imp.offset;
    const mine = ownedHexes(imp.map);
    const shifted = (k: string) => {
      const [q, r] = k.split(",").map(Number);
      return hexKey(q + dq, r + dr);
    };
    // Its own coordinates: the hexes no one before it has.
    const keep = new Set([...mine].filter((k) => !owned.has(shifted(k))));
    for (const c of imp.map.cells) {
      if (!keep.has(hexKey(c.q, c.r))) continue;
      // A faint neighbour is context: dimmed, its regions drawn with it but not the host's to edit.
      cells.push(
        imp.faint
          ? { ...c, q: c.q + dq, r: c.r + dr, line: --line, faint: true, regions: [], faintRegions: c.regions }
          : { ...c, q: c.q + dq, r: c.r + dr, line: --line }
      );
    }
    for (const s of imp.map.stamps ?? []) {
      if (keep.has(hexKey(s.q, s.r))) stamps.push({ ...s, q: s.q + dq, r: s.r + dr, line: --line });
    }
    // Labels and markers stand on points: kept unless the host has the hex under them. A faint neighbour's are dimmed.
    const faint = imp.faint ? { faint: true } : {};
    for (const l of imp.map.labels) {
      if (!owned.has(hexKey(Math.round(l.q + dq), Math.round(l.r + dr))))
        labels.push({ ...l, q: l.q + dq, r: l.r + dr, ...faint, line: --line });
    }
    for (const m of imp.map.markers) {
      if (!owned.has(hexKey(Math.round(m.q + dq), Math.round(m.r + dr))))
        markers.push({ ...m, q: m.q + dq, r: m.r + dr, piece: false, ...faint, line: --line });
    }
    for (const k of mine) owned.add(shifted(k));
  }
  return {
    ...host,
    // Imported lines first: a later line wins its hex, and the host's are the map's.
    cells: [...cells, ...host.cells],
    stamps: [...stamps, ...(host.stamps ?? [])],
    labels: [...labels, ...host.labels],
    markers: [...markers, ...host.markers],
    regions: resolveRegions(host, imports),
  };
}

/** `Folder/Note#Heading|Alias` or `Folder/Note.md` → `note`. */
export const noteName = (s: string) =>
  s.split("|")[0].split("#")[0].split("/").pop()!.replace(/\.md$/i, "").trim().toLowerCase();

/** A map's own region: the one it declares linked to its own note (a duchy's map, `Feathers: { link: "[[Feathers]]" }`). */
export function ownsRegion(region: HexRegion | undefined, path: string): boolean {
  return !!region?.link && !!path && noteName(region.link) === noteName(path);
}

/** A declaration moved into the host's coordinates. */
function placed(region: HexRegion, [dq, dr]: [number, number]): HexRegion {
  const out: HexRegion = { ...region };
  if (region.at) out.at = [region.at[0] + dq, region.at[1] + dr];
  if (region.labelOn) out.labelOn = [region.labelOn[0] + dq, region.labelOn[1] + dr];
  return out;
}

/**
 * The regions as drawn, imports and all (design §15). A region is the one its
 * own map declares (the map linked from it: Worthallow Forest's for
 * `WorthallowForest`), wherever it's imported; copies of it in other maps are
 * left alone. Going up from that map to the host, each import entry's
 * `label:` names the imported map's own region, and each map declaring it
 * with `override: true` puts its fields over, as an exception: so a realm
 * shows its duchies as it does on its own map, inside a bigger map too, or
 * faint around a duchy's. A region no map owns is the first import's (full
 * before faint), the host's fields over it.
 */
function resolveRegions(host: ParsedHexMap, imports: PlacedImport[]): Record<string, HexRegion> {
  // Full imports before faint ones: a faint neighbour's regions are drawn as its own maps declare them too.
  const full = [...imports.filter((i) => !i.faint), ...imports.filter((i) => i.faint)];
  const byPath = new Map(full.map((i) => [i.path, i]));
  const hostPath = imports.find((i) => !imports.some((j) => j.path === i.via))?.via ?? "";
  const names = new Set([...Object.keys(host.regions), ...full.flatMap((i) => Object.keys(i.map.regions))]);
  const out: Record<string, HexRegion> = {};
  for (const name of names) {
    const own = host.regions[name];
    const owner = ownsRegion(own, hostPath) ? undefined : full.find((i) => ownsRegion(i.map.regions[name], i.path));
    if (!owner) {
      if (own && ownsRegion(own, hostPath)) {
        out[name] = own;
        continue;
      }
      const first = full.find((i) => i.map.regions[name]);
      let r = first ? placed(first.map.regions[name], first.offset) : undefined;
      if (r && first?.label) r = withLabel(r, first.label);
      out[name] = own ? withLabel(r ?? { name }, own) : r!;
      continue;
    }
    let r: HexRegion = { ...placed(owner.map.regions[name], owner.offset), source: owner.path };
    if (owner.label) r = withLabel(r, owner.label);
    // Up the chain to the host: each map's exception over it.
    for (let cur = owner, steps = 0; steps < 8; steps++) {
      if (cur.via === hostPath) {
        if (own?.override) r = withLabel(r, own);
        break;
      }
      const up = byPath.get(cur.via);
      if (!up) break;
      const decl = up.map.regions[name];
      if (decl?.override) r = withLabel(r, placed(decl, up.offset));
      cur = up;
    }
    out[name] = r;
  }
  return out;
}

/** A region with these fields put over it, the ones set only; the label's look merged key by key.
 *  Placing a hidden name (`at: border` over `label: false`) shows it again. */
function withLabel(region: HexRegion, over: Partial<HexRegion>): HexRegion {
  const set = Object.fromEntries(Object.entries(over).filter(([, v]) => v !== undefined)) as Partial<HexRegion>;
  const out: HexRegion = { ...region, ...set, name: region.name };
  if (set.labelAt && set.label === undefined && region.label === false) delete out.label;
  if (region.labelLook || set.labelLook) out.labelLook = { ...region.labelLook, ...set.labelLook };
  return out;
}
