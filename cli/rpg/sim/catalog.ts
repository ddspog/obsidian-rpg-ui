/**
 * `rpg sim catalog <action>`: the encounter catalog of a party, a vault note of
 * ready-made encounters each checked against the party by the simulator. The
 * actions: `init` makes the note, `draft` reads table rows into draft entries,
 * `add`/`confirm`/`remove` edit it, `check` simulates what is out of date, and
 * `suggest`/`list` read it. The note is written only by `init`, `draft --accept`,
 * `add`, `confirm`, `remove`, `check` and `suggest --refresh`, always through
 * `writeNote` (which backs the old text up first).
 */

import {
  addEntry,
  DEFAULT_RECHECK_EVERY_SESSIONS,
  DEFAULT_REUSE_AFTER_SESSIONS,
  mergeDrafts,
  removeEntry,
  slugId,
  type Catalog,
  type CatalogEntry,
  type CatalogProfile,
} from "lib/domains/encounter-catalog/catalog";
import type { Confidence } from "lib/domains/encounter-catalog/extract-row";
import {
  isEligible,
  partitionByFit,
  recentlyUsed,
  recheckReason,
  type FitContext,
  type FitPartition,
} from "lib/domains/encounter-catalog/fit-state";
import { normaliseTags, sameTag } from "lib/domains/encounter-catalog/words";
import type { TierMatch } from "lib/domains/encounter-catalog/tier";
import { outcomeDistance } from "lib/domains/encounter-sim/fit";
import { profileView, type PartyProfile } from "lib/domains/encounter-sim/party-profile";
import type { Ctx } from "../app";
import {
  catalogExists,
  defaultCatalogPath,
  loadCatalog,
  maybeCatalogPath,
  resolveCatalogPath,
  saveCatalog,
  systemFolderOf,
} from "./catalog-store";
import { adjustEntry, adjustedEntry, adjustPool } from "./catalog-adjust";
import { checkEntries, loadPartyState, type CheckParams, type CheckResult } from "./catalog-check";
import { notesOf, scanForDrafts } from "./catalog-draft";
import { groupRef } from "./brief";
import type { SimHandler } from "./dispatch";
import { CONFIDENCES, UsageError, type SimOptions, type TierScope } from "./flags";
import { linkNames, readMonsterNote } from "./monsters";
import { DEFAULT_PARTY } from "./party";
import { listSessions } from "../session/lines";
import { readNote, writeNote } from "../write";
import { noteRef } from "./brief";
import { appendToLog, foesText, formatEncounterTag } from "lib/domains/session-log/prepared-encounter";
import { inScope, tierMatcher } from "./tier-scope";

export interface CatalogDeps {
  /** Today's date as written into `checkedOn`; the only thing the clock is used for. */
  now?: () => string;
}

/** The default cap of the drafts a dry run lists, and of the entries `suggest` returns. */
const DEFAULT_DRAFT_LIST = 40;
const DEFAULT_SUGGEST = 10;

const today = (): string => new Date().toISOString().slice(0, 10);

const baseName = (note: string): string => (note.split("/").pop() ?? note).replace(/\.md$/i, "");

const rankOf = (confidence: Confidence): number => CONFIDENCES.length - CONFIDENCES.indexOf(confidence);

interface EntryView {
  id: string;
  name: string;
  monsters: Array<{ note: string; count: number }>;
  tags: string[];
  review: string;
  fit: null | {
    state: string;
    winRate: number;
    tpkRate: number;
    avgHpLost: number;
    /** The state with every rolled count at its fewest / most. */
    atMin?: string;
    atMax?: string;
    /** Why the fit is out of date, when it is. */
    stale?: string;
  };
  uses?: number;
  lastUsedSession?: number;
  scene?: string;
}

/** An entry as `catalog suggest --brief` prints it: groups as --monster takes them, and the fit flattened. */
export interface BriefEntryView {
  id: string;
  name: string;
  monsters: string[];
  tags: string[];
  review: string;
  fit?: string;
  winRate?: number;
  tpkRate?: number;
  avgHpLost?: number;
  stale?: string;
  /** The fit with every rolled count at its fewest / most, when a count is rolled. */
  atMin?: string;
  atMax?: string;
  /** The session it was last run at. */
  lastUsedSession?: number;
  /** The table row's own words. */
  scene?: string;
}

export function briefViewOf(ctx: Ctx, entry: CatalogEntry, fitContext: FitContext): BriefEntryView {
  const reason = recheckReason(
    entry,
    fitContext.stamp,
    fitContext.session,
    fitContext.recheckEverySessions,
    fitContext.difficulty
  );
  return {
    id: entry.id,
    name: entry.name,
    monsters: entry.monsters.map((m) => groupRef(ctx, m.note, m.count)),
    tags: entry.tags,
    review: entry.review,
    ...(entry.fit
      ? {
          fit: entry.fit.state,
          winRate: entry.fit.winRate,
          tpkRate: entry.fit.tpkRate,
          avgHpLost: entry.fit.avgHpLost,
          ...(entry.fit.atMin !== undefined ? { atMin: entry.fit.atMin, atMax: entry.fit.atMax } : {}),
        }
      : {}),
    ...(reason ? { stale: reason } : {}),
    ...(entry.lastUsedSession !== undefined ? { lastUsedSession: entry.lastUsedSession } : {}),
    ...(entry.source?.text ? { scene: entry.source.text } : {}),
  };
}

/** An entry as the commands print it: compact, with the bestiary notes by name. */
function viewOf(entry: CatalogEntry, ctx: FitContext): EntryView {
  const reason = recheckReason(entry, ctx.stamp, ctx.session, ctx.recheckEverySessions, ctx.difficulty);
  return {
    id: entry.id,
    name: entry.name,
    monsters: entry.monsters.map((m) => ({ note: baseName(m.note), count: m.count })),
    tags: entry.tags,
    review: entry.review,
    fit: entry.fit
      ? {
          state: entry.fit.state,
          winRate: entry.fit.winRate,
          tpkRate: entry.fit.tpkRate,
          avgHpLost: entry.fit.avgHpLost,
          ...(entry.fit.atMin !== undefined ? { atMin: entry.fit.atMin, atMax: entry.fit.atMax } : {}),
          ...(reason ? { stale: reason } : {}),
        }
      : null,
    ...(entry.uses !== undefined ? { uses: entry.uses } : {}),
    ...(entry.lastUsedSession !== undefined ? { lastUsedSession: entry.lastUsedSession } : {}),
    ...(entry.source?.text ? { scene: entry.source.text } : {}),
  };
}

const needsCheck = (partition: FitPartition): number => partition.stale + partition.unchecked;

const CHECK_HINT = (n: number): string =>
  `${n} ${n === 1 ? "entry needs" : "entries need"} a check (never checked, or the party, difficulty or session changed): run \`rpg sim catalog check\` (or suggest with --refresh).`;

/** The catalog note's path of an action that works on an existing one. */
const existing = (ctx: Ctx, options: SimOptions): { path: string; catalog: Catalog } => {
  const path = resolveCatalogPath(ctx, options.catalog);
  return { path, catalog: loadCatalog(ctx, path) };
};

function checkParams(options: SimOptions, now: () => string): CheckParams {
  return {
    seed: options.seed,
    trials: options.trials,
    rounds: options.rounds,
    force: options.force,
    limit: options.limitSet ? options.limit : Infinity,
    today: now(),
    tiers: options.tiers,
  };
}

/**
 * The catalog's entries split by the --tiers rule: those offered to the party
 * (each with its match, `lower` meaning a lower tier taken for story use) and
 * how many were left out as another tier's.
 */
function byTier(ctx: Ctx, catalog: Catalog, profile: PartyProfile, scope: TierScope) {
  const matchOf = tierMatcher(ctx, profile);
  const kept: Array<{ entry: CatalogEntry; match: TierMatch }> = [];
  let otherTier = 0;
  for (const entry of catalog.entries) {
    const match = matchOf(entry);
    if (inScope(match, scope)) kept.push({ entry, match });
    else otherTier += 1;
  }
  return { kept, otherTier, scoped: { entries: kept.map((k) => k.entry) } };
}

/** Runs the check and writes the catalog when anything changed; returns the new catalog and the result. */
async function runCheck(
  ctx: Ctx,
  path: string,
  catalog: Catalog,
  options: SimOptions,
  now: () => string
): Promise<{ catalog: Catalog; result: CheckResult; party: Awaited<ReturnType<typeof loadPartyState>> }> {
  const session = options.session ?? catalog.session;
  const withSession: Catalog = { ...catalog, session };
  const party = await loadPartyState(ctx, withSession, path);
  const result = await checkEntries(ctx, withSession, party, checkParams(options, now));
  // The party as checked, for the board in Obsidian (which does not simulate).
  const profile: CatalogProfile = { ...profileView(party.profile), stamp: party.stamp };
  const next: Catalog = { ...result.catalog, profile };
  const profileChanged = JSON.stringify(catalog.profile ?? null) !== JSON.stringify(profile);
  if (result.checked > 0 || session !== catalog.session || profileChanged) saveCatalog(ctx, path, next);
  return { catalog: next, result: { ...result, catalog: next }, party };
}

// ---------------------------------------------------------------- actions

function init(ctx: Ctx, options: SimOptions) {
  const refs = options.pc.length > 0 ? options.pc : DEFAULT_PARTY;
  // Resolved to vault paths now, so the catalog names the same notes whoever reads it later.
  const pcs = refs.map((ref) => ctx.note(ref).path);
  const partyName = options.partyName as string;
  const path = options.catalog
    ? resolveNewPath(options.catalog, systemFolderOf(pcs[0]))
    : defaultCatalogPath(systemFolderOf(pcs[0]), partyName);
  if (catalogExists(ctx, path)) {
    throw new UsageError(
      `The catalog "${path}" already exists; init does not overwrite it (edit it, or pick another --party-name or --catalog).`
    );
  }
  const catalog: Catalog = {
    party: { name: partyName, pcs },
    difficulty: options.difficulty,
    session: options.session ?? 0,
    recheckEverySessions: options.every ?? DEFAULT_RECHECK_EVERY_SESSIONS,
    reuseAfterSessions: options.reuseAfter ?? DEFAULT_REUSE_AFTER_SESSIONS,
    entries: [],
  };
  saveCatalog(ctx, path, catalog);
  return {
    catalog: path,
    party: partyName,
    pcs,
    difficulty: catalog.difficulty,
    session: catalog.session,
    recheckEverySessions: catalog.recheckEverySessions,
    reuseAfterSessions: catalog.reuseAfterSessions,
  };
}

/** `--catalog` on init: a vault path as given, or a bare name in the system's default folder. */
function resolveNewPath(flag: string, systemFolder: string): string {
  if (flag.includes("/") || /\.md$/i.test(flag)) {
    const clean = flag.replace(/^\.?\/+/, "");
    return /\.md$/i.test(clean) ? clean : `${clean}.md`;
  }
  return defaultCatalogPath(systemFolder, flag);
}

function draft(ctx: Ctx, options: SimOptions) {
  // An accept needs the catalog (fail before the long read of the tables); a dry run only compares with
  // the one catalog there is, if any, so it drops the drafts the catalog already has.
  const path = options.accept ? resolveCatalogPath(ctx, options.catalog) : maybeCatalogPath(ctx, options.catalog);
  const catalog = path ? loadCatalog(ctx, path) : emptyCatalog();

  const notes = options.args.flatMap((arg) => notesOf(ctx, arg));
  const scan = scanForDrafts(ctx, [...new Set(notes)]);

  // Ids are made once, before anything is sorted or dropped, so a dry run and an accept agree on them.
  const taken = new Set(catalog.entries.map((e) => e.id));
  for (const d of scan.drafts) {
    d.entry.id = slugId(d.entry.name, d.entry.monsters, taken);
    taken.add(d.entry.id);
  }
  // Highest confidence first (the order within one confidence stays the notes' own), so a duplicate keeps the best.
  const ranked = [...scan.drafts].sort((a, b) => rankOf(b.confidence) - rankOf(a.confidence));
  const merged = mergeDrafts(
    catalog,
    ranked.map((d) => d.entry)
  );
  const unique = new Set(merged.added.map((e) => e.id));
  const drafts = ranked.filter((d) => unique.has(d.entry.id));

  const byConfidence = { high: 0, medium: 0, low: 0 };
  for (const d of drafts) byConfidence[d.confidence] += 1;
  const cap = options.limitSet ? options.limit : DEFAULT_DRAFT_LIST;
  const skipped: Record<string, number> = { ...scan.skipped };
  if (merged.skipped.length > 0) skipped.duplicate = merged.skipped.length;
  for (const key of Object.keys(skipped)) if (skipped[key] === 0) delete skipped[key];

  const doc: Record<string, unknown> = {
    notes: notes.length,
    tables: scan.tables,
    considered: scan.considered,
    total: drafts.length,
    byConfidence,
    shown: Math.min(cap, drafts.length),
    drafts: drafts.slice(0, cap).map((d) => ({
      id: d.entry.id,
      name: d.entry.name,
      monsters: d.entry.monsters.map((m) => ({ note: baseName(m.note), count: m.count })),
      tags: d.entry.tags,
      ...(d.entry.source?.text ? { scene: d.entry.source.text } : {}),
      confidence: d.confidence,
      combat: d.combat,
      reasons: d.reasons,
      ...(d.unresolved.length > 0 ? { unresolved: d.unresolved } : {}),
    })),
    skipped: Object.fromEntries(Object.entries(skipped).sort(([a], [b]) => (a < b ? -1 : 1))),
  };

  if (options.accept && path) {
    const min = rankOf(options.minConfidence);
    const only = new Set(options.only);
    const unknown = options.only.filter((id) => !drafts.some((d) => d.entry.id === id));
    if (unknown.length > 0) throw new UsageError(`--only names no draft of these notes: ${unknown.join(", ")}.`);
    const accepted = drafts
      .filter((d) => (only.size > 0 ? only.has(d.entry.id) : rankOf(d.confidence) >= min))
      .map((d) => d.entry);
    const result = mergeDrafts(catalog, accepted);
    if (result.added.length > 0) saveCatalog(ctx, path, result.catalog);
    doc.catalog = path;
    if (only.size > 0) doc.only = [...only];
    else doc.minConfidence = options.minConfidence;
    doc.accepted = result.added.length;
  }
  return doc;
}

function emptyCatalog(): Catalog {
  return {
    party: { name: "", pcs: [] },
    difficulty: "challenging",
    session: 0,
    recheckEverySessions: DEFAULT_RECHECK_EVERY_SESSIONS,
    reuseAfterSessions: DEFAULT_REUSE_AFTER_SESSIONS,
    entries: [],
  };
}

function add(ctx: Ctx, options: SimOptions) {
  const { path, catalog } = existing(ctx, options);
  const monsters = options.monsters.map(({ note, count }) => {
    const state = readMonsterNote(ctx, note);
    if (state.kind === "non-monster") throw new Error(`"${note}" is not a monster note (no stat.monster block)`);
    if (state.kind === "unresolvable") throw new Error(`"${note}" cannot be read as a monster: ${state.why}`);
    return { note: state.file.path, count };
  });
  const name = options.name as string;
  const entry: CatalogEntry = {
    id: slugId(
      name,
      monsters,
      catalog.entries.map((e) => e.id)
    ),
    name,
    monsters,
    tags: [...new Set(options.tags)],
    review: "confirmed",
  };
  saveCatalog(ctx, path, addEntry(catalog, entry));
  return {
    catalog: path,
    added: { id: entry.id, name, monsters: monsters.map((m) => ({ note: baseName(m.note), count: m.count })) },
  };
}

/** The ids that are not in the catalog, as one usage error. */
function requireIds(catalog: Catalog, path: string, ids: string[]): void {
  const have = new Set(catalog.entries.map((e) => e.id));
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length > 0) {
    throw new UsageError(
      `No entry ${missing.length === 1 ? "with id" : "with ids"} ${missing.map((id) => `"${id}"`).join(", ")} in "${path}" (\`catalog list\` shows the ids).`
    );
  }
}

function confirm(ctx: Ctx, options: SimOptions) {
  const { path, catalog } = existing(ctx, options);
  const ids = [...new Set(options.args)];
  requireIds(catalog, path, ids);
  const confirmed: string[] = [];
  const already: string[] = [];
  const entries = catalog.entries.map((entry) => {
    if (!ids.includes(entry.id)) return entry;
    if (entry.review === "confirmed") {
      already.push(entry.id);
      return entry;
    }
    confirmed.push(entry.id);
    return { ...entry, review: "confirmed" as const };
  });
  if (confirmed.length > 0) saveCatalog(ctx, path, { ...catalog, entries });
  return { catalog: path, confirmed, alreadyConfirmed: already };
}

function remove(ctx: Ctx, options: SimOptions) {
  const { path, catalog } = existing(ctx, options);
  const ids = [...new Set(options.args)];
  requireIds(catalog, path, ids);
  const next = ids.reduce(removeEntry, catalog);
  saveCatalog(ctx, path, next);
  return { catalog: path, removed: ids, remaining: next.entries.length };
}

function tag(ctx: Ctx, options: SimOptions) {
  const { path, catalog } = existing(ctx, options);
  const ids = [...new Set(options.args)];
  requireIds(catalog, path, ids);
  const changed: Array<{ id: string; tags: string[] }> = [];
  const entries = catalog.entries.map((entry) => {
    if (!ids.includes(entry.id)) return entry;
    const kept = entry.tags.filter((t) => !options.dropTags.some((d) => sameTag(t, d)));
    const tags = normaliseTags([...kept, ...options.addTags.filter((t) => !kept.some((k) => sameTag(k, t)))]);
    if (tags.join("\n") === entry.tags.join("\n")) return entry;
    changed.push({ id: entry.id, tags });
    return { ...entry, tags };
  });
  if (changed.length > 0) saveCatalog(ctx, path, { ...catalog, entries });
  return { catalog: path, changed, unchanged: ids.filter((id) => !changed.some((c) => c.id === id)) };
}

function use(ctx: Ctx, options: SimOptions) {
  const { path, catalog } = existing(ctx, options);
  const ids = [...new Set(options.args)];
  requireIds(catalog, path, ids);
  const session = options.session ?? catalog.session;
  const used: Array<{ id: string; uses: number; lastUsedSession: number }> = [];
  const entries = catalog.entries.map((entry) => {
    if (!ids.includes(entry.id)) return entry;
    const next = { ...entry, uses: (entry.uses ?? 0) + 1, lastUsedSession: session };
    used.push({ id: entry.id, uses: next.uses, lastUsedSession: session });
    return next;
  });
  saveCatalog(ctx, path, { ...catalog, entries });
  return {
    catalog: path,
    used,
    offeredAgainFrom: catalog.reuseAfterSessions > 0 ? session + catalog.reuseAfterSessions : session,
  };
}

/**
 * The vault's session notes played by this party: a note `rpg session list` shows
 * (an `rpg log` and `pcs`), in the party's system folder (so test notes elsewhere
 * do not count), whose every PC is one of the catalog's.
 */
function partySessions(ctx: Ctx, catalog: Catalog): string[] {
  const party = new Set(catalog.party.pcs);
  const system = systemFolderOf(catalog.party.pcs[0] ?? "");
  return listSessions(ctx).filter((path) => {
    if (system && !path.startsWith(`${system}/`)) return false;
    const file = ctx.note(path);
    const pcs = ctx.metadataCache.frontmatterOf(file)?.pcs;
    if (!Array.isArray(pcs) || pcs.length === 0) return false;
    return pcs.every((raw) => {
      const name = linkNames(String(raw))[0] ?? String(raw);
      const found = ctx.vault.resolveLink(name.replace(/\.md$/i, ""));
      return found !== null && found !== undefined && party.has(found.path);
    });
  });
}

function session(ctx: Ctx, options: SimOptions) {
  const { path, catalog } = existing(ctx, options);
  const notes = partySessions(ctx, catalog);
  const next = options.session ?? notes.length;
  const from = options.session !== undefined ? "set" : "vault";
  if (next !== catalog.session) saveCatalog(ctx, path, { ...catalog, session: next });
  return { catalog: path, session: next, was: catalog.session, from, sessions: notes };
}

/**
 * Prepares entries in the party's latest session log: one `[Enc:…|prepared]` line each, which the
 * Start Combat card offers (see lib/domains/session-log/prepared-encounter.ts).
 */
function prepare(ctx: Ctx, options: SimOptions) {
  const { path, catalog } = existing(ctx, options);
  const ids = [...new Set(options.args)];
  requireIds(catalog, path, ids);
  const sessions = partySessions(ctx, catalog).sort();
  const latest = sessions[sessions.length - 1];
  if (!latest) {
    throw new UsageError("No session note of this party to prepare in (a note with an rpg log and the party's pcs).");
  }
  let text = readNote(ctx.root, latest) ?? "";
  const self = path.replace(/\.md$/i, "");
  const done: Array<{ id: string; line: string }> = [];
  for (const id of ids) {
    const entry = catalog.entries.find((e) => e.id === id) as CatalogEntry;
    const title = entry.name.replace(/^.+? #\d+: /, "").replace(/[[\]|]/g, "");
    const line = formatEncounterTag({
      link: `[[${self}#^${id}|${title}]]`,
      foes: foesText(entry.monsters.map((m) => ({ link: noteRef(ctx, m.note), count: m.count }))),
      state: "prepared",
    });
    const next = appendToLog(text, line);
    if (next === null) throw new UsageError(`"${latest}" has no rpg log block to prepare in.`);
    text = next;
    done.push({ id, line });
  }
  writeNote(ctx.root, latest, text);
  return { catalog: path, session: latest, prepared: done };
}

/**
 * `catalog adjust`: the entries named (or, with none, those of the party's tier whose fit is one of
 * --state, default too-hard and too-easy, at most --limit, default 5) tried with changes; with
 * --accept the best fitting change of each (or --pick) is added as a draft.
 */
async function adjust(ctx: Ctx, options: SimOptions, now: () => string) {
  const { path, catalog } = existing(ctx, options);
  const ids = [...new Set(options.args)];
  requireIds(catalog, path, ids);
  const party = await loadPartyState(ctx, catalog, path, options.session);
  const states = options.states.length ? options.states : (["too-hard", "too-easy"] as const);
  const chosen = ids.length
    ? catalog.entries.filter((e) => ids.includes(e.id))
    : byTier(ctx, catalog, party.profile, options.tiers)
        .kept.map((k) => k.entry)
        .filter((e) => e.fit && (states as readonly string[]).includes(e.fit.state) && !e.adjustedFrom)
        .slice(0, options.limitSet ? options.limit : 5);
  const pool = await adjustPool(ctx);
  const params = { seed: options.seed, trials: options.trials, rounds: options.rounds, today: now() };
  let next = catalog;
  const results = [];
  for (const entry of chosen) {
    const r = await adjustEntry(ctx, catalog, party, entry, pool, params);
    let added: string | undefined;
    const pick = r.fitting[options.pick - 1];
    if (options.accept && pick) {
      const draftEntry = adjustedEntry(next, entry, pick);
      next = addEntry(next, draftEntry);
      added = draftEntry.id;
    }
    results.push({
      id: r.id,
      fit: r.from.state,
      avgHpLost: r.from.avgHpLost,
      tpkRate: r.from.tpkRate,
      ...(r.direction ? { make: r.direction } : {}),
      tried: r.tried,
      options: r.fitting.slice(0, 3).map((t, i) => ({
        pick: i + 1,
        change: t.candidate.label,
        monsters: t.candidate.monsters.map((m) => groupRef(ctx, m.note, m.count)),
        avgHpLost: t.fit.avgHpLost,
        tpkRate: t.fit.tpkRate,
        winRate: t.fit.winRate,
      })),
      ...(r.fitting.length > 3 ? { moreOptions: r.fitting.length - 3 } : {}),
      ...(r.closest
        ? {
            closest: {
              change: r.closest.candidate.label,
              monsters: r.closest.candidate.monsters.map((m) => groupRef(ctx, m.note, m.count)),
              fit: r.closest.fit.state,
              avgHpLost: r.closest.fit.avgHpLost,
              tpkRate: r.closest.fit.tpkRate,
            },
          }
        : {}),
      ...(r.direction ? { tactics: r.tactics } : {}),
      ...(added ? { added } : {}),
    });
  }
  if (next !== catalog) saveCatalog(ctx, path, next);
  return {
    catalog: path,
    party: { name: catalog.party.name, size: party.actors.length, tier: party.profile.tier },
    difficulty: catalog.difficulty,
    adjusted: results,
    ...(results.length === 0
      ? { note: "No entry to adjust: name ids, or check the catalog first so entries have a fit." }
      : {}),
    ...(options.accept
      ? {}
      : { hint: "A dry run: --accept adds the best option of each as a draft (--pick N another)." }),
  };
}

async function check(ctx: Ctx, options: SimOptions, now: () => string) {
  const { path, catalog } = existing(ctx, options);
  const { result, party } = await runCheck(ctx, path, catalog, options, now);
  return {
    catalog: path,
    party: { name: catalog.party.name, stamp: party.stamp, pcs: party.actors.length },
    session: party.fitContext.session,
    difficulty: catalog.difficulty,
    profile: profileView(party.profile),
    tiers: options.tiers,
    seed: options.seed,
    trials: options.trials,
    checked: result.checked,
    unchanged: result.unchanged,
    remaining: result.remaining,
    otherTier: result.otherTier,
    errors: result.errors,
    partition: partitionByFit(byTier(ctx, result.catalog, party.profile, options.tiers).scoped, party.fitContext),
  };
}

async function suggest(ctx: Ctx, options: SimOptions, now: () => string) {
  const found = existing(ctx, options);
  const path = found.path;
  let catalog = found.catalog;
  let refreshed: Record<string, unknown> | undefined;
  let party;
  if (options.refresh) {
    const run = await runCheck(ctx, path, catalog, options, now);
    catalog = run.catalog;
    party = run.party;
    refreshed = { checked: run.result.checked, errors: run.result.errors, remaining: run.result.remaining };
  } else {
    party = await loadPartyState(ctx, catalog, path, options.session);
  }
  const fitContext = party.fitContext;
  const tiers = byTier(ctx, catalog, party.profile, options.tiers);
  const below = new Set(tiers.kept.filter((k) => k.match === "lower").map((k) => k.entry.id));
  // Only the entries of the party's tiers count: another tier's stale entry is not this party's to check.
  const partition = partitionByFit(tiers.scoped, fitContext);
  const stale = needsCheck(partition);

  let recent = 0;
  const eligible = tiers.scoped.entries.filter((entry) => {
    const ok = isEligible(entry, fitContext, {
      tags: options.tags,
      anyTags: options.anyTags,
      states: options.states.length > 0 ? options.states : ["fit"],
      includeStale: options.includeStale,
      ...(options.includeDraft ? {} : { reviewed: true }),
    });
    if (ok && !options.includeUsed && recentlyUsed(entry, fitContext.session, catalog.reuseAfterSessions)) {
      recent += 1;
      return false;
    }
    return ok;
  });
  // The closest to the difficulty's aim first.
  const distance = (entry: CatalogEntry): number =>
    entry.fit ? outcomeDistance(entry.fit, fitContext.difficulty) : Number.POSITIVE_INFINITY;
  eligible.sort((a, b) => distance(a) - distance(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const cap = options.limitSet ? options.limit : DEFAULT_SUGGEST;

  const marked = <T extends object>(entry: CatalogEntry, view: T): T =>
    below.has(entry.id) ? { ...view, belowTier: true } : view;

  if (options.brief) {
    return {
      difficulty: catalog.difficulty,
      profile: profileView(party.profile),
      needsCheck: stale,
      ...(stale > 0 ? { hint: CHECK_HINT(stale) } : {}),
      ...(refreshed ? { refreshed } : {}),
      ...(recent > 0 ? { recentlyUsed: recent } : {}),
      ...(tiers.otherTier > 0 ? { otherTier: tiers.otherTier } : {}),
      matched: eligible.length,
      entries: eligible.slice(0, cap).map((entry) => marked(entry, briefViewOf(ctx, entry, fitContext))),
    };
  }

  return {
    catalog: path,
    party: catalog.party.name,
    profile: profileView(party.profile),
    session: fitContext.session,
    difficulty: catalog.difficulty,
    tiers: options.tiers,
    partition,
    needsCheck: stale,
    ...(stale > 0 ? { hint: CHECK_HINT(stale) } : {}),
    ...(refreshed ? { refreshed } : {}),
    ...(recent > 0 ? { recentlyUsed: recent } : {}),
    ...(tiers.otherTier > 0 ? { otherTier: tiers.otherTier } : {}),
    matched: eligible.length,
    entries: eligible.slice(0, cap).map((entry) => marked(entry, viewOf(entry, fitContext))),
  };
}

async function list(ctx: Ctx, options: SimOptions) {
  const { path, catalog } = existing(ctx, options);
  const party = await loadPartyState(ctx, catalog, path);
  const fitContext = party.fitContext;
  // `list` shows every entry unless --tiers is written: it is the review of the whole note.
  const tiers = byTier(ctx, catalog, party.profile, options.given.includes("tiers") ? options.tiers : "all");
  const partition = partitionByFit(tiers.scoped, fitContext);
  const matching = tiers.scoped.entries.filter(
    (entry) =>
      isEligible(entry, fitContext, {
        tags: options.tags,
        anyTags: options.anyTags,
        states: ["fit", "too-easy", "too-hard"],
        includeStale: true,
        ...(options.review ? { reviewed: options.review === "confirmed" } : {}),
      }) &&
      (options.states.length === 0 || (!!entry.fit && options.states.includes(entry.fit.state)))
  );
  const cap = options.limitSet ? options.limit : matching.length;
  return {
    catalog: path,
    party: catalog.party.name,
    session: fitContext.session,
    difficulty: catalog.difficulty,
    partition,
    needsCheck: needsCheck(partition),
    matched: matching.length,
    entries: matching.slice(0, cap).map((entry) => viewOf(entry, fitContext)),
  };
}

/** The handler of `rpg sim catalog …`; `deps.now` stands in for the clock in tests. */
export function createSimCatalog(deps: CatalogDeps = {}): SimHandler {
  const now = deps.now ?? today;
  return async (ctx, options) => {
    switch (options.action) {
      case "init":
        return { doc: init(ctx, options) };
      case "draft":
        return { doc: draft(ctx, options) };
      case "add":
        return { doc: add(ctx, options) };
      case "confirm":
        return { doc: confirm(ctx, options) };
      case "remove":
        return { doc: remove(ctx, options) };
      case "tag":
        return { doc: tag(ctx, options) };
      case "use":
        return { doc: use(ctx, options) };
      case "session":
        return { doc: session(ctx, options) };
      case "prepare":
        return { doc: prepare(ctx, options) };
      case "adjust":
        return { doc: await adjust(ctx, options, now) };
      case "check":
        return { doc: await check(ctx, options, now) };
      case "suggest":
        return { doc: await suggest(ctx, options, now) };
      case "list":
        return { doc: await list(ctx, options) };
      default:
        throw new UsageError(`Unknown catalog action "${options.action ?? ""}".`);
    }
  };
}

export const simCatalog: SimHandler = createSimCatalog();
