/**
 * Detail maps (design §13.7): a map whose hexes are finer than another map's
 * (30 mi → 5 mi → 1 mi, six across the flats each time). On axial
 * coordinates the fine hex `(n·q, n·r)` sits exactly on the centre of the
 * coarse hex `(q, r)`, so a detail map's coordinates are the parent's times
 * the ratio `n`. With `at: [q, r]` they're local instead: the detail's (0,0)
 * is the parent's hex (q, r).
 */

import { type Axial, hexCenter, hexKey, pixelToHex } from "./axial";
import { findMapFences } from "./fence-text";
import { isHexMapSource } from "./parse-hex-map";

/** How many detail hexes span one parent hex: six for each level between the scales
 *  (the miles are rounded: 5 mi over 1 mi is still one level), else 6. */
export function detailRatio(parentMetres?: number, ownMetres?: number): number {
  if (!parentMetres || !ownMetres) return 6;
  const steps = Math.round(Math.log(parentMetres / ownMetres) / Math.log(6));
  return steps >= 1 ? Math.pow(6, steps) : 6;
}

/** The parent's drawing (layout units, the same R) placed on the detail map: `scale(n) translate(-x, -y)`. */
export function parentTransform(n: number, at?: [number, number], R = 1): { scale: number; x: number; y: number } {
  const c = at ? hexCenter(at[0], at[1], R) : { x: 0, y: 0 };
  return { scale: n, x: -c.x, y: -c.y };
}

/** The parent hex a detail hex's centre lies in. */
export function parentHexOf(q: number, r: number, n: number, at?: [number, number]): Axial {
  const c = hexCenter(q, r, 1);
  const o = at ? hexCenter(at[0], at[1], 1) : { x: 0, y: 0 };
  return pixelToHex(c.x / n + o.x, c.y / n + o.y, 1);
}

/** The detail hexes whose centres lie in the parent hex (q, r). */
export function childHexesOf(pq: number, pr: number, n: number, at?: [number, number]): Axial[] {
  const cq = n * (pq - (at?.[0] ?? 0));
  const cr = n * (pr - (at?.[1] ?? 0));
  const out: Axial[] = [];
  for (let q = cq - n; q <= cq + n; q++) {
    for (let r = cr - n; r <= cr + n; r++) {
      const p = parentHexOf(q, r, n, at);
      if (p.q === pq && p.r === pr) out.push({ q, r });
    }
  }
  return out;
}

/** The parent hexes a detail map's hexes lie in, as `q,r` keys. */
export function parentHexesOf(hexes: Iterable<Axial>, n: number, at?: [number, number]): Set<string> {
  const out = new Set<string>();
  for (const h of hexes) {
    const p = parentHexOf(h.q, h.r, n, at);
    out.add(hexKey(p.q, p.r));
  }
  return out;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** The next scale down, six times finer, written as the user does: `30 mi` → `5 mi` → `1 mi`
 *  (a fraction of a unit from a half up is rounded to a whole one; smaller stays a fraction). */
export function detailScale(scale: string | undefined, n = 6): string | undefined {
  const m = scale?.trim().match(/^(\d+)(?:\s*\/\s*(\d+))?\s*([a-z]+)$/i);
  if (!m) return undefined;
  let num = parseInt(m[1], 10);
  let den = (m[2] ? parseInt(m[2], 10) : 1) * n;
  const g = gcd(num, den);
  num /= g;
  den /= g;
  if (den > 1 && num / den >= 0.5) return `${Math.round(num / den)} ${m[3]}`;
  return `${num}${den === 1 ? "" : `/${den}`} ${m[3]}`;
}

/** The note text of a new detail map for the parent's hex (q, r). */
export function detailNote(opts: {
  title: string;
  parentNote: string;
  q: number;
  r: number;
  scale?: string;
  pack?: string;
}): string {
  const head = [
    "grid: hex",
    `title: ${opts.title}`,
    opts.pack ? `pack: ${opts.pack}` : null,
    opts.scale ? `scale: ${opts.scale}` : null,
    `of: "[[${opts.parentNote}]]"`,
    `at: [${opts.q}, ${opts.r}]`,
    "---",
  ].filter((l): l is string => l !== null);
  return `# ${opts.title}\n\n\`\`\`rpg map\n${head.join("\n")}\n\`\`\`\n`;
}

/** The first hex map block in a note's text, or null. */
export function firstHexMap(text: string): string | null {
  return findMapFences(text).find((f) => isHexMapSource(f.body))?.body ?? null;
}
