/**
 * Inventory changes — every `[Inv:…]` the log records, attributed to whoever
 * it belongs to, for a "did I put this on the sheet?" checklist.
 *
 *   @(Talon) Received [[Kowyn's Bag]] from Kobold.
 *   => I kept it close. [Inv:[[Kowyn's Bag]]+1]
 *
 * The tag is Lonelog's own; only the OWNER is new. It is the `Owner/` prefix
 * when written (`[Inv:Talon/Rope+1]`), else the actor whose action the line
 * resolves, else nobody — the party's shared stash.
 */

import type { InventoryTag, PersistentTag } from "lib/domains/lonelog/types";
import type { ProseSegment } from "./prose-grouper";

export interface InventoryChange {
  /** Who holds the item; undefined for the party. */
  owner?: string;
  /** The containers it's in, below the owner (`Kowyn's Bag/Pouch/…` → `["Pouch"]`). */
  path?: string[];
  name: string;
  /** Written as a `[[wikilink]]` at least once. */
  link: boolean;
  /** Net count across the log (`+1` then `-1` is 0); undefined when no tag
   *  gave a delta, only a state. */
  delta?: number;
  /** The last stated quantity (`[Inv:Torch|3]`, or the `to` of `3→2`). */
  quantity?: number;
  depleted: boolean;
  /** Where each mention sits (segment source indexes), in log order. */
  sources: number[];
}

/** Whether the change leaves the owner holding the item. */
export function isGain(c: InventoryChange): boolean {
  if (c.depleted) return false;
  if (c.quantity != null) return c.quantity > 0;
  return (c.delta ?? 1) > 0;
}

/** The single actor of an action — a group (`Talon+Lilith`) owns nothing alone. */
function soleActor(actor: string | undefined): string | undefined {
  if (!actor || actor.includes("+")) return undefined;
  return actor.trim();
}

const isInv = (t: PersistentTag): t is InventoryTag => t.kind === "inventory";

/** Fold the log's inventory tags into one change per (owner, item). */
export function collectInventoryChanges(segments: ProseSegment[]): InventoryChange[] {
  const byKey = new Map<string, InventoryChange>();
  const add = (tags: PersistentTag[], actor: string | undefined, source: number) => {
    for (const tag of tags.filter(isInv)) {
      if (!tag.name) continue;
      const owner = tag.owner ?? actor;
      const where = (tag.path ?? []).join("/").toLowerCase();
      const key = `${(owner ?? "").toLowerCase()}\u0000${where}\u0000${tag.name.toLowerCase()}`;
      let c = byKey.get(key);
      if (!c) {
        c = {
          owner,
          ...(tag.path ? { path: tag.path } : {}),
          name: tag.name,
          link: false,
          depleted: false,
          sources: [],
        };
        byKey.set(key, c);
      }
      c.link ||= !!tag.link;
      if (tag.delta != null) c.delta = (c.delta ?? 0) + tag.delta;
      if (tag.quantity != null) c.quantity = tag.quantity;
      if (tag.transition) c.quantity = tag.transition.to;
      if (tag.depleted) c.depleted = true;
      if (!c.sources.includes(source)) c.sources.push(source);
    }
  };

  for (const seg of segments) {
    switch (seg.type) {
      case "action-group":
        for (const c of seg.consequences) add(c.tags, soleActor(seg.action.actor), seg.sourceIndex);
        break;
      case "oracle":
        for (const c of seg.consequences) add(c.tags, soleActor(seg.question.actor), seg.sourceIndex);
        break;
      case "world-event":
        add(seg.entry.tags, undefined, seg.sourceIndex);
        for (const c of seg.consequences) add(c.tags, undefined, seg.sourceIndex);
        break;
      case "standalone-consequence":
        add(seg.entry.tags, undefined, seg.sourceIndex);
        break;
      default:
        break;
    }
  }
  return Array.from(byKey.values());
}
