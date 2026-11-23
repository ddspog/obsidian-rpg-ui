/**
 * What a party is, for picking its encounters: its size, average level, tier of
 * play, CR benchmark and the range of a single monster's CR it can face. The
 * numbers are the Monster Vault's ("Determining Encounter Difficulty", the
 * Challenging Benchmarks by Average Level table). Pure: no Obsidian and no I/O.
 */

import { benchmarkFor, formatCr, parseCr, type Rational } from "./difficulty";

export type Tier = 1 | 2 | 3 | 4;

/** The tier of play of an average level: 1 (levels 1–4), 2 (5–10), 3 (11–16), 4 (17–20). */
export function tierOf(averageLevel: number): Tier {
  if (averageLevel <= 4) return 1;
  if (averageLevel <= 10) return 2;
  if (averageLevel <= 16) return 3;
  return 4;
}

/** MIN CR and MAX CR of a single challenging monster, by average PC level 1–20 (the benchmark table's last columns). */
const SINGLE_CR: ReadonlyArray<readonly [string, string]> = [
  ["1/8", "1/2"],
  ["1/8", "2"],
  ["1/8", "3"],
  ["1/8", "4"],
  ["1/2", "7"],
  ["1", "9"],
  ["1", "10"],
  ["1", "12"],
  ["2", "13"],
  ["2", "15"],
  ["3", "16"],
  ["3", "18"],
  ["3", "19"],
  ["4", "21"],
  ["4", "22"],
  ["4", "24"],
  ["5", "25"],
  ["5", "27"],
  ["5", "28"],
  ["5", "30"],
];

export interface PartyProfile {
  size: number;
  /** The PCs' levels summed and divided by their number, rounded down (at least 1, at most 20). */
  averageLevel: number;
  tier: Tier;
  /** The challenging encounter benchmark: the total CR at which a fight turns challenging. */
  benchmark: Rational;
  /** A single monster below this CR poses little challenge; above `maxSingleCr`, more than the party can handle. */
  minSingleCr: Rational;
  maxSingleCr: Rational;
}

/** The profile of a party from its PCs' levels. */
export function partyProfile(levels: number[]): PartyProfile {
  if (levels.length === 0) throw new Error("A party needs at least one PC");
  const total = levels.reduce((sum, level) => sum + level, 0);
  const averageLevel = Math.min(20, Math.max(1, Math.floor(total / levels.length)));
  const [min, max] = SINGLE_CR[averageLevel - 1];
  return {
    size: levels.length,
    averageLevel,
    tier: tierOf(averageLevel),
    benchmark: benchmarkFor(levels),
    minSingleCr: parseCr(min),
    maxSingleCr: parseCr(max),
  };
}

/** The profile as text, for JSON: CRs as "1/2". */
export function profileView(profile: PartyProfile) {
  return {
    size: profile.size,
    averageLevel: profile.averageLevel,
    tier: profile.tier,
    benchmark: formatCr(profile.benchmark),
    singleCr: `${formatCr(profile.minSingleCr)}-${formatCr(profile.maxSingleCr)}`,
  };
}
