/**
 * `rpg sim build [<theme words>]`: new encounters from the Monster Vault's
 * encounter models (lib/domains/encounter-catalog/build.ts), filled from the
 * bestiary by role for the party (the catalog's, or --pc) and its difficulty,
 * each simulated; the fitting ones come back best first, at most two a model.
 * The name and the scene are the Game Master's to write. With --accept (a
 * catalog needed) the best, or --pick N, is kept as a draft entry.
 */

import { addEntry, slugId, type Catalog } from "lib/domains/encounter-catalog/catalog";
import { fitStateFrom } from "lib/domains/encounter-catalog/fit-state";
import { partyStamp } from "lib/domains/encounter-catalog/party-stamp";
import {
  buildCandidates,
  ENCOUNTER_MODELS,
  MODEL_LABEL,
  sizeVariants,
  type BuildCandidate,
  type EncounterModel,
} from "lib/domains/encounter-catalog/build";
import { wordKey } from "lib/domains/encounter-catalog/words";
import { classifyFit, outcomeDistance, type FitDifficulty } from "lib/domains/encounter-sim/fit";
import { runMonteCarlo } from "lib/domains/encounter-sim/montecarlo";
import { partyProfile, profileView } from "lib/domains/encounter-sim/party-profile";
import type { CombatActor } from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";
import { groupRef, yieldToEventLoop } from "./brief";
import { findCatalogs, loadCatalog, resolveCatalogPath, saveCatalog } from "./catalog-store";
import type { SimHandler } from "./dispatch";
import { MAX_MONSTER_COUNT, UsageError, type SimOptions } from "./flags";
import { crNumber, loadMonster, type LoadedMonster } from "./monsters";
import { DEFAULT_PARTY, loadParty } from "./party";
import { roledBestiary, type RoledMonster } from "./roles";

const ratio = (r: { num: number; den: number }) => r.num / r.den;

/** A pool monster matches the theme words when its name, type, habitat or family names one of them. */
function themed(m: RoledMonster, words: string[]): boolean {
  if (words.length === 0) return true;
  const hay = [m.name, m.type, ...m.habitat, m.note].join(" ").toLowerCase();
  return words.some((w) => hay.includes(wordKey(w)) || hay.includes(w.toLowerCase()));
}

export const simBuild: SimHandler = async (ctx: Ctx, options: SimOptions) => {
  const notes: string[] = [];
  let path: string | undefined;
  let catalog: Catalog | undefined;
  if (options.pc.length === 0 && (options.catalog !== undefined || findCatalogs(ctx.root).length > 0)) {
    path = resolveCatalogPath(ctx, options.catalog);
    catalog = loadCatalog(ctx, path);
  }
  if (options.accept && !catalog) {
    throw new UsageError(
      '--accept keeps an encounter in a catalog: make one with `rpg sim catalog init --party-name "<name>"`.'
    );
  }
  const difficulty: FitDifficulty =
    catalog && !options.given.includes("difficulty") ? catalog.difficulty : options.difficulty;
  const refs = catalog ? catalog.party.pcs : options.pc.length ? options.pc : DEFAULT_PARTY;
  const party = await loadParty(ctx, refs);
  const profile = partyProfile(party.actors.map((a) => a.level));

  const { monsters } = await roledBestiary(ctx, options);
  const pool = monsters.filter((m) => themed(m, options.args));
  if (options.args.length && pool.length === 0) notes.push(`No monster matches ${options.args.join(", ")}.`);
  const models = (options.models.length ? options.models : ENCOUNTER_MODELS) as readonly EncounterModel[];
  const candidates = buildCandidates(
    models,
    pool.map((m) => ({
      note: m.note,
      name: m.name,
      cr: crNumber(m.cr),
      role: m.role,
      subrole: m.subrole,
      tags: m.guess.tags,
    })),
    {
      size: profile.size,
      averageLevel: profile.averageLevel,
      benchmark: ratio(profile.benchmark),
      maxSingleCr: ratio(profile.maxSingleCr),
    }
  ).flatMap((c) => sizeVariants(c, MAX_MONSTER_COUNT));

  const loaded = new Map<string, LoadedMonster>();
  const tried: Array<{ c: BuildCandidate; avgHpLost: number; tpkRate: number; winRate: number; distance: number }> = [];
  for (const c of candidates) {
    await yieldToEventLoop();
    try {
      const groups: Array<{ actor: CombatActor; count: number }> = [];
      for (const m of c.monsters) {
        let lm = loaded.get(m.note);
        if (!lm) {
          lm = await loadMonster(ctx, m.note);
          loaded.set(m.note, lm);
        }
        groups.push({ actor: lm.actor, count: m.count });
      }
      const s = runMonteCarlo({
        party: party.actors,
        monsters: groups,
        seed: options.seed,
        trials: options.trials,
        roundCap: options.rounds,
      });
      if (classifyFit(s, difficulty) !== "fit") continue;
      tried.push({
        c,
        avgHpLost: s.avgHpLost,
        tpkRate: s.tpkRate,
        winRate: s.winRate,
        distance: outcomeDistance(s, difficulty),
      });
    } catch {
      // A monster that cannot load is left out.
    }
  }
  tried.sort((a, b) => a.distance - b.distance);
  // At most two of a model, and one size of an encounter.
  const perModel = new Map<string, number>();
  const seen = new Set<string>();
  const limit = options.limitSet ? options.limit : 5;
  const picked = tried
    .filter((t) => {
      const kinds = t.c.monsters.map((m) => m.note).join("|");
      if (seen.has(kinds) || (perModel.get(t.c.model) ?? 0) >= 2) return false;
      seen.add(kinds);
      perModel.set(t.c.model, (perModel.get(t.c.model) ?? 0) + 1);
      return true;
    })
    .slice(0, limit);

  let added: string | undefined;
  if (options.accept && catalog && path) {
    const chosen = picked[options.pick - 1];
    if (!chosen) {
      notes.push(`No option ${options.pick} to keep.`);
    } else {
      const name = `${MODEL_LABEL[chosen.c.model]}: ${chosen.c.label.replace(/ \([^)]*\)/g, "")}`;
      const id = slugId(
        name,
        chosen.c.monsters,
        catalog.entries.map((e) => e.id)
      );
      const today = new Date().toISOString().slice(0, 10);
      const summary = { winRate: chosen.winRate, tpkRate: chosen.tpkRate, avgHpLost: chosen.avgHpLost };
      const tags = [
        ...new Set(["built", chosen.c.model, ...(options.habitat ? [options.habitat] : []), ...options.args]),
      ];
      saveCatalog(
        ctx,
        path,
        addEntry(catalog, {
          id,
          name,
          monsters: chosen.c.monsters,
          tags,
          review: "draft",
          notes: `Built by rpg sim build (${MODEL_LABEL[chosen.c.model].toLowerCase()}). Give it a name and a scene.`,
          fit: fitStateFrom(summary, difficulty, partyStamp(party.actors), catalog.session, today),
        })
      );
      added = id;
    }
  }
  if (picked.length === 0) {
    notes.push(
      candidates.length === 0
        ? "No model could be filled (the party's benchmark may be 0, or the filters leave too few monsters)."
        : `None of the ${candidates.length} built encounters fits ${difficulty}; try other theme words, --habitat or --difficulty.`
    );
  } else if (!options.accept) {
    notes.push(
      catalog
        ? "Name it and write its scene; `--accept` (or `--accept --pick N`) keeps one in the catalog as a draft."
        : "Name it and write its scene; a catalog (`rpg sim catalog init`) can keep it."
    );
  }

  return {
    doc: {
      party: profileView(profile),
      difficulty,
      catalog: path ?? null,
      tried: candidates.length,
      options: picked.map((t, i) => ({
        pick: i + 1,
        model: MODEL_LABEL[t.c.model],
        who: t.c.label,
        monsters: t.c.monsters.map((m) => groupRef(ctx, m.note, m.count)),
        avgHpLost: t.avgHpLost,
        tpkRate: t.tpkRate,
        winRate: t.winRate,
      })),
      ...(added ? { added } : {}),
      notes,
    },
  };
};
