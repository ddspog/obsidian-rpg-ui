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
import { outcomeDistance } from "lib/domains/encounter-sim/fit";
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
import { checkEntries, loadPartyState, type CheckParams, type CheckResult } from "./catalog-check";
import { notesOf, scanForDrafts } from "./catalog-draft";
import { groupRef } from "./brief";
import type { SimHandler } from "./dispatch";
import { CONFIDENCES, UsageError, type SimOptions } from "./flags";
import { linkNames, readMonsterNote } from "./monsters";
import { DEFAULT_PARTY } from "./party";
import { listSessions } from "../session/lines";

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
  };
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
  if (result.checked > 0 || session !== catalog.session) saveCatalog(ctx, path, result.catalog);
  return { catalog: result.catalog, result, party };
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
      confidence: d.confidence,
      combat: d.combat,
      reasons: d.reasons,
      ...(d.unresolved.length > 0 ? { unresolved: d.unresolved } : {}),
    })),
    skipped: Object.fromEntries(Object.entries(skipped).sort(([a], [b]) => (a < b ? -1 : 1))),
  };

  if (options.accept && path) {
    const min = rankOf(options.minConfidence);
    const accepted = drafts.filter((d) => rankOf(d.confidence) >= min).map((d) => d.entry);
    const result = mergeDrafts(catalog, accepted);
    if (result.added.length > 0) saveCatalog(ctx, path, result.catalog);
    doc.catalog = path;
    doc.minConfidence = options.minConfidence;
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

async function check(ctx: Ctx, options: SimOptions, now: () => string) {
  const { path, catalog } = existing(ctx, options);
  const { result, party } = await runCheck(ctx, path, catalog, options, now);
  return {
    catalog: path,
    party: { name: catalog.party.name, stamp: party.stamp, pcs: party.actors.length },
    session: party.fitContext.session,
    difficulty: catalog.difficulty,
    seed: options.seed,
    trials: options.trials,
    checked: result.checked,
    unchanged: result.unchanged,
    remaining: result.remaining,
    errors: result.errors,
    partition: result.partition,
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
  const partition = partitionByFit(catalog, fitContext);
  const stale = needsCheck(partition);

  let recent = 0;
  const eligible = catalog.entries.filter((entry) => {
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

  if (options.brief) {
    return {
      difficulty: catalog.difficulty,
      needsCheck: stale,
      ...(stale > 0 ? { hint: CHECK_HINT(stale) } : {}),
      ...(refreshed ? { refreshed } : {}),
      ...(recent > 0 ? { recentlyUsed: recent } : {}),
      matched: eligible.length,
      entries: eligible.slice(0, cap).map((entry) => briefViewOf(ctx, entry, fitContext)),
    };
  }

  return {
    catalog: path,
    party: catalog.party.name,
    session: fitContext.session,
    difficulty: catalog.difficulty,
    partition,
    needsCheck: stale,
    ...(stale > 0 ? { hint: CHECK_HINT(stale) } : {}),
    ...(refreshed ? { refreshed } : {}),
    ...(recent > 0 ? { recentlyUsed: recent } : {}),
    matched: eligible.length,
    entries: eligible.slice(0, cap).map((entry) => viewOf(entry, fitContext)),
  };
}

async function list(ctx: Ctx, options: SimOptions) {
  const { path, catalog } = existing(ctx, options);
  const party = await loadPartyState(ctx, catalog, path);
  const fitContext = party.fitContext;
  const partition = partitionByFit(catalog, fitContext);
  const matching = catalog.entries.filter(
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
