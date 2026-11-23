/**
 * `rpg sim catalog adjust <id>…`: an entry that is too easy or too hard for the
 * catalog's party is tried with changes (lib/domains/encounter-catalog/adjust.ts)
 * against the same party; the ones that fit come back ranked, with tactics in
 * words. With `--accept`, the best (or `--pick N`) becomes a new draft entry
 * linked to its original (`adjustedFrom`), so the catalog grows; the original
 * stays as it was.
 */

import {
  proposeAdjustments,
  rankAdjustments,
  tacticsFor,
  type AdjustCandidate,
  type AdjustDirection,
  type Stand,
} from "lib/domains/encounter-catalog/adjust";
import { slugId, type Catalog, type CatalogEntry } from "lib/domains/encounter-catalog/catalog";
import { fitStateFrom, type FitState } from "lib/domains/encounter-catalog/fit-state";
import { outcomeDistance } from "lib/domains/encounter-sim/fit";
import { equivalentsOf } from "lib/domains/encounter-sim/monster-role";
import { runMonteCarlo } from "lib/domains/encounter-sim/montecarlo";
import type { CombatActor, TrialRules } from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";
import { yieldToEventLoop } from "./brief";
import type { PartyState } from "./catalog-check";
import { MAX_MONSTER_COUNT } from "./flags";
import { crNumber, loadMonster, type LoadedMonster } from "./monsters";
import { roledBestiary, roleProfileOf, type RoledMonster } from "./roles";

export interface AdjustParams {
  seed: number;
  trials: number;
  rounds: number;
  rules?: TrialRules;
  today: string;
}

export interface TriedAdjustment {
  candidate: AdjustCandidate;
  fit: FitState;
  distance: number;
  fits: boolean;
}

export interface EntryAdjustment {
  id: string;
  /** The entry's fit before (simulated now, against the same party). */
  from: FitState;
  direction?: AdjustDirection;
  tried: number;
  /** The fitting adjustments, best first. */
  fitting: TriedAdjustment[];
  /** When none fits: the nearest attempt, to show which way to go. */
  closest?: TriedAdjustment;
  tactics: string[];
}

/** What the adjustments draw on: the bestiary with its roles, read once. */
export interface AdjustPool {
  byNote: Map<string, RoledMonster>;
  all: RoledMonster[];
}

export async function adjustPool(ctx: Ctx): Promise<AdjustPool> {
  const { monsters } = await roledBestiary(ctx, {});
  return { all: monsters, byNote: new Map(monsters.map((m) => [m.note, m])) };
}

const ratio = (r: { num: number; den: number }) => r.num / r.den;

/** A type line's creature kind: "Medium Humanoid (Any Lineage)" is Humanoid, "Swarm of Tiny Beasts" Beast. */
function kindOf(type: string): string {
  const words = type
    .replace(/\([^)]*\)/g, "")
    .trim()
    .split(/\s+/);
  return (words[words.length - 1] ?? "").replace(/s$/, "").toLowerCase();
}

/** Tries the changes on one entry and returns those that fit, best first. Nothing is written. */
export async function adjustEntry(
  ctx: Ctx,
  catalog: Catalog,
  party: PartyState,
  entry: CatalogEntry,
  pool: AdjustPool,
  params: AdjustParams
): Promise<EntryAdjustment> {
  const loaded = new Map<string, LoadedMonster>();
  const pathOf = (note: string) => {
    try {
      return ctx.note(note).path;
    } catch {
      return note;
    }
  };
  const load = async (note: string) => {
    const path = pathOf(note);
    let m = loaded.get(path);
    if (!m) {
      m = await loadMonster(ctx, path);
      loaded.set(path, m);
    }
    return m;
  };
  const simulate = async (monsters: CatalogEntry["monsters"]) => {
    const groups: Array<{ actor: CombatActor; count: number }> = [];
    for (const m of monsters) groups.push({ actor: (await load(m.note)).actor, count: m.count });
    const summary = runMonteCarlo({
      party: party.actors,
      monsters: groups,
      seed: params.seed,
      trials: params.trials,
      roundCap: params.rounds,
      ...(params.rules ? { rules: params.rules } : {}),
    });
    return {
      fit: fitStateFrom(summary, catalog.difficulty, party.stamp, party.fitContext.session, params.today),
      distance: outcomeDistance(summary, catalog.difficulty),
    };
  };

  const from = (await simulate(entry.monsters)).fit;
  const base = { id: entry.id, from, tried: 0, fitting: [], tactics: [] };
  if (from.state === "fit") return base;
  const direction: AdjustDirection = from.state === "too-hard" ? "easier" : "harder";

  // Swaps, minions and leaders no stronger than one monster the party can take on alone.
  const maxCr = ratio(party.profile.maxSingleCr);
  const habitats = new Set(entry.tags.map((t) => t.toLowerCase()));
  const sameHabitat = (m: RoledMonster) => m.habitat.some((h) => habitats.has(h.toLowerCase()));
  const stand = (m: RoledMonster): Stand => ({ note: m.note, name: m.name });
  const inReach = pool.all.filter((m) => crNumber(m.cr) <= maxCr);
  const prefer = (list: RoledMonster[]) => [...list.filter(sameHabitat), ...list.filter((m) => !sameHabitat(m))];
  const optionsFor = (way: AdjustDirection) => ({
    nameOf: (note: string) => pool.byNote.get(pathOf(note))?.name ?? note.split("/").pop() ?? note,
    equivalents: (note: string) => {
      const target = pool.byNote.get(pathOf(note));
      if (!target) return [];
      // Easier looks down the CR ladder, harder up it: a monster above the party's reach finds a weaker kin.
      const found = equivalentsOf(roleProfileOf(target), inReach.map(roleProfileOf), { maxSteps: 3, limit: 40 })
        .filter((e) => (way === "easier" ? e.crSteps <= 0 : e.crSteps >= 0))
        .slice(0, 12);
      // An adjustment keeps the scene: the same kind of creature (a humanoid for a humanoid) first.
      const kind = kindOf(target.type);
      const near = found.map((e) => pool.byNote.get(e.note)!).filter(Boolean);
      return [...near.filter((m) => kindOf(m.type) === kind), ...near.filter((m) => kindOf(m.type) !== kind)]
        .filter((m, i, list) => kindOf(m.type) === kind || i < 2 || list.length < 3)
        .map(stand);
    },
    minions: prefer(inReach.filter((m) => m.subrole === "rank-and-file")).map(stand),
    leaders: prefer(inReach.filter((m) => m.role === "leader")).map(stand),
    maxCount: MAX_MONSTER_COUNT,
  });

  const tried: TriedAdjustment[] = [];
  const seen = new Set<string>();
  const key = (monsters: CatalogEntry["monsters"]) =>
    monsters
      .map((m) => `${m.note}:${m.count}`)
      .sort()
      .join("|");
  const run = async (candidates: AdjustCandidate[], prefix = "") => {
    for (const candidate of candidates) {
      if (seen.has(key(candidate.monsters))) continue;
      seen.add(key(candidate.monsters));
      await yieldToEventLoop();
      try {
        const { fit, distance } = await simulate(candidate.monsters);
        const named = prefix ? { ...candidate, label: `${prefix}, then ${candidate.label}` } : candidate;
        tried.push({ candidate: named, fit, distance, fits: fit.state === "fit" });
      } catch {
        // A monster that cannot load is not offered.
      }
    }
  };
  seen.add(key(entry.monsters));
  await run(proposeAdjustments(entry.monsters, direction, optionsFor(direction)));
  // No single change fits: a second one on the three nearest attempts, each the way it missed.
  if (!tried.some((t) => t.fits)) {
    const nearest = [...tried].sort((a, b) => a.distance - b.distance).slice(0, 3);
    for (const t of nearest) {
      const way: AdjustDirection = t.fit.state === "too-hard" ? "easier" : "harder";
      await run(proposeAdjustments(t.candidate.monsters, way, optionsFor(way)), t.candidate.label);
    }
  }
  const fitting = rankAdjustments(tried);
  const closest = fitting.length ? undefined : [...tried].sort((a, b) => a.distance - b.distance)[0];
  return {
    ...base,
    direction,
    tried: tried.length,
    fitting,
    ...(closest ? { closest } : {}),
    tactics: tacticsFor(direction),
  };
}

/** The draft entry an adjustment becomes: the original's scene and tags, linked back to it. */
export function adjustedEntry(catalog: Catalog, original: CatalogEntry, chosen: TriedAdjustment): CatalogEntry {
  const name = `${original.name} (${chosen.candidate.label})`;
  const id = slugId(
    `${original.id} adjusted ${chosen.candidate.kind}`,
    chosen.candidate.monsters,
    catalog.entries.map((e) => e.id)
  );
  return {
    id,
    name,
    monsters: chosen.candidate.monsters,
    tags: [...new Set([...original.tags, "adjusted"])],
    ...(original.source ? { source: original.source } : {}),
    review: "draft",
    adjustedFrom: original.id,
    adjustment: chosen.candidate.label,
    fit: chosen.fit,
  };
}
