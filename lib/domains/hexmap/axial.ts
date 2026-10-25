/**
 * Axial hex maths for flat-top hexes — the hex-map-editor's geometry.
 *
 * `q` runs east, `r` runs south-east; the centre of `(q, r)` is
 * `x = 1.5·R·q`, `y = √3·R·(r + q/2)`, `R` the circumradius. The six sides of
 * a flat-top hex face N, NE, SE, S, SW, NW.
 */

export interface Axial {
  q: number;
  r: number;
}

export type Side = "N" | "NE" | "SE" | "S" | "SW" | "NW";

export const SIDES: Side[] = ["N", "NE", "SE", "S", "SW", "NW"];

/** The step to the neighbour across each side. */
export const SIDE_STEP: Record<Side, Axial> = {
  N: { q: 0, r: -1 },
  NE: { q: 1, r: -1 },
  SE: { q: 1, r: 0 },
  S: { q: 0, r: 1 },
  SW: { q: -1, r: 1 },
  NW: { q: -1, r: 0 },
};

const SQRT3 = Math.sqrt(3);

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function hexCenter(q: number, r: number, R: number): { x: number; y: number } {
  return { x: 1.5 * R * q, y: SQRT3 * R * (r + q / 2) };
}

/** Corner points of the hex, clockwise from the east corner. */
export function hexCorners(cx: number, cy: number, R: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    out.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  return out;
}

export function hexPoints(cx: number, cy: number, R: number): string {
  return hexCorners(cx, cy, R)
    .map((p) => `${round(p.x)},${round(p.y)}`)
    .join(" ");
}

export function neighbour(h: Axial, side: Side): Axial {
  const s = SIDE_STEP[side];
  return { q: h.q + s.q, r: h.r + s.r };
}

/** A point in axial units, not rounded to a hex (markers and labels stand anywhere). */
export function pixelToAxial(x: number, y: number, R: number): Axial {
  return { q: ((2 / 3) * x) / R, r: ((-1 / 3) * x + (SQRT3 / 3) * y) / R };
}

/** The hex under a point (cube rounding). */
export function pixelToHex(x: number, y: number, R: number): Axial {
  const { q, r } = pixelToAxial(x, y, R);
  return cubeRound(q, r);
}

function cubeRound(fq: number, fr: number): Axial {
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q + 0, r: r + 0 };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
