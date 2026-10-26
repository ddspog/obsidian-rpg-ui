/**
 * The day's clock, as the log moves it: `[Time: +8h]` on (a rest, a stage on
 * the road), `[Time: Day 2, 08:00]` set — and a journey's arrival
 * (`[/TRAVEL: arrive Day 4, 18:00 | …]`) sets it too. It starts at the morning of Day 1
 * unless a tag says otherwise. What a long rest's once-a-day is read against.
 */

import { extractTags } from "lib/domains/lonelog/tag-extractor";
import { segmentTags } from "./initiative";
import type { ProseSegment } from "./prose-grouper";

/** A moment on the clock: the day, and hours into it (8.5 → 08:30). */
export interface ClockTime {
  day: number;
  hour: number;
}

/** Hours since Day 1's midnight — to measure between two moments. */
export const hoursOf = (t: ClockTime) => (t.day - 1) * 24 + t.hour;

/** `Day 2, 08:30`. */
export function clockText(t: ClockTime): string {
  const h = Math.floor(t.hour);
  const m = Math.round((t.hour - h) * 60);
  return `Day ${t.day}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The clock after each entry, and now. */
export function foldClock(
  segments: ProseSegment[],
  start: ClockTime = { day: 1, hour: 8 }
): { at: Map<number, ClockTime>; now: ClockTime } {
  let now = { ...start };
  const at = new Map<number, ClockTime>();
  for (const seg of segments) {
    // Its tags — those on an action's own line too (`@(Party) Long rest [Time: +8h]`).
    const tags = [...(seg.type === "action-group" ? (seg.action.tags ?? []) : []), ...segmentTags(seg)];
    // A journey's end sets the clock to when it arrived (`[/TRAVEL: arrive Day 4, 18:00 | …]`).
    if (seg.type === "travel-end" && seg.entry.end?.arrive)
      tags.push(...extractTags(`[Time: ${seg.entry.end.arrive}]`));
    for (const tag of tags) {
      if (tag.kind !== "time") continue;
      if (tag.advance != null) {
        const total = hoursOf(now) + tag.advance;
        now = { day: Math.floor(total / 24) + 1, hour: total % 24 };
      } else if (tag.set) {
        now = { day: tag.set.day ?? now.day, hour: tag.set.hour ?? now.hour };
      }
    }
    at.set(seg.sourceIndex, { ...now });
  }
  return { at, now };
}

/** Hours since the party's last long rest ended — undefined when it hasn't had one in this log. */
export function hoursSinceLongRest(segments: ProseSegment[]): number | undefined {
  const { at, now } = foldClock(segments);
  const rest = [...segments]
    .reverse()
    .find(
      (s) =>
        s.type === "action-group" && /^party$/i.test(s.action.actor ?? "") && /^long rest\b/i.test(s.action.text.trim())
    );
  const then = rest ? at.get(rest.sourceIndex) : undefined;
  return then ? hoursOf(now) - hoursOf(then) : undefined;
}
