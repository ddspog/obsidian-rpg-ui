/**
 * Regions — realms, duchies, basins — drawn over the map: each `@Region`'s
 * hexes tinted as one shape and outlined along its border (every hex side
 * whose neighbour isn't in the region), labelled near its middle, with its
 * size in hexes and its coast (sides facing water) counted.
 */

import { hexCenter, hexCorners, hexKey, neighbour, type Side, SIDES } from "./axial";
import type { HexRegion, RegionLabelLook } from "./parse-hex-map";

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
  /** The fill's colour, when it isn't `color` (`tint:`). */
  tint?: string;
  /** The fill's strength (`tintOpacity:`). */
  tintOpacity?: number;
  /** Drawn with its outline only, its fill only, or neither (`demark:`); unset: both. */
  demark?: "outline" | "fill" | "none";
  /** The name small, just inside the top border (`labelAt: border`), or across the middle. */
  labelAt?: "border" | "bottom" | "middle";
  labelColor?: string;
  /** Size, nudge, turn, lettering style, halo, capitals, spacing. */
  labelLook?: RegionLabelLook;
  /** Its name broken onto lines (its label's `width`), already in its case. */
  labelLines?: string[];
  /** Its name's width in ems at its font size (case and spacing counted), for bending it. */
  labelEm?: number;
  /** The lettering style's letters, when `labelLook.style` names one the pack has. */
  labelFont?: { family: string; weight: number; italic: boolean; color?: string; halo?: string };
  /** What's written on it: `label:`, else the linked note's name (an `@BellscarpRange` tag can't have spaces), else the name. */
  title: string;
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
  /** Only on a faint neighbour's hexes: drawn dimmed. */
  faint?: boolean;
}

/** An id written as one word, read as words: `TheClodgate` → `The Clodgate`. */
export function spaced(id: string): string {
  return id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

/** `Note#Heading|Alias` → `Alias`; `Folder/Note` → `Note`. */
function linkTitle(link: string): string {
  const [target, alias] = link.split("|");
  return alias?.trim() || target.split("#")[0].split("/").pop()!.trim() || link;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * @param members region name → member hex keys (`q,r`)
 * @param water hex keys whose terrain is water
 * @param liftOf a hex's height lift in layout units, so the outline follows the lifted faces
 */
export function layoutRegions(
  members: Map<string, Set<string>>,
  declared: Record<string, HexRegion>,
  water: Set<string>,
  R: number,
  liftOf: (key: string) => number = () => 0
): DrawRegion[] {
  // A hex's centre, raised to its face.
  const centreOf = (q: number, r: number) => {
    const c = hexCenter(q, r, R);
    return { x: c.x, y: c.y - liftOf(hexKey(q, r)) };
  };
  // `at:` (fractions allowed), raised with the hex it falls on.
  const atPoint = ([q, r]: [number, number]) => {
    const c = hexCenter(q, r, R);
    return { x: c.x, y: c.y - liftOf(hexKey(Math.round(q), Math.round(r))) };
  };
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
    // Each outline corner on the flat grid → the lifts it's drawn at, to join steps between heights.
    const steps = new Map<string, { x: number; y: number; lifts: Set<number> }>();
    const stepAt = (x: number, y: number, lift: number) => {
      const at = `${Math.round(x * 10)},${Math.round((y + lift) * 10)}`;
      let s = steps.get(at);
      if (!s) steps.set(at, (s = { x, y: y + lift, lifts: new Set() }));
      s.lifts.add(lift);
    };
    for (const key of keys) {
      const [q, r] = key.split(",").map(Number);
      const lift = liftOf(key);
      const c = centreOf(q, r);
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
        stepAt(corners[a].x, corners[a].y, lift);
        stepAt(corners[b].x, corners[b].y, lift);
        if (water.has(nKey) && !water.has(key)) coast++;
      }
    }
    // Where the outline passes between members at different heights, a riser joins its two levels.
    for (const s of steps.values()) {
      if (s.lifts.size < 2) continue;
      const lifts = [...s.lifts];
      const x = round(s.x);
      edge.push(`M${x},${round(s.y - Math.min(...lifts))}L${x},${round(s.y - Math.max(...lifts))}`);
    }
    // Label on the member hex nearest the middle, so it sits inside the region.
    const mx = sx / keys.size;
    const my = sy / keys.size;
    const decl = declared[name];
    // `labelAt: border`: under the top border, on the topmost north side facing out (nearest the middle across).
    // `labelAt: bottom`: the same over the bottom border, on the lowest south side facing out.
    let border: { x: number; y: number } | null = null;
    const edgeSide = decl?.labelAt === "border" ? "N" : decl?.labelAt === "bottom" ? "S" : null;
    if (edgeSide && !decl?.at) {
      const below = edgeSide === "S";
      for (const key of keys) {
        const [q, r] = key.split(",").map(Number);
        const n = neighbour({ q, r }, edgeSide);
        if (keys.has(hexKey(n.q, n.r))) continue;
        const c = centreOf(q, r);
        // Score by height: the topmost north side, or the lowest south one (negated, so smaller wins).
        const edgeY = below ? c.y + (Math.sqrt(3) / 2) * R - 0.26 * R : c.y - (Math.sqrt(3) / 2) * R + 0.26 * R;
        const y = below ? -edgeY : edgeY;
        if (
          !border ||
          y < border.y - 0.01 ||
          (Math.abs(y - border.y) < 0.01 && Math.abs(c.x - sx / keys.size) < Math.abs(border.x - sx / keys.size))
        )
          border = { x: c.x, y };
      }
      if (border && below) border = { x: border.x, y: -border.y };
    }
    // `label: { on: [q, r] }`: on that hex: its top or bottom side, or its middle.
    if (decl?.labelOn) {
      const c = centreOf(decl.labelOn[0], decl.labelOn[1]);
      const edge = (Math.sqrt(3) / 2) * R - 0.26 * R;
      border = { x: c.x, y: decl.labelAt === "border" ? c.y - edge : decl.labelAt === "bottom" ? c.y + edge : c.y };
    }
    // `at:` puts it on a hex of its own choosing (fractions allowed), clear of other names.
    const label = border
      ? border
      : decl?.at
        ? atPoint(decl.at)
        : centres.reduce((best, c) => {
            // A tie goes to the topmost, then the leftmost: the same hex whatever order the map lists them in
            // (an imported region is named where its own map names it).
            const d = Math.hypot(c.x - mx, c.y - my) - Math.hypot(best.x - mx, best.y - my);
            if (Math.abs(d) > 0.01) return d < 0 ? c : best;
            return c.y < best.y - 0.01 || (Math.abs(c.y - best.y) <= 0.01 && c.x < best.x) ? c : best;
          });
    out.push({
      name,
      title: decl?.label === false ? "" : (decl?.label ?? (decl?.link ? linkTitle(decl.link) : spaced(name))),
      labelAt: decl?.labelAt,
      labelColor: decl?.labelColor,
      labelLook: decl?.labelLook,
      color: decl?.color ?? PALETTE[paletteIndex++ % PALETTE.length],
      tint: decl?.tint,
      tintOpacity: decl?.tintOpacity,
      demark: decl?.demark,
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
