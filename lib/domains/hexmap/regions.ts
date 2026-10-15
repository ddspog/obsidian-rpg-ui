/**
 * Regions — realms, duchies, basins — drawn over the map: each `@Region`'s
 * hexes tinted as one shape and outlined along its border (every hex side
 * whose neighbour isn't in the region), labelled near its middle, with its
 * size in hexes and its coast (sides facing water) counted.
 */

import { hexCenter, hexCorners, hexKey, neighbour, type Side, SIDES } from "./axial";
import type { HexRegion } from "./parse-hex-map";

/** Corner indices (from `hexCorners`, clockwise from east) bounding each side. */
const SIDE_CORNERS: Record<Side, [number, number]> = {
  N: [4, 5],
  NE: [5, 0],
  SE: [0, 1],
  S: [1, 2],
  SW: [2, 3],
  NW: [3, 4],
};

/** Colours for regions the head doesn't declare. */
const PALETTE = ["#8a3b2e", "#3b6e5a", "#3d5a8a", "#8a6d2e", "#6b3d8a", "#2e7a8a", "#8a2e5e"];

export interface DrawRegion {
  name: string;
  color: string;
  link?: string;
  /** Nesting depth (a duchy inside a realm is 1). */
  depth: number;
  /** All member hexes as one path (one fill, no seams). */
  fill: string;
  /** The border: member sides facing a non-member. */
  edge: string;
  label: { x: number; y: number };
  hexes: number;
  coast: number;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * @param members region name → member hex keys (`q,r`)
 * @param water hex keys whose terrain is water
 */
export function layoutRegions(
  members: Map<string, Set<string>>,
  declared: Record<string, HexRegion>,
  water: Set<string>,
  R: number
): DrawRegion[] {
  const depthOf = (name: string, seen = new Set<string>()): number => {
    const parent = declared[name]?.parent;
    if (!parent || seen.has(name) || !declared[parent]) return 0;
    seen.add(name);
    return 1 + depthOf(parent, seen);
  };
  const out: DrawRegion[] = [];
  let paletteIndex = 0;
  for (const [name, keys] of members) {
    if (keys.size === 0) continue;
    const fill: string[] = [];
    const edge: string[] = [];
    let coast = 0;
    let sx = 0;
    let sy = 0;
    const centres: Array<{ x: number; y: number }> = [];
    for (const key of keys) {
      const [q, r] = key.split(",").map(Number);
      const c = hexCenter(q, r, R);
      centres.push(c);
      sx += c.x;
      sy += c.y;
      const corners = hexCorners(c.x, c.y, R);
      fill.push(`M${corners.map((p) => `${round(p.x)},${round(p.y)}`).join("L")}Z`);
      for (const side of SIDES) {
        const n = neighbour({ q, r }, side);
        const nKey = hexKey(n.q, n.r);
        if (keys.has(nKey)) continue;
        const [a, b] = SIDE_CORNERS[side];
        edge.push(`M${round(corners[a].x)},${round(corners[a].y)}L${round(corners[b].x)},${round(corners[b].y)}`);
        if (water.has(nKey) && !water.has(key)) coast++;
      }
    }
    // Label on the member hex nearest the middle, so it sits inside the region.
    const mx = sx / keys.size;
    const my = sy / keys.size;
    const label = centres.reduce((best, c) =>
      Math.hypot(c.x - mx, c.y - my) < Math.hypot(best.x - mx, best.y - my) ? c : best
    );
    const decl = declared[name];
    out.push({
      name,
      color: decl?.color ?? PALETTE[paletteIndex++ % PALETTE.length],
      link: decl?.link,
      depth: depthOf(name),
      fill: fill.join(""),
      edge: edge.join(""),
      label: { x: label.x, y: label.y },
      hexes: keys.size,
      coast,
    });
  }
  // Outer regions first, so nested ones draw over them.
  return out.sort((a, b) => a.depth - b.depth);
}
