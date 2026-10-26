/**
 * Texture packs: the tile tree, `pack.yml`, and which tile a spec picks.
 *
 * A pack is one vault folder: `<pack>/{terrain,path,stack}/<folder>/…/<file>`
 * (terrain may instead sit in `land/` and `water/` at the top)
 * plus `pack.yml`. Specs are the hex-map-editor's, with one addition:
 *
 *   forest                  files directly in `forest/` (all below it if none)
 *   forest[lush]            a subfolder
 *   forest[lush][conifer]   then names containing "conifer"
 *   forest[*]               files of any one level of subfolders
 *   plains[2]               the third match
 *   plains(dry)             names containing "(dry)" — the pack's biome names
 *   dry-plains              a `catalog:` name from pack.yml
 *
 * A random pick is seeded by the hex, so a hex keeps its variant.
 */

import { parse as parseYaml } from "yaml";

export type Layer = "terrain" | "path" | "stack";
export const LAYERS: Layer[] = ["terrain", "path", "stack"];

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
}

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
  /** Paths that join up, by family (`roads`, `rivers`): see autotile.ts. */
  autotile: Record<string, AutotileFamily>;
}

export interface AutotileFamily {
  /** Side combination (`N,SE`, sides in N,NE,SE,S,SW,NW order) → tile paths
   *  in the path layer, without extension. */
  tiles: Record<string, string[]>;
  /** Terrain folders a path also runs into (a river into `water`). */
  connectsTo: string[];
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

const DISPLAY_KEYS: Array<keyof TileDisplay> = ["hexWidth", "zoom", "offsetX", "offsetY", "borderWidth", "clip"];

function pickDisplay(raw: unknown): Partial<TileDisplay> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Partial<TileDisplay> = {};
  for (const key of DISPLAY_KEYS) {
    const v = src[key];
    if (key === "clip") {
      if (typeof v === "boolean") out.clip = v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = v;
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
    const o = v as { tiles?: unknown; connectsTo?: unknown };
    const tiles: Record<string, string[]> = {};
    if (o.tiles && typeof o.tiles === "object") {
      for (const [mask, t] of Object.entries(o.tiles as Record<string, unknown>)) {
        const list = (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
        if (list.length) tiles[canonicalMask(mask)] = list;
      }
    }
    const connectsTo = (Array.isArray(o.connectsTo) ? o.connectsTo : []).filter(
      (x): x is string => typeof x === "string"
    );
    out[family] = { tiles, connectsTo };
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
    autotile: readAutotile(raw.autotile),
  };
}

/** The display for one tile: defaults → layer → folder → file. */
export function displayFor(config: PackConfig, layer: Layer, path: string): TileDisplay {
  const top = path.split("/")[0];
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
    let layer = parts.shift() as Layer;
    // A pack may keep its terrain in two sections at the top, `land/` and
    // `water/`, in place of `terrain/`. Land's folders (`forest`, `hills`) sit
    // at the terrain's root, as they do under `terrain/`; water keeps its own
    // name as the folder (`water[ocean]`), and `pack.yml` still names a tile
    // by its section (`land/mountain/rocky/peak`).
    let tilePath: string | null = null;
    if ((layer as string) === "land" || (layer as string) === "water") {
      if (layer === ("water" as Layer)) parts.unshift("water");
      else tilePath = path;
      layer = "terrain";
    }
    if (!LAYERS.includes(layer) || parts.length < 2) continue;
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
    folder.files.push({ name: base, path: tilePath ? tilePath.replace(IMAGE, "") : [...parts, base].join("/"), url });
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
  const root = findFolder(pack.layers[layer], base);
  if (!root) return null;
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
    const sub: TileFolder | undefined = !filtered && current ? findFolder(current, v) : undefined;
    if (sub) {
      current = sub;
      candidates = sub.files.length > 0 || sub.folders.size === 0 ? sub.files : allFiles(sub);
      continue;
    }
    const needle = v.toLowerCase();
    candidates = candidates.filter((f) => f.name.toLowerCase().includes(needle));
    filtered = true;
  }
  if (candidates.length === 0) return null;
  const file =
    index !== null
      ? candidates[Math.min(index, candidates.length - 1)]
      : candidates[hashSeed(seed) % candidates.length];
  return { file, display: displayFor(pack.config, layer, file.path) };
}
