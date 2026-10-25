/**
 * Play mode's sums (design §14): the hexes a straight move crosses, how far a
 * route is and how long it takes at a travel pace, and which hexes a party has
 * seen. Pure; the map block keeps the sandbox (nothing is written to the note).
 */

import { type Axial, hexKey, neighbour, SIDES } from "./axial";

const METRES_PER_MILE = 1609.344;

/** A day's travel at a normal pace, in miles (5e: 24 mi/day). */
export const DAY_MILES = 24;

function cubeRound(q: number, r: number): Axial {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };
}

export function hexDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** The hexes from `a` to `b` in a straight line, both ends included. */
export function hexLine(a: Axial, b: Axial): Axial[] {
  const n = hexDistance(a, b);
  if (n === 0) return [{ q: a.q, r: a.r }];
  // Nudged off the corners so the line doesn't wobble between two hexes.
  const out: Axial[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(cubeRound(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 1e-6));
  }
  return out;
}

export interface Travel {
  /** Hexes crossed (steps), not counting the start. */
  hexes: number;
  /** Distance in miles, when the map has a scale. */
  miles?: number;
  /** Days at `DAY_MILES`. */
  days?: number;
}

/** How far a route is (a list of hexes, the start first). */
export function travel(route: Axial[], hexMetres?: number, dayMiles = DAY_MILES): Travel {
  let hexes = 0;
  for (let i = 1; i < route.length; i++) hexes += hexDistance(route[i - 1], route[i]);
  if (!hexMetres) return { hexes };
  const miles = (hexes * hexMetres) / METRES_PER_MILE;
  return { hexes, miles, days: miles / dayMiles };
}

/** "3 hexes · 90 mi · 3¾ days" */
export function travelText(t: Travel): string {
  const parts = [`${t.hexes} hex${t.hexes === 1 ? "" : "es"}`];
  if (t.miles !== undefined) parts.push(`${Math.round(t.miles * 10) / 10} mi`);
  if (t.days !== undefined && t.days < 1) {
    // Under a day: hours on the road at the same pace (a day is 8 hours of it).
    const hours = t.days * 8;
    if (hours < 1) parts.push(`${Math.max(1, Math.round(hours * 60))} min`);
    else parts.push(`${Math.round(hours * 4) / 4} h`.replace(".25", "¼").replace(".5", "½").replace(".75", "¾"));
  } else if (t.days !== undefined) {
    const quarters = Math.round(t.days * 4) / 4;
    const whole = Math.floor(quarters);
    const frac = ["", "¼", "½", "¾"][Math.round((quarters - whole) * 4)];
    const n = `${whole || !frac ? whole : ""}${frac}`;
    parts.push(`${n} day${quarters === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

/** The hexes a party has seen: every hex it stood on, and `sight` rings around each. */
export function explored(stood: Iterable<Axial>, sight = 1): Set<string> {
  const out = new Set<string>();
  const visit = (h: Axial, depth: number) => {
    out.add(hexKey(h.q, h.r));
    if (depth > 0) for (const side of SIDES) visit(neighbour(h, side), depth - 1);
  };
  for (const h of stood) visit({ q: Math.round(h.q), r: Math.round(h.r) }, sight);
  return out;
}
