/**
 * `rpg sim suggest`: sweeps the bestiary for encounters near the party's
 * difficulty target. Each usable monster note is loaded once, then fought in
 * groups of 1, 2, 3 ... while the group's total CR stays within twice the
 * target; the candidates closest to the target (then the least deadly) win.
 *
 * By default (--rank outcome) candidates are ranked by the simulated outcome (HP
 * lost, TPK rate) against the difficulty's profile, over a wider sweep; --rank cr
 * ranks by total CR near the target instead. Other options:
 *   --rank outcome  the default: ranks by outcome and sweeps wider
 *                   (total CR up to 4 x the benchmark, at most 30 of a kind, a kind's
 *                   counts stop once the party is wiped 9 times in 10)
 *   --base          groups that are always in the fight; the sweep adds one more kind
 *   --tiers         same (default) or lower: no monster above the party's single-monster CR; all: any
 *   <theme words>   only monsters whose name, type, family (category link) or
 *                   source book (the note's frontmatter) names one
 *   --accept        a catalog needed: the best shown candidate (or --pick N) is
 *                   kept as a draft entry, its fit the one just simulated
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
import { partyProfile, profileView } from "lib/domains/encounter-sim/party-profile";
import { compactSummary, runMonteCarlo, type CompactSummary } from "lib/domains/encounter-sim/montecarlo";
import { isDamaging } from "lib/domains/encounter-sim/types";
import { addEntry, slugId, type Catalog, type CatalogMonster } from "lib/domains/encounter-catalog/catalog";
import { fitStateFrom } from "lib/domains/encounter-catalog/fit-state";
import { partyStamp } from "lib/domains/encounter-catalog/party-stamp";
import { noteStem } from "lib/domains/encounter-catalog/words";
import type { Ctx } from "../app";
import { anyWordIn, groupRef, wordKey, yieldToEventLoop } from "./brief";
import { findCatalogs, loadCatalog, resolveCatalogPath, saveCatalog } from "./catalog-store";
import type { SimHandler } from "./dispatch";
import { rulesOf, UsageError, type Rank, type SimOptions } from "./flags";
import {
  bestiaryPaths,
  categoryHabitat,
  linkNames,
  loadMonster,
  plainType,
  readMonsterNote,
  withTemplate,
  type LoadedMonster,
} from "./monsters";
import { DEFAULT_PARTY, loadParty } from "./party";

/** Why a bestiary note was left out of the sweep. */
export type ExclusionReason =
  | "non-monster"
  | "unresolvable"
  | "filtered"
  | "cr-0"
  | "above-tier"
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

/** A candidate as `--brief` prints it: its groups as --monster takes them, and the outcome. */
export interface BriefCandidate {
  monsters: string[];
  totalCr: string;
  label: DifficultyLabel;
  fit: Fit;
  winRate: number;
  tpkRate: number;
  avgHpLost: number;
  avgRounds: number;
}

export interface SuggestDocument {
  target: { difficulty: string; targetTotal: string; benchmark: string; rank: Rank };
  /** The party's size, average level, tier, benchmark and single-monster CR range. */
  profile: ReturnType<typeof profileView>;
  /** Why there are no candidates, when the reason is the party itself (a benchmark of 0). */
  note?: string;
  candidates: SuggestCandidate[];
  excluded: Record<string, number>;
  /** The draft --accept kept in the catalog: its id, name and groups as --monster takes them. */
  added?: { id: string; name: string; monsters: string[] };
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
  const habitatFilter = options.habitat !== undefined ? wordKey(options.habitat) : undefined;
  // Theme words ("suggest wolf scout"): a monster is kept when one of them is in its name, type,
  // family (its category link) or source book (the note's frontmatter).
  const keywords = options.args;
  const typeFilter = options.type?.trim().toLowerCase();

  // --accept writes a draft into the party's catalog, so the sweep answers the catalog's own party
  // and difficulty (unless flags say otherwise). Without --accept, the sweep is the party it was given.
  let catalogPath: string | undefined;
  let catalog: Catalog | undefined;
  if (
    options.accept &&
    options.pc.length === 0 &&
    (options.catalog !== undefined || findCatalogs(ctx.root).length > 0)
  ) {
    catalogPath = resolveCatalogPath(ctx, options.catalog);
    catalog = loadCatalog(ctx, catalogPath);
  }
  if (options.accept && !catalog) {
    throw new UsageError(
      '--accept keeps an encounter in a catalog: make one with `rpg sim catalog init --party-name "<name>"`.'
    );
  }

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
  const refs = catalog ? catalog.party.pcs : options.pc.length > 0 ? options.pc : DEFAULT_PARTY;
  const party = await loadParty(ctx, refs);
  const levels = party.actors.map((a) => a.level);
  const benchmark = benchmarkFor(levels);
  const profile = partyProfile(levels);
  // --tiers same or lower: no single monster above what a party of this tier can face.
  const maxSingle = options.tiers === "all" ? undefined : profile.maxSingleCr;
  // The difficulty the sweep is judged by: the catalog's when --accept reads one and no flag overrides it.
  const difficulty = catalog && !options.given.includes("difficulty") ? catalog.difficulty : options.difficulty;
  const targetTotal = targetFor(difficulty, benchmark);
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
  //   2. cr-0: nothing to add to a total (before the filters, so a filtered run still counts it)
  //   3. filtered: --habitat, --type, --cr or plan's theme words miss
  //   4. above-tier: the monster's CR is above the party's single-monster CR (unless --tiers all)
  //   4b. out-of-range: one monster (with the base) already above the cap, twice the target total or,
  //      for --rank outcome, 4 x the benchmark (skipped before loading)
  //   5. unresolvable again: loadMonster throws (e.g. a feature ref that resolves to nothing);
  //      only known once the note is loaded, so it is counted here and the sweep carries on
  //   6. no-damaging-action: loaded, but nothing it can do hurts the party
  for (const path of bestiaryPaths(ctx)) {
    await yieldToEventLoop();
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

    // Nothing to add to a total, whatever the filters say: counted as cr-0 so `excluded` tells it apart.
    if (cr.num === 0) {
      exclude("cr-0");
      continue;
    }

    if (habitatFilter !== undefined) {
      const habitat = linkNames(state.data.habitat ?? categoryHabitat(ctx, state.data.category, state.file.path));
      if (!habitat.some((h) => wordKey(h) === habitatFilter)) {
        exclude("filtered");
        continue;
      }
    }
    if (typeFilter !== undefined && !plainType(state.data.type).toLowerCase().includes(typeFilter)) {
      exclude("filtered");
      continue;
    }
    if (keywords.length > 0) {
      const source = ctx.metadataCache.frontmatterOf(state.file)?.source;
      const texts = [
        state.file.basename,
        plainType(state.data.type ?? ""),
        ...linkNames(state.data.category),
        ...(typeof source === "string" ? [source] : []),
      ];
      if (!anyWordIn(keywords, texts)) {
        exclude("filtered");
        continue;
      }
    }
    if (crFilter !== undefined && cmpCr(cr, crFilter) !== 0) {
      exclude("filtered");
      continue;
    }

    if (maxSingle !== undefined && cmpCr(cr, maxSingle) > 0) {
      exclude("above-tier");
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
        rules: rulesOf(options),
      });
      const compact = compactSummary(summary);
      found.push({
        total,
        outcome: Math.round(outcomeDistance(compact, difficulty) * 1e9) / 1e9,
        entry: {
          composition: { note: monster.note, count, cr: formatCr(cr) },
          ...(options.base.length > 0 ? { base: baseSummary } : {}),
          totalCr: formatCr(total),
          label: labelEncounter(levels, total).label,
          ...compact,
          fit: classifyFit(compact, difficulty),
        },
      });
      if (options.rank === "outcome" && compact.tpkRate >= OUTCOME_STOP_TPK) break;
    }
  }

  found.sort((a, b) => compareCandidates(a, b, targetTotal, options.rank));
  const ranked = options.fits.length > 0 ? found.filter((c) => options.fits.includes(c.entry.fit)) : found;
  // A party whose benchmark is 0 has no target to sweep toward: say so rather than return nothing silently.
  let note =
    benchmark.num === 0
      ? "The party's CR benchmark is 0 (too few PCs, or too low a level, for the difficulty note's formula): there is nothing to sweep toward. Use `sim run` on a group you choose."
      : undefined;

  const sortedExcluded: Record<string, number> = {};
  for (const reason of Object.keys(excluded).sort()) {
    sortedExcluded[reason] = excluded[reason as ExclusionReason] as number;
  }

  const kept = ranked.slice(0, options.limit).map((c) => c.entry);
  if (keywords.length > 0 && kept.length === 0) {
    note =
      (note ? `${note} ` : "") +
      `Nothing swept names the theme words (${keywords.join(", ")}): they are read against a monster's name, type, family and source book.`;
  }

  // --accept: the best shown candidate (or --pick) becomes a draft of the catalog, as `build --accept` does.
  let added: { id: string; name: string; monsters: string[] } | undefined;
  if (options.accept && catalog && catalogPath) {
    const chosen = kept[options.pick - 1];
    if (!chosen) {
      note = (note ? `${note} ` : "") + `No candidate ${options.pick} to keep (--pick 1 is the best shown).`;
    } else {
      // The entry keeps the note the sweep loaded and, for a --base group with a template, the template apart.
      const monsters: CatalogMonster[] = [
        ...baseGroups.map(({ monster, count }) => {
          if (monster.template) {
            const suffix = ` with ${monster.template}`;
            const base = monster.note.endsWith(suffix) ? monster.note.slice(0, -suffix.length) : monster.note;
            return { note: base, count, template: monster.template };
          }
          return { note: monster.note, count };
        }),
        { note: chosen.composition.note, count: chosen.composition.count },
      ];
      const name = monsters
        .map((m) => {
          const stem = noteStem(m.template ? withTemplate(m.note, m.template) : m.note);
          return m.count === 1 ? stem : `${m.count} ${stem}`;
        })
        .join(" + ");
      const entry = {
        id: slugId(
          name,
          monsters,
          catalog.entries.map((e) => e.id)
        ),
        name,
        monsters,
        tags: [...new Set(["suggested", ...(options.habitat ? [options.habitat] : []), ...options.args])],
        review: "draft" as const,
        notes: `Kept from a bestiary sweep (rpg sim suggest --rank ${options.rank}). Give it a name and a scene.`,
        fit: fitStateFrom(
          chosen,
          difficulty,
          partyStamp(party.actors, rulesOf(options)),
          catalog.session,
          new Date().toISOString().slice(0, 10)
        ),
      };
      saveCatalog(ctx, catalogPath, addEntry(catalog, entry));
      added = {
        id: entry.id,
        name,
        monsters: monsters.map((m) => groupRef(ctx, withTemplate(m.note, m.template), m.count)),
      };
    }
  }

  if (options.brief) {
    const groups = (c: SuggestCandidate): string[] =>
      [...(c.base ?? []), c.composition].map((g) => groupRef(ctx, g.note, g.count));
    const brief: BriefCandidate[] = kept.map((c) => ({
      monsters: groups(c),
      totalCr: c.totalCr,
      label: c.label,
      fit: c.fit,
      winRate: c.winRate,
      tpkRate: c.tpkRate,
      avgHpLost: c.avgHpLost,
      avgRounds: c.avgRounds,
    }));
    return {
      doc: {
        target: { difficulty, targetTotal: formatCr(targetTotal), rank: options.rank },
        profile: profileView(profile),
        ...(note ? { note } : {}),
        candidates: brief,
        ...(added ? { added } : {}),
      },
    };
  }

  const doc: SuggestDocument = {
    target: {
      difficulty,
      targetTotal: formatCr(targetTotal),
      benchmark: formatCr(benchmark),
      rank: options.rank,
    },
    profile: profileView(profile),
    ...(note ? { note } : {}),
    candidates: kept,
    excluded: sortedExcluded,
    ...(added ? { added } : {}),
  };
  return { doc };
};
