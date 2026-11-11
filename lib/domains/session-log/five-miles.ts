/**
 * Five-mile rolls (Solo Adventurer's Toolbox, Random Wilderness Generation): for every five miles
 * travelled, one roll on the overarching-terrain table of the ground; above about 50 it turns up a
 * minor feature. A journey's step lists the hexes entered, the table for each and how many rolls,
 * so they can be rolled at once and added to the log.
 */

import type { Axial } from "lib/domains/hexmap/axial";
import { hexKey } from "lib/domains/hexmap/axial";
import type { TerrainGrid, TerrainId } from "lib/domains/hexmap/terrain";

/** The vault's table block for each terrain's five-mile roll (`rpg table.overarching-terrain-hills`). */
export const OVERARCHING_TABLE: Partial<Record<TerrainId, string>> = {
  arctic: "overarching-terrain-arctic",
  coastal: "overarching-terrain-coastal",
  desert: "overarching-terrain-desert",
  badlands: "overarching-terrain-desert",
  forest: "overarching-terrain-forest-jungle",
  jungle: "overarching-terrain-forest-jungle",
  grassland: "overarching-terrain-grassland",
  farmland: "overarching-terrain-grassland",
  hills: "overarching-terrain-hills",
  mountain: "overarching-terrain-mountains",
  swamp: "overarching-terrain-swamp",
};

export interface LandRoll {
  hex: Axial;
  terrain: TerrainId;
  table: string;
  /** One per five miles across the hex (at least one). */
  rolls: number;
}

/** The five-mile rolls for the hexes entered, on a map whose hexes are `hexMiles` across. Hexes with
 *  no terrain or no table (water, ruins, towns) are left out. */
export function landRolls(entered: Axial[], grid: TerrainGrid, hexMiles: number): LandRoll[] {
  const out: LandRoll[] = [];
  for (const hex of entered) {
    const terrain = grid.terrain.get(hexKey(hex.q, hex.r));
    const table = terrain ? OVERARCHING_TABLE[terrain] : undefined;
    if (!terrain || !table) continue;
    out.push({ hex, terrain, table, rolls: Math.max(1, Math.round(hexMiles / 5)) });
  }
  return out;
}
