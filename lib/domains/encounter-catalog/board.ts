/**
 * The encounter catalog as the plugin's board shows it: the party as the last
 * `catalog check` profiled it, how many entries fit, and one card per entry,
 * best first. Obsidian does not simulate: staleness is judged against the stamp
 * and session the check wrote. Pure: no Obsidian and no I/O.
 */

import { FIT_TOLERANCE, OUTCOME_PROFILES, outcomeDistance, type OutcomeProfile } from "../encounter-sim/fit";

import type { Catalog, CatalogEntry, CatalogProfile } from "./catalog";
import { recentlyUsed, recheckReason, type RecheckReason } from "./fit-state";
import { entryTiers, type TierMatch } from "./tier";
import { noteStem } from "./words";

/** A card's state: the stored fit when it is current, else why it is not. */
export type CardStatus = "fit" | "too-easy" | "too-hard" | "stale" | "unchecked";

export interface BoardMonster {
  /** The note's name, as said: "Wolf, Dire". */
  name: string;
  /** The note as the entry names it (a vault path). */
  note: string;
  count: number;
  dice?: string;
}

export interface BoardCard {
  id: string;
  name: string;
  monsters: BoardMonster[];
  tags: string[];
  draft: boolean;
  status: CardStatus;
  /** Why the fit is out of date, when the status is `stale`. */
  stale?: RecheckReason;
  /** The stored outcome (also kept when stale, as the last known). */
  outcome?: { winRate: number; tpkRate: number; avgHpLost: number };
  /** The state with a rolled count at its fewest / most, when it differs from the status. */
  atMin?: string;
  atMax?: string;
  scene?: string;
  tier: TierMatch;
  usedRecently: boolean;
  uses?: number;
  lastUsedSession?: number;
  /** The table it came from: "Arctic Encounters, row 3". */
  source?: string;
  /** Where the encounter is from, said after its title: "Arctic · tier 1 · row 5". */
  byline?: string;
  /** The title without the table prefix the draft name carries ("Dire Wolf" from "Arctic T1 #3: Dire Wolf"). */
  title: string;
  /** The book slug of the source (its tag says nothing the byline does not). */
  book?: string;
  /** When it was run recently: the session it is offered again from. */
  restingUntil?: number;
}

export interface BoardCounts {
  fit: number;
  tooEasy: number;
  tooHard: number;
  /** Stale or never checked. */
  needsCheck: number;
  drafts: number;
  recentlyUsed: number;
  /** Entries of another tier than the party's (not among the cards unless asked). */
  otherTier: number;
}

export interface Board {
  party: { name: string; pcs: string[] };
  profile?: CatalogProfile;
  difficulty: Catalog["difficulty"];
  session: number;
  reuseAfterSessions: number;
  /** What the difficulty aims for, and the share of HP lost a fit may be off by. */
  aim: OutcomeProfile & { tolerance: number };
  counts: BoardCounts;
  cards: BoardCard[];
}

export interface BoardOptions {
  /** Show entries of lower tiers (story use), or every tier. Default the party's own. */
  tiers?: "same" | "lower" | "all";
}

const nameOf = noteStem;

/**
 * An entry's tier against the profiled party, by its tier tags. An untagged entry counts as the
 * party's own here: the board cannot read monster CRs (the CLI's `--tiers` does).
 */
function tierOf(entry: CatalogEntry, profile: CatalogProfile | undefined): TierMatch {
  if (!profile) return "same";
  const tiers = entryTiers(entry);
  if (tiers.length === 0 || tiers.includes(profile.tier as 1 | 2 | 3 | 4)) return "same";
  return tiers.every((t) => t < profile.tier) ? "lower" : "higher";
}

function inScope(match: TierMatch, scope: BoardOptions["tiers"]): boolean {
  return scope === "all" || match === "same" || (scope === "lower" && match === "lower");
}

const STATUS_ORDER: Record<CardStatus, number> = { fit: 0, "too-easy": 1, "too-hard": 2, stale: 3, unchecked: 4 };
const TIER_ORDER: Record<TierMatch, number> = { same: 0, lower: 1, higher: 2 };

/** One entry as a card, judged against the catalog's profile and session (also used for a lone entry block). */
export function cardOf(entry: CatalogEntry, catalog: Catalog, tier: TierMatch): BoardCard {
  // Without a profile there is no party stamp to compare: an entry's own stamp stands for it.
  const stamp = catalog.profile?.stamp ?? entry.fit?.stamp ?? "";
  const reason = recheckReason(entry, stamp, catalog.session, catalog.recheckEverySessions, catalog.difficulty);
  const status: CardStatus =
    reason === "no-fit" ? "unchecked" : reason !== null ? "stale" : (entry.fit?.state ?? "unchecked");
  const fit = entry.fit;
  const source = entry.source
    ? `${nameOf(entry.source.note)}${entry.source.row !== undefined ? `, row ${entry.source.row}` : ""}`
    : undefined;
  // A drafted name carries its table: "Arctic T1 #3: Dire Wolf" (or "Arctic T3-4 #3: …").
  const named = /^(.+?) T(\d+(?:-\d+)?) #(\d+): (.+)$/.exec(entry.name);
  const byline = named ? `${named[1]} · tier ${named[2].replace("-", "–")} · row ${named[3]}` : source;
  const used = recentlyUsed(entry, catalog.session, catalog.reuseAfterSessions);
  return {
    id: entry.id,
    name: entry.name,
    monsters: entry.monsters.map((m) => ({
      name: m.template ? `${nameOf(m.note)} (${m.template})` : nameOf(m.note),
      note: m.note,
      count: m.count,
      ...(m.dice ? { dice: m.dice } : {}),
    })),
    tags: entry.tags,
    draft: entry.review === "draft",
    status,
    ...(reason !== null && reason !== "no-fit" ? { stale: reason } : {}),
    ...(fit ? { outcome: { winRate: fit.winRate, tpkRate: fit.tpkRate, avgHpLost: fit.avgHpLost } } : {}),
    ...(fit?.atMin !== undefined && fit.atMin !== fit.state ? { atMin: fit.atMin } : {}),
    ...(fit?.atMax !== undefined && fit.atMax !== fit.state ? { atMax: fit.atMax } : {}),
    ...(entry.source?.text ? { scene: entry.source.text } : {}),
    tier,
    usedRecently: used,
    ...(used && entry.lastUsedSession !== undefined
      ? { restingUntil: entry.lastUsedSession + catalog.reuseAfterSessions }
      : {}),
    title: named ? named[4] : entry.name,
    ...(byline ? { byline } : {}),
    ...(entry.source?.book ? { book: entry.source.book } : {}),
    ...(entry.uses !== undefined ? { uses: entry.uses } : {}),
    ...(entry.lastUsedSession !== undefined ? { lastUsedSession: entry.lastUsedSession } : {}),
    ...(source ? { source } : {}),
  };
}

/** The board of a catalog: counts over the entries in the party's tiers, and their cards, best first. */
export function buildBoard(catalog: Catalog, options: BoardOptions = {}): Board {
  const scope = options.tiers ?? "same";
  const counts: BoardCounts = {
    fit: 0,
    tooEasy: 0,
    tooHard: 0,
    needsCheck: 0,
    drafts: 0,
    recentlyUsed: 0,
    otherTier: 0,
  };
  const cards: BoardCard[] = [];
  const distance = new Map<string, number>();
  for (const entry of catalog.entries) {
    const tier = tierOf(entry, catalog.profile);
    if (!inScope(tier, scope)) {
      counts.otherTier += 1;
      continue;
    }
    const card = cardOf(entry, catalog, tier);
    if (card.status === "fit") counts.fit += 1;
    else if (card.status === "too-easy") counts.tooEasy += 1;
    else if (card.status === "too-hard") counts.tooHard += 1;
    else counts.needsCheck += 1;
    if (card.draft) counts.drafts += 1;
    if (card.usedRecently) counts.recentlyUsed += 1;
    distance.set(entry.id, entry.fit ? outcomeDistance(entry.fit, catalog.difficulty) : Number.POSITIVE_INFINITY);
    cards.push(card);
  }
  // Encounters run recently last (they are resting); then fit, too easy, too hard, out of date, never
  // checked; within a state: the party's own tier, confirmed, closest to the aim, then by id.
  cards.sort(
    (a, b) =>
      Number(a.usedRecently) - Number(b.usedRecently) ||
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
      Number(a.draft) - Number(b.draft) ||
      (distance.get(a.id) ?? 0) - (distance.get(b.id) ?? 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  return {
    party: { name: catalog.party.name, pcs: catalog.party.pcs.map(nameOf) },
    ...(catalog.profile ? { profile: catalog.profile } : {}),
    difficulty: catalog.difficulty,
    session: catalog.session,
    reuseAfterSessions: catalog.reuseAfterSessions,
    aim: { ...OUTCOME_PROFILES[catalog.difficulty], tolerance: FIT_TOLERANCE },
    counts,
    cards,
  };
}
