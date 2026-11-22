/**
 * How well a simulated encounter fits a difficulty, judged by its outcome (the
 * share of the party's hit points it costs and how often it kills the party)
 * rather than by its CR. Pure: no Obsidian and no I/O.
 */

export type FitDifficulty = "easy" | "challenging" | "deadly";

export type Fit = "fit" | "too-easy" | "too-hard";

/** What the fit looks at: the fields of a Monte Carlo summary it needs. */
export interface OutcomeSummary {
  avgHpLost: number;
  tpkRate: number;
}

/** The outcome a difficulty aims for: the share of party HP lost and the TPK rate. */
export interface OutcomeProfile {
  toll: number;
  tpk: number;
}

/**
 * The outcome each difficulty aims for. These numbers are tunable heuristics,
 * not rules of the game: the vault's difficulty note speaks only of CR.
 */
export const OUTCOME_PROFILES: Readonly<Record<FitDifficulty, OutcomeProfile>> = {
  easy: { toll: 0.25, tpk: 0 },
  challenging: { toll: 0.5, tpk: 0.05 },
  deadly: { toll: 0.75, tpk: 0.2 },
};

/** The most outcomeDistance that still counts as a fit (a heuristic, like the profiles). */
export const FIT_TOLERANCE = 0.3;

/** The distance of an outcome from a difficulty's profile: HP lost, plus a doubled weight on TPK. */
export function outcomeDistance(summary: OutcomeSummary, difficulty: FitDifficulty): number {
  const target = OUTCOME_PROFILES[difficulty];
  return Math.abs(summary.avgHpLost - target.toll) + 2 * Math.abs(summary.tpkRate - target.tpk);
}

/** `fit` within the tolerance; otherwise too easy when it costs less than aimed for without killing more. */
export function classifyFit(summary: OutcomeSummary, difficulty: FitDifficulty): Fit {
  // The epsilon keeps a distance of exactly the tolerance a fit despite float rounding.
  if (outcomeDistance(summary, difficulty) <= FIT_TOLERANCE + 1e-9) return "fit";
  const target = OUTCOME_PROFILES[difficulty];
  return summary.avgHpLost < target.toll && summary.tpkRate <= target.tpk ? "too-easy" : "too-hard";
}

/** How a Monte Carlo spread its outcomes: the trials, and the per-trial standard deviation of the HP share lost. */
export interface OutcomeSpread {
  trials: number;
  hpLostStdDev: number;
}

export interface FitMargin {
  /** outcomeDistance of the outcome. */
  distance: number;
  /** Its standard error from the sampling: the distance moves about this much on another seed. */
  stdErr: number;
  /** The tolerance lies within two standard errors of the distance: another run may call it the other way. */
  borderline: boolean;
}

/**
 * How sure a fit is. The distance has a standard error from the trials (HP lost: its per-trial standard
 * deviation over the root of the trials; TPK rate: a binomial's, never taken below one trial's worth), and
 * a fit within two standard errors of the tolerance is borderline: 200 trials leave about ±1.5 points on a rate.
 */
export function fitMargin(summary: OutcomeSummary, difficulty: FitDifficulty, spread: OutcomeSpread): FitMargin {
  const n = Math.max(1, spread.trials);
  const p = Math.min(1 - 1 / n, Math.max(1 / n, summary.tpkRate));
  const seHp = spread.hpLostStdDev / Math.sqrt(n);
  const seTpk = Math.sqrt((p * (1 - p)) / n);
  const stdErr = Math.sqrt(seHp * seHp + 4 * seTpk * seTpk);
  const distance = outcomeDistance(summary, difficulty);
  return { distance, stdErr, borderline: Math.abs(distance - FIT_TOLERANCE) < 2 * stdErr };
}
