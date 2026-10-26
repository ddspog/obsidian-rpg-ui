/**
 * From a parsed hex map to what gets drawn: each line's tile picked from its
 * pack, placed on the hex: by height group, then layer (terrain with its base
 * just over it, covering the slab baked into the art; its edges such as
 * coasts, paths, then stacks on top), then top to bottom so a hex's slab and
 * overhang tuck under the hex below it.
 *
 * Height lifts: each step (`step:` metres, 100 by default) raises a hex by the
 * pack's step of slab. A raised hex stands on a slab per step, down to the
 * ground; its lower slabs draw with the ground's group, so the hexes in front
 * hide what they cover and its cliff shows wherever nothing in front is as high.
 *
 * Markers (`m(q,r)`) stand on their point, over the map: several on one
 * spot fan out. Labels (`l(q,r)`) are title banners put together to fit their text
 * (labels.ts), drawn over everything at their own spot, between hexes too.
 *
 * Two steps, both pure: `resolveHexMap` picks tiles (needs the packs),
 * `layoutHexMap` places them (needs each picked image's natural size).
 */

import { autotileFamily, pathColor, pathMouths, pickAutotileTurned, sideMask, type Surroundings } from "./autotile";
import { edgePieces } from "./edges";
import { hexCenter, hexKey, neighbour, pixelToHex, SIDES, type Side } from "./axial";
import {
  arcPath,
  composeLabel,
  withCase,
  wrapText,
  familyFiles,
  LABEL_FONT,
  type LabelFamily,
  labelFamilies,
  type LabelPiece,
  letteringFont,
} from "./labels";
import { MARKER_ANCHOR, MARKER_HEIGHT, markerTuning } from "./markers";
import type { HexCell, HexLabelLine, HexMapError, HexMarkerLine, ParsedHexMap } from "./parse-hex-map";
import { type DrawRegion, layoutRegions } from "./regions";
import { expandStamps } from "./stamps";
import {
  DEFAULT_STEP,
  type HexPack,
  type LabelTuning,
  type Layer,
  type TileDisplay,
  displayFor,
  groundOf,
  hashSeed,
  parseTileSpec,
  resolveCatalog,
  selectTile,
} from "./packs";

/** The built-in pack: plain colours, no images. */
export const FLAT_PACK = "flat";

/** Fill for a hex with no tile (the editor's terrain colours, plus a few). */
const TERRAIN_COLORS: Record<string, string> = {
  water: "#2196F3",
  ocean: "#1e6fb8",
  sea: "#2a7fc9",
  lake: "#4a9bd8",
  forest: "#2E7D32",
  mountain: "#795548",
  stone: "#8d8d8d",
  hills: "#9e9d24",
  plains: "#C0CA33",
  grass: "#4CAF50",
  grassland: "#66bb6a",
  desert: "#FF9800",
  snow: "#E3F2FD",
  swamp: "#388E3C",
  wetlands: "#4e7d55",
  urban: "#a1887f",
  city: "#a1887f",
};

/** A base draws with its hex's terrain, row by row, just over it: it covers the
 *  slab baked into the terrain art, and the next row's faces cover it in turn. */
const LAYER_RANK: Record<Layer, number> = {
  terrain: 0,
  base: 0,
  edge: 1,
  path: 2,
  stack: 3,
  marker: 4,
  label: 5,
  far: 3,
};
const OVER_TERRAIN: Record<Layer, number> = {
  terrain: 0,
  base: 1,
  edge: 0,
  path: 0,
  stack: 0,
  marker: 0,
  label: 0,
  far: 0,
};

/** Metres per height step when a map doesn't say. */
export const STEP_METRES = 100;

export interface ResolvedPick {
  cell: HexCell;
  /** Which copy of an `xN` line. */
  copy: number;
  url?: string;
  display?: TileDisplay;
  /** Tile file path inside the layer, for tooltips. */
  file?: string;
  /** Fill when there's no tile. */
  color?: string;
  /** A spec was written but no tile matched it. */
  missing?: boolean;
  /** A joined path with no tile for its sides: drawn as a stroke. */
  stroke?: { sides: Side[]; family: string };
  /** The sides a joined path connects (`N,SE`), for tooltips. */
  mask?: string;
  /** A base's slab, counted down from the hex's face (0 is the top one). */
  slab?: number;
  /** A terrain tile cropped to its face: it `hides` a baked-in base the hex has its own of. */
  crop?: boolean;
  /** A raised hex with no base: its own tile again this many steps down, only its slab showing. */
  under?: number;
  /** A path tile from another slot of its shape, turned this many sides clockwise into place. */
  turn?: number;
}

/** Terrain base names that count as water when a pack has no land / water sections (or no pack). */
const WATER = new Set(["water", "ocean", "sea", "lake"]);

export interface ResolvedLabel {
  line: HexLabelLine;
  text: string;
  /** Unset: no pack, or no such family — drawn as a plain tag. */
  family?: LabelFamily;
}

export interface ResolvedMarker {
  line: HexMarkerLine;
  /** Unset: no tile for its spec — drawn as a plain pin. */
  url?: string;
  file?: string;
  anchor: [number, number];
  size: number;
  /** Its caption's lettering style (`text=place`), when the pack has it. */
  captionStyle?: LabelTuning;
}

export interface ResolvedHexMap {
  map: ParsedHexMap;
  picks: ResolvedPick[];
  markers: ResolvedMarker[];
  labels: ResolvedLabel[];
  errors: HexMapError[];
  urls: string[];
  /** Hex keys whose terrain is water. */
  water: Set<string>;
  /** The pack's lettering styles, by name lower-cased (for regions' `label: { style }`). */
  letterings?: Record<string, LabelTuning>;
  /** Metres per height step, and a step's lift as a share of the hex width. */
  step: { metres: number; share: number };
}

/** A step's lift as a share of the hex width: the pack's `step` over its
 *  `hexWidth` (both whole-pack pixels), else `DEFAULT_STEP`. */
export function stepShare(pack: HexPack | undefined): number {
  const d = pack?.config.defaults;
  return d?.step !== undefined && d.hexWidth ? d.step / d.hexWidth : DEFAULT_STEP;
}

function fallbackColor(cell: HexCell, catalogColor?: string): string {
  if (cell.color) return cell.color;
  if (catalogColor) return catalogColor;
  const base = cell.spec ? parseTileSpec(cell.spec).base.toLowerCase() : "";
  return TERRAIN_COLORS[base] ?? TERRAIN_COLORS[cell.spec?.toLowerCase() ?? ""] ?? "#cfcfcf";
}

/** What each hex's terrain is (its last terrain line): its base name, land or water, and its tile's
 *  folder; paths are left for the caller. Also the water hexes. */
export function terrainAround(
  map: ParsedHexMap,
  pack: HexPack | undefined
): { around: Surroundings; water: Set<string> } {
  const around: Surroundings = { paths: new Map(), terrain: new Map(), ground: new Map(), folder: new Map() };
  const water = new Set<string>();
  for (const cell of map.cells) {
    if (!cell.spec || cell.layer !== "terrain") continue;
    const key = hexKey(cell.q, cell.r);
    const base = parseTileSpec(resolveCatalog(pack, cell.spec).spec).base.toLowerCase();
    around.terrain.set(key, base);
    // Land or water by the section of the tile it draws (the same pick as resolveHexMap's), else by name.
    const tile = pack ? selectTile(pack, "terrain", cell.spec, `${map.seed}:${cell.q},${cell.r}:terrain:0`) : null;
    const ground = (tile && groundOf(tile.file.path)) ?? (WATER.has(base) ? "water" : "land");
    around.ground.set(key, ground);
    const folder = tile?.file.path.split("/")[1]?.toLowerCase();
    if (folder) around.folder!.set(key, folder);
    else around.folder!.delete(key);
    if (ground === "water") water.add(key);
    else water.delete(key);
  }
  return { around, water };
}

export function resolveHexMap(parsed: ParsedHexMap, packs: Map<string, HexPack>, defaultPack: string): ResolvedHexMap {
  const packName = parsed.pack ?? defaultPack;
  const pack = packName === FLAT_PACK ? undefined : packs.get(packName);
  // Stamps put down first: from here on their lines are the map's.
  const map = parsed.stamps?.length ? expandStamps(parsed, pack?.config.stamps ?? {}) : parsed;
  const errors: HexMapError[] = [...map.errors];
  if (!pack && packName !== FLAT_PACK) {
    errors.push({
      line: 1,
      message: `pack "${packName}" not found${packs.size ? ` — packs: ${[...packs.keys()].join(", ")}` : " — no packs in the packs folder"}; drawing plain colours`,
    });
  }
  const picks: ResolvedPick[] = [];
  const urls = new Set<string>();

  // What surrounds each hex, for paths that join up and for coasts.
  const { around, water } = terrainAround(map, pack);
  for (const cell of map.cells) {
    if (!cell.spec || cell.layer !== "path") continue;
    const key = hexKey(cell.q, cell.r);
    const family =
      autotileFamily(pack, cell.spec) ?? parseTileSpec(resolveCatalog(pack, cell.spec).spec).base.toLowerCase();
    let set = around.paths.get(key);
    if (!set) around.paths.set(key, (set = new Set()));
    set.add(family);
  }

  // Where each joined path runs into what it connects to (a river's mouth into the sea), per family.
  const mouths = new Map<string, Map<string, Side>>();
  if (pack) {
    for (const cell of map.cells) {
      const family = cell.layer === "path" && cell.spec ? autotileFamily(pack, cell.spec) : null;
      if (!family || mouths.has(family)) continue;
      const order = map.cells
        .filter((c) => c.layer === "path" && c.spec && autotileFamily(pack, c.spec) === family)
        .map((c) => hexKey(c.q, c.r));
      const auto = pack.config.autotile[family];
      mouths.set(family, pathMouths(family, around, auto.connectsTo, order, auto.except));
    }
  }

  // Edges along the terrain (coasts), on the hex's terrain line, one pick per piece. A hex with
  // edges placed by hand (or `e(q,r): none`) keeps those instead, and a river's mouth parts the coast.
  if (pack && Object.keys(pack.config.edges).length) {
    const byHand = new Set(map.cells.filter((c) => c.layer === "edge" && c.spec).map((c) => hexKey(c.q, c.r)));
    // `e(q,r): hue=30` — no tile, only a colour for the coast the hex lays itself.
    const tints = new Map<string, HexCell>();
    for (const c of map.cells) if (c.layer === "edge" && !c.spec && c.look) tints.set(hexKey(c.q, c.r), c);
    const parted = new Map<string, Set<Side>>();
    const part = (key: string, side: Side) => {
      let set = parted.get(key);
      if (!set) parted.set(key, (set = new Set()));
      set.add(side);
    };
    for (const familyMouths of mouths.values())
      for (const [key, side] of familyMouths) {
        const [q, r] = key.split(",").map(Number);
        const water = neighbour({ q, r }, side);
        // The land hex's side (a coast laid outside) and the water hex's facing one (laid inside).
        part(key, side);
        part(hexKey(water.q, water.r), SIDES[(SIDES.indexOf(side) + 3) % 6]);
      }
    // The hex's last terrain line, as in `around`.
    const ground = new Map<string, HexCell>();
    for (const cell of map.cells) if (cell.layer === "terrain" && cell.spec) ground.set(hexKey(cell.q, cell.r), cell);
    for (const [key, cell] of ground) {
      if (byHand.has(key)) continue;
      const pieces = edgePieces(pack, cell, around, `${map.seed}:${key}:edge`, parted.get(key));
      for (const [copy, piece] of pieces.entries()) {
        urls.add(piece.file.url);
        picks.push({
          // The terrain line's look is its own tile's: the coast takes only its tint line's colour.
          cell: { ...cell, layer: "edge", spec: piece.family, count: 1, look: tints.get(key)?.look },
          copy,
          url: piece.file.url,
          display: displayFor(pack.config, "edge", piece.file.path),
          file: piece.file.path,
        });
      }
    }
  }

  // Bases: under each hex's top terrain (or a hex with only a `b` line), from
  // its own `b` line, its height group's `base=`, or the pack's `base:`.
  const metres = map.step ?? STEP_METRES;
  const stepsOf = (height: number) => Math.round(height / metres);
  const top = new Map<string, HexCell>();
  const own = new Map<string, HexCell>();
  for (const cell of map.cells) {
    const key = hexKey(cell.q, cell.r);
    if (cell.layer === "base") own.set(key, cell);
    else if (cell.layer === "terrain" && (!top.has(key) || cell.height >= top.get(key)!.height)) top.set(key, cell);
  }
  // A raised hex stands on its own stack, all the way down to the ground: hexes in front hide what they cover.
  const dropOf = (at: HexCell): number => Math.max(1, stepsOf(at.height));
  const based = new Set<string>();
  const missingBase = new Set<string>();
  for (const key of new Set([...top.keys(), ...own.keys()])) {
    const ground = top.get(key);
    const line = own.get(key);
    const spec = line?.spec ?? ground?.groupBase ?? pack?.config.base;
    const at = (ground ?? line)!;
    if (!spec || !pack) continue;
    const drop = dropOf(at);
    const cell: HexCell = { ...at, layer: "base", spec, count: 1, line: line?.line ?? at.line };
    const picked = selectTile(pack, "base", spec, `${map.seed}:${key}:base`);
    if (!picked) {
      // A group's or the pack's base is reported once, not on every hex.
      const where = line ? `line ${line.line}` : spec;
      if (!missingBase.has(where)) {
        missingBase.add(where);
        errors.push({ line: cell.line, message: `no base tile for "${spec}" in pack "${packName}"` });
      }
      continue;
    }
    based.add(key);
    urls.add(picked.file.url);
    // The lowest slab first, so the top one draws over it.
    for (let slab = drop - 1; slab >= 0; slab--) {
      picks.push({
        cell,
        copy: drop - 1 - slab,
        slab,
        url: picked.file.url,
        display: picked.display,
        file: picked.file.path,
      });
    }
  }

  for (const cell of map.cells) {
    if (cell.layer === "base") continue;
    // `e(q,r): none` only turns the hex's own coast off.
    if (cell.layer === "edge" && cell.spec?.toLowerCase() === "none") continue;
    const catalog = cell.spec ? resolveCatalog(pack, cell.spec) : undefined;
    const family = cell.layer === "path" && cell.spec ? autotileFamily(pack, cell.spec) : null;
    if (family && pack) {
      const familyMouths = mouths.get(family) ?? new Map<string, Side>();
      const sides = sideMask(cell, family, around, familyMouths);
      const mask = sides.join(",");
      const mouth = familyMouths.get(hexKey(cell.q, cell.r));
      const found = pickAutotileTurned(pack, family, sides, `${map.seed}:${cell.q},${cell.r}:path`, mouth);
      if (found) {
        const { file, turn } = found;
        urls.add(file.url);
        picks.push({
          cell,
          copy: 0,
          url: file.url,
          display: displayFor(pack.config, "path", file.path),
          file: file.path,
          mask,
          ...(turn ? { turn } : {}),
        });
      } else {
        picks.push({ cell, copy: 0, stroke: { sides, family }, mask });
      }
      continue;
    }
    for (let copy = 0; copy < cell.count; copy++) {
      if (!cell.spec) {
        if (cell.color && copy === 0) picks.push({ cell, copy, color: cell.color });
        continue;
      }
      const seed = `${map.seed}:${cell.q},${cell.r}:${cell.layer}:${copy}`;
      const picked = pack ? selectTile(pack, cell.layer, cell.spec, seed) : null;
      if (picked) {
        urls.add(picked.file.url);
        const key = hexKey(cell.q, cell.r);
        // The top terrain of a hex with a base of its own drops its baked-in one.
        const crop = cell.layer === "terrain" && !!picked.display.hides && based.has(key) && top.get(key) === cell;
        // A raised hex with no base repeats its tile's baked-in slab down to its front neighbours,
        // lowest first, so it stands on a cliff rather than floating over a gap.
        if (
          cell.layer === "terrain" &&
          cell.count === 1 &&
          !picked.display.clip &&
          !based.has(key) &&
          top.get(key) === cell
        ) {
          const file = { url: picked.file.url, display: picked.display, file: picked.file.path };
          for (let under = dropOf(cell) - 1; under >= 1; under--) picks.push({ cell, copy: -under, under, ...file });
        }
        picks.push({ cell, copy, url: picked.file.url, display: picked.display, file: picked.file.path, crop });
      } else if (copy === 0) {
        const missing = !!pack;
        if (missing) {
          errors.push({ line: cell.line, message: `no ${cell.layer} tile for "${cell.spec}" in pack "${packName}"` });
        }
        // Stacks and paths without a tile have nothing sensible to fill.
        if (cell.layer === "terrain") picks.push({ cell, copy, color: fallbackColor(cell, catalog?.color), missing });
      }
    }
  }
  // Markers: one tile each, standing on its anchor.
  const markers: ResolvedMarker[] = [];
  const styles = labelFamilies(pack);
  for (const line of map.markers ?? []) {
    const picked = pack && line.spec ? selectTile(pack, "marker", line.spec, `${map.seed}:${line.line}:marker`) : null;
    if (pack && line.spec && !picked) {
      errors.push({
        line: line.line,
        message: `no marker for "${line.spec}" in pack "${packName}"; drawing a plain pin`,
      });
    }
    const tuning = picked ? markerTuning(pack, picked.file.path) : {};
    if (picked) urls.add(picked.file.url);
    const styleName = line.caption?.style?.toLowerCase();
    const captionStyle = styleName ? styles.get(styleName) : undefined;
    if (styleName && pack && !captionStyle?.lettering)
      errors.push({ line: line.line, message: `no lettering style "${line.caption?.style}" for the caption` });
    markers.push({
      ...(captionStyle?.lettering ? { captionStyle: captionStyle.tuning } : {}),
      line,
      url: picked?.file.url,
      file: picked?.file.path,
      anchor: tuning.anchor ?? MARKER_ANCHOR,
      size: line.size * (tuning.size ?? 1),
    });
  }

  // Labels: every piece of the family is measured, since the text decides which get drawn.
  const families = labelFamilies(pack);
  const firstFamily = [...families.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
  const labels: ResolvedLabel[] = [];
  for (const line of map.labels ?? []) {
    const name = line.family?.toLowerCase() ?? firstFamily;
    const family = name ? families.get(name) : undefined;
    if (line.family && pack && !family) {
      const known = [...families.values()]
        .map((f) => f.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      errors.push({
        line: line.line,
        message: `no label family "${line.family}" in pack "${packName}"${known.length ? ` — families: ${known.join(", ")}` : ""}; drawing a plain tag`,
      });
    }
    if (family) for (const f of familyFiles(family)) urls.add(f.url);
    labels.push({ line, text: line.text ?? linkLabel(line.link ?? ""), family });
  }
  const letterings: Record<string, LabelTuning> = {};
  for (const [name, family] of families) if (family.lettering) letterings[name] = family.tuning;
  return {
    map,
    picks,
    markers,
    labels,
    errors,
    urls: [...urls],
    water,
    letterings,
    step: { metres, share: stepShare(pack) },
  };
}

export interface ImageSize {
  w: number;
  h: number;
}

export interface DrawTile {
  kind: "tile";
  key: string;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Clipped to its hex (flat textures). */
  clip: boolean;
  /** Cropped to the hex face centred here (terrain that `hides` its baked-in base). */
  crop?: { cx: number; cy: number };
  /** Mirrored left to right about this x (every other slab of a base, for variety). */
  flipX?: number;
  /** Only the part below this y shows (a raised hex's tile repeated as its slab). */
  below?: number;
  /** Turned about the hex's centre (a path tile standing in for a missing slot). */
  rotate?: { deg: number; cx: number; cy: number };
  /** A faint neighbour's: drawn dimmed. */
  faint?: boolean;
  /** A colour filter from the line's `hue=` / `sat=` / `bright=`: its key in `HexLayout.filters`. */
  filter?: string;
}

/** A `hue=` / `sat=` / `bright=` set, drawn as one shared SVG filter. */
export interface DrawFilter {
  key: string;
  hue: number;
  sat: number;
  bright: number;
}

export interface DrawFill {
  kind: "fill";
  key: string;
  cx: number;
  cy: number;
  color: string;
  missing: boolean;
}

/** A joined path with no tile for its sides: centre to each side's middle. */
export interface DrawStroke {
  kind: "stroke";
  key: string;
  cx: number;
  cy: number;
  sides: Side[];
  color: string;
  /** The line's colour filter, as a tile's. */
  filter?: string;
}

export interface HexInfo {
  q: number;
  r: number;
  /** The face's centre, lifted by the hex's height. */
  cx: number;
  cy: number;
  height: number;
  specs: Array<{ layer: Layer; spec?: string; file?: string; mask?: string; line: number }>;
  label?: string;
  link?: string;
  regions: string[];
  /** Only a faint neighbour's lines are on it. */
  faint?: boolean;
  /** The regions a faint neighbour puts it in: drawn, not this map's to edit. */
  faintRegions?: string[];
}

export interface DrawLabel {
  key: string;
  x: number;
  y: number;
  text: string;
  link?: string;
}

/** A marker's caption size, in hex circumradii, and the face it's measured in. */
export const MARKER_CAPTION = 0.28;
const CAPTION_FONT = "system-ui, sans-serif";

/** A marker standing on its point (`x`, `y`): the image's anchor sits there. */
export interface DrawMarker {
  key: string;
  x: number;
  y: number;
  /** None: a plain pin (no tile for its spec). */
  url?: string;
  /** The image's box, in layout units. */
  box: { x: number; y: number; w: number; h: number };
  text?: string;
  /** How the caption is drawn: where (its middle), its size and letters, and its arc. */
  caption?: {
    x: number;
    y: number;
    size: number;
    font: string;
    weight: number;
    italic: boolean;
    color?: string;
    /** A colour, or `false` for no outline; unset: the stylesheet's. */
    halo?: string | false;
    arc?: string;
    case?: "upper" | "title" | "lower" | "none";
    rot?: number;
    spacing?: number;
    /** Broken onto these lines (its width), already in its case. */
    lines?: string[];
  };
  link?: string;
  spec?: string;
  /** A faint neighbour's: drawn dimmed. */
  faint?: boolean;
  line: number;
}

/** A label: its banner's pieces in the banner's own pixels, scaled and turned onto the map. */
export interface DrawBanner {
  key: string;
  /** The banner's centre, in layout units. */
  cx: number;
  cy: number;
  /** Degrees, clockwise. */
  rot: number;
  /** Layout units per banner pixel. */
  scale: number;
  w: number;
  h: number;
  /** None: a plain tag (no pack, or no such family). */
  pieces: LabelPiece[];
  text: { value: string; x: number; y: number; size: number; color?: string; font: string };
  /** Lettering (no banner, no tag): how the letters are drawn. */
  lettering?: { weight: number; italic: boolean; halo?: string; spacing?: number; arc?: string; lines?: string[] };
  link?: string;
  /** A faint neighbour's: drawn dimmed. */
  faint?: boolean;
  line: number;
}

export interface HexLayout {
  R: number;
  items: Array<DrawTile | DrawFill | DrawStroke>;
  markers: DrawMarker[];
  banners: DrawBanner[];
  regions: DrawRegion[];
  /** Colour filters the tiles use, by key. */
  filters: DrawFilter[];
  /** Hex outlines (terrain hexes whose tile asks for a border). */
  borders: Array<{ key: string; cx: number; cy: number; width: number }>;
  labels: DrawLabel[];
  hexes: Map<string, HexInfo>;
  bounds: { x: number; y: number; w: number; h: number };
}

/** Layout units per hex circumradius; the SVG scales to fit anyway. */
export const HEX_R = 40;

/** A label's banner height at `size=1`, in hex circumradii. */
export const LABEL_HEIGHT = 1.1;

/** A text's width in ems (at a font size of 1), for fitting banners to it. */
/** A text's width in ems, in a font (CSS family), at a weight (600, banner text, unless given). */
export type MeasureEm = (text: string, font: string, weight?: number, italic?: boolean) => number;

/** Without a way to measure (tests, no DOM): an average serif letter. */
export const roughEm: MeasureEm = (text) => text.length * 0.55;

function linkLabel(link: string): string {
  const [target, alias] = link.split("|");
  return (alias ?? target.split("#")[0].split("/").pop() ?? target).trim();
}

export function layoutHexMap(
  resolved: ResolvedHexMap,
  sizes: Map<string, ImageSize>,
  R = HEX_R,
  measureEm: MeasureEm = roughEm
): HexLayout {
  const hexes = new Map<string, HexInfo>();
  const halfH = (Math.sqrt(3) / 2) * R;
  // A step's lift in layout units; a cell at `height` metres is raised by its steps of it.
  const { metres, share } = resolved.step ?? { metres: STEP_METRES, share: DEFAULT_STEP };
  const stepUnits = share * 2 * R;
  const liftOf = (height: number) => Math.round(height / metres) * stepUnits;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };

  for (const cell of resolved.map.cells) {
    const key = hexKey(cell.q, cell.r);
    const { x, y } = hexCenter(cell.q, cell.r, R);
    let info = hexes.get(key);
    if (!info) {
      info = { q: cell.q, r: cell.r, cx: x, cy: y, height: cell.height, specs: [], regions: [], faint: !!cell.faint };
      hexes.set(key, info);
    } else if (!cell.faint) info.faint = false;
    info.height = Math.max(info.height, cell.height);
    info.specs.push({ layer: cell.layer, spec: cell.spec, line: cell.line });
    if (cell.label) info.label = cell.label;
    if (cell.link) info.link = cell.link;
    for (const r of cell.regions) if (!info.regions.includes(r)) info.regions.push(r);
    for (const r of cell.faintRegions ?? []) {
      info.faintRegions ??= [];
      if (!info.faintRegions.includes(r)) info.faintRegions.push(r);
    }
  }
  for (const info of hexes.values()) {
    info.cy -= liftOf(info.height);
    if (!info.faint) grow(info.cx - R, info.cy - halfH, info.cx + R, info.cy + halfH);
  }

  type Sorted = { order: [number, number, number, number, number, number]; item: DrawTile | DrawFill | DrawStroke };
  const sorted: Sorted[] = [];
  const borders: HexLayout["borders"] = [];
  const filters = new Map<string, DrawFilter>();
  const filterOf = (cell: HexCell): string | undefined => {
    const hue = cell.look?.hue ?? 0;
    const sat = cell.look?.sat ?? 1;
    const bright = cell.look?.bright ?? 1;
    if (!hue && sat === 1 && bright === 1) return undefined;
    const key = `h${hue}s${sat}b${bright}`.replace(/[^a-z0-9]/gi, "_");
    if (!filters.has(key)) filters.set(key, { key, hue, sat, bright });
    return key;
  };
  for (const pick of resolved.picks) {
    const { cell, copy } = pick;
    const key = `${cell.q},${cell.r}:${cell.layer}:${cell.line}:${copy}`;
    const { x: cx, y: row } = hexCenter(cell.q, cell.r, R);
    const cy = row - liftOf(cell.height);
    // A raised hex's lower slabs draw with the ground, row by row: behind the hexes in front of it
    // whatever their height, over the ones behind it.
    const group = pick.slab || pick.under ? Math.min(0, cell.height) : cell.height;
    const order: Sorted["order"] = [group, LAYER_RANK[cell.layer], row, cx, OVER_TERRAIN[cell.layer], copy];
    const info = hexes.get(hexKey(cell.q, cell.r));
    if (info && (pick.file || pick.mask !== undefined)) {
      let spec = info.specs.find((s) => s.line === cell.line && s.layer === cell.layer);
      // A base from the hex's group or the pack has no line of its own: listed under the terrain's.
      if (!spec && cell.layer === "base") {
        spec = { layer: "base", spec: cell.spec, line: cell.line };
        info.specs.unshift(spec);
      }
      if (spec) {
        spec.file = pick.file;
        spec.mask = pick.mask;
      }
    }
    if (pick.stroke) {
      const color = pathColor(pick.stroke.family);
      sorted.push({
        order,
        item: { kind: "stroke", key, cx, cy, sides: pick.stroke.sides, color, filter: filterOf(cell) },
      });
      continue;
    }
    if (!pick.url || !pick.display) {
      sorted.push({
        order,
        item: { kind: "fill", key, cx, cy, color: pick.color ?? "#cfcfcf", missing: !!pick.missing },
      });
      continue;
    }
    const d = pick.display;
    if (cell.layer === "terrain" && d.borderWidth > 0 && copy === 0)
      borders.push({ key, cx, cy, width: d.borderWidth });
    const filter = filterOf(cell);
    if (d.clip) {
      sorted.push({
        order,
        item: {
          kind: "tile",
          key,
          url: pick.url,
          x: cx - R,
          y: cy - halfH,
          w: 2 * R,
          h: 2 * halfH,
          clip: true,
          filter,
        },
      });
      continue;
    }
    const size = sizes.get(pick.url);
    if (!size) continue;
    const scale = ((2 * R) / (d.hexWidth ?? size.w)) * d.zoom;
    const w = size.w * scale;
    const h = size.h * scale;
    let ox = d.offsetX * scale;
    // A base's lower slabs stack a step apart below the top one.
    let oy = d.offsetY * scale + (pick.slab ?? pick.under ?? 0) * stepUnits;
    if (cell.count > 1) {
      // Scatter copies inside the hex's inner circle, the same way each time.
      const hsh = hashSeed(`${resolved.map.seed}:${key}`);
      const angle = ((hsh % 3600) / 3600) * Math.PI * 2 + (copy * Math.PI * 2) / cell.count;
      const radius = 0.45 * R * (0.55 + ((hsh >>> 12) % 100) / 220);
      ox += Math.cos(angle) * radius;
      oy += Math.sin(angle) * radius * 0.8;
    }
    // The line's own look: scaled about the hex centre, then shifted (in hex widths).
    const grown = cell.look?.size ?? 1;
    const [sx, sy] = cell.look?.shift ?? [0, 0];
    const x = cx + (ox - w / 2) * grown + sx * 2 * R;
    const y = cy + (oy - h / 2) * grown + sy * 2 * R;
    const sw = w * grown;
    const sh = h * grown;
    // A map fits its own hexes: faint neighbours show around them, panned or zoomed out to.
    if (!cell.faint) grow(x, y, x + sw, y + sh);
    const crop = pick.crop ? { cx, cy } : undefined;
    // Under the hex's face centre the face above covers all but the slab; above it, art like peaks would peek out.
    const below = pick.under ? cy : undefined;
    // A flat-top hex is the same mirrored, so every other slab turns over and a tall cliff doesn't repeat.
    const flipX = pick.slab !== undefined && pick.slab % 2 === 1 ? cx : undefined;
    const rotate = pick.turn ? { deg: 60 * pick.turn, cx, cy } : undefined;
    sorted.push({
      order,
      item: {
        kind: "tile",
        key,
        url: pick.url,
        x,
        y,
        w: sw,
        h: sh,
        clip: false,
        crop,
        below,
        flipX,
        filter,
        rotate,
        ...(cell.faint ? { faint: true } : {}),
      },
    });
  }
  sorted.sort((a, b) => {
    for (let i = 0; i < a.order.length; i++) if (a.order[i] !== b.order[i]) return a.order[i] - b.order[i];
    return 0;
  });

  const labels: DrawLabel[] = [];
  for (const [key, info] of hexes) {
    const text = info.label ?? (info.link ? linkLabel(info.link) : undefined);
    if (text) labels.push({ key, x: info.cx, y: info.cy + halfH * 0.62, text, link: info.link });
  }

  // Markers on one spot fan out sideways, centred on it.
  const markers: DrawMarker[] = [];
  const spots = new Map<string, ResolvedMarker[]>();
  for (const m of resolved.markers ?? []) {
    const spot = `${m.line.q.toFixed(2)},${m.line.r.toFixed(2)}`;
    spots.set(spot, [...(spots.get(spot) ?? []), m]);
  }
  for (const group of spots.values()) {
    // Each takes the room of its picture or its caption, whichever is wider, side by side.
    const placed = group.map((m) => {
      const h = MARKER_HEIGHT * R * m.size;
      const size = m.url ? sizes.get(m.url) : undefined;
      const w = size ? (h * size.w) / size.h : h * 0.6;
      const cs = m.captionStyle;
      const font = cs ? letteringFont(cs) : { family: CAPTION_FONT, weight: 600, italic: false };
      const capSize = MARKER_CAPTION * R * (m.line.caption?.size ?? 1);
      // In its case and spacing, broken onto lines when it has a width (a bent one stays on one).
      const cap = m.line.caption;
      const em = (t: string) => measureEm(t, font.family, font.weight, font.italic) + (cap?.spacing ?? 0) * t.length;
      const shown = withCase(m.line.text ?? "", cap?.case);
      const capLines =
        m.line.text && cap?.width && !cap.arc ? wrapText(shown, (cap.width * R) / capSize, em) : undefined;
      const capW = m.line.text ? Math.max(...(capLines ?? [shown]).map(em)) * capSize : 0;
      // A caption moved off the marker doesn't widen its room.
      const moved = !!cap?.offset;
      return { m, h, w, size, font, capSize, capW, capLines, room: Math.max(w, moved ? 0 : capW) + R * 0.12 };
    });
    const total = placed.reduce((n, p) => n + p.room, 0);
    let left = -total / 2;
    for (const { m, h, w, size, room, font, capSize, capW, capLines } of placed) {
      const { line } = m;
      const at = hexCenter(line.q, line.r, R);
      const x = at.x + left + room / 2;
      left += room;
      const y = at.y;
      const box = { x: x - w * m.anchor[0], y: y - h * m.anchor[1], w, h };
      markers.push({
        key: `marker:${line.line}`,
        x,
        y,
        url: size ? m.url : undefined,
        box,
        text: line.text,
        ...(line.text
          ? {
              caption: (() => {
                const [dx, dy] = line.caption?.offset ?? [0, 0];
                const bend = line.caption?.arc ? arcPath(capW, line.caption.arc) : null;
                return {
                  x: x + dx * R,
                  y: y + R * 0.2 + dy * R,
                  size: capSize,
                  font: font.family,
                  weight: font.weight,
                  italic: font.italic,
                  color: line.caption?.color ?? m.captionStyle?.color,
                  halo: line.caption?.halo ?? m.captionStyle?.halo,
                  arc: bend && bend.sag > 0 ? bend.d : undefined,
                  case: line.caption?.case,
                  rot: line.caption?.rot,
                  spacing: line.caption?.spacing,
                  ...(capLines && capLines.length > 1 ? { lines: capLines } : {}),
                };
              })(),
            }
          : {}),
        link: line.link,
        spec: line.spec,
        ...(line.faint ? { faint: true } : {}),
        line: line.line,
      });
      // A faint neighbour's markers are drawn where the map reaches, not reached for.
      if (line.faint) continue;
      grow(box.x, box.y, box.x + w, box.y + h + (line.text ? R * 0.4 : 0));
      if (line.text && line.caption?.offset) {
        const cx = x + line.caption.offset[0] * R;
        const cy = y + R * 0.2 + line.caption.offset[1] * R;
        grow(cx - capW / 2, cy - capSize, cx + capW / 2, cy + capSize);
      }
    }
  }

  const banners: DrawBanner[] = [];
  for (const [i, label] of (resolved.labels ?? []).entries()) {
    const { line, family, text } = label;
    const { x: cx, y: cy } = hexCenter(line.q, line.r, R);
    const font = family?.tuning.font ?? LABEL_FONT;
    const em = measureEm(text, font);
    const height = LABEL_HEIGHT * R * line.size;
    const key = `label:${line.line}:${i}`;
    const composed = family ? composeLabel(family, em, (url) => sizes.get(url), `${resolved.map.seed}:${key}`) : null;
    const color = line.color ?? family?.tuning.color;
    const at = { key, cx, cy, rot: line.rot, link: line.link, line: line.line };
    let banner: DrawBanner;
    if (family?.lettering) {
      // Just the letters: size=1 is letters half a hex across the flats tall.
      const lf = letteringFont(family.tuning);
      const size = LABEL_HEIGHT * R * line.size * 0.6;
      const spacing = line.spacing ?? family.tuning.spacing ?? 0;
      const em = (t: string) => measureEm(t, lf.family, lf.weight, lf.italic) + spacing * t.length;
      // In its case; broken onto lines at its width (a bent one stays on one line).
      const shown = withCase(text, line.case);
      const lines = line.width && !line.arc ? wrapText(shown, (line.width * R) / size, em) : [shown];
      const w = Math.max(...lines.map(em)) * size;
      const bend = line.arc ? arcPath(w, line.arc) : null;
      const h = size * (1.25 + 1.05 * (lines.length - 1)) + (bend?.sag ?? 0);
      banner = {
        ...at,
        scale: 1,
        w,
        h,
        pieces: [],
        text: { value: shown, x: w / 2, y: h / 2, size, color, font: lf.family },
        lettering: {
          weight: lf.weight,
          italic: lf.italic,
          halo: line.halo === false ? "none" : (line.halo ?? family.tuning.halo),
          spacing: spacing || undefined,
          arc: bend && bend.sag > 0 ? bend.d : undefined,
          ...(lines.length > 1 ? { lines } : {}),
        },
      };
    } else if (composed) {
      const { w, h, pieces, text: t } = composed;
      banner = { ...at, scale: height / h, w, h, pieces, text: { value: text, ...t, color, font } };
    } else {
      // A plain tag in layout units.
      const size = height * 0.42;
      const w = em * size + height * 0.7;
      banner = {
        ...at,
        scale: 1,
        w,
        h: height * 0.7,
        pieces: [],
        text: { value: text, x: w / 2, y: (height * 0.7) / 2, size, color, font },
      };
    }
    if (line.faint) {
      banners.push({ ...banner, faint: true });
      continue;
    }
    banners.push(banner);
    // Its corners, turned, for the map's bounds.
    const a = (line.rot * Math.PI) / 180;
    const hw = (banner.w * banner.scale) / 2;
    const hh = (banner.h * banner.scale) / 2;
    const ex = Math.abs(hw * Math.cos(a)) + Math.abs(hh * Math.sin(a));
    const ey = Math.abs(hw * Math.sin(a)) + Math.abs(hh * Math.cos(a));
    grow(cx - ex, cy - ey, cx + ex, cy + ey);
  }

  // A faint neighbour's hexes count too, so a realm's border runs on past the map's own hexes.
  const members = new Map<string, Set<string>>();
  const own = new Set<string>();
  for (const [key, info] of hexes) {
    for (const name of [...info.regions, ...(info.faint ? (info.faintRegions ?? []) : [])]) {
      let set = members.get(name);
      if (!set) members.set(name, (set = new Set()));
      set.add(key);
      if (!info.faint) own.add(name);
    }
  }
  // One only on faint hexes is a neighbour's: drawn dimmed.
  const regions = layoutRegions(members, resolved.map.regions, resolved.water, R, (key) => {
    const info = hexes.get(key);
    return info ? liftOf(info.height) : 0;
  }).map((g) => (own.has(g.name) ? g : { ...g, faint: true }));
  // A region named in a lettering style takes its letters; one with a width breaks onto lines.
  for (const g of regions) {
    const look = g.labelLook ?? {};
    const style = look.style?.toLowerCase();
    const tuning = style ? resolved.letterings?.[style] : undefined;
    if (tuning) g.labelFont = { ...letteringFont(tuning), color: tuning.color, halo: tuning.halo };
    if ((look.width || look.arc) && g.title) {
      const border = g.labelAt === "border" || g.labelAt === "bottom";
      const size = R * (border ? 0.24 : g.depth > 0 ? 0.42 : 0.55) * (look.size ?? 1);
      const kase = regionCase(look, !!g.labelFont);
      const font = g.labelFont ?? { family: "system-ui, sans-serif", weight: 800, italic: false };
      // Capitals drawn by the stylesheet are spaced 0.12em unless the label says.
      const spacing = look.spacing ?? (g.labelFont ? 0 : 0.12);
      const em = (t: string) => measureEm(t, font.family, font.weight, font.italic) + spacing * t.length;
      const shown = withCase(g.title, kase);
      // Bent: as long as the name is, measured; else broken onto lines at its width.
      if (look.arc) g.labelEm = em(shown);
      else {
        const lines = wrapText(shown, (look.width! * R) / size, em);
        if (lines.length > 1) g.labelLines = lines;
      }
    }
  }

  if (!Number.isFinite(minX)) {
    minX = minY = 0;
    maxX = maxY = 1;
  }
  const pad = R * 0.3;
  return {
    R,
    items: sorted.map((s) => s.item),
    markers,
    banners,
    regions,
    filters: [...filters.values()],
    borders,
    labels,
    hexes,
    bounds: { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad },
  };
}

/** The hex drawn under a point: raised hexes sit above their grid cell, so the
 *  cell's own hex and those around it are tried, nearest lifted face first. */
/** How a region's name is cased: its `case`, else its older `caps`, else capitals unless it has a lettering style. */
export function regionCase(
  look: { case?: "upper" | "title" | "lower" | "none"; caps?: boolean },
  lettered: boolean
): "upper" | "title" | "lower" | "none" {
  return look.case ?? (look.caps === undefined ? (lettered ? "none" : "upper") : look.caps ? "upper" : "none");
}

export function hexAt(layout: HexLayout, x: number, y: number): HexInfo | null {
  const h = pixelToHex(x, y, layout.R);
  const near = [h, ...SIDES.map((side) => neighbour(h, side)), neighbour(neighbour(h, "S"), "S")];
  let best: HexInfo | null = null;
  let bestD = Infinity;
  for (const n of near) {
    const info = layout.hexes.get(hexKey(n.q, n.r));
    if (!info) continue;
    const d = Math.hypot(info.cx - x, info.cy - y);
    if (d < bestD) {
      best = info;
      bestD = d;
    }
  }
  return best && bestD <= layout.R ? best : null;
}
