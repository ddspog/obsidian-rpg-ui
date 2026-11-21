/**
 * Whether a catalog entry belongs to a party's tier of play. An entry drafted
 * from a table carries the table's tier tags (`tier-1`, or `tier-3` and `tier-4`
 * for a "Tier 3–4" table); it belongs when one of them is the party's tier. An
 * entry with no tier tag (made by hand) belongs when none of its monsters is
 * above the party's single-monster CR. Pure: no Obsidian and no I/O.
 */

import { cmpCr, parseCr, type Rational } from "../encounter-sim/difficulty";
import type { PartyProfile, Tier } from "../encounter-sim/party-profile";

import type { CatalogEntry } from "./catalog";

/** `same`: the party's tier. `lower`: only lower tiers (story use; less XP). `higher`: above it. */
export type TierMatch = "same" | "lower" | "higher";

/** The tiers an entry's tags name, sorted; empty when it has none. */
export function entryTiers(entry: Pick<CatalogEntry, "tags">): Tier[] {
  const tiers = new Set<Tier>();
  for (const tag of entry.tags) {
    const m = /^tier-([1-4])$/.exec(tag.trim().toLowerCase());
    if (m) tiers.add(Number(m[1]) as Tier);
  }
  return [...tiers].sort();
}

/**
 * How an entry stands against the party's tier. `crOf` gives a monster note's
 * CR (or undefined when it cannot be read), used only for untagged entries: an
 * unreadable CR does not count against the entry.
 */
export function tierMatch(
  entry: Pick<CatalogEntry, "tags" | "monsters">,
  profile: Pick<PartyProfile, "tier" | "maxSingleCr">,
  crOf: (note: string) => string | undefined
): TierMatch {
  const tiers = entryTiers(entry);
  if (tiers.length > 0) {
    if (tiers.includes(profile.tier)) return "same";
    return tiers.every((t) => t < profile.tier) ? "lower" : "higher";
  }
  const over = entry.monsters.some((m) => {
    const text = crOf(m.note);
    if (text === undefined) return false;
    let cr: Rational;
    try {
      cr = parseCr(text);
    } catch {
      return false;
    }
    return cmpCr(cr, profile.maxSingleCr) > 0;
  });
  return over ? "higher" : "same";
}
