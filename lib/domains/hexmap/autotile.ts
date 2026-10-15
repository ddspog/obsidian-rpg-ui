/**
 * Paths that join up. `p(q,r): roads` — a path naming only its family, when
 * the pack's `pack.yml` has an `autotile:` table for it — draws the tile whose
 * ends face the neighbouring hexes with the same path (and, with
 * `connectsTo: [water]`, the neighbouring water hexes a river runs into).
 * A full spec (`roads[clean][turn60-3]`) is drawn as written and never joined.
 */

import { type Axial, hexKey, neighbour, type Side, SIDES } from "./axial";
import { type HexPack, hashSeed, parseTileSpec, resolveCatalog, type TileFile } from "./packs";

/** The family a path spec joins as, or null when it's drawn as written. */
export function autotileFamily(pack: HexPack | undefined, spec: string): string | null {
  if (!pack) return null;
  const { base, parts } = parseTileSpec(resolveCatalog(pack, spec).spec);
  if (parts.length > 0) return null;
  const key = Object.keys(pack.config.autotile).find((k) => k.toLowerCase() === base.toLowerCase());
  return key ?? null;
}

export interface Surroundings {
  /** Path families present on each hex. */
  paths: Map<string, Set<string>>;
  /** Terrain base folder on each hex (`water`, `forest`), lower-cased. */
  terrain: Map<string, string>;
}

/** The sides of a hex that face a neighbour with the same path, plus its
 *  mouth if it has one (see `pathMouths`). */
export function sideMask(h: Axial, family: string, around: Surroundings, mouths?: Map<string, Side>): Side[] {
  const mouth = mouths?.get(hexKey(h.q, h.r));
  return SIDES.filter((side) => side === mouth || around.paths.get(keyAt(h, side))?.has(family));
}

function keyAt(h: Axial, side: Side): string {
  const n = neighbour(h, side);
  return hexKey(n.q, n.r);
}

/**
 * Where each path of a family runs into a `connectsTo` terrain (a river into
 * the sea): one mouth per connected path, at one of its ends, through the
 * side most nearly straight on from where it comes in — never more than one
 * side off, so a river doesn't double back into the sea beside it. When both
 * ends could, the one written last wins (rivers are written source to mouth).
 *
 * @param order the family's hex keys in the order their lines are written
 */
export function pathMouths(
  family: string,
  around: Surroundings,
  connectsTo: string[],
  order: string[]
): Map<string, Side> {
  const mouths = new Map<string, Side>();
  const joins = connectsTo.map((c) => c.toLowerCase());
  if (joins.length === 0) return mouths;
  const has = (key: string) => around.paths.get(key)?.has(family) ?? false;
  const toAxial = (key: string): Axial => {
    const [q, r] = key.split(",").map(Number);
    return { q, r };
  };
  const seen = new Set<string>();
  for (const start of order) {
    if (seen.has(start) || !has(start)) continue;
    // One connected path.
    const part: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const key = queue.shift() as string;
      part.push(key);
      for (const side of SIDES) {
        const n = keyAt(toAxial(key), side);
        if (has(n) && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    let best: { key: string; side: Side; turn: number; at: number } | null = null;
    for (const key of part) {
      const h = toAxial(key);
      const sides = SIDES.filter((side) => has(keyAt(h, side)));
      if (sides.length > 1) continue;
      const from = sides.length === 1 ? SIDES.indexOf(sides[0]) : -1;
      for (const side of SIDES) {
        const t = around.terrain.get(keyAt(h, side));
        if (!t || !joins.includes(t)) continue;
        const x = (SIDES.indexOf(side) - from + 9) % 6;
        const turn = from < 0 ? 0 : Math.min(x, 6 - x);
        if (turn > 1) continue;
        const at = order.lastIndexOf(key);
        if (!best || turn < best.turn || (turn === best.turn && at > best.at)) best = { key, side, turn, at };
      }
    }
    if (best) mouths.set(best.key, best.side);
  }
  return mouths;
}

/** The tile for a side combination, varied by the seed when the table lists several. */
export function pickAutotile(pack: HexPack, family: string, sides: Side[], seed: string): TileFile | null {
  const list = pack.config.autotile[family]?.tiles[sides.join(",")];
  if (!list?.length) return null;
  const files = list.map((p) => pack.byPath.path.get(p.toLowerCase())).filter((f): f is TileFile => !!f);
  return files.length ? files[hashSeed(seed) % files.length] : null;
}

/** Stroke colour for a path drawn without a tile. */
export function pathColor(family: string): string {
  const f = family.toLowerCase();
  if (f.startsWith("river") || f.startsWith("stream")) return "#4a90c8";
  if (f.startsWith("wall")) return "#6d6d6d";
  return "#8a6a45";
}
