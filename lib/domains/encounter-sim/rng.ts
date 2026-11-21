import { rollD20, type Rng } from "lib/ui/dice/roll";

export type { Rng };

/**
 * A seeded stream (mulberry32): the same numeric seed always yields the same
 * values. Nothing on the sim path reads Math.random or the clock.
 */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ParsedExpr {
  /** Dice groups in written order: `count` dice of `sides`, added or subtracted. */
  dice: Array<{ count: number; sides: number; sign: 1 | -1 }>;
  /** Every flat term, summed. */
  bonus: number;
}

/**
 * `1d8+1`, `d6`, `2d6+3-1`, `4`, `-1`: dice groups and flat terms. Null when anything else
 * is in the way (words, a dice group with no sides).
 */
function parseExpr(expr: string): ParsedExpr | null {
  const text = expr.replace(/\s+/g, "").replace(/[\u2212\u2013]/g, "-");
  if (!text || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/i.test(text)) return null;
  const parsed: ParsedExpr = { dice: [], bonus: 0 };
  for (const m of text.matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/gi)) {
    const sign = m[1] === "-" ? -1 : 1;
    if (m[3] !== undefined) {
      const count = m[2] ? parseInt(m[2], 10) : 1;
      const sides = parseInt(m[3], 10);
      if (count < 1 || sides < 2) return null;
      parsed.dice.push({ count, sides, sign });
    } else {
      parsed.bonus += sign * parseInt(m[4], 10);
    }
  }
  return parsed;
}

/** Whether `rollExpr` and `averageOf` can handle the expression. */
export function isRollable(expr: string): boolean {
  return parseExpr(expr) !== null;
}

/**
 * Roll a damage or healing expression through the injected rng. A critical hit
 * doubles the dice but not the flat terms, and leaves a flat amount unchanged.
 */
export function rollExpr(expr: string, crit: boolean, rng: Rng): number {
  const parsed = parseExpr(expr);
  if (!parsed) throw new Error(`Cannot roll "${expr}"`);
  let total = parsed.bonus;
  for (const group of parsed.dice) {
    const count = crit ? group.count * 2 : group.count;
    for (let i = 0; i < count; i++) total += group.sign * (Math.floor(rng() * group.sides) + 1);
  }
  return total;
}

/** One d20 (no modifier) from the injected rng. */
export function d20(rng: Rng): number {
  return rollD20(0, "normal", rng).kept;
}

/** The mean of an expression: count*(sides+1)/2 per group + the flat terms; 0 when it cannot be read. */
export function averageOf(expr: string): number {
  const parsed = parseExpr(expr);
  if (!parsed) return 0;
  return parsed.dice.reduce((sum, g) => sum + (g.sign * g.count * (g.sides + 1)) / 2, parsed.bonus);
}
