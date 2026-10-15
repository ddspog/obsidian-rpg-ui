/**
 * Who bears which condition at the end of the log — the party's (`[PC:Talon|+prone]`)
 * and the foes' (`[F:Fat [[Kobold, A]]|+pinned]`) alike, given with `+` and
 * lifted with `-`. What a status card is drawn from.
 *
 * A condition can name what left it — `+pinned([[Icicle Javelin º]])` — so its
 * card reads the rules for shaking it off from that source.
 */

import type { PersistentTag } from "lib/domains/lonelog/types";
import { combatantKey, segmentTags } from "./initiative";
import type { ProseSegment } from "./prose-grouper";

/** One `+pinned([[Icicle Javelin º]])` / `-pinned`: given or lifted, and what gave it. */
export interface ConditionChange {
  add: boolean;
  condition: string;
  /** What left it (`Icicle Javelin º`), when the tag says. */
  from?: string;
}

/** Reads `+condition`, `-condition` and `+condition([[Source]])` — not `HP-5`, which is HP. */
export function conditionChange(raw: string): ConditionChange | null {
  const m = raw
    .trim()
    .match(/^([+-])\s*([A-Za-z][\w -]*?)\s*(?:\(\s*(?:\[\[)?([^\]()|]+?)(?:\|[^\]]*)?(?:\]\])?\s*\))?$/);
  if (!m || /^HP\b/i.test(m[2])) return null;
  return { add: m[1] === "+", condition: m[2].trim().toLowerCase(), ...(m[3] ? { from: m[3].trim() } : {}) };
}

/** The condition changes in a party or foe tag. */
function changes(tag: PersistentTag): Array<ConditionChange & { name: string }> {
  if (tag.kind !== "pc" && tag.kind !== "foe") return [];
  const list = tag.kind === "pc" ? tag.changes : tag.tags;
  return list.flatMap((c) => {
    const ch = conditionChange(c);
    return ch ? [{ ...ch, name: tag.name }] : [];
  });
}

/**
 * Everyone's conditions as the log leaves them, by combatant key — each with
 * what left it. One whose source says it lasts `until the end of its next
 * turn` (Luminous Bolt's blinded) — `endsWhen(condition, from)` — ends with
 * itself: it's lifted once its bearer's next round is over, though the log
 * never wrote `-blinded`.
 */
export function conditionsNow(
  segments: ProseSegment[],
  endsWhen: (condition: string, from: string | undefined) => "end-of-next-turn" | undefined = () => undefined
): Map<string, Map<string, string | undefined>> {
  const out = new Map<string, Map<string, string | undefined>>();
  // Conditions whose bearer's next round has begun — they end with it.
  const ending = new Map<string, Set<string>>();
  let roundOf: string | undefined;
  for (const seg of segments) {
    if (seg.type === "turn" || seg.type === "round" || seg.type === "combat-end") {
      // The round that just ended takes its bearer's ending conditions with it.
      if (roundOf) {
        for (const c of ending.get(roundOf) ?? []) out.get(roundOf)?.delete(c);
        ending.delete(roundOf);
      }
      roundOf = seg.type === "turn" ? combatantKey(seg.actor) : undefined;
      // Its bearer's next round has begun: what lasts until its end now ends with it.
      if (roundOf) {
        const now = out.get(roundOf);
        const lasting = [...(now ?? [])]
          .filter(([c, from]) => endsWhen(c, from) === "end-of-next-turn")
          .map(([c]) => c);
        if (lasting.length > 0) ending.set(roundOf, new Set(lasting));
      }
    }
    const tags = [
      ...(seg.type === "oracle" ? (seg.question.foes ?? []) : []),
      ...(seg.type === "action-group" ? (seg.action.tags ?? []) : []),
      ...segmentTags(seg),
    ];
    for (const tag of tags) {
      for (const ch of changes(tag)) {
        const key = combatantKey(ch.name);
        const now = out.get(key) ?? new Map<string, string | undefined>();
        if (ch.add) now.set(ch.condition, ch.from ?? now.get(ch.condition));
        else {
          now.delete(ch.condition);
          ending.get(key)?.delete(ch.condition);
        }
        out.set(key, now);
      }
    }
  }
  return out;
}

/**
 * What the session spent of each character's resources — spell slots
 * (`[Kowyn/1st-Circle Slot-1]`), uses (`[Talon/Mystic Mark-1]`) — the net of
 * every `+n` / `-n` in the log, by character and resource. A `=n` sets it
 * outright, so it's left to the sheet.
 */
export function resourcesSpent(segments: ProseSegment[]): Array<{ who: string; resource: string; change: number }> {
  const net = new Map<string, { who: string; resource: string; change: number }>();
  for (const seg of segments) {
    const tags = [...(seg.type === "action-group" ? (seg.action.tags ?? []) : []), ...segmentTags(seg)];
    for (const tag of tags) {
      if (tag.kind !== "dial-op" || !tag.pc || !tag.name || tag.amount == null) continue;
      if (tag.op !== "inc" && tag.op !== "dec") continue;
      const key = `${combatantKey(tag.pc)}\u0000${tag.name.toLowerCase()}`;
      const entry = net.get(key) ?? { who: tag.pc, resource: tag.name, change: 0 };
      entry.change += tag.op === "inc" ? tag.amount : -tag.amount;
      net.set(key, entry);
    }
  }
  return [...net.values()].filter((e) => e.change !== 0);
}
