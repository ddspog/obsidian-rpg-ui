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
import { runMonteCarlo } from "lib/domains/encounter-sim/montecarlo";
import type { CombatActor } from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";
import { loadMonster, type LoadedMonster } from "./monsters";
import { loadParty } from "./party";

/** The party of a catalog, loaded, with its stamp and what decides whether a fit is current. */
export interface PartyState {
  actors: CombatActor[];
  stamp: string;
  fitContext: FitContext;
}

/** Loads the catalog's PCs. `session` overrides the catalog's own (for a read of a different session). */
export async function loadPartyState(
  ctx: Ctx,
  catalog: Catalog,
  path: string,
  session = catalog.session
): Promise<PartyState> {
  if (catalog.party.pcs.length === 0) throw new Error(`Catalog "${path}" lists no PCs (its \`pcs\` is empty).`);
  const { actors } = await loadParty(ctx, catalog.party.pcs);
  const stamp = partyStamp(actors);
  return {
    actors,
    stamp,
    fitContext: {
      stamp,
      session,
      recheckEverySessions: catalog.recheckEverySessions,
      difficulty: catalog.difficulty,
    },
  };
}

export interface CheckParams {
  seed: number;
  trials: number;
  rounds: number;
  /** Simulate every entry, not only those that need it. */
  force: boolean;
  /** The most entries to simulate (default all). */
  limit: number;
  /** The date written into `checkedOn`. */
  today: string;
}

export interface CheckResult {
  catalog: Catalog;
  checked: number;
  /** Entries whose fit is current and were not simulated. */
  unchanged: number;
  /** Entries that need a check but were left for the next run by `limit`. */
  remaining: number;
  errors: Array<{ id: string; error: string }>;
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
  let unchanged = 0;
  let remaining = 0;

  const entries = [];
  for (const entry of catalog.entries) {
    const due =
      params.force ||
      recheckReason(
        entry,
        fitContext.stamp,
        fitContext.session,
        fitContext.recheckEverySessions,
        fitContext.difficulty
      ) !== null;
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

    let groups;
    try {
      groups = [];
      for (const { note, count } of entry.monsters) {
        let monster = monsters.get(note);
        if (!monster) {
          monster = await loadMonster(ctx, note);
          monsters.set(note, monster);
        }
        groups.push({ actor: monster.actor, count });
      }
    } catch (error) {
      errors.push({ id: entry.id, error: (error as Error).message });
      entries.push(entry);
      continue;
    }

    const summary = runMonteCarlo({
      party: party.actors,
      monsters: groups,
      seed: params.seed,
      trials: params.trials,
      roundCap: params.rounds,
    });
    checked += 1;
    entries.push({
      ...entry,
      fit: fitStateFrom(summary, catalog.difficulty, fitContext.stamp, fitContext.session, params.today),
    });
  }

  const next: Catalog = { ...catalog, entries };
  return { catalog: next, checked, unchanged, remaining, errors, partition: partitionByFit(next, fitContext) };
}
