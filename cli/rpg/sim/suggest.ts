/**
 * `rpg sim suggest`: sweeps the bestiary for encounters near the party's
 * difficulty target. Each usable monster note is loaded once, then fought in
 * groups of 1, 2, 3 ... while the group's total CR stays within twice the
 * target; the candidates closest to the target (then the least deadly) win.
 */

import {
  absDiffCr,
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
import { compactSummary, runMonteCarlo, type CompactSummary } from "lib/domains/encounter-sim/montecarlo";
import { isDamaging } from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";
import type { SimHandler } from "./dispatch";
import { UsageError, type SimOptions } from "./flags";
import { bestiaryPaths, categoryHabitat, linkNames, loadMonster, plainType, readMonsterNote } from "./monsters";
import { DEFAULT_PARTY, loadParty } from "./party";

/** Why a bestiary note was left out of the sweep. */
export type ExclusionReason =
  | "non-monster"
  | "unresolvable"
  | "filtered"
  | "cr-0"
  | "out-of-range"
  | "no-damaging-action";

export interface SuggestCandidate extends CompactSummary {
  composition: { note: string; count: number; cr: string };
  totalCr: string;
  label: DifficultyLabel;
}

export interface SuggestDocument {
  target: { difficulty: string; targetTotal: string; benchmark: string };
  candidates: SuggestCandidate[];
  excluded: Record<string, number>;
}

/** Orders by distance to the target, then tpkRate, then note ref, then count. */
function compareCandidates(
  a: { entry: SuggestCandidate; total: Rational },
  b: { entry: SuggestCandidate; total: Rational },
  target: Rational
): number {
  const byDistance = cmpCr(absDiffCr(a.total, target), absDiffCr(b.total, target));
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

  // The party is loaded once and shared by every trial of every candidate.
  const party = await loadParty(ctx, options.pc.length > 0 ? options.pc : DEFAULT_PARTY);
  const levels = party.actors.map((a) => a.level);
  const benchmark = benchmarkFor(levels);
  const targetTotal = targetFor(options.difficulty, benchmark);
  const twiceTarget = mulCr(targetTotal, { num: 2, den: 1 });

  const excluded: Partial<Record<ExclusionReason, number>> = {};
  const exclude = (reason: ExclusionReason) => {
    excluded[reason] = (excluded[reason] ?? 0) + 1;
  };

  const found: Array<{ entry: SuggestCandidate; total: Rational }> = [];

  // Each note is classified in this order, stopping at the first reason it fails:
  //   1. non-monster / unresolvable: readMonsterNote says so, or the CR is not a CR
  //   2. filtered: --habitat, --type or --cr misses
  //   3. cr-0: nothing to add to a total
  //   4. out-of-range: one monster already above twice the target total (skipped before loading)
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
    if (cmpCr(cr, twiceTarget) > 0) {
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
    for (let count = 1; ; count++) {
      const total = mulCr(cr, { num: count, den: 1 });
      if (cmpCr(total, twiceTarget) > 0) break;
      const summary = runMonteCarlo({
        party: party.actors,
        monsters: [{ actor: monster.actor, count }],
        seed: options.seed,
        trials: options.trials,
        roundCap: options.rounds,
      });
      found.push({
        total,
        entry: {
          composition: { note: monster.note, count, cr: formatCr(cr) },
          totalCr: formatCr(total),
          label: labelEncounter(levels, total).label,
          ...compactSummary(summary),
        },
      });
    }
  }

  found.sort((a, b) => compareCandidates(a, b, targetTotal));

  const sortedExcluded: Record<string, number> = {};
  for (const reason of Object.keys(excluded).sort()) {
    sortedExcluded[reason] = excluded[reason as ExclusionReason] as number;
  }

  const doc: SuggestDocument = {
    target: {
      difficulty: options.difficulty,
      targetTotal: formatCr(targetTotal),
      benchmark: formatCr(benchmark),
    },
    candidates: found.slice(0, options.limit).map((c) => c.entry),
    excluded: sortedExcluded,
  };
  return { doc };
};
