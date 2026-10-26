/**
 * A map's finer levels, kept in its own block (design §13.9): `level 1:` is
 * the map six times finer (30 mi → 5 mi, six hexes across the flats of one),
 * `level 2:` six times finer again (5 mi → 1 mi). Each level is one layer
 * in global coordinates: the fine hex `(6q, 6r)` sits on the centre of the
 * coarse hex `(q, r)`, so a level isn't owned hex by hex, and its hexes on a
 * coarse border belong to the level, not to either side.
 *
 *   ---
 *   t(1,0): plains @Dunlind
 *   level 1:
 *     * t(6,0): plains
 *     * t(7,-1): forest
 *   level 2:
 *     * t(36,0): urban[lush][hamlet]
 *
 * A level is edited as a map of its own: `levelView` gives its text (the main
 * map's header with this level's scale, then its lines), the editor works on
 * it, and `spliceLevel` puts its lines back, adding the section the first time.
 *
 * The older `detail(q,r):` sections (one per coarse hex, in that hex's own
 * coordinates) are read by `migrateDetails`, which moves them into levels.
 */

import { stringify } from "yaml";
import { type Axial, hexCenter, hexKey, pixelToHex } from "./axial";
import { detailScale } from "./detail";
import type { PlacedImport } from "./imports";
import { detailSections, levelSections, parseHexMap } from "./parse-hex-map";

export { type LevelSection, levelSections, mainEnd } from "./parse-hex-map";

/** How many hexes of a level span one of the level above, across the flats. */
export const LEVEL_RATIO = 6;
/** The finest level: 30 mi → 5 mi → 1 mi. */
export const MAX_LEVEL = 2;

/** The deepest level the block has lines for. */
export function deepestLevel(source: string): number {
  return levelSections(source).reduce((n, s) => Math.max(n, s.depth), 0);
}

/** A level's scale: the main map's, six times finer for each level down. */
export function levelScale(scale: string | undefined, depth: number): string | undefined {
  let s = scale;
  for (let i = 0; i < depth && s; i++) s = detailScale(s, LEVEL_RATIO);
  return s;
}

/** A section's lines (below its heading), or none. */
function sectionLines(source: string, depth: number): string[] {
  const s = levelSections(source).find((x) => x.depth === depth);
  return s ? source.split("\n").slice(s.line + 1, s.to) : [];
}

/** The level `depth` as a block of its own: the main map's header (pack,
 *  regions …) with this level's scale, then its lines. Level 0 is the block. */
export function levelView(source: string, depth: number): string {
  if (depth === 0) return source;
  const top = parseHexMap(source);
  const head: Record<string, unknown> = { grid: "hex" };
  if (top.title) head.title = top.title;
  if (top.pack) head.pack = top.pack;
  if (top.seed) head.seed = `${top.seed}/level${depth}`;
  const scale = levelScale(top.scale, depth);
  if (scale) head.scale = scale;
  if (top.step) head.step = `${top.step} m`;
  if (top.coords) head.coords = top.coords;
  if (top.parent) head.parent = top.parent;
  if (Object.keys(top.regions).length) {
    head.regions = Object.fromEntries(
      Object.values(top.regions).map((g) => [
        g.name,
        {
          ...(g.color ? { color: g.color } : {}),
          ...(g.link ? { link: `[[${g.link}]]` } : {}),
          ...(g.parent ? { parent: g.parent } : {}),
        },
      ])
    );
  }
  const header = stringify(head, { flowCollectionPadding: false }).replace(/\n+$/, "");
  return [...header.split("\n"), "---", ...sectionLines(source, depth)].join("\n");
}

/** The block with level `depth` holding the lines of `view` (a `levelView`
 *  after editing); the section is added after the levels above it if new. */
export function spliceLevel(source: string, depth: number, view: string): string {
  if (depth === 0) return view;
  const viewLines = view.split("\n");
  const sep = viewLines.findIndex((l) => l.trim() === "---");
  const body = viewLines.slice(sep + 1);
  while (body.length && !body[body.length - 1].trim()) body.pop();
  const lines = source.split("\n");
  const sections = levelSections(source);
  const own = sections.find((s) => s.depth === depth);
  if (own) {
    // A blank line between sections stays where it was.
    const trailing: string[] = [];
    for (let i = own.to - 1; i > own.line && !lines[i].trim(); i--) trailing.unshift("");
    lines.splice(own.line + 1, own.to - own.line - 1, ...body, ...trailing);
    return lines.join("\n");
  }
  if (body.length === 0) return source;
  // Written like the block's own lines: bulleted if they are.
  if (lines.some((l) => /^\s+\*\s/.test(l))) {
    for (let i = 0; i < body.length; i++) if (/^[a-z]+\s*\(|^-?\d/.test(body[i])) body[i] = `  * ${body[i]}`;
  }
  // After the last level above it, else at the end.
  const after = sections.find((s) => s.depth > depth);
  if (after) {
    lines.splice(after.line, 0, `level ${depth}:`, ...body, "");
    return lines.join("\n");
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return [...lines, "", `level ${depth}:`, ...body].join("\n");
}

/** Edits to level `depth`, written into the block. */
export function editLevel(source: string, depth: number, apply: (view: string) => string): string {
  if (depth === 0) return apply(source);
  return spliceLevel(source, depth, apply(levelView(source, depth)));
}

// ---- where a level's hexes lie in the level above ----

/** The coarse hex a fine hex's centre lies in. */
export function coarseHexOf(q: number, r: number): Axial {
  const c = hexCenter(q, r, 1);
  return pixelToHex(c.x / LEVEL_RATIO, c.y / LEVEL_RATIO, 1);
}

/** The coarse hexes (`q,r`) a level's hexes lie in. */
export function coarseHexesOf(hexes: Iterable<Axial>): Set<string> {
  const out = new Set<string>();
  for (const h of hexes) {
    const p = coarseHexOf(h.q, h.r);
    out.add(hexKey(p.q, p.r));
  }
  return out;
}

/** Whether a point (coarse units, R = 1) is inside the coarse hex (q, r). */
function insideHex(x: number, y: number, q: number, r: number): boolean {
  const c = hexCenter(q, r, 1);
  const dx = Math.abs(x - c.x);
  const dy = Math.abs(y - c.y);
  const eps = 1e-6;
  return dy <= Math.sqrt(3) / 2 + eps && Math.sqrt(3) * dx + dy <= Math.sqrt(3) + eps;
}

/** The fine hexes wholly inside the coarse hex (q, r): the ones a new detail fills.
 *  Those across its border are left out (they're the neighbour's as much as its). */
export function innerHexesOf(pq: number, pr: number): Axial[] {
  const n = LEVEL_RATIO;
  const out: Axial[] = [];
  for (let q = n * pq - n; q <= n * pq + n; q++) {
    for (let r = n * pr - n; r <= n * pr + n; r++) {
      const c = hexCenter(q, r, 1);
      let inside = true;
      for (let i = 0; i < 6 && inside; i++) {
        const a = (Math.PI / 3) * i;
        inside = insideHex((c.x + Math.cos(a)) / n, (c.y + Math.sin(a)) / n, pq, pr);
      }
      if (inside) out.push({ q, r });
    }
  }
  return out;
}

/** What a coarse hex is drawn with, as a fill takes it down a level. */
export interface CoarseTile {
  terrain?: string;
  base?: string;
  height: number;
}

/** One fine hex a fill paints: the coarse hex's tile, staged until Done. */
export interface FillHex extends CoarseTile {
  q: number;
  r: number;
}

/** A coarse hex's tile taken down a level: its inner fine hexes painted the same
 *  (terrain, base and height), those that have nothing of their own yet. */
export function fillHexes(pq: number, pr: number, tile: CoarseTile, taken: Set<string>): FillHex[] {
  if (!tile.terrain && !tile.base) return [];
  return innerHexesOf(pq, pr)
    .filter((h) => !taken.has(hexKey(h.q, h.r)))
    .map((h) => ({ ...tile, q: h.q, r: h.r }));
}

/** A map's text with the fill's hexes written after its own lines (bulleted if they are):
 *  bases at the ground, terrains under their heights' groups. */
export function withFill(view: string, fill: FillHex[]): string {
  if (fill.length === 0) return view;
  const lines = view.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  const bullet = lines.slice(sep + 1).some((l) => /^\s+\*\s/.test(l)) ? "  * " : "";
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const out = [...lines];
  const bases = fill.filter((f) => f.base);
  const heights = [...new Set(fill.filter((f) => f.terrain).map((f) => f.height))].sort((a, b) => a - b);
  if (bases.length) {
    out.push("0m:");
    for (const f of bases) out.push(`${bullet}b(${f.q},${f.r}): ${f.base}`);
  }
  for (const h of heights) {
    out.push(`${h}m:`);
    for (const f of fill) if (f.terrain && f.height === h) out.push(`${bullet}t(${f.q},${f.r}): ${f.terrain}`);
  }
  return out.join("\n");
}

/** A view box (layout units) at another level: six times larger for each level down. */
export function viewAtLevel<V extends { x: number; y: number; w: number; h: number }>(
  v: V,
  from: number,
  to: number
): V {
  const k = Math.pow(LEVEL_RATIO, to - from);
  return { ...v, x: v.x * k, y: v.y * k, w: v.w * k, h: v.h * k };
}

/** The imports placed at a level: each one's own level of that depth, its offset scaled. */
export function importsAtLevel(imports: PlacedImport[], depth: number): PlacedImport[] {
  if (depth === 0) return imports;
  const k = Math.pow(LEVEL_RATIO, depth);
  const out: PlacedImport[] = [];
  for (const i of imports) {
    if (!levelSections(i.body).some((s) => s.depth === depth)) continue;
    const body = levelView(i.body, depth);
    out.push({ ...i, body, map: parseHexMap(body), offset: [i.offset[0] * k, i.offset[1] * k] });
  }
  return out;
}

// ---- the older detail(q,r) sections ----

const NUM = String.raw`-?\d+(?:\.\d+)?|-?\.\d+`;
const COORD_LINE = new RegExp(
  String.raw`^(\s*(?:\*\s*)?)(?:([a-z]+)\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*\)|(-?\d+)\s*,\s*(-?\d+)(?=\s*[:,]))`,
  "i"
);
const HEIGHT_LINE = /^\s*(?:\*\s*)?-?\d+\s*m\s*:/;

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** A hex line moved by (dq, dr); other lines as they are. */
function shiftLine(line: string, dq: number, dr: number): string {
  const m = line.match(COORD_LINE);
  if (!m) return line;
  const [all, lead, name, a, b, la, lb] = m;
  if (name) return `${lead}${name}(${fmt(parseFloat(a) + dq)},${fmt(parseFloat(b) + dr)})${line.slice(all.length)}`;
  return `${lead}${parseInt(la, 10) + dq},${parseInt(lb, 10) + dr}${line.slice(all.length)}`;
}

/** Whether the block still has `detail(q,r):` sections. */
export function hasOldDetails(source: string): boolean {
  return detailSections(source).length > 0;
}

/**
 * The block with its `detail(q,r):` sections moved into `level N:` sections,
 * each hex at its global place there. Sections split out to a note
 * (`detail(2,0): [[Note]]`) are dropped: that note's `of:` places it.
 */
export function migrateDetails(source: string): string {
  const sections = detailSections(source);
  if (sections.length === 0) return source;
  const lines = source.split("\n");
  const byDepth = new Map<number, string[]>();
  for (const d of sections) {
    if (d.link) continue;
    let off: [number, number] = [0, 0];
    for (const [q, r] of d.path) off = [LEVEL_RATIO * (off[0] + q), LEVEL_RATIO * (off[1] + r)];
    const body = lines.slice(d.line + 1, d.to).map((l) => shiftLine(l, off[0], off[1]));
    while (body.length && !body[body.length - 1].trim()) body.pop();
    const depth = d.path.length;
    const had = byDepth.get(depth);
    // Each part starts back at the ground, as its section did.
    if (had && had.some((l) => HEIGHT_LINE.test(l)) && !HEIGHT_LINE.test(body.find((l) => l.trim()) ?? ""))
      body.unshift("0m:");
    byDepth.set(depth, [...(had ?? []), ...body]);
  }
  const main = lines.slice(0, sections[0].line);
  while (main.length && !main[main.length - 1].trim()) main.pop();
  const out = [...main];
  for (const depth of [...byDepth.keys()].sort((a, b) => a - b))
    out.push("", `level ${depth}:`, ...byDepth.get(depth)!);
  return out.join("\n");
}
