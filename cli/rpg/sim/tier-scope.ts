/**
 * The `--tiers` rule of the catalog commands, `plan` and `suggest`: which
 * encounters a party may be offered by tier of play (see
 * lib/domains/encounter-catalog/tier.ts).
 */

import type { CatalogEntry } from "lib/domains/encounter-catalog/catalog";
import { tierMatch, type TierMatch } from "lib/domains/encounter-catalog/tier";
import type { PartyProfile } from "lib/domains/encounter-sim/party-profile";
import type { Ctx } from "../app";
import type { TierScope } from "./flags";
import { readMonsterNote } from "./monsters";

/** Whether an entry of this match is offered under the scope. */
export function inScope(match: TierMatch, scope: TierScope): boolean {
  return scope === "all" || match === "same" || (scope === "lower" && match === "lower");
}

/** The tier match of catalog entries against a party, reading monster CRs from the vault once each. */
export function tierMatcher(ctx: Ctx, profile: PartyProfile): (entry: CatalogEntry) => TierMatch {
  const crs = new Map<string, string | undefined>();
  const crOf = (note: string): string | undefined => {
    if (!crs.has(note)) {
      const state = readMonsterNote(ctx, note);
      crs.set(note, state.kind === "monster" ? state.data.cr : undefined);
    }
    return crs.get(note);
  };
  return (entry) => tierMatch(entry, profile, crOf);
}
