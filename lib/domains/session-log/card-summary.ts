/**
 * The confirmation sentence for a card — what playing it does.
 */

import type { SessionFeatureCard } from "./card-types";

/**
 * What a card does, for its confirmation: its `summary`, else the first
 * paragraph of its description — prose only, so a description's worked example
 * (lonelog lines like `? …` or `gen: …`) never stands in for one.
 */
export function cardSummary(card: SessionFeatureCard): string {
  if (card.summary?.trim()) return card.summary.trim();
  const paragraph = (card.text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(\?|@|!|=>|->|d:|d\(|gen:|tbl:|o:|\[|```|#)/.test(p));
  return paragraph ?? "";
}
