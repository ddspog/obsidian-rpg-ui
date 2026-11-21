/**
 * The fit state of a catalog entry: what the simulator said of it for one party
 * configuration, and when that answer has to be asked again. Pure: no Obsidian
 * and no I/O.
 */

import { classifyFit, type Fit, type FitDifficulty } from "../encounter-sim/fit";
import { round4, type MonteCarloSummary } from "../encounter-sim/montecarlo";

import type { Catalog, CatalogEntry } from "./catalog";

export type FitStateName = Fit;
export type Difficulty = FitDifficulty;

/** The simulator's verdict on one entry for one party configuration. */
export interface FitState {
  state: FitStateName;
  /** The party stamp (party-stamp.ts) the simulation ran against. */
  stamp: string;
  /** The difficulty profile the outcome was judged against. */
  difficulty: Difficulty;
  winRate: number;
  tpkRate: number;
  avgHpLost: number;
  /** ISO date or date-time of the check. */
  checkedOn: string;
  /** The catalog's session number at the check. */
  checkedAtSession: number;
}

/** Why an entry's fit has to be computed again; `null` means it is current. */
export type RecheckReason = "no-fit" | "party-changed" | "difficulty-changed" | "sessions-elapsed";

/** What decides whether an entry's fit is current. */
export interface FitContext {
  stamp: string;
  session: number;
  /** A fit older than this many sessions is refreshed; 0 (or less) turns the refresh off. */
  recheckEverySessions: number;
  difficulty: Difficulty;
}

export interface EligibilityFilter {
  /** Every one of these tags must be on the entry (case-insensitive). */
  tags?: string[];
  /** At least one of these tags must be on the entry (case-insensitive). */
  anyTags?: string[];
  /** The fit states that qualify. Default `["fit"]`. */
  states?: FitStateName[];
  /** Also admit entries whose fit is stale or missing (their fit is unknown). Default false. */
  includeStale?: boolean;
  /** `true`: only confirmed entries; `false`: only drafts; absent: both. */
  reviewed?: boolean;
}

export interface FitPartition {
  /** Current fit state `fit`. */
  fit: number;
  /** Current fit state `too-easy`. */
  tooEasy: number;
  /** Current fit state `too-hard`. */
  tooHard: number;
  /** Have a fit that is out of date (party or difficulty changed, or sessions elapsed). */
  stale: number;
  /** Have no fit at all. */
  unchecked: number;
  /** Review flag `draft`; counted apart, so it overlaps the five counts above. */
  draft: number;
}

/** A Monte Carlo summary reduced to what the fit state stores. */
export type FitSummary = Pick<MonteCarloSummary, "winRate" | "tpkRate" | "avgHpLost">;

/**
 * Builds the fit state of a simulated entry. The metrics are rounded to four
 * places, as the simulator's JSON is, and the state is classified on the rounded
 * values so what is stored always reproduces its own state.
 */
export function fitStateFrom(
  summary: FitSummary,
  difficulty: Difficulty,
  stamp: string,
  session: number,
  nowIso: string
): FitState {
  const winRate = round4(summary.winRate);
  const tpkRate = round4(summary.tpkRate);
  const avgHpLost = round4(summary.avgHpLost);
  return {
    state: classifyFit({ avgHpLost, tpkRate }, difficulty),
    stamp,
    difficulty,
    winRate,
    tpkRate,
    avgHpLost,
    checkedOn: nowIso,
    checkedAtSession: session,
  };
}

/**
 * Why an entry has to be simulated again, or `null` when its fit is current.
 * Checked in order: no fit yet, the party configuration changed (stamp differs),
 * the difficulty changed, `recheckEverySessions` sessions passed since the check.
 */
export function recheckReason(
  entry: Pick<CatalogEntry, "fit">,
  stamp: string,
  session: number,
  recheckEverySessions: number,
  difficulty: Difficulty
): RecheckReason | null {
  const fit = entry.fit;
  if (!fit) return "no-fit";
  if (fit.stamp !== stamp) return "party-changed";
  if (fit.difficulty !== difficulty) return "difficulty-changed";
  if (recheckEverySessions > 0 && session - fit.checkedAtSession >= recheckEverySessions) return "sessions-elapsed";
  return null;
}

const lower = (tags: readonly string[]): Set<string> => new Set(tags.map((t) => t.trim().toLowerCase()));

/**
 * Whether an entry can be offered. A stale or unchecked entry's fit is unknown,
 * so it is left out unless `includeStale`; a current one must have a state in
 * `states` (default `fit`), so a `too-easy` entry stays out for the same party.
 */
export function isEligible(entry: CatalogEntry, ctx: FitContext, filter: EligibilityFilter = {}): boolean {
  const { tags, anyTags, states = ["fit"], includeStale = false, reviewed } = filter;

  if (reviewed !== undefined && (entry.review === "confirmed") !== reviewed) return false;

  if (tags && tags.length > 0) {
    const have = lower(entry.tags);
    if (!tags.every((t) => have.has(t.trim().toLowerCase()))) return false;
  }
  if (anyTags && anyTags.length > 0) {
    const have = lower(entry.tags);
    if (!anyTags.some((t) => have.has(t.trim().toLowerCase()))) return false;
  }

  const reason = recheckReason(entry, ctx.stamp, ctx.session, ctx.recheckEverySessions, ctx.difficulty);
  if (reason !== null) return includeStale;
  return entry.fit !== undefined && states.includes(entry.fit.state);
}

/** Counts the entries of a catalog by the state of their fit (see FitPartition). */
export function partitionByFit(catalog: Pick<Catalog, "entries">, ctx: FitContext): FitPartition {
  const out: FitPartition = { fit: 0, tooEasy: 0, tooHard: 0, stale: 0, unchecked: 0, draft: 0 };
  for (const entry of catalog.entries) {
    if (entry.review === "draft") out.draft += 1;
    const reason = recheckReason(entry, ctx.stamp, ctx.session, ctx.recheckEverySessions, ctx.difficulty);
    if (reason === "no-fit") out.unchecked += 1;
    else if (reason !== null) out.stale += 1;
    else if (entry.fit?.state === "fit") out.fit += 1;
    else if (entry.fit?.state === "too-easy") out.tooEasy += 1;
    else out.tooHard += 1;
  }
  return out;
}
