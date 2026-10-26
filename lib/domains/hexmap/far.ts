/**
 * Far art (design §13.10): how a level's hexes look from the level above.
 * Each hex of the map six times coarser that has detail below it is drawn as
 * its own tile with its fine hexes over it, at a sixth of the size: a fine hex
 * whose terrain has far art (a `far:` family in `pack.yml`) as that art, picked
 * by which of its six neighbours are of the same family, so a forest's trees
 * join into one wood; a fine hex with none as its own tile, shrunk. A fine hex
 * the same as the coarse one it's in adds nothing, and is left out.
 *
 *   far:
 *     forest:
 *       of: [forest, jungle]          # the terrains it stands for (else its name)
 *       size: 1.2                     # its tiles' size, as a share of the hex
 *       tiles:
 *         alone-0: forest/alone-0     # in the pack's far/ folder; shapes as paths'
 *         straight-0: [forest/straight-0, forest/straight-0b]
 *
 * A shape with no tile of its own is drawn from another slot of it turned into
 * place (as paths are), and else from the family's `star-0` or `alone-0`.
 */

import { type Axial, hexCenter, hexKey, neighbour, type Side, SIDES } from "./axial";
import { hexIs, type Surroundings } from "./autotile";
import type { DrawFill, DrawStroke, DrawTile, HexLayout, ImageSize } from "./layout";
import { coarseHexOf, LEVEL_RATIO } from "./levels";
import { displayFor, type FarFamily, hashSeed, type HexPack, type TileFile } from "./packs";
import type { ParsedHexMap } from "./parse-hex-map";
import { PATH_SHAPES, shapeName, type ShapeSlot, shapesWithSides } from "./path-shapes";

/** The far family a hex's terrain belongs to, or null when the pack has none for it. */
export function farFamilyOf(pack: HexPack | undefined, around: Surroundings, key: string): string | null {
  if (!pack || !around.terrain.has(key)) return null;
  for (const [name, family] of Object.entries(pack.config.far)) {
    if (!hexIs(around, key, family.of)) continue;
    if (family.except.length && hexIs(around, key, family.except)) continue;
    return name;
  }
  return null;
}

/** The sides of a hex facing a neighbour of the same far family. */
export function farSides(h: Axial, family: string, families: Map<string, string>): Side[] {
  return SIDES.filter((side) => {
    const n = neighbour(h, side);
    return families.get(hexKey(n.q, n.r)) === family;
  });
}

/** A family's tiles for one shape, as files of the far layer. */
function filesFor(pack: HexPack, family: FarFamily, shape: ShapeSlot): TileFile[] {
  return (family.tiles[shapeName(shape)] ?? [])
    .map((p) => pack.byPath.far.get(p.toLowerCase()))
    .filter((f): f is TileFile => !!f);
}

/** The far tile for a hex with these sides of its kind round it, turned (in sides clockwise)
 *  when it stands in from another slot; varied by the seed when there are several. */
export function pickFarTile(
  pack: HexPack,
  name: string,
  sides: Side[],
  seed: string
): { file: TileFile; turn: number } | null {
  const family = pack.config.far[name];
  if (!family) return null;
  const pick = (list: TileFile[], turn: number) => ({ file: list[hashSeed(seed) % list.length], turn });
  const wanted: ShapeSlot[] = sides.length ? shapesWithSides(sides.join(",")) : [{ type: "alone", slot: 0 }];
  for (const shape of wanted) {
    const list = filesFor(pack, family, shape);
    if (list.length) return pick(list, 0);
  }
  for (const want of wanted) {
    const slots = PATH_SHAPES.find((s) => s.type === want.type)?.slots ?? 1;
    for (let step = 1; step < slots; step++) {
      const list = filesFor(pack, family, { ...want, slot: (want.slot - step + slots) % slots });
      if (list.length) return pick(list, step);
    }
  }
  // Nothing of that shape at any turn: the family's whole or lone tile still says what it is.
  for (const shape of [
    { type: "star", slot: 0 },
    { type: "alone", slot: 0 },
  ]) {
    const list = filesFor(pack, family, shape);
    if (list.length) return pick(list, 0);
  }
  return null;
}

/** One fine hex's far tile. */
export interface FarPick {
  q: number;
  r: number;
  family: string;
  file: TileFile;
  turn: number;
  faint: boolean;
}

/** The far tiles of a fine map's hexes: those whose terrain has a far family. */
export function resolveFar(map: ParsedHexMap, pack: HexPack | undefined, around: Surroundings): FarPick[] {
  if (!pack || Object.keys(pack.config.far).length === 0) return [];
  const families = new Map<string, string>();
  for (const key of around.terrain.keys()) {
    const family = farFamilyOf(pack, around, key);
    if (family) families.set(key, family);
  }
  const faint = new Set<string>();
  const own = new Set<string>();
  for (const c of map.cells) {
    const k = hexKey(c.q, c.r);
    if (c.faint) faint.add(k);
    else own.add(k);
  }
  const out: FarPick[] = [];
  for (const [key, family] of families) {
    const [q, r] = key.split(",").map(Number);
    const found = pickFarTile(pack, family, farSides({ q, r }, family, families), `${map.seed}:${key}:far`);
    if (found) out.push({ q, r, family, ...found, faint: faint.has(key) && !own.has(key) });
  }
  return out;
}

/** The hex an item of a layout is drawn for (its key starts `q,r:`). */
function itemHex(key: string): string {
  return key.split(":")[0];
}

/** An item moved down by `dy` (layout units). */
function shifted<T extends DrawTile | DrawFill | DrawStroke>(item: T, dy: number): T {
  if (!dy) return item;
  if (item.kind !== "tile") return { ...item, cy: item.cy + dy };
  const t = item as DrawTile;
  return {
    ...t,
    y: t.y + dy,
    ...(t.crop ? { crop: { cx: t.crop.cx, cy: t.crop.cy + dy } } : {}),
    ...(t.below !== undefined ? { below: t.below + dy } : {}),
    ...(t.rotate ? { rotate: { ...t.rotate, cy: t.rotate.cy + dy } } : {}),
  } as T;
}

/**
 * The level below as the level above shows it: a layout in the fine map's own
 * units (drawn scaled down by six over the coarse map). `fine` is the fine map
 * laid out flat (its heights dropped: each fine hex sits on its coarse hex's
 * face, lifted with it); `coarse` is the coarse map drawn, to sit on and
 * compare with.
 */
export function farLayout(
  fine: { map: ParsedHexMap; layout: HexLayout },
  picks: FarPick[],
  coarse: { map: ParsedHexMap; layout: HexLayout },
  pack: HexPack | undefined,
  sizes: Map<string, ImageSize>
): HexLayout {
  const R = fine.layout.R;
  const n = LEVEL_RATIO;
  // Each coarse hex's top terrain, and how far its face is lifted (in fine units).
  const coarseTop = new Map<string, { spec?: string; height: number }>();
  for (const c of coarse.map.cells) {
    if (c.layer !== "terrain") continue;
    const k = hexKey(c.q, c.r);
    const was = coarseTop.get(k);
    if (!was || c.height >= was.height) coarseTop.set(k, { spec: c.spec, height: c.height });
  }
  const liftOf = (key: string): number => {
    const info = coarse.layout.hexes.get(key);
    if (!info) return 0;
    const [q, r] = key.split(",").map(Number);
    return (info.cy - hexCenter(q, r, coarse.layout.R).y) * n;
  };
  const coarseOf = (key: string): string => {
    const [q, r] = key.split(",").map(Number);
    const p = coarseHexOf(q, r);
    return hexKey(p.q, p.r);
  };
  const fineTop = new Map<string, string | undefined>();
  for (const c of fine.map.cells) if (c.layer === "terrain") fineTop.set(hexKey(c.q, c.r), c.spec);

  const farred = new Set(picks.map((p) => hexKey(p.q, p.r)));
  // Hexes drawn as their own tile, shrunk: no far art, and not just their coarse hex again.
  const shrunk = new Set<string>();
  for (const key of fine.layout.hexes.keys()) {
    if (farred.has(key)) continue;
    const spec = fineTop.get(key);
    const under = coarseTop.get(coarseOf(key))?.spec;
    if (spec && under && spec.toLowerCase() === under.toLowerCase()) continue;
    shrunk.add(key);
  }

  const items: HexLayout["items"] = [];
  for (const item of fine.layout.items) {
    const key = itemHex(item.key);
    if (shrunk.has(key)) items.push(shifted(item, liftOf(coarseOf(key))));
  }
  // Far tiles over the shrunk ones, row by row so the lower ones overlap the higher.
  const ordered = [...picks].sort((a, b) => hexCenter(a.q, a.r, R).y - hexCenter(b.q, b.r, R).y || a.q - b.q);
  for (const p of ordered) {
    const key = hexKey(p.q, p.r);
    const { x: cx, y } = hexCenter(p.q, p.r, R);
    const cy = y + liftOf(coarseOf(key));
    const d = pack ? displayFor(pack.config, "far", p.file.path) : undefined;
    const size = sizes.get(p.file.url);
    if (!d || !size) continue;
    const grown = pack?.config.far[p.family]?.size ?? 1;
    const halfH = (Math.sqrt(3) / 2) * R;
    const rotate = p.turn ? { deg: 60 * p.turn, cx, cy } : undefined;
    if (d.clip) {
      items.push({
        kind: "tile",
        key: `${key}:far`,
        url: p.file.url,
        x: cx - R,
        y: cy - halfH,
        w: 2 * R,
        h: 2 * halfH,
        clip: true,
        ...(rotate ? { rotate } : {}),
        ...(p.faint ? { faint: true } : {}),
      });
      continue;
    }
    const scale = ((2 * R) / (d.hexWidth ?? size.w)) * d.zoom * grown;
    const w = size.w * scale;
    const h = size.h * scale;
    items.push({
      kind: "tile",
      key: `${key}:far`,
      url: p.file.url,
      x: cx + d.offsetX * scale - w / 2,
      y: cy + d.offsetY * scale - h / 2,
      w,
      h,
      clip: false,
      ...(rotate ? { rotate } : {}),
      ...(p.faint ? { faint: true } : {}),
    });
  }
  return {
    R,
    items,
    markers: [],
    banners: [],
    regions: [],
    filters: fine.layout.filters,
    borders: [],
    labels: [],
    hexes: new Map(),
    bounds: fine.layout.bounds,
  };
}
