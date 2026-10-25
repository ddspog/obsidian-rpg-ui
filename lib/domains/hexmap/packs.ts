/**
 * Texture packs: the tile tree, `pack.yml`, and which tile a spec picks.
 *
 * A pack is one vault folder: `<pack>/{base,terrain,edge,path,stack,marker,label,far}/<folder>/…/<file>`,
 * terrain's land and water sections either under `terrain/` or at the pack's top (`<pack>/land/…`)
 * plus `pack.yml`. Specs are the hex-map-editor's, with one addition:
 *
 *   forest                  files directly in `forest/` (all below it if none)
 *   forest[lush]            a subfolder
 *   forest[lush][conifer]   then names containing "conifer"
 *   forest[*]               files of any one level of subfolders
 *   plains[2]               the third match
 *   plains(dry)             names containing "(dry)" — the pack's biome names
 *   dry-plains              a `catalog:` name from pack.yml
 *   rocky                   with no such folder: files in the layer itself
 *                           named `rocky` or `rocky-…` (bases live there)
 *
 * A random pick is seeded by the hex, so a hex keeps its variant.
 */

import { parse as parseYaml } from "yaml";
import { type FarCompose, readCompose } from "./far-compose";
import { shapeKey } from "./path-shapes";

/** In drawing order: the ground with its base (the slab under the face, drawn
 *  over the terrain art's own), edges along its sides (coasts), paths, then
 *  stacks (props: buildings, trees) on top. Markers (pins, flags, pedestals
 *  standing on a point, see markers.ts) go over the map, and labels (title
 *  banners put together to fit their text, see labels.ts) over them. `far` is
 *  never painted: it's how a level's hexes look from the level above (far.ts). */
export type Layer = "base" | "terrain" | "edge" | "path" | "stack" | "marker" | "label" | "far";
export const LAYERS: Layer[] = ["base", "terrain", "edge", "path", "stack", "marker", "label", "far"];

/** What a terrain hex is, by the section its tile sits in (`terrain/land/…`,
 *  `terrain/water/…`): coasts, rivers' mouths and regions' coastlines ask this. */
export type Ground = "land" | "water";
export const GROUNDS: Ground[] = ["land", "water"];

/** The section a terrain tile's path (`land/forest/lush/x`) sits in, or null for a pack without sections. */
export function groundOf(path: string): Ground | null {
  const top = path.split("/")[0].toLowerCase();
  return (GROUNDS as string[]).includes(top) ? (top as Ground) : null;
}

export interface TileDisplay {
  /** Image pixels the hex face spans (tiles and sprites share a scale);
   *  absent: the image's own width. */
  hexWidth?: number;
  zoom: number;
  /** In image pixels. */
  offsetX: number;
  offsetY: number;
  borderWidth: number;
  /** Clip the image to the hex (flat textures) instead of letting it overhang. */
  clip?: boolean;
  /** Image pixels of slab per height step. At pack or base-layer level it sets
   *  how high a step lifts a hex; on a base tile, how far apart its repeated
   *  slabs sit. Absent: `DEFAULT_STEP` of the hex width. */
  step?: number;
  /** A terrain tile whose art has a base baked in: where the hex gets a base,
   *  the tile is cropped to its face so the two don't both show. */
  hides?: boolean;
}

/** A height step as a share of the hex width, when the pack doesn't say:
 *  `basic`'s slabs measure 7–9 % (35 px under a 477 px face, 10 under 115). */
export const DEFAULT_STEP = 0.08;

export interface CatalogEntry {
  spec: string;
  color?: string;
}

export interface PackConfig {
  name: string;
  description?: string;
  version?: string;
  defaults: TileDisplay;
  layers: Partial<Record<Layer, Partial<TileDisplay>>>;
  /** Keyed by top folder (`forest`) or `layer/folder` (`stack/island`). */
  terrains: Record<string, Partial<TileDisplay>>;
  /** Keyed by layer-relative path without extension (`forest/lush/conifer-0`),
   *  optionally prefixed with the layer. */
  files: Record<string, Partial<TileDisplay>>;
  catalog: Record<string, CatalogEntry>;
  /** The base every hex gets unless its map says otherwise (`base: level`). */
  base?: string;
  /** Paths that join up, by family (`roads`, `rivers`): see autotile.ts. */
  autotile: Record<string, AutotileFamily>;
  /** Edges laid along terrain's sides, by family (`coast`): see edges.ts. */
  edges: Record<string, EdgeFamily>;
  /** Label families' text box and seams, by family folder (`title-1`): see labels.ts. */
  labels: Record<string, LabelTuning>;
  /** Marker styles' anchor and size, by style folder (`pedestal-gold`): see markers.ts. */
  markers: Record<string, MarkerTuning>;
  /** Custom tiles: named groups of map lines, relative to (0,0) (`custom:`): see stamps.ts. */
  stamps: Record<string, string[]>;
  /** How terrains look from the level above (zoomed out), by family: see far.ts. */
  far: Record<string, FarFamily>;
}

/** A terrain's far (zoomed-out) art: one autotile set, picked by which of the six neighbours
 *  are of the same family (a forest's trees join into one wood). */
export interface FarFamily {
  /** Shape (`alone-0`, `straight-0`, `star-0`: see path-shapes.ts) → tile paths in the far layer, without extension. */
  tiles: Record<string, string[]>;
  /** The terrains it stands for, by folder, base name or ground (`forest`, `jungle`), lower-cased; none: its own name. */
  of: string[];
  /** Hexes it doesn't stand for though they match `of`. */
  except: string[];
  /** How big its tiles are drawn, as a share of their hex (1: as wide as the hex). */
  size?: number;
  /** The recipe its tiles are baked from in the pack studio (far-compose.ts). */
  compose?: FarCompose;
  unknownKeys: string[];
}

/** Where a marker style stands on its picture, and how big it is drawn. */
export interface MarkerTuning {
  /** The point that sits on the marker's spot, as shares of the image (x, y). */
  anchor?: [number, number];
  /** Height multiplier (1: the default marker height). */
  size?: number;
}

/** Where a label's text sits on its banner, in the banner's own pixels. */
export interface LabelTuning {
  /** From the banner's edges: top, right, bottom, left. */
  inset?: [number, number, number, number];
  /** Text height as a share of the banner's height. */
  size?: number;
  /** Pixels each piece overlaps the one before it, hiding hand-drawn seams. */
  overlap?: number;
  color?: string;
  font?: string;
  /** Lettering: just the text, in its font, with no banner art (a style named in `labels:` with no folder). */
  lettering?: boolean;
  /** CSS font weight (400 regular, 700 bold, 900 black). */
  weight?: number;
  italic?: boolean;
  /** A colour drawn round the letters so they read over the map. */
  halo?: string;
  /** Letter spacing, in ems. */
  spacing?: number;
}

export interface EdgeFamily {
  /** Run (`run3-0`: see path-shapes.ts) → tile paths in the edge layer, without extension. */
  tiles: Record<string, string[]>;
  /** Terrain bases the edge runs along (`water`, `sea`), lower-cased. */
  meets: string[];
  /** Hexes that don't count as `meets` though they match it (`except: [swamp]`: no beach round a swamp). */
  except: string[];
  /** Drawn on the `meets` hexes themselves, along their sides facing the rest
   *  (`inside`, the default: a coast on the water), or on the hexes facing them
   *  (`outside`: a coast on the land). */
  on: "outside" | "inside";
  /** Keys that name no run: ignored. */
  unknownKeys: string[];
}

export interface AutotileFamily {
  /** Shape (`straight-0`, `start-4-hub`: see path-shapes.ts) → tile paths in the
   *  path layer, without extension. Older side-mask keys (`N,S`) read as their type. */
  tiles: Record<string, string[]>;
  /** Keys still written as side masks (rewritten as shape names on the next edit). */
  sideKeys: number;
  /** Keys that name no shape: ignored. */
  unknownKeys: string[];
  /** Terrain folders a path also runs into (a river into `water`). */
  connectsTo: string[];
  /** Hexes it doesn't run into though they match `connectsTo` (`except: [swamp]`: no mouth into a swamp). */
  except?: string[];
}

export interface TileFile {
  /** File name without extension. */
  name: string;
  /** Path below the layer folder, without extension (`forest/lush/conifer-0`). */
  path: string;
  url: string;
}

export interface TileFolder {
  name: string;
  files: TileFile[];
  folders: Map<string, TileFolder>;
}

export interface HexPack {
  name: string;
  config: PackConfig;
  layers: Record<Layer, TileFolder>;
  /** Every tile by layer and path (`roads/clean/turn60-0`), lower-cased. */
  byPath: Record<Layer, Map<string, TileFile>>;
}

export const DEFAULT_DISPLAY: TileDisplay = { zoom: 1, offsetX: 0, offsetY: 0, borderWidth: 0.5 };

const DISPLAY_KEYS: Array<keyof TileDisplay> = [
  "hexWidth",
  "zoom",
  "offsetX",
  "offsetY",
  "borderWidth",
  "clip",
  "step",
  "hides",
];
const FLAGS = new Set<keyof TileDisplay>(["clip", "hides"]);

function pickDisplay(raw: unknown): Partial<TileDisplay> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Partial<TileDisplay> = {};
  for (const key of DISPLAY_KEYS) {
    const v = src[key];
    if (FLAGS.has(key)) {
      if (typeof v === "boolean") (out as Record<string, unknown>)[key] = v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

function pickDisplayMap(raw: unknown): Record<string, Partial<TileDisplay>> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, pickDisplay(v)]));
}

const SIDE_ORDER = ["N", "NE", "SE", "S", "SW", "NW"];

/** A side combination written any way (`se, n`) in its canonical form (`N,SE`). */
export function canonicalMask(mask: string): string {
  return mask
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SIDE_ORDER.includes(s))
    .sort((a, b) => SIDE_ORDER.indexOf(a) - SIDE_ORDER.indexOf(b))
    .join(",");
}

function readAutotile(raw: unknown): Record<string, AutotileFamily> {
  const out: Record<string, AutotileFamily> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [family, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as { tiles?: unknown; connectsTo?: unknown; except?: unknown };
    const { tiles, sideKeys, unknownKeys } = readTiles(o.tiles, "path");
    const connectsTo = strings(o.connectsTo);
    const except = strings(o.except).map((m) => m.toLowerCase());
    out[family] = { tiles, connectsTo, ...(except.length ? { except } : {}), sideKeys, unknownKeys };
  }
  return out;
}

/** A table's keys read as shape names (`kind` picks paths' shapes or edges' runs). */
function readTiles(raw: unknown, kind: "path" | "edge" | "far") {
  const tiles: Record<string, string[]> = {};
  let sideKeys = 0;
  const unknownKeys: string[] = [];
  if (raw && typeof raw === "object") {
    for (const [key, t] of Object.entries(raw as Record<string, unknown>)) {
      const shape = shapeKey(key, kind);
      if (!shape) {
        unknownKeys.push(key);
        continue;
      }
      if (shape !== key) sideKeys++;
      const list = (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
      if (list.length) tiles[shape] = [...(tiles[shape] ?? []), ...list];
    }
  }
  return { tiles, sideKeys, unknownKeys };
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string");

function readFar(raw: unknown): Record<string, FarFamily> {
  const out: Record<string, FarFamily> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [family, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as { tiles?: unknown; of?: unknown; except?: unknown; size?: unknown; compose?: unknown };
    const { tiles, unknownKeys } = readTiles(o.tiles, "far");
    const of = (typeof o.of === "string" ? [o.of] : strings(o.of)).map((m) => m.toLowerCase());
    const except = strings(o.except).map((m) => m.toLowerCase());
    const size = num(o.size);
    const compose = readCompose(o.compose);
    out[family] = {
      tiles,
      of: of.length ? of : [family.toLowerCase()],
      except,
      unknownKeys,
      ...(size ? { size } : {}),
      ...(compose ? { compose } : {}),
    };
  }
  return out;
}

function readEdges(raw: unknown): Record<string, EdgeFamily> {
  const out: Record<string, EdgeFamily> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [family, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as { tiles?: unknown; meets?: unknown; except?: unknown; on?: unknown };
    const { tiles, unknownKeys } = readTiles(o.tiles, "edge");
    const meets = strings(o.meets).map((m) => m.toLowerCase());
    const except = strings(o.except).map((m) => m.toLowerCase());
    out[family] = { tiles, meets, except, on: o.on === "outside" ? "outside" : "inside", unknownKeys };
  }
  return out;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** `custom: { town: ["t(0,0): city", …] }` (once `stamps:`) — or one block of text per tile. */
function readStamps(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    // An unquoted `- t(0,0): city` reads as a one-key map, and `- 100m:` as one with no value.
    const line = (item: unknown): string =>
      item && typeof item === "object"
        ? Object.entries(item as Record<string, unknown>)
            .map(([k, val]) => `${k}:${val === null || val === undefined ? "" : ` ${String(val)}`}`)
            .join(" ")
        : String(item);
    const lines = Array.isArray(v) ? v.map(line) : typeof v === "string" ? v.split("\n") : [];
    const kept = lines.map((l) => l.trim()).filter(Boolean);
    if (kept.length) out[name] = kept;
  }
  return out;
}

function readMarkers(raw: unknown): Record<string, MarkerTuning> {
  const out: Record<string, MarkerTuning> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [style, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const t: MarkerTuning = {};
    const anchor = Array.isArray(o.anchor) ? o.anchor.map(num) : [];
    if (anchor.length === 2 && anchor.every((n) => n !== undefined)) t.anchor = anchor as [number, number];
    if (num(o.size) !== undefined) t.size = num(o.size);
    out[style] = t;
  }
  return out;
}

/** Weight names as fonts write them (`Bookmania-Semibold`), lower-cased with no spaces. */
export const FONT_WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  roman: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  heavy: 900,
  black: 900,
};

/** A font file in a pack's `fonts/` folder, read from its name: `Bookmania-Black Italic.ttf` →
 *  Bookmania, 900, italic. Null when it isn't a font. */
export function fontFaceOf(path: string): { family: string; weight: number; italic: boolean } | null {
  const m = path.match(/(?:^|\/)fonts\/(?:.*\/)?([^/]+)\.(ttf|otf|woff2?)$/i);
  if (!m) return null;
  const [family, ...rest] = m[1].split("-");
  const style = rest.join(" ").toLowerCase();
  const italic = /\b(italic|oblique)\b/.test(style);
  const name = style.replace(/\b(italic|oblique)\b/, "").replace(/\s+/g, "");
  return { family: family.trim(), weight: FONT_WEIGHTS[name] ?? 400, italic };
}

function readLabels(raw: unknown): Record<string, LabelTuning> {
  const out: Record<string, LabelTuning> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [family, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const t: LabelTuning = {};
    const inset = Array.isArray(o.inset) ? o.inset.map(num) : [];
    if (inset.length === 4 && inset.every((n) => n !== undefined)) t.inset = inset as LabelTuning["inset"];
    if (num(o.size) !== undefined) t.size = num(o.size);
    if (num(o.overlap) !== undefined) t.overlap = num(o.overlap);
    if (typeof o.color === "string") t.color = o.color;
    if (typeof o.font === "string") t.font = o.font;
    if (o.lettering === true) t.lettering = true;
    const weight =
      typeof o.weight === "string" ? FONT_WEIGHTS[o.weight.toLowerCase().replace(/[\s-]/g, "")] : num(o.weight);
    if (weight !== undefined) t.weight = weight;
    if (o.italic === true) t.italic = true;
    if (typeof o.halo === "string") t.halo = o.halo;
    if (num(o.spacing) !== undefined) t.spacing = num(o.spacing);
    out[family] = t;
  }
  return out;
}

/** Read a `pack.yml`. A missing or broken file gives the defaults. */
export function parsePackConfig(text: string | null, packName: string): PackConfig {
  let raw: Record<string, unknown> = {};
  if (text) {
    try {
      const parsed = parseYaml(text);
      if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
    } catch {
      raw = {};
    }
  }
  const layersRaw = (raw.layers ?? {}) as Record<string, unknown>;
  const layers: PackConfig["layers"] = {};
  for (const layer of LAYERS) {
    if (layersRaw && typeof layersRaw === "object" && layer in layersRaw) layers[layer] = pickDisplay(layersRaw[layer]);
  }
  const catalog: Record<string, CatalogEntry> = {};
  if (raw.catalog && typeof raw.catalog === "object") {
    for (const [id, v] of Object.entries(raw.catalog as Record<string, unknown>)) {
      if (typeof v === "string") catalog[id] = { spec: v };
      else if (v && typeof v === "object" && typeof (v as { spec?: unknown }).spec === "string") {
        const entry = v as { spec: string; color?: unknown };
        catalog[id] = { spec: entry.spec, color: typeof entry.color === "string" ? entry.color : undefined };
      }
    }
  }
  return {
    name: typeof raw.name === "string" ? raw.name : packName,
    description: typeof raw.description === "string" ? raw.description : undefined,
    version: typeof raw.version === "string" ? raw.version : String(raw.version ?? "") || undefined,
    defaults: { ...DEFAULT_DISPLAY, ...pickDisplay(raw.defaults) },
    layers,
    terrains: pickDisplayMap(raw.terrains),
    files: pickDisplayMap(raw.files),
    catalog,
    base: typeof raw.base === "string" && raw.base.trim() ? raw.base.trim() : undefined,
    autotile: readAutotile(raw.autotile),
    edges: readEdges(raw.edges),
    labels: readLabels(raw.labels),
    markers: readMarkers(raw.markers),
    stamps: { ...readStamps(raw.stamps), ...readStamps(raw.custom) },
    far: readFar(raw.far),
  };
}

/** The display for one tile: defaults → layer → folder → file. A terrain
 *  folder's key (`forest`) is the one below its section (`land/forest`). */
export function displayFor(config: PackConfig, layer: Layer, path: string): TileDisplay {
  const parts = path.split("/");
  const top = layer === "terrain" && parts.length > 2 && groundOf(path) ? parts[1] : parts[0];
  return {
    ...config.defaults,
    ...config.layers[layer],
    ...config.terrains[top],
    ...config.terrains[`${layer}/${top}`],
    ...config.files[path],
    ...config.files[`${layer}/${path}`],
  };
}

const IMAGE = /\.(svg|webp|png|jpe?g)$/i;

function emptyFolder(name: string): TileFolder {
  return { name, files: [], folders: new Map() };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Build a pack's tile tree from its files: paths below the pack folder
 *  (`terrain/forest/lush/conifer-0.webp`) with their loadable URLs. */
export function buildPack(name: string, files: Array<{ path: string; url: string }>, config: PackConfig): HexPack {
  const layers = Object.fromEntries(LAYERS.map((l) => [l, emptyFolder(l)])) as Record<Layer, TileFolder>;
  for (const { path, url } of files) {
    if (!IMAGE.test(path)) continue;
    const parts = path.split("/");
    // Terrain's sections may sit at the pack's top (`land/forest/…`, `water/ocean/…`) instead of
    // under `terrain/`: the same tiles, with the same paths below the layer.
    if (groundOf(parts[0] ?? "") && parts.length > 1) parts.unshift("terrain");
    const layer = parts.shift() as Layer;
    // Bases sit in their layer folder itself; other tiles one folder down at least.
    if (!LAYERS.includes(layer) || parts.length < (layer === "base" ? 1 : 2)) continue;
    const fileName = parts.pop() as string;
    let folder = layers[layer];
    for (const part of parts) {
      let next = folder.folders.get(part);
      if (!next) {
        next = emptyFolder(part);
        folder.folders.set(part, next);
      }
      folder = next;
    }
    const base = fileName.replace(IMAGE, "");
    folder.files.push({ name: base, path: [...parts, base].join("/"), url });
  }
  const sortTree = (f: TileFolder) => {
    f.files.sort((a, b) => collator.compare(a.name, b.name));
    f.folders.forEach(sortTree);
  };
  LAYERS.forEach((l) => sortTree(layers[l]));
  const byPath = Object.fromEntries(LAYERS.map((l) => [l, new Map<string, TileFile>()])) as HexPack["byPath"];
  const index = (layer: Layer, f: TileFolder) => {
    f.files.forEach((file) => byPath[layer].set(file.path.toLowerCase(), file));
    f.folders.forEach((sub) => index(layer, sub));
  };
  LAYERS.forEach((l) => index(l, layers[l]));
  return { name, config, layers, byPath };
}

export interface SpecPart {
  kind: "bracket" | "qualifier";
  value: string;
}

export interface TileSpec {
  base: string;
  parts: SpecPart[];
}

/** `water[Ocean](still water)` → base `water`, parts `[Ocean]`, `(still water)`. */
export function parseTileSpec(spec: string): TileSpec {
  const s = spec.trim();
  const m = s.match(/^[^[(]*/);
  const base = (m ? m[0] : s).trim();
  const parts: SpecPart[] = [];
  const re = /\[([^\]]*)\]|\(([^)]*)\)/g;
  let pm: RegExpExecArray | null;
  const rest = s.slice(base.length);
  while ((pm = re.exec(rest)) !== null) {
    if (pm[1] !== undefined) parts.push({ kind: "bracket", value: pm[1].trim() });
    else parts.push({ kind: "qualifier", value: pm[2].trim() });
  }
  return { base, parts };
}

function allFiles(f: TileFolder): TileFile[] {
  const out = [...f.files];
  f.folders.forEach((sub) => out.push(...allFiles(sub)));
  return out;
}

function findFolder(f: TileFolder, name: string): TileFolder | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of f.folders) if (k.toLowerCase() === lower) return v;
  return undefined;
}

/**
 * A spec's top folder in a layer. Terrain's sections are seen through, so
 * specs don't name them: `forest` is `land/forest`, a section is itself
 * (`water[ocean]`), and folders of one name in both (`basic`) read as one.
 */
function topFolder(root: TileFolder, name: string): TileFolder | undefined {
  const sections = [...root.folders.values()].filter((f) => groundOf(f.name));
  const direct = findFolder(root, name);
  if (sections.length === 0) return direct;
  const found = [direct, ...sections.map((s) => findFolder(s, name))].filter((f): f is TileFolder => !!f);
  return found.length > 1 ? mergeFolders(found) : found[0];
}

/** Several folders read as one: their files, and their subfolders merged by name. */
function mergeFolders(list: TileFolder[]): TileFolder {
  const folders = new Map<string, TileFolder>();
  const byName = new Map<string, TileFolder[]>();
  for (const f of list)
    for (const [k, v] of f.folders) byName.set(k.toLowerCase(), [...(byName.get(k.toLowerCase()) ?? []), v]);
  for (const subs of byName.values()) folders.set(subs[0].name, subs.length > 1 ? mergeFolders(subs) : subs[0]);
  return { name: list[0].name, files: list.flatMap((f) => f.files), folders };
}

/** Stable 32-bit FNV-1a hash. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface PickedTile {
  file: TileFile;
  display: TileDisplay;
}

/** Resolve a catalog name to its spec (and colour), or the spec itself. */
export function resolveCatalog(pack: HexPack | undefined, spec: string): CatalogEntry {
  const entry = pack?.config.catalog[spec.trim()];
  return entry ?? { spec };
}

/** The tile a spec picks in a pack's layer, or null when none matches. */
export function selectTile(pack: HexPack, layer: Layer, spec: string, seed: string): PickedTile | null {
  const { base, parts } = parseTileSpec(resolveCatalog(pack, spec).spec);
  if (!base) return null;
  let root = topFolder(pack.layers[layer], base);
  if (!root) {
    // No folder of that name: the layer's own files of that name (`rocky`, `rocky-1`).
    const needle = base.toLowerCase();
    const own = pack.layers[layer].files.filter(
      (f) => f.name.toLowerCase() === needle || f.name.toLowerCase().startsWith(`${needle}-`)
    );
    if (own.length === 0) return null;
    root = { name: base, files: own, folders: new Map() };
  }
  let current: TileFolder | null = root;
  let candidates: TileFile[] = root.files.length > 0 || root.folders.size === 0 ? root.files : allFiles(root);
  let index: number | null = null;
  let filtered = false;
  for (const part of parts) {
    const v = part.value;
    if (part.kind === "qualifier") {
      const needle = `(${v.toLowerCase()})`;
      candidates = candidates.filter((f) => f.name.toLowerCase().includes(needle));
      filtered = true;
      continue;
    }
    if (v === "*") {
      const pool: TileFile[] = [];
      (current ? [...current.folders.values()] : []).forEach((sub) => pool.push(...sub.files));
      candidates = pool;
      current = null;
      continue;
    }
    if (/^\d+$/.test(v)) {
      index = parseInt(v, 10);
      continue;
    }
    // A pattern (`deciduous*`, `*sparse`): any file whose whole name fits it, picked at random.
    if (v.includes("*")) {
      const pattern = new RegExp(
        `^${v
          .toLowerCase()
          .split("*")
          .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*")}$`
      );
      candidates = candidates.filter((f) => pattern.test(f.name.toLowerCase()));
      filtered = true;
      continue;
    }
    const sub: TileFolder | undefined = !filtered && current ? findFolder(current, v) : undefined;
    if (sub) {
      current = sub;
      candidates = sub.files.length > 0 || sub.folders.size === 0 ? sub.files : allFiles(sub);
      continue;
    }
    const needle = v.toLowerCase();
    // A file named exactly so wins (`[deciduous]` isn't also `deciduous-sparse`); else any name containing it.
    const exact = candidates.filter((f) => f.name.toLowerCase() === needle);
    candidates = exact.length ? exact : candidates.filter((f) => f.name.toLowerCase().includes(needle));
    filtered = true;
  }
  if (candidates.length === 0) return null;
  const file =
    index !== null
      ? candidates[Math.min(index, candidates.length - 1)]
      : candidates[hashSeed(seed) % candidates.length];
  return { file, display: displayFor(pack.config, layer, file.path) };
}
