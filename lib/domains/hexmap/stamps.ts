/**
 * Custom tiles (design §13.3, hexmapper's "stamps"): a hex — or a few — built
 * from the pack's art (terrain, base, paths, stacks, markers, each with its
 * look), saved by name in the pack's `pack.yml` as map lines relative to
 * (0,0), painted on a map like any tile with `c(q,r): name rot=N` and
 * expanded as the map is read, so editing a custom tile changes every map
 * that uses it. Built in the tile builder (paint mode, or settings).
 *
 *   custom:
 *     walled-town:
 *       - "t(0,0): city"
 *       - "s(0,0): buildings x3"
 *       - "p(0,0): roads"
 *       - "100m:"
 *       - "t(1,0): hills"
 *
 * The map's own terrain and base lines win over a stamp's on the same hex, and
 * a later stamp over an earlier one. Paths in a stamp join up with the map
 * around them. Turning works in 60° steps; exact path pieces don't turn with
 * it (joined ones are worked out afresh).
 */

import { hexKey, pixelToHex } from "./axial";
import {
  type HexCell,
  type HexLabelLine,
  type HexMapError,
  type HexMarkerLine,
  type HexStampLine,
  parseHexMap,
  type ParsedHexMap,
} from "./parse-hex-map";

/** Turn an axial point (fractions too) `rot` 60° steps clockwise about (0,0). */
export function rotateAxial(q: number, r: number, rot: number): { q: number; r: number } {
  let a = q;
  let b = r;
  for (let i = 0; i < ((rot % 6) + 6) % 6; i++) [a, b] = [-b, a + b];
  return { q: a + 0, r: b + 0 };
}

const MAX_DEPTH = 3;

/** A stamp's lines read as a map body (line n of the body is `def[n - 2]`). */
function readStamp(def: string[]): ParsedHexMap {
  return parseHexMap(`---\n${def.join("\n")}`);
}

/** The map with its stamps put down: their cells, markers and labels added. */
export function expandStamps(map: ParsedHexMap, stamps: Record<string, string[]>, depth = 0): ParsedHexMap {
  const lines = map.stamps ?? [];
  if (lines.length === 0) return map;
  const errors: HexMapError[] = [...map.errors];
  // Hexes whose terrain (or base) is already decided: the map's own, then later stamps'.
  const taken = new Set<string>();
  for (const c of map.cells)
    if (c.layer === "terrain" || c.layer === "base") taken.add(`${c.layer}:${hexKey(c.q, c.r)}`);
  const cells: HexCell[][] = [];
  const markers: HexMarkerLine[] = [];
  const labels: HexLabelLine[] = [];
  for (const sl of [...lines].reverse()) {
    const def = stamps[sl.name];
    if (!def) {
      const known = Object.keys(stamps);
      errors.push({
        line: sl.line,
        message: `no custom tile "${sl.name}" in the pack${known.length ? ` — custom tiles: ${known.join(", ")}` : ""}`,
      });
      continue;
    }
    let inner = readStamp(def);
    if (depth < MAX_DEPTH) inner = expandStamps(inner, stamps, depth + 1);
    for (const e of inner.errors) errors.push({ line: sl.line, message: `custom tile "${sl.name}": ${e.message}` });
    const place = (q: number, r: number) => {
      const t = rotateAxial(q, r, sl.rot);
      return { q: t.q + sl.q, r: t.r + sl.r };
    };
    const own: HexCell[] = [];
    const claimed: string[] = [];
    for (const c of inner.cells) {
      const at = place(c.q, c.r);
      const key = `${c.layer}:${hexKey(at.q, at.r)}`;
      if ((c.layer === "terrain" || c.layer === "base") && taken.has(key)) continue;
      if (c.layer === "terrain" || c.layer === "base") claimed.push(key);
      own.push({ ...c, ...at, height: c.height + sl.height, line: sl.line, stamp: sl.name });
    }
    claimed.forEach((k) => taken.add(k));
    cells.unshift(own);
    for (const m of inner.markers) markers.push({ ...m, ...place(m.q, m.r), line: sl.line });
    for (const l of inner.labels) labels.push({ ...l, ...place(l.q, l.r), line: sl.line });
  }
  return {
    ...map,
    cells: [...cells.flat(), ...map.cells],
    markers: [...markers, ...map.markers],
    labels: [...labels, ...map.labels],
    errors,
  };
}

const NUM = String.raw`-?\d+(?:\.\d+)?|-?\.\d+`;
const CELL_AT = /^((?:[tpsebc]|stamp)\s*)\(\s*-?\d+\s*,\s*-?\d+\s*\)/;
const LEGACY_AT = /^-?\d+\s*,\s*-?\d+\s*:/;
const POINT_AT = new RegExp(String.raw`^([ml]\s*)\(\s*(?:${NUM})\s*,\s*(?:${NUM})\s*\)`);

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** An item's text (`t(2,1): forest …`) at other coordinates. */
export function moveItem(item: string, q: number, r: number): string {
  if (CELL_AT.test(item)) return item.replace(CELL_AT, (_, p: string) => `${p.trim()}(${q},${r})`);
  if (LEGACY_AT.test(item)) return item.replace(LEGACY_AT, `t(${q},${r}):`);
  return item.replace(POINT_AT, (_, p: string) => `${p.trim()}(${fmt(q)},${fmt(r)})`);
}

const itemOf = (text: string) => text.replace(/^\s*(?:\*\s*)?/, "").trim();

/** Items in height groups as stamp lines: one group per height, the lowest at 0. */
function grouped(items: Array<{ height: number; item: string }>): string[] {
  const heights = [...new Set(items.map((i) => i.height))].sort((a, b) => a - b);
  const low = heights[0] ?? 0;
  if (heights.length <= 1) return items.map((i) => i.item);
  return heights.flatMap((h) => [`${h - low}m:`, ...items.filter((i) => i.height === h).map((i) => i.item)]);
}

/** The lines of the hexes `keys` (`q,r`) as a stamp, relative to the hex nearest their middle. */
export function stampFromHexes(source: string, keys: Set<string>): string[] {
  const map = parseHexMap(source);
  const lines = source.split("\n");
  const hexes = [...keys].map((k) => k.split(",").map(Number) as [number, number]);
  if (hexes.length === 0) return [];
  const mq = hexes.reduce((n, [q]) => n + q, 0) / hexes.length;
  const mr = hexes.reduce((n, [, r]) => n + r, 0) / hexes.length;
  const [aq, ar] = hexes.reduce((best, h) =>
    Math.hypot(h[0] - mq, h[1] - mr) < Math.hypot(best[0] - mq, best[1] - mr) ? h : best
  );
  const items: Array<{ height: number; item: string; line: number }> = [];
  for (const c of map.cells) {
    if (!keys.has(hexKey(c.q, c.r))) continue;
    items.push({ height: c.height, item: moveItem(itemOf(lines[c.line - 1]), c.q - aq, c.r - ar), line: c.line });
  }
  const pointIn = (q: number, r: number) => {
    const h = pixelToHex(1.5 * q, Math.sqrt(3) * (r + q / 2), 1);
    return keys.has(hexKey(h.q, h.r));
  };
  for (const st of map.stamps ?? []) {
    if (!keys.has(hexKey(st.q, st.r))) continue;
    items.push({ height: st.height, item: moveItem(itemOf(lines[st.line - 1]), st.q - aq, st.r - ar), line: st.line });
  }
  for (const p of [...map.markers, ...map.labels]) {
    if (!pointIn(p.q, p.r)) continue;
    const low = items.length ? Math.min(...items.map((i) => i.height)) : 0;
    items.push({ height: low, item: moveItem(itemOf(lines[p.line - 1]), p.q - aq, p.r - ar), line: p.line });
  }
  items.sort((a, b) => a.line - b.line);
  return grouped(items);
}

/** A stamp line's own lines, put down where it is (for Expand: it becomes ordinary lines). */
export function stampItems(def: string[], sl: HexStampLine): Array<{ height: number; item: string }> {
  const inner = readStamp(def);
  const out: Array<{ height: number; item: string; line: number }> = [];
  const place = (q: number, r: number) => {
    const t = rotateAxial(q, r, sl.rot);
    return { q: t.q + sl.q, r: t.r + sl.r };
  };
  for (const c of inner.cells) {
    const at = place(c.q, c.r);
    out.push({ height: c.height + sl.height, item: moveItem(itemOf(def[c.line - 2]), at.q, at.r), line: c.line });
  }
  for (const p of [...inner.markers, ...inner.labels]) {
    const at = place(p.q, p.r);
    out.push({ height: sl.height, item: moveItem(itemOf(def[p.line - 2]), at.q, at.r), line: p.line });
  }
  for (const s of inner.stamps ?? []) {
    const at = place(s.q, s.r);
    const item = moveItem(itemOf(def[s.line - 2]), at.q, at.r).replace(/\s+rot\s*=\s*-?\d+/i, "");
    const rot = (s.rot + sl.rot) % 6;
    out.push({ height: s.height + sl.height, item: rot ? `${item} rot=${rot}` : item, line: s.line });
  }
  return out.sort((a, b) => a.line - b.line).map(({ height, item }) => ({ height, item }));
}
