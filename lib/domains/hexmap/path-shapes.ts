/**
 * The shapes a path tile can have: which of the hex's six sides it runs out
 * through, named by type and slot (`straight-0`, `pfork-3`). Sides are
 * numbered clockwise from the north face — 0 N, 1 NE, 2 SE, 3 S, 4 SW, 5 NW —
 * and slot k is the type's slot-0 shape turned k sides clockwise, so the slot
 * is where the figure points. A type has as many slots as it has distinct
 * turns: `straight` has 3 (straight-3 would be straight-0 again), `star` 1.
 * Every set of sides is exactly one type and slot. A variant (`end`) is other
 * art with the same sides as its type (`start`). Any shape can also have a
 * centre other than the plain crossing: a **hub**, round (`start-4-hub`: a
 * cul-de-sac; a river's `turn60-2-hub`: a lake on a bend; a road's
 * `xfork-0-hub`: a roundabout), or a **stub**, where the path begins inside
 * the hex and branches out (`turn120-5-stub`). Autotile never picks a stub
 * by itself: it marks a place, so only a map, or a rule, asks for one. And
 * one of its sides can be a **mouth**, opening across that whole side instead
 * of meeting its middle (`turn120-4-mouth0`: a river widening into the sea at
 * the north side).
 * `autotile:` tables key tiles by shape name, so each of these is its own entry.
 *
 * Far art (`far:` tables, far.ts) uses the same shapes for the neighbours of
 * the same kind a hex has, and one more: `alone`, a hex with none.
 *
 * Edge pieces (a coast, laid along a hex's sides) have their own shapes, the
 * runs: `run3-0` covers three neighbouring sides centred on N. They use the
 * same slots and names, with no centre or mouth (see `EDGE_SHAPES`).
 */

import { type Side, SIDES } from "./axial";

export interface PathShape {
  /** A path's shape (the sides it runs out through) or an edge's (the sides it lies along). */
  kind: "path" | "edge";
  type: string;
  /** The sides at slot 0, by number. */
  base: number[];
  /** Distinct turns: slots run 0 to slots − 1. */
  slots: number;
  /** What slot 0 looks like, in words. */
  hint: string;
  /** The type whose sides it shares, for other art of the same shape. */
  variantOf?: string;
}

function shape(type: string, base: number[], hint: string, variantOf?: string): PathShape {
  const key = (k: number) => turn(base, k).join(",");
  let slots = 1;
  while (slots < 6 && key(slots) !== key(0)) slots++;
  return { kind: "path", type, base, slots, hint, ...(variantOf ? { variantOf } : {}) };
}

function run(type: string, base: number[], hint: string): PathShape {
  return { ...shape(type, base, hint), kind: "edge" };
}

/** The sides turned k steps clockwise, sorted. */
function turn(sides: number[], k: number): number[] {
  return sides.map((s) => (s + k) % 6).sort((a, b) => a - b);
}

/** By number of sides, then by how spread out they are. */
export const PATH_SHAPES: PathShape[] = [
  shape("start", [0], "where a path begins: out through N only"),
  shape("end", [0], "where a path stops: out through N only", "start"),
  shape("turn60", [0, 1], "a sharp bend, N and NE"),
  shape("turn120", [0, 2], "a wide bend, N and SE"),
  shape("straight", [0, 3], "N through to S"),
  shape("nfork", [5, 0, 1], "three sides side by side, the middle one N"),
  // A twin pair: the stem at the slot, the branch on the left or right as you come in from it.
  shape("lfork", [0, 2, 3], "N to S, with a branch on the left (SE)"),
  shape("rfork", [0, 3, 4], "N to S, with a branch on the right (SW)"),
  shape("yfork", [0, 2, 4], "every other side: N, SE, SW"),
  shape("mfork", [0, 1, 2, 3], "four sides side by side, N to S"),
  shape("pfork", [0, 2, 3, 4], "N to S, with branches SE and SW"),
  shape("xfork", [0, 2, 3, 5], "two straights crossing: N–S and SE–NW"),
  shape("star5", [0, 1, 2, 4, 5], "every side but S"),
  shape("star", [0, 1, 2, 3, 4, 5], "every side"),
];

/**
 * Edge pieces: a run of neighbouring sides. Odd runs point at their middle
 * side (like `nfork`), even ones start at their first side clockwise (like
 * `turn60`). Any sides a hex needs are covered by runs, so pieces stack.
 */
export const EDGE_SHAPES: PathShape[] = [
  run("run1", [0], "along N"),
  run("run2", [0, 1], "along N and NE"),
  run("run3", [5, 0, 1], "along NW, N and NE"),
  run("run4", [0, 1, 2, 3], "along N, NE, SE and S"),
  run("run5", [4, 5, 0, 1, 2], "along every side but S"),
  run("ring", [0, 1, 2, 3, 4, 5], "all the way round"),
];

/** Far art's own shape: a hex with no neighbour of its kind (a lone wood). Not a path's. */
export const ALONE: PathShape = shape("alone", [], "on its own: no neighbour of its kind");

/** Far art's shapes: alone, then the paths' types (a far tile shows which sides join its neighbours). */
export const FAR_SHAPES: PathShape[] = [ALONE, ...PATH_SHAPES.filter((s) => !s.variantOf)];

const BY_TYPE = new Map([...PATH_SHAPES, ...EDGE_SHAPES, ALONE].map((s) => [s.type, s]));

/** The shapes of a kind: paths', edges' or far art's. */
export function shapesOf(kind: PathShape["kind"] | "far"): PathShape[] {
  return kind === "edge" ? EDGE_SHAPES : kind === "far" ? FAR_SHAPES : PATH_SHAPES;
}

export function pathShape(type: string): PathShape | undefined {
  return BY_TYPE.get(type.toLowerCase());
}

/** The sides a type at a slot runs out through, in N…NW order. */
export function shapeSides(type: string, slot: number): Side[] {
  const s = pathShape(type);
  if (!s) return [];
  return turn(s.base, ((slot % s.slots) + s.slots) % s.slots).map((i) => SIDES[i]);
}

/** The side mask (`N,SE`, as `autotile:` tables key it) of a type at a slot. */
export function shapeMask(type: string, slot: number): string {
  return shapeSides(type, slot).join(",");
}

export interface ShapeSlot {
  type: string;
  slot: number;
  /** Not the plain crossing: `hub`, a round centre (a cul-de-sac, a roundabout, a
   *  lake); `stub`, the path beginning inside the hex. */
  centre?: Centre;
  /** The side (0 N … 5 NW, one of the shape's own) that opens across its whole width: a river's mouth. */
  mouth?: number;
}

export type Centre = "hub" | "stub";
/** The centres, as their name suffixes (`start-4-hub`, `turn120-5-stub`). */
export const CENTRES: Centre[] = ["hub", "stub"];
/** The suffix naming a shape's mouth side (`turn120-4-mouth0`). */
export const MOUTH = "mouth";

export function sameShape(a: ShapeSlot | null, b: ShapeSlot | null): boolean {
  return a?.type === b?.type && a?.slot === b?.slot && a?.centre === b?.centre && a?.mouth === b?.mouth;
}

const BY_MASK = new Map<string, ShapeSlot>();
for (const s of PATH_SHAPES.filter((x) => !x.variantOf))
  for (let slot = 0; slot < s.slots; slot++) BY_MASK.set(shapeMask(s.type, slot), { type: s.type, slot });

/** The type and slot of a side mask in canonical form (`N,SE`), or null for none. */
export function classifyMask(mask: string): ShapeSlot | null {
  return BY_MASK.get(mask) ?? null;
}

/**
 * Every shape with these sides (`N`): the type first, then its variants, then
 * each of those with a hub (never a stub: autotile doesn't pick those). With a `mouth` side, the same again opening there
 * come first, so the plain shapes are only a fallback.
 */
export function shapesWithSides(mask: string, mouth?: Side): ShapeSlot[] {
  const base = classifyMask(mask);
  if (!base) return [];
  const variants = PATH_SHAPES.filter((s) => s.variantOf === base.type).map((s) => ({ type: s.type, slot: base.slot }));
  const plain = [base, ...variants];
  const all: ShapeSlot[] = [...plain, ...plain.map((s): ShapeSlot => ({ ...s, centre: "hub" }))];
  const at = mouth ? SIDES.indexOf(mouth) : -1;
  if (at < 0 || !mask.split(",").includes(mouth as string)) return all;
  return [...all.map((s) => ({ ...s, mouth: at })), ...all];
}

/** A side mask written any way (`se, n`) in N…NW order (`N,SE`), or null if a part isn't a side. */
function readMask(key: string): string | null {
  const parts = key.split(",").map((p) => p.trim().toUpperCase());
  if (!parts.every((p) => (SIDES as string[]).includes(p))) return null;
  return SIDES.filter((side) => parts.includes(side)).join(",");
}

/** Older shape names, read as what they are now. */
const RENAMED: Record<string, (slot: number) => ShapeSlot> = {
  culdesac: (slot) => ({ type: "start", slot, centre: "hub" }),
};

/** An `autotile:` table key as the shape it names (`start-0`): a shape name, an
 *  older one (`culdesac-4` is `start-4-hub`), or a side mask (`N`) read as its
 *  type. Null when it's none of these. */
export function shapeKey(key: string, kind: PathShape["kind"] | "far" = "path"): string | null {
  if (kind === "far") {
    const named = shapeFromName(key);
    if (named)
      return pathShape(named.type)?.kind === "path" && !named.centre && named.mouth === undefined
        ? shapeName(named)
        : null;
    if (/^alone$/i.test(key.trim())) return "alone-0";
    const mask = readMask(key);
    const base = mask ? classifyMask(mask) : null;
    return base ? shapeName(base) : null;
  }
  if (kind === "edge") {
    const named = shapeFromName(key);
    return named && pathShape(named.type)?.kind === "edge" ? shapeName(named) : null;
  }
  const old = /^([a-z]+)-(\d)$/i.exec(key.trim());
  const renamed = old && RENAMED[old[1].toLowerCase()];
  if (renamed && old) return shapeName(renamed(Number(old[2])));
  const named = shapeFromName(key);
  if (named) return pathShape(named.type)?.kind === "path" && named.type !== "alone" ? shapeName(named) : null;
  const mask = readMask(key);
  const base = mask ? classifyMask(mask) : null;
  return base ? shapeName(base) : null;
}

/** Where a shape name sorts: in catalogue order, then by slot; a shape before
 *  its hub and stub, each before their mouths. */
export function shapeOrder(name: string): number {
  const s = shapeFromName(name);
  if (!s) return Infinity;
  return (
    shapesOf(pathShape(s.type)?.kind ?? "path").findIndex((x) => x.type === s.type) * 1000 +
    s.slot * 100 +
    (s.centre ? 10 * (CENTRES.indexOf(s.centre) + 1) : 0) +
    (s.mouth ?? -1) +
    1
  );
}

/** A tile name that follows the standard (`straight-1`, `Pfork-3`, `start-0b`,
 *  `start-4-hub`, `turn120-5-stub`, `turn120-4-mouth0`) read as its shape, else
 *  null. A mouth on a side the shape doesn't use names nothing, and so does a
 *  stub on a `start` (which begins inside the hex anyway). */
export function shapeFromName(name: string): ShapeSlot | null {
  // A letter after the slot tells apart tiles of one shape in a folder (`straight-0b`).
  const m = new RegExp(`^([a-z0-9]+?)-(\\d)[b-z]?(-(?:${CENTRES.join("|")}))?(-${MOUTH}(\\d))?$`, "i").exec(
    name.trim()
  );
  if (!m) return null;
  const s = pathShape(m[1]);
  const slot = Number(m[2]);
  if (!s || slot >= s.slots) return null;
  // Edge pieces have no centre and no mouth.
  if (s.kind === "edge" && (m[3] || m[5] !== undefined)) return null;
  const shape: ShapeSlot = { type: s.type, slot };
  if (m[3]) shape.centre = m[3].slice(1).toLowerCase() as Centre;
  if (shape.centre === "stub" && s.base.length === 1) return null;
  if (m[5] !== undefined) {
    const mouth = Number(m[5]);
    if (!shapeSides(s.type, slot).includes(SIDES[mouth])) return null;
    shape.mouth = mouth;
  }
  return shape;
}

/** `straight-0`; with `letter`, the extra tile of that shape in a folder (`straight-0b`). */
export function shapeName({ type, slot, centre, mouth }: ShapeSlot, letter = ""): string {
  return `${type}-${slot}${letter}${centre ? `-${centre}` : ""}${mouth !== undefined ? `-${MOUTH}${mouth}` : ""}`;
}

/**
 * New names for listed tiles so each is called by its shape: `straight-0`, then
 * `straight-0b`, `straight-0c` for more in one folder (`start-4b-hub` with a hub). A tile already named for
 * its shape keeps its name; a name another file holds is skipped over.
 *
 * @param listed tile paths below the layer (`roads/clean/x`) and the shape each is listed as
 * @param taken every tile path in the layer, so names stay unique
 * @returns renames, `from` and `to` both paths below the layer
 */
export function planShapeRenames(
  listed: Array<{ path: string; shape: string }>,
  taken: string[]
): Array<{ from: string; to: string }> {
  const split = (path: string) => {
    const at = path.lastIndexOf("/");
    return { dir: path.slice(0, at + 1), name: path.slice(at + 1) };
  };
  const LETTERS = ["", ..."bcdefghijklmnopqrstuvwxyz"];
  const namesFor = (shape: string) => {
    const s = shapeFromName(shape);
    return s ? LETTERS.map((l) => shapeName(s, l)) : [];
  };
  const isNamedFor = (name: string, shape: string) => namesFor(shape).includes(name.toLowerCase());
  const movers = listed.filter((t) => !isNamedFor(split(t.path).name, t.shape));
  const moving = new Set(movers.map((t) => t.path.toLowerCase()));
  const occupied = new Set(taken.map((p) => p.toLowerCase()).filter((p) => !moving.has(p)));
  const out: Array<{ from: string; to: string }> = [];
  for (const t of [...movers].sort((x, y) => x.path.localeCompare(y.path))) {
    const { dir } = split(t.path);
    const name = namesFor(t.shape).find((n) => !occupied.has((dir + n).toLowerCase()));
    if (!name) continue;
    occupied.add((dir + name).toLowerCase());
    out.push({ from: t.path, to: dir + name });
  }
  return out;
}

/**
 * The edge pieces that cover a hex's sides (those `along` is true for), run by
 * run: one piece for a run when `has` says there's one that long, else the
 * longest there is, then the rest of the run the same way. A hex with every
 * side takes a `ring`, else is covered like one long run from N.
 */
export function coverSides(along: boolean[], has: (shape: ShapeSlot) => boolean): ShapeSlot[] {
  const n = along.filter(Boolean).length;
  if (n === 0) return [];
  if (n === 6 && has({ type: "ring", slot: 0 })) return [{ type: "ring", slot: 0 }];
  // Walk from a side that starts a run (right after one that isn't covered).
  const from = n === 6 ? 0 : (along.findIndex((a, i) => !a && along[(i + 1) % 6]) + 1) % 6;
  const pieces: ShapeSlot[] = [];
  let i = 0;
  while (i < 6) {
    if (!along[(from + i) % 6]) {
      i++;
      continue;
    }
    let length = 0;
    while (length < 6 - i && along[(from + i + length) % 6]) length++;
    // Cover this run, longest pieces first.
    let at = from + i;
    let left = length;
    while (left > 0) {
      let size = Math.min(left, 5);
      while (size > 1 && !has(runAt(size, at))) size--;
      pieces.push(runAt(size, at));
      at += size;
      left -= size;
    }
    i += length;
  }
  return pieces;
}

/** The run of `size` sides starting at side `first`, as a shape and slot. */
function runAt(size: number, first: number): ShapeSlot {
  // Odd runs are slotted by their middle side, even ones by their first.
  const slot = (size % 2 ? first + (size - 1) / 2 : first) % 6;
  return { type: `run${size}`, slot };
}
