/**
 * Areas of hexes (design §13.4): the hexes whose centres lie inside a freehand
 * loop (lasso fill, after hexmapper's point-in-polygon test) or a box (select).
 * Points are in layout units.
 */

import { type Axial, hexCenter, pixelToHex } from "./axial";

export interface Point {
  x: number;
  y: number;
}

/** Even-odd test: is the point inside the loop? */
export function pointInPolygon(p: Point, loop: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i];
    const b = loop[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Every hex whose centre lies in the box from x0,y0 to x1,y1 and passes `keep`. */
function hexesIn(x0: number, y0: number, x1: number, y1: number, R: number, keep: (c: Point) => boolean): Axial[] {
  const [minX, maxX] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [minY, maxY] = [Math.min(y0, y1), Math.max(y0, y1)];
  const corners = [
    pixelToHex(minX, minY, R),
    pixelToHex(maxX, minY, R),
    pixelToHex(minX, maxY, R),
    pixelToHex(maxX, maxY, R),
  ];
  const qs = corners.map((h) => h.q);
  const rs = corners.map((h) => h.r);
  const out: Axial[] = [];
  for (let q = Math.min(...qs) - 1; q <= Math.max(...qs) + 1; q++) {
    for (let r = Math.min(...rs) - 1; r <= Math.max(...rs) + 1; r++) {
      const c = hexCenter(q, r, R);
      if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY && keep(c)) out.push({ q, r });
    }
  }
  return out;
}

export function hexesInRect(a: Point, b: Point, R: number): Axial[] {
  return hexesIn(a.x, a.y, b.x, b.y, R, () => true);
}

export function hexesInPolygon(loop: Point[], R: number): Axial[] {
  if (loop.length < 3) return [];
  const xs = loop.map((p) => p.x);
  const ys = loop.map((p) => p.y);
  return hexesIn(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), R, (c) => pointInPolygon(c, loop));
}
