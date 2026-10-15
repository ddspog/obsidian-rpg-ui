/**
 * The Log's move pills with what the rules make of them: the feet walked this
 * round of what the creature may (`MOVE → H6 · 15/30 ft`), and — in the
 * warning red, never blocking — a move past it, one a condition forbids, and
 * the opportunity attacks it provoked.
 */

import type { SidebarItem, SidebarPill } from "lib/domains/session-log/prose-model";
import type { MoveCheck } from "./movement-rules";

/** A name as shown: links read as their text. */
const shown = (name: string) =>
  name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();

/** The warnings a move earns, as pills. */
export function moveWarnings(check: MoveCheck): SidebarPill[] {
  const out: SidebarPill[] = [];
  if (check.held) out.push({ name: "speed 0", value: check.held, kind: "warn" });
  else if (check.allowance != null && check.spent > check.allowance)
    out.push({ name: check.granted ? "over its limit" : "over speed", kind: "warn" });
  // A plain move off its own round — nothing granted it.
  if (check.offTurn) out.push({ name: "outside its round", kind: "warn" });
  if (check.provokes.length > 0)
    out.push({ name: "provokes", value: check.provokes.map(shown).join(", "), kind: "warn" });
  return out;
}

/** Each entry's move pills, in order, with its moves' checks. */
export function withMoveChecks(items: SidebarItem[], checks: Map<number, MoveCheck[]>): SidebarItem[] {
  return items.map((item) => {
    const list = checks.get(item.id);
    if (!list || list.length === 0) return item;
    let n = 0;
    const rows = item.rows.map((row) => {
      if (!row.pills.some((p) => p.kind === "move")) return row;
      const pills = row.pills.flatMap((p) => {
        if (p.kind !== "move") return [p];
        const check = list[n++];
        if (!check) return [p];
        const feet =
          (check.allowance != null ? `${check.spent}/${check.allowance} ft` : `${check.feet} ft`) +
          (check.granted ? ` · ${check.granted}` : "");
        return [{ ...p, value: `${p.value ?? ""} · ${feet}`.trim() }, ...moveWarnings(check)];
      });
      return { ...row, pills };
    });
    return { ...item, rows };
  });
}
