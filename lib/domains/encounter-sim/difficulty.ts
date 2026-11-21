/**
 * Tales of the Valiant encounter difficulty: exact rational CR arithmetic and
 * the party benchmark the vault's difficulty note describes.
 */

export interface Rational {
  num: number;
  den: number;
}

export type DifficultyLabel = "below" | "at" | "above";

export type DifficultyName = "easy" | "challenging" | "deadly";

export interface DifficultyResult {
  totalCr: Rational;
  benchmark: Rational;
  label: DifficultyLabel;
}

export interface DifficultyStrings {
  totalCr: string;
  benchmark: string;
  label: DifficultyLabel;
}

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
};

const make = (num: number, den: number): Rational => {
  if (!Number.isInteger(num) || !Number.isInteger(den) || den <= 0) {
    throw new Error(`Invalid rational ${num}/${den}`);
  }
  const g = gcd(num, den) || 1;
  return { num: num / g, den: den / g };
};

/** Parses a CR written as "3" or "1/8" into an irreducible rational. */
export function parseCr(text: string): Rational {
  const trimmed = String(text).trim();
  const whole = /^(\d+)$/.exec(trimmed);
  if (whole) return make(Number(whole[1]), 1);
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (frac) {
    const den = Number(frac[2]);
    if (den === 0) throw new Error(`Invalid CR "${text}": zero denominator`);
    return make(Number(frac[1]), den);
  }
  throw new Error(`Invalid CR "${text}": expected a whole number or a fraction like 1/8`);
}

export function addCr(a: Rational, b: Rational): Rational {
  return make(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function mulCr(a: Rational, b: Rational): Rational {
  return make(a.num * b.num, a.den * b.den);
}

/** Negative when a < b, zero when equal, positive when a > b. */
export function cmpCr(a: Rational, b: Rational): number {
  return Math.sign(a.num * b.den - b.num * a.den);
}

export function absDiffCr(a: Rational, b: Rational): Rational {
  return make(Math.abs(a.num * b.den - b.num * a.den), a.den * b.den);
}

/** Irreducible "p/q"; integers print plain ("10"), zero as "0". */
export function formatCr(cr: Rational): string {
  const r = make(cr.num, cr.den);
  return r.den === 1 ? String(r.num) : `${r.num}/${r.den}`;
}

/** The party's benchmark total CR for the given PC levels. */
export function benchmarkFor(levels: number[]): Rational {
  if (levels.length === 0) throw new Error("A party needs at least one PC");
  const count = levels.length;
  const total = levels.reduce((sum, level) => sum + level, 0);
  const avg = Math.floor(total / count);
  if (avg <= 1) {
    if (count >= 3 && count <= 5) return make(1, 2);
    if (count === 6 || count === 7) return make(1, 1);
    return make(Math.floor(total / 4), 1);
  }
  if (avg <= 4) return make(Math.floor(total / 4), 1);
  if (avg <= 10) return make(Math.floor(total / 2), 1);
  return make(Math.floor((3 * total) / 4), 1);
}

export function labelEncounter(levels: number[], totalCr: Rational): DifficultyResult {
  const benchmark = benchmarkFor(levels);
  const cmp = cmpCr(totalCr, benchmark);
  const label: DifficultyLabel = cmp < 0 ? "below" : cmp === 0 ? "at" : "above";
  return { totalCr: make(totalCr.num, totalCr.den), benchmark, label };
}

const DIFFICULTY_FACTOR: Record<DifficultyName, Rational> = {
  easy: { num: 1, den: 2 },
  challenging: { num: 1, den: 1 },
  deadly: { num: 2, den: 1 },
};

/** Target total CR for a difficulty: 1/2, 1 or 2 times the benchmark. */
export function targetFor(difficulty: DifficultyName, benchmark: Rational): Rational {
  return mulCr(benchmark, DIFFICULTY_FACTOR[difficulty]);
}

export function formatDifficulty(result: DifficultyResult): DifficultyStrings {
  return {
    totalCr: formatCr(result.totalCr),
    benchmark: formatCr(result.benchmark),
    label: result.label,
  };
}
