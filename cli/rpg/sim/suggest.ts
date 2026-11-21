/**
 * `rpg sim suggest`: sweeps the bestiary for encounters near the party's
 * difficulty target. Each usable monster note is loaded once, then fought in
 * groups of 1, 2, 3 ... while the group's total CR stays within twice the
 * target; the candidates closest to the target (then the least deadly) win.
 *
 * Two opt-in features leave that default untouched:
 *   --rank outcome  ranks by the simulated outcome (HP lost, TPK rate) against the
 *                   difficulty's profile instead of by total CR, and sweeps wider
 *                   (total CR up to 4 x the benchmark, at most 30 of a kind, a kind's
 *                   counts stop once the party is wiped 9 times in 10)
 *   --base          groups that are always in the fight; the sweep adds one more kind
 */

import {
  absDiffCr,
  addCr,
  benchmarkFor,
  cmpCr,
  formatCr,
  labelEncounter,
  mulCr,
  parseCr,
  targetFor,
  type DifficultyLabel,
  type Rational,
} from "lib/domains/encounter-sim/difficulty";
import { classifyFit, outcomeDistance, type Fit } from "lib/domains/encounter-sim/fit";
import { compactSummary, runMonteCarlo, type CompactSummary } from "lib/domains/encounter-sim/montecarlo";
import { isDamaging } from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";
import type { SimHandler } from "./dispatch";
import { UsageError, type Rank, type SimOptions } from "./flags";
import {
  bestiaryPaths,
  categoryHabitat,
  linkNames,
  loadMonster,
  plainType,
  readMonsterNote,
  type LoadedMonster,
} from "./monsters";
import { DEFAULT_PARTY, loadParty } from "./party";

/** Why a bestiary note was left out of the sweep. */
export type ExclusionReason =
  | "non-monster"
  | "unresolvable"
  | "filtered"
  | "cr-0"
  | "out-of-range"
  | "no-damaging-action";

export interface SuggestGroup {
  note: string;
  count: number;
  cr: string;
}

export interface SuggestCandidate extends CompactSummary {
  /** The kind the sweep varies. */
  composition: SuggestGroup;
  /** The `--base` groups, present only when the option was given. */
  base?: SuggestGroup[];
  totalCr: string;
  label: DifficultyLabel;
  fit: Fit;
}

export interface SuggestDocument {
  target: { difficulty: string; targetTotal: string; benchmark: string; rank: Rank };
  candidates: SuggestCandidate[];
  excluded: Record<string, number>;
}

/** The wider sweep of `--rank outcome`: total CR up to this many times the benchmark. */
const OUTCOME_CAP_FACTOR = 4;
/** `--rank outcome`: the most monsters of one kind. */
const OUTCOME_MAX_COUNT = 30;
/** `--rank outcome`: a kind's counts stop once a probe wipes the party this often (more only gets worse). */
const OUTCOME_STOP_TPK = 0.9;

interface Found {
  entry: SuggestCandidate;
  total: Rational;
  /** The distance to the difficulty's outcome profile (used by `--rank outcome`). */
  outcome: number;
}

/** Orders by distance to the target (CR, or outcome), then tpkRate, then note ref, then count. */
function compareCandidates(a: Found, b: Found, target: Rational, rank: Rank): number {
  const byDistance =
    rank === "outcome" ? a.outcome - b.outcome : cmpCr(absDiffCr(a.total, target), absDiffCr(b.total, target));
  if (byDistance !== 0) return byDistance;
  if (a.entry.tpkRate !== b.entry.tpkRate) return a.entry.tpkRate - b.entry.tpkRate;
  if (a.entry.composition.note !== b.entry.composition.note) {
    return a.entry.composition.note < b.entry.composition.note ? -1 : 1;
  }
  return a.entry.composition.count - b.entry.composition.count;
}

export const simSuggest: SimHandler = async (ctx: Ctx, options: SimOptions) => {
  let crFilter: Rational | undefined;
  if (options.cr !== undefined) {
    try {
      crFilter = parseCr(options.cr);
    } catch {
      throw new UsageError(`--cr "${options.cr}" is not a CR (use a whole number or a fraction like 1/2).`);
    }
  }
  const habitatFilter = options.habitat?.trim().toLowerCase();
  const typeFilter = options.type?.trim().toLowerCase();

  // The base groups are loaded once, before the party: a misspelt base note is reported first, naming it.
  const baseGroups: Array<{ monster: LoadedMonster; count: number; cr: Rational }> = [];
  let baseCr: Rational = { num: 0, den: 1 };
  const baseCache = new Map<string, LoadedMonster>();
  for (const { note, count } of options.base) {
    let monster = baseCache.get(note);
    if (!monster) {
      monster = await loadMonster(ctx, note);
      baseCache.set(note, monster);
    }
    let cr: Rational;
    try {
      cr = parseCr(monster.cr);
    } catch (err) {
      throw new Error(`Base monster "${monster.note}": ${(err as Error).message}`);
    }
    baseGroups.push({ monster, count, cr });
    baseCr = addCr(baseCr, mulCr(cr, { num: count, den: 1 }));
  }
  const baseSummary: SuggestGroup[] = baseGroups.map(({ monster, count, cr }) => ({
    note: monster.note,
    count,
    cr: formatCr(cr),
  }));

  // The party is loaded once and shared by every trial of every candidate.
  const party = await loadParty(ctx, options.pc.length > 0 ? options.pc : DEFAULT_PARTY);
  const levels = party.actors.map((a) => a.level);
  const benchmark = benchmarkFor(levels);
  const targetTotal = targetFor(options.difficulty, benchmark);
  // The largest total CR the sweep goes to (and the largest a single note may add to the base).
  const cap =
    options.rank === "outcome"
      ? mulCr(benchmark, { num: OUTCOME_CAP_FACTOR, den: 1 })
      : mulCr(targetTotal, { num: 2, den: 1 });
  const maxCount = options.rank === "outcome" ? OUTCOME_MAX_COUNT : Infinity;

  const excluded: Partial<Record<ExclusionReason, number>> = {};
  const exclude = (reason: ExclusionReason) => {
    excluded[reason] = (excluded[reason] ?? 0) + 1;
  };

  const found: Found[] = [];

  // Each note is classified in this order, stopping at the first reason it fails:
  //   1. non-monster / unresolvable: readMonsterNote says so, or the CR is not a CR
  //   2. filtered: --habitat, --type or --cr misses
  //   3. cr-0: nothing to add to a total
  //   4. out-of-range: one monster (with the base) already above the cap, twice the target total or,
  //      for --rank outcome, 4 x the benchmark (skipped before loading)
  //   5. unresolvable again: loadMonster throws (e.g. a feature ref that resolves to nothing);
  //      only known once the note is loaded, so it is counted here and the sweep carries on
  //   6. no-damaging-action: loaded, but nothing it can do hurts the party
  for (const path of bestiaryPaths(ctx)) {
    const state = readMonsterNote(ctx, path);
    if (state.kind === "non-monster") {
      exclude("non-monster");
      continue;
    }
    if (state.kind === "unresolvable") {
      exclude("unresolvable");
      continue;
    }
    let cr: Rational;
    try {
      cr = parseCr(state.data.cr ?? "");
    } catch {
      exclude("unresolvable");
      continue;
    }

    if (habitatFilter !== undefined) {
      const habitat = linkNames(state.data.habitat ?? categoryHabitat(ctx, state.data.category, state.file.path));
      if (!habitat.some((h) => h.toLowerCase() === habitatFilter)) {
        exclude("filtered");
        continue;
      }
    }
    if (typeFilter !== undefined && !plainType(state.data.type).toLowerCase().includes(typeFilter)) {
      exclude("filtered");
      continue;
    }
    if (crFilter !== undefined && cmpCr(cr, crFilter) !== 0) {
      exclude("filtered");
      continue;
    }

    if (cr.num === 0) {
      exclude("cr-0");
      continue;
    }
    if (cmpCr(addCr(baseCr, cr), cap) > 0) {
      exclude("out-of-range");
      continue;
    }

    let monster;
    try {
      monster = await loadMonster(ctx, path);
    } catch {
      exclude("unresolvable");
      continue;
    }
    if (!monster.actor.actions.some(isDamaging)) {
      exclude("no-damaging-action");
      continue;
    }

    // The actor is shared across counts; the engine copies it per combatant.
    for (let count = 1; count <= maxCount; count++) {
      const total = addCr(baseCr, mulCr(cr, { num: count, den: 1 }));
      if (cmpCr(total, cap) > 0) break;
      const summary = runMonteCarlo({
        party: party.actors,
        monsters: [
          ...baseGroups.map(({ monster: b, count: n }) => ({ actor: b.actor, count: n })),
          { actor: monster.actor, count },
        ],
        seed: options.seed,
        trials: options.trials,
        roundCap: options.rounds,
      });
      const compact = compactSummary(summary);
      found.push({
        total,
        outcome: Math.round(outcomeDistance(compact, options.difficulty) * 1e9) / 1e9,
        entry: {
          composition: { note: monster.note, count, cr: formatCr(cr) },
          ...(options.base.length > 0 ? { base: baseSummary } : {}),
          totalCr: formatCr(total),
          label: labelEncounter(levels, total).label,
          ...compact,
          fit: classifyFit(compact, options.difficulty),
        },
      });
      if (options.rank === "outcome" && compact.tpkRate >= OUTCOME_STOP_TPK) break;
    }
  }

  found.sort((a, b) => compareCandidates(a, b, targetTotal, options.rank));

  const sortedExcluded: Record<string, number> = {};
  for (const reason of Object.keys(excluded).sort()) {
    sortedExcluded[reason] = excluded[reason as ExclusionReason] as number;
  }

  const doc: SuggestDocument = {
    target: {
      difficulty: options.difficulty,
      targetTotal: formatCr(targetTotal),
      benchmark: formatCr(benchmark),
      rank: options.rank,
    },
    candidates: found.slice(0, options.limit).map((c) => c.entry),
    excluded: sortedExcluded,
  };
  return { doc };
};
