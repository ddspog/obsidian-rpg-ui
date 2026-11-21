/**
 * `rpg sim plan`: a few ready options for the next encounter in one call, so a
 * Game Master model does not spend a round trip (or the tokens of a full
 * `suggest`) to get them. The party's catalog is read first: its entries whose
 * fit is current and `fit`, confirmed ones before drafts, those matching the
 * theme words before the rest. When that gives fewer than --limit (3) options,
 * the bestiary is swept as `suggest --rank outcome` does and its `fit` groups
 * fill the rest. Nothing is written: a stale catalog is reported, not checked.
 */

import type { Catalog, CatalogEntry } from "lib/domains/encounter-catalog/catalog";
import { isEligible, partitionByFit } from "lib/domains/encounter-catalog/fit-state";
import { cmpCr, parseCr } from "lib/domains/encounter-sim/difficulty";
import { outcomeDistance, type Fit } from "lib/domains/encounter-sim/fit";
import type { Ctx } from "../app";
import { anyWordIn, groupRef, wordKey } from "./brief";
import { loadPartyState } from "./catalog-check";
import { findCatalogs, loadCatalog, resolveCatalogPath } from "./catalog-store";
import type { SimHandler } from "./dispatch";
import type { Difficulty, SimOptions } from "./flags";
import { plainType, readMonsterNote } from "./monsters";
import { DEFAULT_PARTY } from "./party";
import { simSuggest, type SuggestCandidate, type SuggestDocument } from "./suggest";

/** How many options `plan` gives when --limit is not written. */
export const DEFAULT_PLAN_OPTIONS = 3;

export interface PlanOption {
  /** `catalog` (confirmed), `catalog-draft` (read from a table, not confirmed yet) or `sweep` (the bestiary). */
  from: "catalog" | "catalog-draft" | "sweep";
  /** The catalog entry's id (catalog options only). */
  id?: string;
  name: string;
  /** The groups, as --monster takes them ("Thug:3"). */
  monsters: string[];
  tags?: string[];
  totalCr?: string;
  fit: Fit;
  winRate: number;
  tpkRate: number;
  avgHpLost: number;
}

export interface PlanDocument {
  party: string[];
  difficulty: Difficulty;
  /** The catalog read, or null when there is none (or --pc named a party of its own). */
  catalog: string | null;
  options: PlanOption[];
  /** What the caller should know: a stale catalog, a skipped one, a sweep that found nothing. */
  notes: string[];
}

const stemOf = (path: string): string => (path.split("/").pop() ?? path).replace(/\.md$/i, "");

/** The groups of an option in one order, to tell two options of the same monsters apart from different ones. */
const keyOf = (monsters: string[]): string => [...monsters].sort().join(" + ");

/** How many theme words an entry matches (name, tags, monster names). */
function themeScore(entry: CatalogEntry, words: readonly string[]): number {
  const texts = [entry.name, ...entry.tags, ...entry.monsters.map((m) => stemOf(m.note))];
  return words.filter((word) => anyWordIn([word], texts)).length;
}

/** Whether a monster of the entry passes --type and --cr (read from its note; an unreadable one does not). */
function monsterFilter(ctx: Ctx, options: SimOptions): ((entry: CatalogEntry) => boolean) | undefined {
  const type = options.type?.trim().toLowerCase();
  const cr = options.cr !== undefined ? parseCr(options.cr) : undefined;
  if (type === undefined && cr === undefined) return undefined;
  return (entry) =>
    entry.monsters.some(({ note }) => {
      const state = readMonsterNote(ctx, note);
      if (state.kind !== "monster") return false;
      if (
        type !== undefined &&
        !plainType(state.data.type ?? "")
          .toLowerCase()
          .includes(type)
      )
        return false;
      if (cr !== undefined) {
        try {
          if (cmpCr(parseCr(state.data.cr ?? ""), cr) !== 0) return false;
        } catch {
          return false;
        }
      }
      return true;
    });
}

interface CatalogPick {
  options: PlanOption[];
  notes: string[];
}

async function fromCatalog(
  ctx: Ctx,
  path: string,
  catalog: Catalog,
  options: SimOptions,
  limit: number
): Promise<CatalogPick> {
  const notes: string[] = [];
  const party = await loadPartyState(ctx, catalog, path, options.session);
  const fitContext = party.fitContext;
  const partition = partitionByFit(catalog, fitContext);
  const stale = partition.stale + partition.unchecked;
  if (stale > 0) {
    notes.push(
      `${stale} catalog ${stale === 1 ? "entry was" : "entries were"} not offered: never checked, or the party, difficulty or session changed (run \`rpg sim catalog check\`).`
    );
  }

  const habitat = options.habitat !== undefined ? wordKey(options.habitat) : undefined;
  const passesMonsters = monsterFilter(ctx, options);
  const words = options.args;
  const scored = catalog.entries
    .filter((entry) => isEligible(entry, fitContext, { tags: options.tags, anyTags: options.anyTags }))
    .filter((entry) => habitat === undefined || entry.tags.some((t) => wordKey(t) === habitat))
    .filter((entry) => !passesMonsters || passesMonsters(entry))
    .map((entry) => ({ entry, score: themeScore(entry, words) }))
    .filter(({ score }) => words.length === 0 || score > 0);

  const distance = (entry: CatalogEntry): number =>
    entry.fit ? outcomeDistance(entry.fit, fitContext.difficulty) : Number.POSITIVE_INFINITY;
  const confirmed = (entry: CatalogEntry): number => (entry.review === "confirmed" ? 0 : 1);
  scored.sort(
    (a, b) =>
      confirmed(a.entry) - confirmed(b.entry) ||
      b.score - a.score ||
      distance(a.entry) - distance(b.entry) ||
      (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0)
  );

  const picked = scored.slice(0, limit).map(({ entry }): PlanOption => {
    const fit = entry.fit as NonNullable<CatalogEntry["fit"]>;
    return {
      from: entry.review === "confirmed" ? "catalog" : "catalog-draft",
      id: entry.id,
      name: entry.name,
      monsters: entry.monsters.map((m) => groupRef(ctx, m.note, m.count)),
      tags: entry.tags,
      fit: fit.state,
      winRate: fit.winRate,
      tpkRate: fit.tpkRate,
      avgHpLost: fit.avgHpLost,
    };
  });
  if (picked.some((o) => o.from === "catalog-draft")) {
    notes.push(
      "catalog-draft options were read from a table and checked, but nobody has confirmed them: `rpg sim catalog confirm <id>` keeps one."
    );
  }
  return { options: picked, notes };
}

/** The sweep's `fit` candidates as options, skipping any already offered. */
function sweepOptions(ctx: Ctx, doc: SuggestDocument, taken: Set<string>, want: number): PlanOption[] {
  const out: PlanOption[] = [];
  for (const c of doc.candidates as SuggestCandidate[]) {
    if (out.length >= want) break;
    if (c.fit !== "fit") continue;
    const groups = [...(c.base ?? []), c.composition];
    const monsters = groups.map((g) => groupRef(ctx, g.note, g.count));
    const key = keyOf(monsters);
    if (taken.has(key)) continue;
    taken.add(key);
    out.push({
      from: "sweep",
      name: groups.map((g) => (g.count === 1 ? stemOf(g.note) : `${g.count} ${stemOf(g.note)}`)).join(" + "),
      monsters,
      totalCr: c.totalCr,
      fit: c.fit,
      winRate: c.winRate,
      tpkRate: c.tpkRate,
      avgHpLost: c.avgHpLost,
    });
  }
  return out;
}

export const simPlan: SimHandler = async (ctx, options) => {
  const limit = options.limitSet ? options.limit : DEFAULT_PLAN_OPTIONS;
  const notes: string[] = [];

  // A catalog is read unless --pc names a party of its own; several catalogs need --catalog.
  let path: string | undefined;
  let catalog: Catalog | undefined;
  if (options.pc.length === 0 && (options.catalog !== undefined || findCatalogs(ctx.root).length > 0)) {
    path = resolveCatalogPath(ctx, options.catalog);
    catalog = loadCatalog(ctx, path);
  }
  const difficulty: Difficulty =
    catalog && !options.given.includes("difficulty") ? catalog.difficulty : options.difficulty;
  const pcs = catalog ? catalog.party.pcs : options.pc;

  const picked: PlanOption[] = [];
  if (catalog && path) {
    if (catalog.difficulty !== difficulty) {
      notes.push(
        `The catalog's fits are for ${catalog.difficulty}, not ${difficulty}: its entries were not offered (only swept groups).`
      );
    } else {
      const fromIt = await fromCatalog(ctx, path, catalog, options, limit);
      picked.push(...fromIt.options);
      notes.push(...fromIt.notes);
    }
  } else if (options.pc.length === 0) {
    notes.push(
      'No encounter catalog: `rpg sim catalog init --party-name "<name>"` makes one, so a chosen encounter is kept and reused.'
    );
  }

  if (picked.length < limit) {
    const sweep = async (words: string[]) =>
      (
        await simSuggest(ctx, {
          ...options,
          args: words,
          pc: pcs,
          difficulty,
          rank: "outcome",
          brief: false,
          limit: Number.MAX_SAFE_INTEGER,
          limitSet: true,
        })
      ).doc as SuggestDocument;
    const taken = new Set(picked.map((o) => keyOf(o.monsters)));
    const want = limit - picked.length;
    const first = await sweep(options.args);
    let found = sweepOptions(ctx, first, taken, want);
    if (first.target.benchmark === "0") {
      notes.push(
        "The party's CR benchmark is 0 (too few PCs, or too low a level, for the difficulty note's formula): there is nothing to sweep toward."
      );
    } else if (found.length === 0 && options.args.length > 0) {
      notes.push(
        `No bestiary group named by the theme words (${options.args.join(", ")}) fits ${difficulty}: swept without them.`
      );
      found = sweepOptions(ctx, await sweep([]), taken, want);
    }
    if (found.length === 0 && first.target.benchmark !== "0") {
      notes.push(
        `The sweep found no group that fits ${difficulty} for this party (try another --habitat or --type, a --base group, or another --difficulty).`
      );
    } else if (found.length > 0) {
      notes.push(
        'A swept group can be kept for this party: `rpg sim catalog add --name "<name>" --monster "<group>"…`.'
      );
    }
    picked.push(...found);
  }

  const party = (pcs.length > 0 ? pcs : DEFAULT_PARTY).map(stemOf);
  const doc: PlanDocument = { party, difficulty, catalog: path ?? null, options: picked, notes };
  return { doc };
};
