/**
 * Edges that lay themselves: a pack's `edges:` family (a coast) runs along
 * every side where a hex meets its `meets` terrain (`water`: the water
 * section's tiles, or a base folder's name), on the water hex
 * (`on: inside`, the default) or the land hex (`on: outside`). Each hex's sides are
 * covered by runs of edge pieces (path-shapes.ts `coverSides`), so a hex with
 * water to the N and S takes two pieces, not one special tile.
 */

import { hexIs, type Surroundings } from "./autotile";
import { type Axial, hexKey, neighbour, type Side, SIDES } from "./axial";
import { type EdgeFamily, type HexPack, hashSeed, type TileFile } from "./packs";
import { coverSides, shapeName, type ShapeSlot } from "./path-shapes";

export interface EdgePiece {
  family: string;
  shape: ShapeSlot;
  file: TileFile;
}

/** Which of a hex's sides an edge family runs along, given what surrounds it. */
export function edgeSides(family: EdgeFamily, h: Axial, around: Surroundings): boolean[] {
  const key = hexKey(h.q, h.r);
  const inside = family.on === "inside";
  const meets = (k: string) =>
    hexIs(around, k, family.meets) && !(family.except.length && hexIs(around, k, family.except));
  if (!around.terrain.has(key) || meets(key) !== inside) return SIDES.map(() => false);
  return SIDES.map((side) => {
    const n = neighbour(h, side);
    const other = hexKey(n.q, n.r);
    // The map's own edge isn't a shore.
    return around.terrain.has(other) && meets(other) !== inside;
  });
}

/** The pieces each edge family lays on a hex, varied by the seed when a run lists several tiles.
 *  `parted`: sides left open (where a river's mouth meets the sea), so the run is laid in two. */
export function edgePieces(
  pack: HexPack,
  h: Axial,
  around: Surroundings,
  seed: string,
  parted?: Set<Side>
): EdgePiece[] {
  const out: EdgePiece[] = [];
  for (const [family, config] of Object.entries(pack.config.edges)) {
    const files = (shape: ShapeSlot) =>
      (config.tiles[shapeName(shape)] ?? [])
        .map((p) => pack.byPath.edge.get(p.toLowerCase()))
        .filter((f): f is TileFile => !!f);
    const sides = edgeSides(config, h, around).map((on, i) => on && !parted?.has(SIDES[i]));
    const shapes = coverSides(sides, (s) => files(s).length > 0);
    for (const [i, shape] of shapes.entries()) {
      const list = files(shape);
      if (list.length) out.push({ family, shape, file: list[hashSeed(`${seed}:${family}:${i}`) % list.length] });
    }
  }
  return out;
}
