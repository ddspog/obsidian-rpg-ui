/**
 * GM interpretation: turn a rolled value into a worded outcome.
 *
 * Two resolvers, both pure:
 *   - `resolveInterpret` — evaluate an authored `interpret:` map of
 *     comparison-expression keys (">CF", "<=CF, even", "4-15", …) against a
 *     roll + chaos factor, returning the first matching outcome.
 *   - `fateResult` / `fateThreshold` — a Mythic-style Fate Chart: a likelihood
 *     band × chaos factor → d100 Yes/No thresholds, with exceptional results.
 *
 * No Obsidian / vault dependencies.
 */

import type { GMInterpret, GMLikelihood } from "../features/types";

// ─── interpret expressions ──────────────────────────────────────────────────

export interface InterpretContext {
  /** The rolled value being interpreted. */
  roll: number;
  /** Current chaos factor, for `CF`-relative comparisons. */
  cf?: number;
}

/** Evaluate one comparison clause (no commas) against the context. */
function evalClause(clause: string, ctx: InterpretContext): boolean {
  const c = clause.trim().toLowerCase();
  if (!c) return true;
  if (c === "even") return ctx.roll % 2 === 0;
  if (c === "odd") return ctx.roll % 2 !== 0;

  // range "a-b" (inclusive)
  const range = c.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    return ctx.roll >= parseInt(range[1], 10) && ctx.roll <= parseInt(range[2], 10);
  }

  // comparison "<op> <CF|number>" (op defaults to "=")
  const cmp = c.match(/^(<=|>=|<|>|=)?\s*(cf|\d+)$/);
  if (cmp) {
    const op = cmp[1] ?? "=";
    const rhs = cmp[2] === "cf" ? ctx.cf : parseInt(cmp[2], 10);
    if (rhs == null || Number.isNaN(rhs)) return false;
    switch (op) {
      case "<":
        return ctx.roll < rhs;
      case "<=":
        return ctx.roll <= rhs;
      case ">":
        return ctx.roll > rhs;
      case ">=":
        return ctx.roll >= rhs;
      case "=":
        return ctx.roll === rhs;
    }
  }
  return false;
}

/** Evaluate a full interpret KEY (clauses joined by commas — all must hold). */
export function evalInterpret(expr: string, ctx: InterpretContext): boolean {
  return expr.split(",").every((clause) => evalClause(clause, ctx));
}

/** Resolve an interpret map to the first matching key's worded outcome
 *  (object key order is significant), or null when nothing matches. */
export function resolveInterpret(interpret: GMInterpret, ctx: InterpretContext): string | null {
  for (const [expr, outcome] of Object.entries(interpret)) {
    if (evalInterpret(expr, ctx)) return outcome;
  }
  return null;
}

// ─── Mythic-style Fate Chart ──────────────────────────────────────────────────

export type FateResult = "Exceptional Yes" | "Yes" | "No" | "Exceptional No";

/** Base d100 "Yes" probability at a neutral chaos factor of 5. */
/**
 * The Fate Chart, as printed.
 *
 * Every cell in the chart comes from ONE ladder of percentages, and each step down
 * the odds — or back down the chaos factor — moves one rung along it. So the chart
 * is not a formula over a base value; it is this ladder, indexed.
 *
 * It matters: scaling a base linearly (`base × cf / 5`) agrees with the book only in
 * the 50/50 row, and puts Likely at CF 5 on 75 where the chart says 65.
 */
const FATE_LADDER = [1, 5, 10, 15, 25, 35, 50, 65, 75, 85, 90, 95, 99];

/** Odds from most to least likely — their order IS their offset along the ladder. */
const FATE_ODDS: GMLikelihood[] = [
  "certain",
  "near-certain",
  "very-likely",
  "likely",
  "50/50",
  "unlikely",
  "very-unlikely",
  "near-impossible",
  "impossible",
];

/** Where 50/50 at chaos factor 5 sits, the chart's centre. */
const FATE_CENTRE = 6;

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * The d100 "Yes" threshold for a likelihood at a chaos factor (1–9): a roll
 * ≤ threshold is a Yes. Scales the neutral-CF base by `cf / 5` so a high chaos
 * factor makes Yes more likely and a low one less.
 *
 * NOTE: a tunable default model in the spirit of the Mythic GME Fate Chart, not
 * a verbatim copy of any edition's table — swap `FATE_BASE` / this formula to
 * match a specific chart.
 */
export function fateThreshold(cf: number, likelihood: GMLikelihood): number {
  const odds = FATE_ODDS.indexOf(likelihood);
  const rung = clamp(FATE_CENTRE - (odds < 0 ? 4 : odds) + (clamp(cf, 1, 9) - 1), 0, FATE_LADDER.length - 1);
  return FATE_LADDER[rung];
}

/**
 * The extreme fifths printed either side of a cell: at or below the first is an
 * Exceptional Yes, at or above the second an Exceptional No.
 *
 * Rounded, not floored, which is what the chart shows — a 99 cell prints 20, and
 * `floor(99/5)` is 19. Where a fifth rounds away to nothing the chart prints "x", and
 * an exceptional result is impossible: 0 can never be rolled, and neither can 101.
 */
export function fateExceptional(threshold: number): { yes: number; no: number } {
  return { yes: Math.round(threshold / 5), no: 100 - Math.round((100 - threshold) / 5) + 1 };
}

/**
 * Interpret a d100 roll as a Mythic-style fate answer. The lowest fifth of the
 * Yes band is an Exceptional Yes; the highest fifth of the No band is an
 * Exceptional No.
 */
export function fateResult(roll: number, cf: number, likelihood: GMLikelihood): FateResult {
  const yes = fateThreshold(cf, likelihood);
  const ex = fateExceptional(yes);
  if (roll <= ex.yes) return "Exceptional Yes";
  if (roll <= yes) return "Yes";
  if (roll >= ex.no) return "Exceptional No";
  return "No";
}

/** Worded form used after the lonelog `->` answer. */
export const FATE_WORDING: Record<FateResult, string> = {
  "Exceptional Yes": "Yes, and...",
  Yes: "Yes",
  No: "No",
  "Exceptional No": "No, and...",
};

/** A Fate Question answered: the outcome, how to word it, and the number the roll
 *  had to beat — which is the whole point of consulting the chart. */
export interface FateAnswer {
  result: FateResult;
  wording: string;
  /** The Yes threshold for these odds at this chaos factor. */
  threshold: number;
  /** At or below this is an Exceptional Yes; 0 when the odds allow none. */
  exceptionalYes: number;
  /** At or above this is an Exceptional No; 101 when the odds allow none. */
  exceptionalNo: number;
  /** The roll was a double whose digit is at or below the chaos factor — a
   *  Random Event fires alongside the answer. */
  randomEvent: boolean;
}

/**
 * Whether a Fate roll triggers a Random Event: a double (11, 22, … 99 on the
 * d100; two matching d10s on a Fate Check) whose single digit is at or below
 * the chaos factor. A 100 (`00`) is not a double for this — its digit is 0.
 */
export function fateRandomEvent(dice: number | [number, number], cf: number): boolean {
  if (Array.isArray(dice)) {
    const [a, b] = dice;
    return a === b && a >= 1 && a <= 9 && a <= cf;
  }
  if (dice < 11 || dice > 99 || dice % 11 !== 0) return false;
  return dice / 11 <= cf;
}

/**
 * Answer a Fate Question from its roll, chaos factor and odds.
 *
 * The one call a log line needs: everything about how the chart is read lives here,
 * so a question that names its oracle resolves the same way the chart in the book
 * does, and rolling again re-answers it.
 */
export function answerFateQuestion(roll: number, cf: number, likelihood: GMLikelihood): FateAnswer {
  const threshold = fateThreshold(cf, likelihood);
  const ex = fateExceptional(threshold);
  const result = fateResult(roll, cf, likelihood);
  return {
    result,
    wording: FATE_WORDING[result],
    threshold,
    exceptionalYes: ex.yes,
    exceptionalNo: ex.no,
    randomEvent: fateRandomEvent(roll, cf),
  };
}

/** Fate Check modifier by position along the odds / chaos ladders (+5 … −5). */
const FATE_CHECK_STEPS = [5, 4, 2, 1, 0, -1, -2, -4, -5];

/** The Fate Check roll modifier for these odds plus this chaos factor. */
export function fateCheckModifier(cf: number, likelihood: GMLikelihood): number {
  const odds = FATE_ODDS.indexOf(likelihood);
  const oddsMod = FATE_CHECK_STEPS[odds < 0 ? 4 : odds];
  // CF 9 → +5 … CF 1 → −5: the same ladder, read from the top.
  const cfMod = FATE_CHECK_STEPS[9 - clamp(Math.round(cf), 1, 9)];
  return oddsMod + cfMod;
}

/** A Fate Check answered: the outcome, the modified total, and what it needed. */
export interface FateCheckAnswer {
  result: FateResult;
  wording: string;
  /** The two d10s added, plus the odds and chaos modifiers. */
  total: number;
  modifier: number;
  /** The smallest dice sum that answers Yes (a total of 11 or more). */
  yesOn: number;
  randomEvent: boolean;
}

/**
 * Answer a Fate Question by Fate Check: 2d10 added, plus the Odds and Chaos
 * Factor modifiers. A total of 11+ is a Yes, 10 or less a No; a total landing
 * in 18–20 is an Exceptional Yes and in 2–4 an Exceptional No — exactly those
 * ranges, so a modifier that pushes a total past them leaves it plain.
 * Matching dice at or under the chaos factor also fire a Random Event.
 */
export function answerFateCheck(dice: [number, number], cf: number, likelihood: GMLikelihood): FateCheckAnswer {
  const modifier = fateCheckModifier(cf, likelihood);
  const total = dice[0] + dice[1] + modifier;
  const result: FateResult =
    total >= 18 && total <= 20
      ? "Exceptional Yes"
      : total >= 11
        ? "Yes"
        : total >= 2 && total <= 4
          ? "Exceptional No"
          : "No";
  return {
    result,
    wording: FATE_WORDING[result],
    total,
    modifier,
    yesOn: 11 - modifier,
    randomEvent: fateRandomEvent(dice, cf),
  };
}
