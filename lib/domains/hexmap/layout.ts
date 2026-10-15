/**
 * From a parsed hex map to what gets drawn: each line's tile picked from its
 * pack, placed on the hex, in the order the hex-map-editor documents —
 * height group, then layer (terrain under stacks under paths), then top to
 * bottom so a hex's slab and overhang tuck under the hex below it.
 *
 * Two steps, both pure: `resolveHexMap` picks tiles (needs the packs),
 * `layoutHexMap` places them (needs each picked image's natural size).
 */

import { autotileFamily, pathColor, pathMouths, pickAutotile, sideMask, type Surroundings } from "./autotile";
import { hexCenter, hexKey, type Side } from "./axial";
import type { HexCell, HexMapError, ParsedHexMap } from "./parse-hex-map";
import { type DrawRegion, layoutRegions } from "./regions";
import {
  type HexPack,
  type Layer,
  type TileDisplay,
  displayFor,
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

const LAYER_RANK: Record<Layer, number> = { terrain: 0, stack: 1, path: 2 };

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
}

/** Terrain base names that count as water (coasts, rivers' mouths). */
const WATER = new Set(["water", "ocean", "sea", "lake"]);

export interface ResolvedHexMap {
  map: ParsedHexMap;
  picks: ResolvedPick[];
  errors: HexMapError[];
  urls: string[];
  /** Hex keys whose terrain is water. */
  water: Set<string>;
}

function fallbackColor(cell: HexCell, catalogColor?: string): string {
  if (cell.color) return cell.color;
  if (catalogColor) return catalogColor;
  const base = cell.spec ? parseTileSpec(cell.spec).base.toLowerCase() : "";
  return TERRAIN_COLORS[base] ?? TERRAIN_COLORS[cell.spec?.toLowerCase() ?? ""] ?? "#cfcfcf";
}

export function resolveHexMap(map: ParsedHexMap, packs: Map<string, HexPack>, defaultPack: string): ResolvedHexMap {
  const errors: HexMapError[] = [...map.errors];
  const packName = map.pack ?? defaultPack;
  const pack = packName === FLAT_PACK ? undefined : packs.get(packName);
  if (!pack && packName !== FLAT_PACK) {
    errors.push({
      line: 1,
      message: `pack "${packName}" not found${packs.size ? ` — packs: ${[...packs.keys()].join(", ")}` : " — no packs in the packs folder"}; drawing plain colours`,
    });
  }
  const picks: ResolvedPick[] = [];
  const urls = new Set<string>();

  // What surrounds each hex, for paths that join up and for coasts.
  const around: Surroundings = { paths: new Map(), terrain: new Map() };
  const water = new Set<string>();
  for (const cell of map.cells) {
    if (!cell.spec) continue;
    const key = hexKey(cell.q, cell.r);
    const base = parseTileSpec(resolveCatalog(pack, cell.spec).spec).base.toLowerCase();
    if (cell.layer === "terrain") {
      around.terrain.set(key, base);
      if (WATER.has(base)) water.add(key);
      else water.delete(key);
    } else if (cell.layer === "path") {
      const family = autotileFamily(pack, cell.spec) ?? base;
      let set = around.paths.get(key);
      if (!set) around.paths.set(key, (set = new Set()));
      set.add(family);
    }
  }

  const mouths = new Map<string, Map<string, Side>>();
  for (const cell of map.cells) {
    const catalog = cell.spec ? resolveCatalog(pack, cell.spec) : undefined;
    const family = cell.layer === "path" && cell.spec ? autotileFamily(pack, cell.spec) : null;
    if (family && pack) {
      let familyMouths = mouths.get(family);
      if (!familyMouths) {
        const order = map.cells
          .filter((c) => c.layer === "path" && c.spec && autotileFamily(pack, c.spec) === family)
          .map((c) => hexKey(c.q, c.r));
        familyMouths = pathMouths(family, around, pack.config.autotile[family].connectsTo, order);
        mouths.set(family, familyMouths);
      }
      const sides = sideMask(cell, family, around, familyMouths);
      const mask = sides.join(",");
      const file = pickAutotile(pack, family, sides, `${map.seed}:${cell.q},${cell.r}:path`);
      if (file) {
        urls.add(file.url);
        picks.push({
          cell,
          copy: 0,
          url: file.url,
          display: displayFor(pack.config, "path", file.path),
          file: file.path,
          mask,
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
        picks.push({ cell, copy, url: picked.file.url, display: picked.display, file: picked.file.path });
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
  return { map, picks, errors, urls: [...urls], water };
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
}

export interface HexInfo {
  q: number;
  r: number;
  cx: number;
  cy: number;
  height: number;
  specs: Array<{ layer: Layer; spec?: string; file?: string; mask?: string; line: number }>;
  label?: string;
  link?: string;
  regions: string[];
}

export interface DrawLabel {
  key: string;
  x: number;
  y: number;
  text: string;
  link?: string;
}

export interface HexLayout {
  R: number;
  items: Array<DrawTile | DrawFill | DrawStroke>;
  regions: DrawRegion[];
  /** Hex outlines (terrain hexes whose tile asks for a border). */
  borders: Array<{ key: string; cx: number; cy: number; width: number }>;
  labels: DrawLabel[];
  hexes: Map<string, HexInfo>;
  bounds: { x: number; y: number; w: number; h: number };
}

/** Layout units per hex circumradius; the SVG scales to fit anyway. */
export const HEX_R = 40;

function linkLabel(link: string): string {
  const [target, alias] = link.split("|");
  return (alias ?? target.split("#")[0].split("/").pop() ?? target).trim();
}

export function layoutHexMap(resolved: ResolvedHexMap, sizes: Map<string, ImageSize>, R = HEX_R): HexLayout {
  const hexes = new Map<string, HexInfo>();
  const halfH = (Math.sqrt(3) / 2) * R;
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
      info = { q: cell.q, r: cell.r, cx: x, cy: y, height: cell.height, specs: [], regions: [] };
      hexes.set(key, info);
      grow(x - R, y - halfH, x + R, y + halfH);
    }
    info.height = Math.max(info.height, cell.height);
    info.specs.push({ layer: cell.layer, spec: cell.spec, line: cell.line });
    if (cell.label) info.label = cell.label;
    if (cell.link) info.link = cell.link;
    for (const r of cell.regions) if (!info.regions.includes(r)) info.regions.push(r);
  }

  type Sorted = { order: [number, number, number, number, number]; item: DrawTile | DrawFill | DrawStroke };
  const sorted: Sorted[] = [];
  const borders: HexLayout["borders"] = [];
  for (const pick of resolved.picks) {
    const { cell, copy } = pick;
    const key = `${cell.q},${cell.r}:${cell.layer}:${cell.line}:${copy}`;
    const { x: cx, y: cy } = hexCenter(cell.q, cell.r, R);
    const order: Sorted["order"] = [cell.height, LAYER_RANK[cell.layer], cy, cx, copy];
    const info = hexes.get(hexKey(cell.q, cell.r));
    if (info && (pick.file || pick.mask !== undefined)) {
      const spec = info.specs.find((s) => s.line === cell.line);
      if (spec) {
        spec.file = pick.file;
        spec.mask = pick.mask;
      }
    }
    if (pick.stroke) {
      const color = pathColor(pick.stroke.family);
      sorted.push({ order, item: { kind: "stroke", key, cx, cy, sides: pick.stroke.sides, color } });
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
    if (d.clip) {
      sorted.push({
        order,
        item: { kind: "tile", key, url: pick.url, x: cx - R, y: cy - halfH, w: 2 * R, h: 2 * halfH, clip: true },
      });
      continue;
    }
    const size = sizes.get(pick.url);
    if (!size) continue;
    const scale = ((2 * R) / (d.hexWidth ?? size.w)) * d.zoom;
    const w = size.w * scale;
    const h = size.h * scale;
    let ox = d.offsetX * scale;
    let oy = d.offsetY * scale;
    if (cell.count > 1) {
      // Scatter copies inside the hex's inner circle, the same way each time.
      const hsh = hashSeed(`${resolved.map.seed}:${key}`);
      const angle = ((hsh % 3600) / 3600) * Math.PI * 2 + (copy * Math.PI * 2) / cell.count;
      const radius = 0.45 * R * (0.55 + ((hsh >>> 12) % 100) / 220);
      ox += Math.cos(angle) * radius;
      oy += Math.sin(angle) * radius * 0.8;
    }
    const x = cx - w / 2 + ox;
    const y = cy - h / 2 + oy;
    grow(x, y, x + w, y + h);
    sorted.push({ order, item: { kind: "tile", key, url: pick.url, x, y, w, h, clip: false } });
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

  const members = new Map<string, Set<string>>();
  for (const [key, info] of hexes) {
    for (const name of info.regions) {
      let set = members.get(name);
      if (!set) members.set(name, (set = new Set()));
      set.add(key);
    }
  }
  const regions = layoutRegions(members, resolved.map.regions, resolved.water, R);

  if (!Number.isFinite(minX)) {
    minX = minY = 0;
    maxX = maxY = 1;
  }
  const pad = R * 0.3;
  return {
    R,
    items: sorted.map((s) => s.item),
    regions,
    borders,
    labels,
    hexes,
    bounds: { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad },
  };
}
