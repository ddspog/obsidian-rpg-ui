/**
 * Where a fight stands, for the GM's Next Turn and Next Round cards. At this
 * table a TURN is a pass through the initiative order (`T2`) and each
 * creature's slot in it is their ROUND (`R(Talon)`) — the reverse of the rules'
 * words, which the code keeps inside (`round` counts passes, `turn` segments
 * are slots). The clock tells the pass the fight is in, and who acts next: the
 * order from whoever follows the last to act in it (by an action, or `R(Name)`).
 */

import { matchActor } from "./actors";
import { applyInitiative, combatantKey, segmentTags } from "./initiative";
import type { ProseSegment } from "./prose-grouper";
import type { InitiativeEntry, InitiativeTag, PersistentTag } from "lib/domains/lonelog/types";

export interface CombatClock {
  /** The pass (the table's turn) being played — 0 before the first `T1`. */
  round: number;
  /** The order from whoever is up next, round the table once — as the log
   *  writes their names (`Thin Kobold, A`). Empty with no `[Init:]`. */
  next: string[];
}

const isInit = (t: PersistentTag): t is InitiativeTag => t.kind === "initiative";

/** A name as an actor is written: links read as their text. */
const asWritten = (name: string) =>
  name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();

/**
 * The fight the log ends in, or null when it ends outside one. `isOut` drops
 * those no longer in it (a foe down or fled) from who's next.
 */
export function combatClock(
  segments: ProseSegment[],
  isOut: (name: string) => boolean = () => false
): CombatClock | null {
  let open = false;
  let round = 0;
  let order: InitiativeEntry[] = [];
  let last = -1;

  for (const seg of segments) {
    if (seg.type === "combat-start") {
      open = true;
      round = 0;
      last = -1;
    } else if (seg.type === "combat-end") {
      open = false;
      order = [];
    } else if (seg.type === "round") {
      round = seg.round;
      last = -1;
    }
    for (const tag of segmentTags(seg).filter(isInit)) order = applyInitiative(order, tag);

    const taker = seg.type === "action-group" ? seg.action.actor : seg.type === "turn" ? seg.actor : undefined;
    if (open && taker && !taker.includes("+") && order.length > 0) {
      const i = matchActor(
        taker,
        order.map((e) => ({ name: combatantKey(e.name) }))
      );
      if (i >= 0) last = Math.max(last, i);
    }
  }
  if (!open) return null;

  const names = order.map((e) => asWritten(e.name));
  const from = last + 1;
  const next = [...names.slice(from), ...names.slice(0, from)].filter((n) => !isOut(n));
  return { round, next };
}
