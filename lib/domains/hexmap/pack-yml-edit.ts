/**
 * Edits to a pack's `pack.yml`, applied to its text so the file keeps its
 * comments and layout: catalog names added, renamed, removed; display tuning
 * set or cleared at the pack, folder or tile level; a renamed tile followed
 * everywhere the file names it, and a moved one (to another layer) carrying
 * its tuning along; a path tile given its place in an autotile
 * table; a label family's text box set. The settings' pack browser queues these and writes them on Save (a
 * rename, at once, with the file).
 */

import { Document, isMap, isScalar, isSeq, parse as parseYaml, parseDocument, Scalar, YAMLMap, YAMLSeq } from "yaml";
import { composeValue, type FarCompose } from "./far-compose";
import { groundOf, type Layer, type TileDisplay } from "./packs";
import { shapeKey, shapeOrder } from "./path-shapes";

export type TuneKey = "hexWidth" | "zoom" | "offsetX" | "offsetY" | "borderWidth" | "step";
export const TUNE_KEYS: TuneKey[] = ["hexWidth", "zoom", "offsetX", "offsetY", "borderWidth", "step"];
/** Yes / no tuning (`hides`: terrain art with a base baked in). */
export type FlagKey = "hides";

/** Where tuning applies: the whole pack, a folder (`forest`, `stack/island`),
 *  or one tile (`forest/lush/conifer-0`). */
export type TuneLevel = { kind: "defaults" } | { kind: "terrains"; key: string } | { kind: "files"; key: string };

export type PackEdit =
  | { kind: "catalog-set"; id: string; spec: string; color?: string }
  | { kind: "catalog-delete"; id: string }
  | { kind: "catalog-rename"; from: string; to: string }
  /** `null` clears the key at that level (falls back to the level above). */
  | { kind: "tune"; level: TuneLevel; key: TuneKey | FlagKey; value: number | boolean | null }
  /** A tile renamed or moved (paths below its layer, no extension: `forest/lush/conifer-0`):
   *  its tuning entry, autotile lists and the catalog specs naming exactly it follow. */
  | { kind: "tile-rename"; layer: string; from: string; to: string }
  /** A tile, or a folder with everything below it (`basic/level`, `basic`), moved to
   *  the same place in another layer: its tuning goes along; the old layer's autotile
   *  or edge tables drop it. Catalog specs stay as they are (they read per layer).
   *  `flat`: into the layer folder itself, by file name (bases: `basic/level` → `level`). */
  | { kind: "tile-move"; from: Layer; to: Layer; path: string; folder: boolean; flat?: boolean }
  /** A path tile (`roads/clean/straight-0`) listed under one shape (`straight-0`) of a
   *  family's `autotile:` table, and taken out of any other; `null` takes it out of all.
   *  The table's older side-mask keys are rewritten as shape names. With `section:
   *  "edges"`, an edge piece (`coast/run3-0`) in a family's `edges:` table instead. */
  | { kind: "autotile-set"; family: string; path: string; shape: string | null; section?: Section }
  /** A family's table rewritten with shape-name keys, nothing else changed. */
  | { kind: "autotile-shape-keys"; family: string; section?: Section }
  /** A far family's `of:` (the terrains it stands for) or `size:`; null takes it out. */
  | { kind: "far-set"; family: string; key: "of" | "size"; value: string[] | number | null }
  /** A far family's recipe (far-compose.ts), written whole; null takes it out. */
  | { kind: "far-compose"; family: string; compose: FarCompose | null }
  /** A far family's `tiles:` replaced by baked ones, one per shape (`straight-0: forest/straight-0`). */
  | { kind: "far-baked"; family: string; tiles: Record<string, string> }
  /** A label family's text box or seams (`labels: { title-1: { inset: [t, r, b, l] } }`); `null` clears it. */
  | { kind: "label-set"; family: string; key: LabelKey; value: number | string | number[] | null }
  /** A marker style's anchor or size (`markers: { pin: { anchor: [0.5, 0.97] } }`); `null` clears it. */
  | { kind: "marker-set"; style: string; key: MarkerKey; value: number | number[] | null }
  /** A custom tile's lines (`custom: { town: ["t(0,0): city", …] }`), each quoted; `null` deletes it. */
  | { kind: "stamp-set"; name: string; lines: string[] | null }
  | { kind: "stamp-rename"; from: string; to: string };

export type LabelKey = "inset" | "size" | "overlap" | "color" | "font";
export type MarkerKey = "anchor" | "size";

/** Where a family's table lives: paths' `autotile:`, edges' `edges:` or far art's `far:`. */
export type Section = "autotile" | "edges" | "far";
const KIND: Record<Section, "path" | "edge" | "far"> = { autotile: "path", edges: "edge", far: "far" };
/** The table section a layer's tiles are listed in, if any. */
const SECTION_OF: Record<string, Section> = { path: "autotile", edge: "edges", far: "far" };

function levelPath(level: TuneLevel): string[] {
  return level.kind === "defaults" ? ["defaults"] : [level.kind, level.key];
}

/** The map at `path`, created (in block style) if missing. */
function ensureMap(doc: Document, path: string[]): YAMLMap {
  let node = doc.getIn(path, true);
  if (!isMap(node)) {
    doc.setIn(path, doc.createNode({}));
    node = doc.getIn(path, true);
  }
  const map = node as YAMLMap;
  return map;
}

function setValue(doc: Document, path: string[], value: unknown): void {
  const parent = ensureMap(doc, path.slice(0, -1));
  // An empty `{}` written in the template turns to block style once it holds something.
  if (parent.flow && parent.items.length === 0) parent.flow = false;
  parent.set(path[path.length - 1], value);
}

function deleteValue(doc: Document, path: string[]): void {
  if (!doc.hasIn(path)) return;
  doc.deleteIn(path);
  // Drop a tile or folder entry left with nothing in it.
  const parentPath = path.slice(0, -1);
  const parent = doc.getIn(parentPath, true);
  if (parentPath.length === 2 && isMap(parent) && parent.items.length === 0) doc.deleteIn(parentPath);
}

/** The spec that picks exactly one tile: `forest[lush][conifer-0]` for `forest/lush/conifer-0`. */
export function tileSpec(path: string): string {
  const [base, ...rest] = path.split("/");
  return base + rest.map((p) => `[${p}]`).join("");
}

const same = (a: unknown, b: string) => typeof a === "string" && a.toLowerCase() === b.toLowerCase();

/** A tile's new path wherever `pack.yml` names its old one. */
function renameTile(doc: Document, edit: Extract<PackEdit, { kind: "tile-rename" }>): void {
  // Its tuning: `files:` keys are terrain paths bare, other layers' prefixed.
  const prefix = edit.layer === "terrain" ? "" : `${edit.layer}/`;
  const files = doc.getIn(["files"], true);
  if (isMap(files)) {
    for (const pair of files.items) {
      const key = isScalar(pair.key) ? pair.key : null;
      if (key && same(key.value, prefix + edit.from)) key.value = prefix + edit.to;
    }
  }
  // Families' tables in this layer (paths' `autotile:`, edges' `edges:`; paths below the layer).
  const section = SECTION_OF[edit.layer] ?? null;
  const autotile = section ? doc.getIn([section], true) : null;
  if (isMap(autotile)) {
    for (const family of autotile.items) {
      const tiles = isMap(family.value) ? family.value.get("tiles", true) : null;
      if (!isMap(tiles)) continue;
      for (const pair of tiles.items) {
        const list = isSeq(pair.value) ? pair.value.items : [pair.value];
        for (const item of list) if (isScalar(item) && same(item.value, edit.from)) item.value = edit.to;
      }
    }
  }
  // Catalog names for exactly this tile (a folder's spec or a partial name still matches by itself).
  const catalog = doc.getIn(["catalog"], true);
  if (isMap(catalog)) {
    // A terrain tile's spec can name its section (`land[forest][x]`) or not (`forest[x]`): either follows, as written.
    const forms = (path: string) => {
      const inner = edit.layer === "terrain" && groundOf(path) ? path.slice(path.indexOf("/") + 1) : null;
      return inner ? [tileSpec(path), tileSpec(inner)] : [tileSpec(path)];
    };
    const from = forms(edit.from);
    const to = forms(edit.to);
    const follow = (s: Scalar) => {
      const i = from.findIndex((f) => same(s.value, f));
      if (i >= 0) s.value = to[i];
    };
    for (const pair of catalog.items) {
      const v = pair.value;
      if (isScalar(v)) follow(v);
      else if (isMap(v)) {
        const spec = v.get("spec", true);
        if (isScalar(spec)) follow(spec);
      }
    }
  }
}

/** `files:` and `terrains:` keys: terrain's bare, other layers' prefixed. */
const layerPrefix = (layer: string) => (layer === "terrain" ? "" : `${layer}/`);

function moveTile(doc: Document, edit: Extract<PackEdit, { kind: "tile-move" }>): void {
  const to = layerPrefix(edit.to);
  const moved = (p: string) =>
    p.toLowerCase() === edit.path.toLowerCase() ||
    (edit.folder && p.toLowerCase().startsWith(`${edit.path.toLowerCase()}/`));
  const sections: Array<[string, boolean]> = [
    ["files", true],
    // A folder's own tuning goes with it when it's a top folder (not when its files spill out flat).
    ["terrains", edit.folder && !edit.flat && !edit.path.includes("/")],
  ];
  for (const [name, applies] of sections) {
    const map = applies ? doc.getIn([name], true) : null;
    if (!isMap(map)) continue;
    for (const pair of map.items) {
      const key = isScalar(pair.key) ? pair.key : null;
      if (!key || typeof key.value !== "string") continue;
      const k = key.value;
      // Keys may name the layer (`base/basic`); terrain's may also be bare, when
      // they don't start with another layer's name (`path/wall` isn't terrain's).
      const named = k.toLowerCase().startsWith(`${edit.from}/`);
      if (!named && (edit.from !== "terrain" || /^(base|edge|path|stack|marker|label|far)\//i.test(k))) continue;
      const rest = named ? k.slice(edit.from.length + 1) : k;
      if (moved(rest)) key.value = to + (edit.flat ? rest.slice(rest.lastIndexOf("/") + 1) : rest);
    }
  }
  const section = SECTION_OF[edit.from] ?? null;
  const tables = section ? doc.getIn([section], true) : null;
  if (isMap(tables)) {
    for (const family of tables.items) {
      const tiles = isMap(family.value) ? family.value.get("tiles", true) : null;
      if (!isMap(tiles)) continue;
      for (const pair of [...tiles.items]) {
        const list = isSeq(pair.value) ? pair.value.items : [pair.value];
        const kept = list.filter((item) => !(isScalar(item) && typeof item.value === "string" && moved(item.value)));
        if (kept.length === list.length) continue;
        if (kept.length === 0) tiles.items.splice(tiles.items.indexOf(pair), 1);
        else pair.value = listNode(kept);
      }
    }
  }
}

function quoted(value: string): Scalar {
  const s = new Scalar(value);
  s.type = Scalar.QUOTE_DOUBLE;
  return s;
}

/** A family's `tiles:` keyed by shape name: older side-mask keys (`N,S`) become their
 *  type (`straight-0`), keys naming the same shape merge, and all sort in catalogue
 *  order. Keys that name no shape stay as they are, at the end. */
function shapeKeyed(doc: Document, tiles: YAMLMap, kind: "path" | "edge" | "far"): void {
  const byShape = new Map<string, unknown[]>();
  const unknown: typeof tiles.items = [];
  for (const pair of tiles.items) {
    const shape = isScalar(pair.key) ? shapeKey(String(pair.key.value), kind) : null;
    if (!shape) {
      unknown.push(pair);
      continue;
    }
    const list = isSeq(pair.value) ? pair.value.items : [pair.value];
    byShape.set(shape, [...(byShape.get(shape) ?? []), ...list]);
  }
  tiles.items = [
    ...[...byShape]
      .sort((x, y) => shapeOrder(x[0]) - shapeOrder(y[0]))
      .map(([shape, list]) => doc.createPair(new Scalar(shape), listNode(list))),
    ...unknown,
  ];
}

/** One tile as a plain value, several as a flow list. */
function listNode(items: unknown[]): unknown {
  if (items.length === 1) return items[0];
  const seq = new YAMLSeq();
  seq.flow = true;
  seq.items = items;
  return seq;
}

/** A tile listed under one shape of a family's table, and out of every other
 *  (a list left with one tile goes back to a plain value; an empty one goes). */
function setAutotile(doc: Document, edit: Extract<PackEdit, { kind: "autotile-set" }>): void {
  const section = edit.section ?? "autotile";
  const kind = KIND[section];
  const tiles = ensureMap(doc, [section, edit.family, "tiles"]);
  if (tiles.flow && tiles.items.length === 0) tiles.flow = false;
  shapeKeyed(doc, tiles, kind);
  for (const pair of [...tiles.items]) {
    const list = isSeq(pair.value) ? pair.value.items : [pair.value];
    const kept = list.filter((item) => !(isScalar(item) && same(item.value, edit.path)));
    if (kept.length === list.length) continue;
    if (kept.length === 0) tiles.items.splice(tiles.items.indexOf(pair), 1);
    else pair.value = listNode(kept);
  }
  if (!edit.shape) return;
  const pair = tiles.items.find((p) => isScalar(p.key) && p.key.value === edit.shape);
  if (pair) {
    const list = isSeq(pair.value) ? pair.value.items : [pair.value];
    pair.value = listNode([...list, quoted(edit.path)]);
  } else {
    tiles.items.push(doc.createPair(new Scalar(edit.shape), quoted(edit.path)));
    shapeKeyed(doc, tiles, kind);
  }
}

export function applyPackEdits(text: string, edits: PackEdit[]): string {
  if (edits.length === 0) return text;
  const parsed = parseDocument(text || "");
  // An empty (or non-map) file starts from a fresh document.
  const doc: Document = isMap(parsed.contents) ? parsed : new Document({});
  for (const edit of edits) {
    if (edit.kind === "catalog-set") {
      setValue(
        doc,
        ["catalog", edit.id],
        edit.color ? doc.createNode({ spec: edit.spec, color: edit.color }, { flow: true }) : edit.spec
      );
    } else if (edit.kind === "catalog-delete") {
      deleteValue(doc, ["catalog", edit.id]);
    } else if (edit.kind === "tile-rename") {
      renameTile(doc, edit);
    } else if (edit.kind === "tile-move") {
      moveTile(doc, edit);
    } else if (edit.kind === "autotile-set") {
      setAutotile(doc, edit);
    } else if (edit.kind === "autotile-shape-keys") {
      const section = edit.section ?? "autotile";
      const tiles = doc.getIn([section, edit.family, "tiles"], true);
      if (isMap(tiles)) shapeKeyed(doc, tiles, KIND[section]);
    } else if (edit.kind === "far-compose") {
      const path = ["far", edit.family, "compose"];
      if (edit.compose === null) {
        deleteValue(doc, path);
        continue;
      }
      const node = doc.createNode(composeValue(edit.compose)) as YAMLMap;
      // Each sprite is one line: `- { src: …, zone: mid, x: 0, y: 0.1, s: 0.6 }`.
      const flowItems = (seq: unknown) => {
        if (isSeq(seq)) for (const item of seq.items) if (isMap(item)) item.flow = true;
      };
      flowItems(node.get("sprites", true));
      const shapes = node.get("shapes", true);
      if (isMap(shapes)) for (const pair of shapes.items) flowItems(pair.value);
      setValue(doc, path, node);
    } else if (edit.kind === "far-baked") {
      const tiles = new YAMLMap();
      for (const shape of Object.keys(edit.tiles).sort((a, b) => shapeOrder(a) - shapeOrder(b)))
        tiles.items.push(doc.createPair(new Scalar(shape), quoted(edit.tiles[shape])));
      setValue(doc, ["far", edit.family, "tiles"], tiles);
    } else if (edit.kind === "far-set") {
      const path = ["far", edit.family, edit.key];
      if (edit.value === null) deleteValue(doc, path);
      else setValue(doc, path, Array.isArray(edit.value) ? doc.createNode(edit.value, { flow: true }) : edit.value);
    } else if (edit.kind === "label-set" || edit.kind === "marker-set") {
      const [section, name] = edit.kind === "label-set" ? ["labels", edit.family] : ["markers", edit.style];
      const path = [section, name, edit.key];
      if (edit.value === null) {
        deleteValue(doc, path);
        continue;
      }
      const value = Array.isArray(edit.value) ? doc.createNode(edit.value, { flow: true }) : edit.value;
      // A family or style is a one-liner: `title-1: { inset: [125, 60, 55, 75], size: 0.3 }`.
      const entry = doc.getIn([section, name], true);
      if (isMap(entry)) entry.set(edit.key, value);
      else {
        const map = ensureMap(doc, [section]);
        if (map.flow && map.items.length === 0) map.flow = false;
        map.set(name, doc.createNode({ [edit.key]: edit.value }, { flow: true }));
      }
    } else if (edit.kind === "stamp-set") {
      if (edit.lines === null) {
        deleteValue(doc, ["custom", edit.name]);
        deleteValue(doc, ["stamps", edit.name]);
        continue;
      }
      const seq = new YAMLSeq();
      for (const line of edit.lines) {
        const item = new Scalar(line);
        item.type = Scalar.QUOTE_DOUBLE;
        seq.items.push(item);
      }
      deleteValue(doc, ["stamps", edit.name]);
      setValue(doc, ["custom", edit.name], seq);
    } else if (edit.kind === "stamp-rename") {
      const section = doc.hasIn(["custom", edit.from]) ? "custom" : "stamps";
      const value = doc.getIn([section, edit.from], true);
      if (value === undefined || edit.from === edit.to) continue;
      doc.deleteIn([section, edit.from]);
      setValue(doc, ["custom", edit.to], value);
    } else if (edit.kind === "catalog-rename") {
      const value = doc.getIn(["catalog", edit.from], true);
      if (value === undefined || edit.from === edit.to) continue;
      doc.deleteIn(["catalog", edit.from]);
      setValue(doc, ["catalog", edit.to], value);
    } else {
      const path = [...levelPath(edit.level), edit.key];
      if (edit.value === null) {
        deleteValue(doc, path);
      } else if (edit.level.kind === "defaults") {
        setValue(doc, path, edit.value);
      } else {
        // Tile and folder entries are one-liners: `"forest/lush/conifer-0": { offsetY: -3 }`.
        const entryPath = levelPath(edit.level);
        const entry = doc.getIn(entryPath, true);
        if (!isMap(entry)) {
          const section = ensureMap(doc, [edit.level.kind]);
          if (section.flow && section.items.length === 0) section.flow = false;
          // Tile paths are quoted, like the entries the pack ships with.
          const key = new Scalar(edit.level.key);
          if (edit.level.kind === "files") key.type = Scalar.QUOTE_DOUBLE;
          section.set(key, doc.createNode({ [edit.key]: edit.value }, { flow: true }));
        } else {
          entry.set(edit.key, edit.value);
        }
      }
    }
  }
  return doc.toString();
}

/** The tuning a level sets itself (not inherited), from a parsed config section. */
export function ownTuning(section: Partial<TileDisplay> | undefined): Partial<Record<TuneKey, number>> {
  const out: Partial<Record<TuneKey, number>> = {};
  for (const key of TUNE_KEYS) {
    const v = section?.[key];
    if (typeof v === "number") out[key] = v;
  }
  return out;
}

/** A yes / no a level sets itself (`hides`), or undefined when it inherits. */
export function ownFlag(section: Partial<TileDisplay> | undefined, key: FlagKey): boolean | undefined {
  const v = section?.[key];
  return typeof v === "boolean" ? v : undefined;
}

/** The `defaults:` tuning the file itself writes (the parsed config also
 *  fills in built-in defaults, which shouldn't show as set). */
export function ownDefaults(text: string): Partial<Record<TuneKey, number>> {
  try {
    const raw = parseYaml(text || "") as { defaults?: Partial<TileDisplay> } | null;
    return ownTuning(raw?.defaults);
  } catch {
    return {};
  }
}
