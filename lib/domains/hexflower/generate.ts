/**
 * Filling a hex map from a hex flower (Campaign Builder, "Procedurally Generated Maps"): each empty
 * hex is one roll of the flower, the token starting from what the hex it's reached from already is,
 * so terrain flows across the map as it does across the flower. A drag walks on from hex to hex; a
 * click on a filled hex fills its empty neighbours, one roll each, from it (the book's way of
 * uncovering the map as the party enters each hex).
 *
 * A result becomes a tile by the map's `generate: { tiles }` (`Mountains: mountain[rocky][medium]`),
 * else by its terrain type's tile in `DEFAULT_TILES`.
 */

import { type Axial, hexKey, neighbour, SIDES } from "lib/domains/hexmap/axial";
import { type TerrainId, terrainOf } from "lib/domains/hexmap/terrain";
import { type FlowerState, type FlowerStep, type HexFlower, rollFlower, startState } from "./hex-flower";

/** A tile for each terrain type, in the `basic` pack. */
export const DEFAULT_TILES: Record<TerrainId, string> = {
  arctic: "plains[snowy]",
  badlands: "mountain[badlands]",
  coastal: "plains[lush]",
  desert: "plains[desert]",
  farmland: "plains[farmland]",
  forest: "forest[lush]",
  grassland: "plains[lush]",
  hills: "hills[lush]",
  jungle: "forest[lush]",
  mountain: "mountain[rocky][medium]",
  ruins: "urban[lush][ruins]",
  swamp: "wetlands[damp]",
  underground: "basic[blank]",
  urban: "urban[lush]",
  water: "water[ocean]",
};

/** Results the terrain words don't cover (the ruins flower's wards and caves). */
const RESULT_TERRAIN: Record<string, TerrainId> = {
  tundra: "arctic",
  chasm: "underground",
  collapse: "underground",
  "narrow tunnels": "underground",
  "large caverns": "underground",
  "up/down": "underground",
  recreation: "ruins",
};

/** The terrain type a flower result means: `Hills`, `Tundra`, `Military Ward` (a ruin). */
export function resultTerrain(result: string): TerrainId | null {
  const r = result.trim().toLowerCase();
  return terrainOf(r) ?? RESULT_TERRAIN[r] ?? (/\bward$/.test(r) ? "ruins" : null);
}

/** What the generator writes for a result: the tile, and `terrain=` when the tile alone wouldn't say
 *  it (a coast drawn as plains). Null when there's no tile for it. */
export function tileFor(
  result: string,
  tiles: Record<string, string> = {}
): { spec: string; terrain?: TerrainId } | null {
  const own = Object.entries(tiles).find(([k]) => k.trim().toLowerCase() === result.trim().toLowerCase());
  const terrain = resultTerrain(result) ?? undefined;
  if (own) return { spec: own[1], terrain };
  if (!terrain) return null;
  const spec = DEFAULT_TILES[terrain];
  const plain = terrain === "coastal" || terrain === "jungle" || terrain === "underground";
  return { spec, terrain: plain ? terrain : undefined };
}

/** Where on the flower a hex that is `what` (a result, or a terrain type) puts the token: the cell
 *  giving that result, else one of that terrain type (nearest Start first). */
export function placeFor(f: HexFlower, what: string): { at: Axial; result: string } | null {
  const want = what.trim().toLowerCase();
  const wantTerrain = resultTerrain(want);
  const cells = [...f.cells.values()].sort(
    (a, b) => Math.abs(a.at.q) + Math.abs(a.at.r) - (Math.abs(b.at.q) + Math.abs(b.at.r))
  );
  for (const c of cells) {
    const o = c.options.find((o) => o.toLowerCase() === want);
    if (o) return { at: c.at, result: o };
  }
  if (!wantTerrain) return null;
  for (const c of cells) {
    const o = c.options.find((o) => resultTerrain(o) === wantTerrain);
    if (o) return { at: c.at, result: o };
  }
  return null;
}

/** Steps between two cells of a flower. */
export function flowerDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export interface Generated {
  hex: Axial;
  step: FlowerStep;
  /** On doubles: what the flower's doubles table gave for the hex. */
  element?: { name: string; text: string };
}

/**
 * Rolls a result for each of `targets` in turn. `known` is what the map's hexes already are (a result
 * or terrain type, by hex key); the token starts each hex from a known neighbour — the hex just
 * generated when it's next door, so a drag walks on — and stays where it was when none is known.
 */
export function generateHexes(
  f: HexFlower,
  targets: Axial[],
  known: Map<string, string>,
  state: FlowerState = startState(),
  random: () => number = Math.random,
  /**
   * `from`: the hex the walk comes from; `continuing`: the token is still where rolling `from` left it.
   * `anchorFor`: what the bigger hex a hex lies in is (a detail level's coarse hex: `forest`), where
   * the walk starts when no neighbour says; `tether`: how many flower steps the token may stray from
   * that hex's cell before it is put back there (the land keeps the big hex's character).
   */
  {
    from,
    continuing = false,
    anchorFor,
    tether,
  }: { from?: Axial; continuing?: boolean; anchorFor?: (hex: Axial) => string | undefined; tether?: number } = {}
): { generated: Generated[]; state: FlowerState } {
  const generated: Generated[] = [];
  const seen = new Map(known);
  let prev: Axial | undefined = from;
  for (const hex of targets) {
    const key = hexKey(hex.q, hex.r);
    if (seen.has(key)) continue;
    // Next to the hex just rolled: the token walks on from where it is. Else it starts from what a
    // neighbour on the map already is.
    const walksOn =
      !!prev &&
      (generated.length > 0 || continuing) &&
      SIDES.some((side) => {
        const n = neighbour(prev!, side);
        return n.q === hex.q && n.r === hex.r;
      });
    let start = state;
    if (!walksOn) {
      const near = [...(prev ? [prev] : []), ...SIDES.map((side) => neighbour(hex, side))]
        .map((n) => seen.get(hexKey(n.q, n.r)))
        .find((v): v is string => !!v);
      const place = near ? placeFor(f, near) : null;
      if (place) start = { ...state, at: place.at, last: place.result };
      else {
        const big = anchorFor?.(hex);
        const anchor = big ? placeFor(f, big) : null;
        if (anchor) start = { ...state, at: anchor.at, last: anchor.result };
      }
    }
    // Strayed too far from what the big hex is: back to its cell before rolling.
    const big = tether !== undefined ? anchorFor?.(hex) : undefined;
    const anchor = big ? placeFor(f, big) : null;
    if (anchor && flowerDistance(start.at, anchor.at) > tether!)
      start = { ...start, at: anchor.at, last: anchor.result };
    const { step, state: next } = rollFlower(f, start, random);
    state = next;
    seen.set(key, step.result);
    generated.push({ hex, step });
    prev = hex;
  }
  return { generated, state };
}
