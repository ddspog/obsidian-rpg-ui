/**
 * Far art composed from sprites (design §13.11): a family's recipe in
 * `pack.yml` that the pack studio's composer edits and bakes into one image
 * per shape (`far/<family>/<shape>.webp`, listed in `far:`'s `tiles:`).
 *
 *   far:
 *     forest:
 *       compose:
 *         sprites:                                   # the template
 *           - { src: "stack/foliage/Tree 3", zone: mid, x: 0, y: 0.1, s: 0.6 }
 *           - { src: "stack/foliage/Tree 5", zone: "*+", x: 0, y: -0.3, s: 0.5 }
 *           - { src: "stack/foliage/Bush 1", zone: "*-", x: 0.05, y: -0.32, s: 0.4, flip: true }
 *         shapes:                                    # variations finished by hand
 *           straight-0:
 *             - { src: "stack/foliage/Tree 3", x: 0, y: 0, s: 0.6 }
 *
 * Sprites stand on their point (`x`, `y`: the middle of their foot), in hex
 * widths from the hex's centre (y down; the face runs ±√3/4). `s` scales the
 * sprite from its size on the map. Zones say when a template sprite is drawn:
 * `mid` always; `N+` when the hex joins its neighbour across N, `N-` when it
 * doesn't (and so for each side); `*+` / `*-` are drawn as if for N and turned
 * round to every side that's joined, or open, so one side's design does all six.
 * A variation in `shapes:` is drawn as its own list instead of the template.
 */

import { type Side, SIDES } from "./axial";
import { shapeName, shapeSides, FAR_SHAPES, type ShapeSlot } from "./path-shapes";

export type FarZone = "mid" | "*+" | "*-" | `${Side}+` | `${Side}-`;

export interface FarSprite {
  /** Layer and path, without extension (`stack/foliage/Foliage - Tree 3 (lush)`). */
  src: string;
  x: number;
  y: number;
  s: number;
  flip?: boolean;
}

export interface FarTemplateSprite extends FarSprite {
  zone: FarZone;
}

export interface FarCompose {
  sprites: FarTemplateSprite[];
  /** Variations finished by hand, by shape name: drawn instead of the template. */
  shapes: Record<string, FarSprite[]>;
  /** The baked image's width and height, in hex widths (room for sprites to reach past the hex). */
  canvas: number;
}

export const DEFAULT_CANVAS = 1.5;

const ZONES = new Set<string>(["mid", "*+", "*-", ...SIDES.flatMap((s) => [`${s}+`, `${s}-`])]);

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

function readSprite(raw: unknown): FarSprite | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.src !== "string" || !o.src.trim()) return null;
  return {
    src: o.src.trim(),
    x: num(o.x, 0),
    y: num(o.y, 0),
    s: num(o.s, 1),
    ...(o.flip === true ? { flip: true } : {}),
  };
}

/** A family's `compose:`, or undefined when it has none. */
export function readCompose(raw: unknown): FarCompose | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const sprites: FarTemplateSprite[] = [];
  for (const item of Array.isArray(o.sprites) ? o.sprites : []) {
    const s = readSprite(item);
    const zone = (item as Record<string, unknown>)?.zone;
    if (s) sprites.push({ ...s, zone: typeof zone === "string" && ZONES.has(zone) ? (zone as FarZone) : "mid" });
  }
  const shapes: Record<string, FarSprite[]> = {};
  if (o.shapes && typeof o.shapes === "object") {
    for (const [name, list] of Object.entries(o.shapes as Record<string, unknown>)) {
      shapes[name] = (Array.isArray(list) ? list : []).map(readSprite).filter((s): s is FarSprite => !!s);
    }
  }
  return { sprites, shapes, canvas: Math.max(1, num(o.canvas, DEFAULT_CANVAS)) };
}

/** A recipe as `pack.yml` writes it (defaults left out). */
export function composeValue(c: FarCompose): Record<string, unknown> {
  const sprite = (s: FarSprite) => ({
    src: s.src,
    x: round(s.x),
    y: round(s.y),
    s: round(s.s),
    ...(s.flip ? { flip: true } : {}),
  });
  return {
    ...(c.canvas !== DEFAULT_CANVAS ? { canvas: c.canvas } : {}),
    sprites: c.sprites.map((s) => ({ ...sprite(s), zone: s.zone })),
    ...(Object.keys(c.shapes).length
      ? { shapes: Object.fromEntries(Object.entries(c.shapes).map(([k, list]) => [k, list.map(sprite)])) }
      : {}),
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** A point turned `k` sides clockwise about the hex's centre. */
export function turnPoint(x: number, y: number, k: number): { x: number; y: number } {
  const a = (Math.PI / 3) * k;
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
}

/** Every variation far art has, in catalogue order: alone, then each type's slots. */
export function farVariations(): ShapeSlot[] {
  return FAR_SHAPES.flatMap((s) => [...Array(s.slots).keys()].map((slot) => ({ type: s.type, slot })));
}

/** One template sprite drawn in a variation: where, and which zone (and side) it came from. */
export interface PlacedSprite extends FarSprite {
  /** The template sprite's index; absent for a variation's own. */
  from?: number;
  /** The side a `*+` / `*-` sprite is turned to (0 is itself). */
  turn?: number;
}

/** The sprites of a variation with these joined sides, from the template (not its own list). */
export function templateSprites(c: FarCompose, joined: Side[]): PlacedSprite[] {
  const out: PlacedSprite[] = [];
  c.sprites.forEach((s, i) => {
    if (s.zone === "mid") {
      out.push({ ...s, from: i });
      return;
    }
    if (s.zone === "*+" || s.zone === "*-") {
      const want = s.zone === "*+";
      SIDES.forEach((side, k) => {
        if (joined.includes(side) !== want) return;
        out.push({ ...s, ...turnPoint(s.x, s.y, k), from: i, turn: k });
      });
      return;
    }
    const side = s.zone.slice(0, -1) as Side;
    if (joined.includes(side) === s.zone.endsWith("+")) out.push({ ...s, from: i });
  });
  return out;
}

/** A variation's sprites: its own list when it has one, else the template's; front ones last. */
export function spritesFor(c: FarCompose, shape: ShapeSlot): PlacedSprite[] {
  const own = c.shapes[shapeName(shape)];
  const list: PlacedSprite[] = own
    ? own.map((s) => ({ ...s }))
    : templateSprites(c, shapeSides(shape.type, shape.slot));
  return depthSorted(list);
}

/** Back to front: the sprite standing higher up the hex is behind. */
export function depthSorted<T extends { y: number }>(list: T[]): T[] {
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.y - b.s.y || a.i - b.i)
    .map((e) => e.s);
}
