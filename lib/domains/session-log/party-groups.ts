/**
 * A PARTY card that calls on its members — a short rest's hit dice, each
 * member's own entry — drawn in the Log as one entry, as a Multiattack is:
 *
 *   @(Party) Short rest
 *   @(Kowyn) Spends a hit die
 *   d: Healing | 1d8+2=
 *   @(Talon) Spends a hit die
 *   d: Healing | 1d10=
 *   => They patched up by the fire. [Kowyn/Hit Dice-1] [Talon/Hit Dice-1]
 *
 * Its line folds into the first member's header strip (`SHORT REST Party`),
 * their entries run on inside one framed panel.
 */

import type { SidebarItem } from "./prose-model";
import type { ProseSegment } from "./prose-grouper";

const isParty = (actor?: string) => /^party$/i.test(actor?.trim() ?? "");

/** Each party card's members' entries, by the card's own: what follows it, by
 *  members of the party, until anything else. */
export function partyGroups(segments: ProseSegment[], isMember: (actor: string) => boolean): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // One with its own outcome is done (a long rest's `=> … [Time: +8h]`):
    // who acts next isn't a part of it.
    if (seg.type !== "action-group" || !isParty(seg.action.actor) || seg.consequences.length > 0) continue;
    const members: number[] = [];
    for (let j = i + 1; j < segments.length; j++) {
      const next = segments[j];
      if (
        next.type !== "action-group" ||
        !next.action.actor ||
        isParty(next.action.actor) ||
        !isMember(next.action.actor)
      )
        break;
      members.push(next.sourceIndex);
    }
    if (members.length > 0) out.set(seg.sourceIndex, members);
  }
  return out;
}

export function withPartyGroups(
  items: SidebarItem[],
  segments: ProseSegment[],
  isMember: (actor: string) => boolean
): SidebarItem[] {
  const groups = partyGroups(segments, isMember);
  if (groups.size === 0) return items;
  const role = new Map<number, "part" | "last">();
  const heads = new Map<number, string>();
  const folded = new Set<number>();
  for (const [opener, members] of groups) {
    const seg = segments.find((s) => s.sourceIndex === opener);
    const item = items.find((x) => x.id === opener);
    const what = seg?.type === "action-group" ? seg.action.text.trim() : "";
    // Just its line: folded into the first member's strip. With rolls or an
    // outcome of its own, it stays — the panel's first entry.
    if (item && item.rows.length <= 1 && what) {
      folded.add(opener);
      heads.set(members[0], what);
    } else role.set(opener, "part");
    members.forEach((id, k) => role.set(id, k === members.length - 1 ? "last" : "part"));
  }
  return items.flatMap((item) => {
    if (folded.has(item.id)) return [];
    const g = role.get(item.id);
    let out = g ? { ...item, group: g } : item;
    const head = heads.get(item.id);
    if (head && out.rows[0]) {
      const pill = { name: head, value: "Party", kind: "multiattack" };
      out = { ...out, rows: [{ ...out.rows[0], pills: [pill, ...out.rows[0].pills] }, ...out.rows.slice(1)] };
    }
    return [out];
  });
}
