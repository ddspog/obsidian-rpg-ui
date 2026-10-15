/**
 * Foes through a session log — who is in play and how hurt they are.
 *
 *   ? Combat begins. [F:[[Kobold, Elite]]|HP 26] [F:Fat [[Kobold, A]]|HP 9]
 *   @(Talon) I shoot the elite
 *   => Through the shoulder. [F:[[Kobold, Elite]]|HP-7]
 *   @(Kobold, Elite) It slashes back      ← reappears: HP 19/26
 *   => It falls. [F:[[Kobold, Elite]]|dead]
 *
 * A foe's first `HP n` is its maximum; later `HP n` sets the current value and
 * `HP±n` moves it. Each segment gets the foes it mentions — in a tag, or as the
 * actor of its action — with their health as of the end of that segment.
 */

import type { FoeTag, PersistentTag } from "lib/domains/lonelog/types";
import { matchActor } from "./actors";
import { conditionChange } from "./conditions";
import { combatantKey } from "./initiative";
import type { ProseSegment } from "./prose-grouper";

export interface FoeAt {
  /** As first written (`Fat [[Kobold, A]]`), for display and its link. */
  name: string;
  current?: number;
  max?: number;
  state?: string;
  /** Conditions it has now — given with `+surprised`, lifted with `-surprised`
   *  on its tag, the lonelog way. */
  conditions?: string[];
}

const isFoe = (t: PersistentTag): t is FoeTag => t.kind === "foe";

/** Every foe tag a segment carries, in line order. */
/** The foe tags a segment carries (`[F:Kobold, A|HP-5]`), wherever it wrote them. */
export function segmentFoes(seg: ProseSegment): FoeTag[] {
  switch (seg.type) {
    case "oracle":
      return [...(seg.question.foes ?? []), ...seg.consequences.flatMap((c) => c.tags.filter(isFoe))];
    case "action-group":
      return seg.consequences.flatMap((c) => c.tags.filter(isFoe));
    case "world-event":
      return [...seg.entry.tags, ...seg.consequences.flatMap((c) => c.tags)].filter(isFoe);
    case "standalone-consequence":
      return seg.entry.tags.filter(isFoe);
    default:
      return [];
  }
}

/** Fold foe tags in log order; each segment maps to the foes it mentions. */
export function foldFoes(segments: ProseSegment[]): Map<number, FoeAt[]> {
  const known = new Map<string, FoeAt>();
  const out = new Map<number, FoeAt[]>();

  for (const seg of segments) {
    const mentioned: string[] = [];
    const mention = (key: string) => {
      if (!mentioned.includes(key)) mentioned.push(key);
    };

    // A foe acting (`@(Kobold, Elite) …`) reappears even without a tag.
    if (seg.type === "action-group" && seg.action.actor && known.size > 0) {
      const keys = Array.from(known.keys());
      const i = matchActor(
        seg.action.actor,
        keys.map((name) => ({ name }))
      );
      if (i >= 0) mention(keys[i]);
    }

    for (const tag of segmentFoes(seg)) {
      const key = combatantKey(tag.name);
      if (!key) continue;
      let foe = known.get(key);
      if (!foe) {
        foe = { name: tag.name };
        known.set(key, foe);
      }
      if (tag.hp?.max != null) foe.max = tag.hp.max;
      if (tag.hp?.set != null) {
        foe.current = tag.hp.set;
        if (foe.max == null) foe.max = tag.hp.set;
      }
      if (tag.hp?.delta != null) {
        foe.current = Math.max(0, (foe.current ?? foe.max ?? 0) + tag.hp.delta);
      }
      if (tag.state) foe.state = tag.state;
      // `+condition` gives it, `-condition` lifts it (`HP-5` is HP, not a condition).
      for (const t of tag.tags) {
        const ch = conditionChange(t);
        if (!ch) continue;
        const now = new Set(foe.conditions ?? []);
        if (ch.add) now.add(ch.condition);
        else now.delete(ch.condition);
        foe.conditions = [...now];
      }
      mention(key);
    }

    if (mentioned.length > 0) {
      out.set(
        seg.sourceIndex,
        mentioned.map((k) => {
          const f = known.get(k)!;
          return { ...f, ...(f.conditions ? { conditions: [...f.conditions] } : {}) };
        })
      );
    }
  }
  return out;
}

/** End states that take a foe out of the fight. */
const DOWN_STATES = new Set(["dead", "fled", "defeated", "unconscious", "down", "surrendered"]);

/** Whether a foe is out of the fight: an end state, or no HP left. */
export function isDown(foe: FoeAt): boolean {
  return (foe.state != null && DOWN_STATES.has(foe.state)) || foe.current === 0;
}

/**
 * The foes still in play at the end of the log, in the order they entered —
 * every foe a tag has named, less the ones marked down or at 0 HP.
 */
export function foesInPlay(segments: ProseSegment[]): FoeAt[] {
  const last = new Map<string, FoeAt>();
  for (const foes of foldFoes(segments).values()) {
    for (const f of foes) last.set(combatantKey(f.name), f);
  }
  return Array.from(last.values()).filter((f) => !isDown(f));
}
