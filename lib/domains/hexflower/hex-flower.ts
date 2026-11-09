/**
 * `rpg hexflower` — a hex flower: a table of 19 hexes in rings round a Start hex, walked by a token
 * (Campaign Builder: Dungeons & Ruins, "Map Element Tables"). Each roll moves the token one hex in
 * the direction the dice say; off the edge it wraps round to the far end of the same line, unless an
 * arrow on that edge sends it somewhere else. Results after the first depend on the ones before, so
 * terrain flows (no swamp next to a mountain).
 *
 *   title: Wilderness Terrain Elements
 *   dice: 2d6                      # the default
 *   directions:                    # the default: Start's numbers
 *     N: 2, 12
 *     NE: 3-4
 *     SE: 5-6
 *     S: 7
 *     SW: 8-9
 *     NW: 10-11
 *   start: previous                # landing on Start: the last result again, or a result ("Up/Down")
 *   cells:                         # each hex, by its steps from Start (`N N`), or axial `q,r`
 *     N N: Mountains
 *     N: Hills
 *     NW SW: Desert / Grassland     # two in one: d6 picks, 1–3 the first, 4–6 the second
 *   arrows:                        # an edge that sends the token elsewhere instead of wrapping
 *     N N > N: stay
 *     N N > NW: NW N
 *   doubles: Roll on [[Distinct Hex Elements]]   # said when the dice show doubles (both dice alike)
 *   doublesTable: "#distinct-hex-elements"      # and rolled for you: a table block here, or [[Note]]#name
 *   temperature: true              # a die of 1 shifts colder, a 6 warmer (both: back to temperate)
 *   shifts:                        # what a result becomes when it's hot or cold
 *     hot: { Forest: Jungle }
 *     cold: { Desert: Tundra, Grassland: Tundra }
 *
 * The flower is flat-topped, like the hex maps: the same six sides (N, NE, SE, S, SW, NW) and axial
 * coordinates (q east, r south-east), so a walk on the flower is a walk on a map.
 */

import { parse as parseYaml } from "yaml";
import { type Axial, hexKey, neighbour, type Side, SIDES, SIDE_STEP } from "lib/domains/hexmap/axial";

export interface FlowerCell {
  at: Axial;
  /** As written (`Desert / Grassland`). */
  text: string;
  /** The results it can give: one, or several split by ` / `. */
  options: string[];
}

export interface FlowerArrow {
  from: Axial;
  side: Side;
  /** Where the token goes: a cell, or the same one (`stay`). */
  to: Axial;
}

export type Temperature = -1 | 0 | 1;

export interface HexFlower {
  title?: string;
  /** Dice rolled for a direction: count and sides (2d6). */
  dice: { count: number; sides: number };
  /** Which side each total moves the token to. */
  directions: Map<number, Side>;
  /** Hexes away from Start (2 for the 19-hex flower). */
  radius: number;
  cells: Map<string, FlowerCell>;
  arrows: FlowerArrow[];
  /** Landing on Start: repeat the previous result (`previous`), or this result. */
  start: "previous" | string;
  doubles?: string;
  /** A table rolled on doubles (`doublesTable: "#distinct-hex-elements"`, or `[[Note]]#name`). */
  doublesTable?: string;
  temperature: boolean;
  shifts: { hot: Record<string, string>; cold: Record<string, string> };
  errors: string[];
}

const SIDE_NAMES: Record<string, Side> = {
  n: "N",
  north: "N",
  up: "N",
  ne: "NE",
  northeast: "NE",
  se: "SE",
  southeast: "SE",
  s: "S",
  south: "S",
  down: "S",
  sw: "SW",
  southwest: "SW",
  nw: "NW",
  northwest: "NW",
};

export function sideOf(word: string): Side | null {
  return SIDE_NAMES[word.trim().toLowerCase().replace(/[-\s]/g, "")] ?? null;
}

/** Start's numbers in the book's flowers. */
export const DEFAULT_DIRECTIONS: Array<[Side, number[]]> = [
  ["N", [2, 12]],
  ["NE", [3, 4]],
  ["SE", [5, 6]],
  ["S", [7]],
  ["SW", [8, 9]],
  ["NW", [10, 11]],
];

/** A hex written as steps from Start (`N N`, `NW,SW`, `start`) or axial (`-1,2`, `(0,-2)`). */
export function readPlace(text: string): Axial | null {
  const t = text.trim();
  if (/^(start|centre|center)$/i.test(t)) return { q: 0, r: 0 };
  const axial = t.match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
  if (axial) return { q: parseInt(axial[1], 10), r: parseInt(axial[2], 10) };
  let at: Axial = { q: 0, r: 0 };
  const words = t.split(/[\s,]+/).filter(Boolean);
  if (!words.length) return null;
  for (const w of words) {
    const side = sideOf(w);
    if (!side) return null;
    at = neighbour(at, side);
  }
  return at;
}

/** Totals from a `directions:` value: `2, 12`, `3-4`, `[8, 9]`, `7`. */
function readTotals(v: unknown): number[] {
  const parts = Array.isArray(v) ? v.map(String) : String(v ?? "").split(",");
  const out: number[] = [];
  for (const p of parts) {
    const range = p.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) for (let n = parseInt(range[1], 10); n <= parseInt(range[2], 10); n++) out.push(n);
    else if (/^\d+$/.test(p.trim())) out.push(parseInt(p.trim(), 10));
  }
  return out;
}

export function distanceFromStart(a: Axial): number {
  return (Math.abs(a.q) + Math.abs(a.r) + Math.abs(a.q + a.r)) / 2;
}

function readShifts(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw))
    for (const [k, v] of Object.entries(raw as Record<string, unknown>))
      if (typeof v === "string" && v.trim()) out[k.trim().toLowerCase()] = v.trim();
  return out;
}

export function parseHexFlower(source: string): HexFlower {
  const flower: HexFlower = {
    dice: { count: 2, sides: 6 },
    directions: new Map(),
    radius: 2,
    cells: new Map(),
    arrows: [],
    start: "previous",
    temperature: false,
    shifts: { hot: {}, cold: {} },
    errors: [],
  };
  let raw: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(source);
    if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
  } catch (err) {
    flower.errors.push(`can't read the block: ${err instanceof Error ? err.message.split("\n")[0] : "invalid YAML"}`);
  }
  if (typeof raw.title === "string") flower.title = raw.title.trim();
  const dice = String(raw.dice ?? "2d6").match(/^(\d*)d(\d+)$/i);
  if (dice) flower.dice = { count: parseInt(dice[1] || "1", 10), sides: parseInt(dice[2], 10) };
  else flower.errors.push(`dice: "${String(raw.dice)}" isn't dice like 2d6`);

  const dirs: Array<[Side, number[]]> = [];
  if (raw.directions && typeof raw.directions === "object") {
    for (const [k, v] of Object.entries(raw.directions as Record<string, unknown>)) {
      const side = sideOf(k);
      if (!side) flower.errors.push(`directions: "${k}" isn't a side (N, NE, SE, S, SW, NW)`);
      else dirs.push([side, readTotals(v)]);
    }
  }
  for (const [side, totals] of dirs.length ? dirs : DEFAULT_DIRECTIONS)
    for (const n of totals) flower.directions.set(n, side);
  const min = flower.dice.count;
  const max = flower.dice.count * flower.dice.sides;
  const missing: number[] = [];
  for (let n = min; n <= max; n++) if (!flower.directions.has(n)) missing.push(n);
  if (missing.length) flower.errors.push(`directions: no side for ${missing.join(", ")}`);

  if (raw.cells && typeof raw.cells === "object") {
    for (const [k, v] of Object.entries(raw.cells as Record<string, unknown>)) {
      const at = readPlace(k);
      const text = v === null || v === undefined ? "" : String(v).trim();
      if (!at) {
        flower.errors.push(`cells: "${k}" isn't a place — steps from Start (N N, NW SW) or q,r`);
        continue;
      }
      flower.cells.set(hexKey(at.q, at.r), {
        at,
        text,
        // `Desert / Grassland`: two in one (a link's `/` doesn't split).
        options: (text.includes("[[") ? [text] : text.split("/")).map((o) => o.trim()).filter(Boolean),
      });
      flower.radius = Math.max(flower.radius, distanceFromStart(at));
    }
  }
  if (!flower.cells.size) flower.errors.push("cells: none — list each hex as `N N: Mountains`");

  if (raw.arrows && typeof raw.arrows === "object") {
    for (const [k, v] of Object.entries(raw.arrows as Record<string, unknown>)) {
      const m = k.match(/^(.*)>\s*(\S+)\s*$/);
      const from = m ? readPlace(m[1]) : null;
      const side = m ? sideOf(m[2]) : null;
      const target = String(v ?? "").trim();
      const to = /^(stay|same|here)$/i.test(target) ? from : readPlace(target);
      if (!from || !side || !to) {
        flower.errors.push(`arrows: "${k}: ${target}" — write \`N N > NW: NW N\` (from, the side rolled, where to)`);
        continue;
      }
      flower.arrows.push({ from, side, to });
    }
  }
  if (typeof raw.start === "string" && raw.start.trim()) flower.start = raw.start.trim();
  if (typeof raw.doubles === "string" && raw.doubles.trim()) flower.doubles = raw.doubles.trim();
  if (typeof raw.doublesTable === "string" && raw.doublesTable.trim()) flower.doublesTable = raw.doublesTable.trim();
  flower.temperature = raw.temperature === true;
  if (raw.shifts && typeof raw.shifts === "object") {
    const s = raw.shifts as Record<string, unknown>;
    flower.shifts = { hot: readShifts(s.hot ?? s.warm), cold: readShifts(s.cold) };
  }
  return flower;
}

/** Where the token is, and what it remembers. */
export interface FlowerState {
  at: Axial;
  temperature: Temperature;
  /** The last result (what Start repeats). */
  last?: string;
}

export const startState = (): FlowerState => ({ at: { q: 0, r: 0 }, temperature: 0 });

export interface FlowerStep {
  dice: number[];
  total: number;
  side: Side;
  from: Axial;
  to: Axial;
  /** Went off the edge and came in on the far side of the line. */
  wrapped: boolean;
  /** An arrow on the edge sent it. */
  arrow: boolean;
  /** The cell's text as written. */
  cell: string;
  /** What the roll gives: the cell's option (picked with `pick` when it has several), Start's
   *  result, shifted by temperature. */
  result: string;
  /** The die that picked between a cell's options. */
  pick?: number;
  doubles: boolean;
  temperature: Temperature;
  /** The temperature changed with this roll. */
  shifted: boolean;
  /** Landed on Start. */
  start: boolean;
}

function inside(f: HexFlower, a: Axial): boolean {
  return distanceFromStart(a) <= f.radius;
}

/** Where the token goes from `from` towards `side`: an arrow on that edge, the neighbour, or round
 *  to the far end of the line through `from`. */
export function moveToken(f: HexFlower, from: Axial, side: Side): { to: Axial; wrapped: boolean; arrow: boolean } {
  const arrow = f.arrows.find((a) => a.from.q === from.q && a.from.r === from.r && a.side === side);
  if (arrow) return { to: arrow.to, wrapped: false, arrow: true };
  const next = neighbour(from, side);
  if (inside(f, next)) return { to: next, wrapped: false, arrow: false };
  const back = SIDE_STEP[SIDES[(SIDES.indexOf(side) + 3) % 6]];
  let at = from;
  for (;;) {
    const prev = { q: at.q + back.q, r: at.r + back.r };
    if (!inside(f, prev)) break;
    at = prev;
  }
  return { to: at, wrapped: true, arrow: false };
}

/** Choose among a cell's options with a die: d6 for two or three (1–3 / 4–6, or pairs), else one
 *  side each. */
export function pickDie(options: number): number {
  return 6 % options === 0 ? 6 : options;
}

export function pickOption(options: string[], die: number): string {
  const sides = pickDie(options.length);
  const per = sides / options.length;
  return options[Math.min(options.length - 1, Math.floor((die - 1) / per))];
}

/** The result with the temperature's shift (`Forest` → `Jungle` when hot). */
export function shiftResult(f: HexFlower, result: string, temperature: Temperature): string {
  if (!temperature) return result;
  const table = temperature > 0 ? f.shifts.hot : f.shifts.cold;
  return table[result.toLowerCase()] ?? result;
}

export const TEMPERATURE_NAMES: Record<Temperature, string> = { [-1]: "Cold", 0: "Temperate", 1: "Hot" };

/** One roll: `dice` (each die), and `pick` (a die of that many sides) for a cell with several results. */
export function stepFlower(
  f: HexFlower,
  state: FlowerState,
  dice: number[],
  pick: (sides: number) => number = () => 1
): { step: FlowerStep; state: FlowerState } {
  const total = dice.reduce((a, b) => a + b, 0);
  const side = f.directions.get(total) ?? "N";
  const { to, wrapped, arrow } = moveToken(f, state.at, side);
  const doubles = dice.length > 1 && dice.every((d) => d === dice[0]);

  let temperature = state.temperature;
  if (f.temperature && f.dice.sides === 6) {
    const low = dice.includes(1);
    const high = dice.includes(6);
    if (low && high) temperature = 0;
    else if (low) temperature = Math.max(-1, temperature - 1) as Temperature;
    else if (high) temperature = Math.min(1, temperature + 1) as Temperature;
  }

  const atStart = to.q === 0 && to.r === 0;
  const cell = f.cells.get(hexKey(to.q, to.r));
  let result: string;
  let picked: number | undefined;
  if (atStart && f.start === "previous") result = state.last ?? cell?.options[0] ?? "Start";
  else if (atStart) result = f.start;
  else if (!cell || cell.options.length === 0) result = cell?.text || "—";
  else if (cell.options.length === 1) result = cell.options[0];
  else {
    picked = pick(pickDie(cell.options.length));
    result = pickOption(cell.options, picked);
  }
  const base = result;
  result = shiftResult(f, base, temperature);

  return {
    step: {
      dice,
      total,
      side,
      from: state.at,
      to,
      wrapped,
      arrow,
      cell: atStart ? "Start" : (cell?.text ?? ""),
      result,
      pick: picked,
      doubles,
      temperature,
      shifted: temperature !== state.temperature,
      start: atStart,
    },
    state: { at: to, temperature, last: base },
  };
}

/** A roll with `random` (0–1) for the dice and the pick. */
export function rollFlower(
  f: HexFlower,
  state: FlowerState,
  random: () => number = Math.random
): { step: FlowerStep; state: FlowerState } {
  const die = (sides: number) => 1 + Math.floor(random() * sides);
  const dice = Array.from({ length: f.dice.count }, () => die(f.dice.sides));
  return stepFlower(f, state, dice, die);
}
