/**
 * A fight's XP as the Log tells it. The log writes each party member's share
 * as a tag on the line that says how the fight ended —
 *
 *   [/COMBAT]
 *   => The leader yielded. [Talon/XP+87] [Kowyn/XP+87] [Jacqui/XP+87] [Lilith/XP+87]
 *
 * — and the Log draws them as one: `XP 350 — 87 each · Talon, Kowyn, Jacqui, Lilith`
 * (the total, what the fight was worth; each share, its even part).
 */

import type { ProseSegment } from "./prose-grouper";
import type { SidebarItem, SidebarPill } from "./prose-model";
import { segmentTags } from "./initiative";

/** The XP shares an entry's tags give: who, and how much. */
export function xpShares(seg: ProseSegment): Array<{ who: string; xp: number }> {
  return segmentTags(seg).flatMap((t) =>
    t.kind === "dial-op" && t.pc && t.name && /^xp$/i.test(t.name.trim()) && t.op === "inc" && t.amount != null
      ? [{ who: t.pc, xp: t.amount }]
      : []
  );
}

/**
 * The Log's entries with each XP award drawn as one pill — `totalFor(id)`
 * gives what the fight that entry ends was worth, when known.
 */
export function withXpAward(
  items: SidebarItem[],
  segments: ProseSegment[],
  totalFor: (id: number) => number | undefined
): SidebarItem[] {
  return items.map((item) => {
    const seg = segments.find((s) => s.sourceIndex === item.id);
    const shares = seg ? xpShares(seg) : [];
    if (shares.length === 0) return item;
    const each = shares.every((s) => s.xp === shares[0].xp) ? shares[0].xp : undefined;
    const total = totalFor(item.id) ?? shares.reduce((n, s) => n + s.xp, 0);
    const award: SidebarPill = {
      name: "XP",
      value: `${total}${each != null ? ` — ${each} each` : ""} · ${shares.map((s) => (each != null ? s.who : `${s.who} ${s.xp}`)).join(", ")}`,
      kind: "dial",
    };
    // Its tags' own XP pills give way to the one.
    let placed = false;
    const rows = item.rows.map((row) => {
      if (!row.pills.some((p) => p.kind === "dial" && /^xp$/i.test(p.name))) return row;
      const pills = row.pills.filter((p) => !(p.kind === "dial" && /^xp$/i.test(p.name)));
      if (!placed) {
        placed = true;
        pills.unshift(award);
      }
      return { ...row, pills };
    });
    return { ...item, rows };
  });
}
