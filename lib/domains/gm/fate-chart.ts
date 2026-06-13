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
const FATE_BASE: Record<GMLikelihood, number> = {
  certain: 99,
  "near-certain": 95,
  "very-likely": 85,
  likely: 75,
  "50/50": 50,
  unlikely: 25,
  "very-unlikely": 15,
  "near-impossible": 5,
  impossible: 1,
};

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
  return clamp(Math.round((FATE_BASE[likelihood] * clamp(cf, 1, 9)) / 5), 1, 99);
}

/**
 * Interpret a d100 roll as a Mythic-style fate answer. The lowest fifth of the
 * Yes band is an Exceptional Yes; the highest fifth of the No band is an
 * Exceptional No.
 */
export function fateResult(roll: number, cf: number, likelihood: GMLikelihood): FateResult {
  const yes = fateThreshold(cf, likelihood);
  const exYes = Math.floor(yes / 5);
  const exNoStart = 100 - Math.floor((100 - yes) / 5) + 1;
  if (roll <= exYes) return "Exceptional Yes";
  if (roll <= yes) return "Yes";
  if (roll >= exNoStart) return "Exceptional No";
  return "No";
}

/** Worded form used after the lonelog `->` answer. */
export const FATE_WORDING: Record<FateResult, string> = {
  "Exceptional Yes": "Yes, and...",
  Yes: "Yes",
  No: "No",
  "Exceptional No": "No, and...",
};
