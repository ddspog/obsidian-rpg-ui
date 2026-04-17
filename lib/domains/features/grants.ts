/**
 * Grant dedup / labelling helpers.
 *
 * Pure functions used by the resolver and feature card UI to collapse multiple
 * tagged grants into one inline display row per tag.
 */

import type { Grant, TagId } from "./types";

const TAG_LABELS: Record<TagId, string> = {
  hp: "Hit Points",
  armor: "Armor",
  weapons: "Weapons",
  save: "Saving Throws",
  skill_proficiency: "Skill P.",
  tool: "Tools",
  language: "Languages",
  speed: "Speed",
  size: "Size",
  talent: "Talents",
};

/** Human-readable label for a tag. Falls back to the tag id for unknown tags. */
export function tagLabel(tag: TagId | string): string {
  return (TAG_LABELS as Record<string, string | undefined>)[tag] ?? tag;
}

/**
 * Merge same-tag grants while preserving first-seen order.
 *
 * Example:
 *   [{tag:"armor", values:["Light"]}, {tag:"hp", values:["+8"]}, {tag:"armor", values:["Shield"]}]
 *   → [{tag:"armor", values:["Light","Shield"]}, {tag:"hp", values:["+8"]}]
 *
 * Duplicate values within a tag are deduplicated (first occurrence wins).
 */
export function groupByTag(grants: Grant[]): Grant[] {
  const order: TagId[] = [];
  const buckets = new Map<TagId, string[]>();

  for (const g of grants) {
    if (!buckets.has(g.tag)) {
      buckets.set(g.tag, []);
      order.push(g.tag);
    }
    const seen = buckets.get(g.tag)!;
    for (const v of g.values) {
      if (!seen.includes(v)) seen.push(v);
    }
  }

  return order.map((tag) => ({ tag, values: buckets.get(tag)! }));
}
