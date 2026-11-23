/**
 * `rpg sim catalog check`: simulates the entries whose fit is missing or out of
 * date against the catalog's party and stamps each with the verdict. Entries run
 * in file order with one seed, so the same catalog, party and clock give the
 * same note; only the stored `checkedOn` date comes from the clock.
 */

import type { Catalog } from "lib/domains/encounter-catalog/catalog";
import {
  fitStateFrom,
  partitionByFit,
  recheckReason,
  type FitContext,
  type FitPartition,
} from "lib/domains/encounter-catalog/fit-state";
import { partyStamp } from "lib/domains/encounter-catalog/party-stamp";
import { diceRange } from "lib/domains/encounter-catalog/words";
import { fitMargin } from "lib/domains/encounter-sim/fit";
import { runMonteCarlo } from "lib/domains/encounter-sim/montecarlo";
import { partyProfile, type PartyProfile } from "lib/domains/encounter-sim/party-profile";
import type { CombatActor, TrialRules } from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";
import { yieldToEventLoop } from "./brief";
import { MAX_MONSTER_COUNT, type TierScope } from "./flags";
import { loadMonster, withTemplate, type LoadedMonster } from "./monsters";
import { loadParty } from "./party";
import { inScope, tierMatcher } from "./tier-scope";

/** The party of a catalog, loaded, with its stamp and what decides whether a fit is current. */
export interface PartyState {
  actors: CombatActor[];
  stamp: string;
  fitContext: FitContext;
  /** Size, tier, benchmark and single-monster CR range. */
  profile: PartyProfile;
}

/** Loads the catalog's PCs. `session` overrides the catalog's own (for a read of a different session). */
export async function loadPartyState(
  ctx: Ctx,
  catalog: Catalog,
  path: string,
  session = catalog.session,
  rules?: TrialRules
): Promise<PartyState> {
  if (catalog.party.pcs.length === 0) throw new Error(`Catalog "${path}" lists no PCs (its \`pcs\` is empty).`);
  const { actors } = await loadParty(ctx, catalog.party.pcs);
  const stamp = partyStamp(actors, rules);
  return {
    actors,
    stamp,
    profile: partyProfile(actors.map((a) => a.level)),
    fitContext: {
      stamp,
      session,
      recheckEverySessions: catalog.recheckEverySessions,
      difficulty: catalog.difficulty,
    },
  };
}

/** A borderline entry is run again with this many times the trials, up to the most below. */
const BORDERLINE_FACTOR = 4;
const MAX_BORDERLINE_TRIALS = 2000;

export interface CheckParams {
  seed: number;
  trials: number;
  rounds: number;
  /** The rules the fights are played by (flags.ts `rulesOf`). */
  rules?: TrialRules;
  /** Simulate every entry, not only those that need it. */
  force: boolean;
  /** The most entries to simulate (default all). */
  limit: number;
  /** The date written into `checkedOn`. */
  today: string;
  /** The tiers simulated (default the party's own: an entry of another tier is left as it is). */
  tiers?: TierScope;
}

export interface CheckResult {
  catalog: Catalog;
  checked: number;
  /** Entries whose fit is current and were not simulated. */
  unchanged: number;
  /** Entries that need a check but were left for the next run by `limit`. */
  remaining: number;
  errors: Array<{ id: string; error: string }>;
  /** Entries run again with more trials because their first run sat near the fit's edge. */
  borderlineRuns: number;
  /** Entries still near the edge after that (marked `borderline` in their fit). */
  borderline: number;
  /** Entries of another tier of play, not simulated (see --tiers). */
  otherTier: number;
  partition: FitPartition;
}

/** Simulates what needs it and returns the catalog with the new fits; nothing is written. */
export async function checkEntries(
  ctx: Ctx,
  catalog: Catalog,
  party: PartyState,
  params: CheckParams
): Promise<CheckResult> {
  const { fitContext } = party;
  const monsters = new Map<string, LoadedMonster>();
  const errors: CheckResult["errors"] = [];
  let checked = 0;
  let borderlineRuns = 0;
  let unchanged = 0;
  let remaining = 0;
  let otherTier = 0;
  const matchOf = tierMatcher(ctx, party.profile);
  const scope = params.tiers ?? "same";

  const entries = [];
  for (const entry of catalog.entries) {
    await yieldToEventLoop();
    const due =
      params.force ||
      recheckReason(
        entry,
        fitContext.stamp,
        fitContext.session,
        fitContext.recheckEverySessions,
        fitContext.difficulty
      ) !== null;
    if (!inScope(matchOf(entry), scope)) {
      otherTier += 1;
      entries.push(entry);
      continue;
    }
    if (!due) {
      unchanged += 1;
      entries.push(entry);
      continue;
    }
    if (checked + errors.length >= params.limit) {
      remaining += 1;
      entries.push(entry);
      continue;
    }

    let groups: Array<{ actor: CombatActor; count: number; dice?: string }>;
    try {
      groups = [];
      for (const { note: base, count, dice, template } of entry.monsters) {
        const note = withTemplate(base, template);
        let monster = monsters.get(note);
        if (!monster) {
          monster = await loadMonster(ctx, note);
          monsters.set(note, monster);
        }
        groups.push({ actor: monster.actor, count, ...(dice ? { dice } : {}) });
      }
    } catch (error) {
      errors.push({ id: entry.id, error: (error as Error).message });
      entries.push(entry);
      continue;
    }

    const simulate = (counts: number[], trials = params.trials) =>
      runMonteCarlo({
        party: party.actors,
        monsters: groups.map((g, i) => ({ actor: g.actor, count: counts[i] })),
        seed: params.seed,
        trials,
        roundCap: params.rounds,
        ...(params.rules ? { rules: params.rules } : {}),
      });
    let summary = simulate(groups.map((g) => g.count));
    let trials = params.trials;
    // Near the fit's edge another seed could call it the other way: run it again with more trials (item 24).
    if (fitMargin(summary, catalog.difficulty, { trials, hpLostStdDev: summary.hpLostStdDev }).borderline) {
      trials = Math.min(MAX_BORDERLINE_TRIALS, params.trials * BORDERLINE_FACTOR);
      if (trials > params.trials)
        summary = simulate(
          groups.map((g) => g.count),
          trials
        );
      borderlineRuns += 1;
    }
    const fit = fitStateFrom(summary, catalog.difficulty, fitContext.stamp, fitContext.session, params.today);
    if (trials !== params.trials) fit.trials = trials;
    if (fitMargin(summary, catalog.difficulty, { trials, hpLostStdDev: summary.hpLostStdDev }).borderline) {
      fit.borderline = true;
    }
    // A rolled count ("1d4 + 1 grimlocks") is stored at its average; the fewest and the most it can be are
    // simulated too, so a fit that turns too hard on a high roll says so.
    const ranges = groups.map((g) => (g.dice ? diceRange(g.dice) : null));
    if (ranges.some((r, i) => r !== null && (r.min !== groups[i].count || r.max !== groups[i].count))) {
      const at = (pick: "min" | "max") => {
        const counts = groups.map((g, i) => Math.min(MAX_MONSTER_COUNT, ranges[i]?.[pick] ?? g.count));
        return fitStateFrom(simulate(counts), catalog.difficulty, fitContext.stamp, fitContext.session, params.today)
          .state;
      };
      fit.atMin = at("min");
      fit.atMax = at("max");
    }
    checked += 1;
    entries.push({ ...entry, fit });
  }

  const next: Catalog = { ...catalog, entries };
  return {
    catalog: next,
    checked,
    borderlineRuns,
    borderline: entries.filter((e) => e.fit?.borderline).length,
    unchanged,
    remaining,
    errors,
    otherTier,
    partition: partitionByFit(next, fitContext),
  };
}
