/**
 * Combat order through a session log.
 *
 *   [COMBAT]
 *   [Init: Talon 17; [[Kobold, Elite]] 12; Lilith d20+1=9]
 *   R1
 *   @(Talon) …            ← 1st
 *   @(Kobold, Elite) …    ← 2nd
 *   [Init:+ Kobold Archer 14]
 *   [Init:- [[Kobold, Elite]]]
 *   [/COMBAT]
 *
 * Folds the `[Init:…]` tags into the order in effect at each segment, and
 * notes any action taken OUT OF TURN — an actor who acts before someone
 * ahead of them in the order, within one round.
 */

import type { InitiativeEntry, InitiativeTag, PersistentTag } from "lib/domains/lonelog/types";
import { matchActor } from "./actors";
import type { ProseSegment } from "./prose-grouper";

/**
 * A combatant's name as read, for matching: links shown as their text
 * (`[[Kobold, Elite]]` → `kobold, elite`), the rest kept, so `Fat [[Kobold, A]]`
 * and `Think [[Kobold, A]]` stay two combatants.
 */
export function combatantKey(name: string): string {
  return name
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => alias ?? target)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Highest first; ties, and names without a value (last), keep written order. */
export function sortOrder(entries: InitiativeEntry[]): InitiativeEntry[] {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const av = a.e.value;
      const bv = b.e.value;
      if (av == null && bv == null) return a.i - b.i;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av || a.i - b.i;
    })
    .map(({ e }) => e);
}

/** Apply one `[Init:…]` tag to an order. */
export function applyInitiative(order: InitiativeEntry[], tag: InitiativeTag): InitiativeEntry[] {
  if (tag.op === "set") return sortOrder(tag.entries);
  const keys = new Set(tag.entries.map((e) => combatantKey(e.name)));
  const rest = order.filter((e) => !keys.has(combatantKey(e.name)));
  return tag.op === "remove" ? rest : sortOrder([...rest, ...tag.entries]);
}

export interface InitiativeAt {
  /** The order in effect after this segment's own `[Init:…]` tags. */
  order: InitiativeEntry[];
  /** The round this segment falls in (0 before any `R#`). */
  round: number;
  /** This segment's actor acted before someone ahead of them this round. */
  outOfTurn?: boolean;
  /** This segment changed the order (holds an `[Init:…]` tag). */
  changed?: boolean;
}

const isInit = (t: PersistentTag): t is InitiativeTag => t.kind === "initiative";

/** The tags a segment carries, wherever in it they were written. */
export function segmentTags(seg: ProseSegment): PersistentTag[] {
  switch (seg.type) {
    case "action-group":
      return seg.consequences.flatMap((c) => c.tags);
    case "oracle":
      return seg.consequences.flatMap((c) => c.tags);
    case "world-event":
      return [...seg.entry.tags, ...seg.consequences.flatMap((c) => c.tags)];
    case "standalone-consequence":
      return seg.entry.tags;
    default:
      return [];
  }
}

/**
 * Walk the segments, tracking the order and the round. The order is usually
 * registered BEFORE the fight (`[Init: …]` then `[COMBAT]`) and carries into
 * it. An action counts toward turn order only inside a combat (from `[COMBAT]`
 * or the first `R#`, until `[/COMBAT]`, which also clears the order), with an
 * order to check against, and by a single named actor who is in it. Each `R#`
 * starts the turn count over.
 *
 * Once a creature's round is marked (`R(Talon)`), the markers are the order:
 * what's done inside a round — the owner's actions, someone else's reaction
 * (Lilith's opportunity attack in the Elite's round) — takes no turn.
 */
export function foldInitiative(segments: ProseSegment[]): Map<number, InitiativeAt> {
  const out = new Map<number, InitiativeAt>();
  let order: InitiativeEntry[] = [];
  let round = 0;
  let inCombat = false;
  let lastTurn = -1;
  // A round marker opened a creature's round this turn: actions inside it take no turn.
  let marked = false;

  for (const seg of segments) {
    if (seg.type === "combat-start") {
      inCombat = true;
      lastTurn = -1;
    } else if (seg.type === "combat-end") {
      inCombat = false;
      order = [];
      round = 0;
    } else if (seg.type === "round") {
      // A round is combat, whether or not a `[COMBAT]` opened it.
      inCombat = true;
      round = seg.round;
      lastTurn = -1;
      marked = false;
    }
    if (seg.type === "turn") marked = true;

    let outOfTurn = false;
    // A turn is taken by its marker (`T(Talon)`) as by an action.
    const turnTaker =
      seg.type === "action-group" && !marked ? seg.action.actor : seg.type === "turn" ? seg.actor : undefined;
    if (turnTaker && inCombat && order.length > 0) {
      const actor = turnTaker;
      if (actor && !actor.includes("+")) {
        const turn = matchActor(
          actor,
          order.map((e) => ({ name: combatantKey(e.name) }))
        );
        if (turn >= 0) {
          if (turn < lastTurn) outOfTurn = true;
          lastTurn = Math.max(lastTurn, turn);
        }
      }
    }

    const inits = segmentTags(seg).filter(isInit);
    // Registering the order does not start the fight: an `[Init:]` written
    // before `[COMBAT]` sets who goes when, and the turns count from there.
    for (const tag of inits) order = applyInitiative(order, tag);

    out.set(seg.sourceIndex, {
      order,
      round,
      ...(outOfTurn ? { outOfTurn } : {}),
      ...(inits.length > 0 ? { changed: true } : {}),
    });
  }
  return out;
}
