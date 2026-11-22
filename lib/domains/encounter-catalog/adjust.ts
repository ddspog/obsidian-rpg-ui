/**
 * Adjusting an encounter to the party: the changes `catalog adjust` tries on an
 * entry that is too easy or too hard (fewer or more of a group, a group swapped
 * for an equivalent of the same role, a few minions or a leader added, a group
 * taken away), and how the ones that fit are ranked. The simulator judges each;
 * this file only proposes and ranks. Terrain and tactics cannot be simulated,
 * so they come as suggestions in words. Pure: no Obsidian and no I/O.
 */

import type { CatalogMonster } from "./catalog";

export type AdjustDirection = "easier" | "harder";

export type AdjustKind = "count" | "swap" | "add" | "remove";

export interface AdjustCandidate {
  kind: AdjustKind;
  /** What changes, in words ("3 Wolf instead of 5"). */
  label: string;
  monsters: CatalogMonster[];
}

/** A monster another may stand in for, or join as a minion or a leader. */
export interface Stand {
  note: string;
  name: string;
}

export interface ProposeOptions {
  /** The display name of a group's note. */
  nameOf: (note: string) => string;
  /** The equivalents of a note (same role and subrole first), closest first. */
  equivalents: (note: string) => Stand[];
  /** Rank-and-file soldiers that may join (too easy). */
  minions: Stand[];
  /** Leaders that may join (too easy). */
  leaders: Stand[];
  /** The most of one kind in a fight. */
  maxCount: number;
  /** Equivalents tried for each group. */
  swaps?: number;
}

function plural(n: number, name: string): string {
  return `${n} ${name}`;
}

/** The changes worth simulating for an entry that should become easier or harder. */
export function proposeAdjustments(
  monsters: CatalogMonster[],
  direction: AdjustDirection,
  options: ProposeOptions
): AdjustCandidate[] {
  const out: AdjustCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: AdjustCandidate) => {
    const key = c.monsters
      .map((m) => `${m.note}:${m.count}`)
      .sort()
      .join("|");
    if (seen.has(key) || c.monsters.length === 0 || c.monsters.some((m) => m.count < 1)) return;
    seen.add(key);
    out.push(c);
  };
  const without = (i: number) => monsters.filter((_, j) => j !== i);
  const withGroup = (i: number, g: CatalogMonster) => monsters.map((m, j) => (j === i ? g : m));

  // Fewer or more of one group: a dice count becomes a fixed one.
  monsters.forEach((m, i) => {
    const steps = direction === "easier" ? [-1, -2, -3, -4] : [1, 2, 3, 4, 6];
    for (const step of steps) {
      const count = m.count + step;
      if (count < 1 || count > options.maxCount) continue;
      const name = options.nameOf(m.note);
      push({
        kind: "count",
        label: `${plural(count, name)} instead of ${m.count}`,
        monsters: withGroup(i, { note: m.note, count }),
      });
    }
  });

  // A group swapped for an equivalent, at its count, one fewer, or one or two more (a weaker kin in numbers).
  monsters.forEach((m, i) => {
    for (const eq of options.equivalents(m.note).slice(0, options.swaps ?? 4)) {
      if (monsters.some((o) => o.note === eq.note)) continue;
      for (const count of [m.count, m.count - 1, m.count + 1, m.count + 2]) {
        if (count < 1 || count > options.maxCount) continue;
        push({
          kind: "swap",
          label: `${plural(count, eq.name)} instead of ${plural(m.count, options.nameOf(m.note))}`,
          monsters: withGroup(i, { note: eq.note, count }),
        });
      }
    }
  });

  if (direction === "harder") {
    for (const minion of options.minions.slice(0, 3)) {
      if (monsters.some((o) => o.note === minion.note)) continue;
      for (const count of [2, 3, 4, 6]) {
        push({
          kind: "add",
          label: `with ${plural(count, minion.name)} (rank and file)`,
          monsters: [...monsters, { note: minion.note, count }],
        });
      }
    }
    for (const leader of options.leaders.slice(0, 3)) {
      if (monsters.some((o) => o.note === leader.note)) continue;
      const article = /^[aeiou]/i.test(leader.name) ? "an" : "a";
      push({
        kind: "add",
        label: `led by ${article} ${leader.name}`,
        monsters: [...monsters, { note: leader.note, count: 1 }],
      });
    }
  } else if (monsters.length > 1) {
    monsters.forEach((m, i) =>
      push({ kind: "remove", label: `without the ${options.nameOf(m.note)}`, monsters: without(i) })
    );
  }
  return out;
}

/** How much an adjustment changes the encounter: a count least, then a swap, then a new or lost group. */
const KIND_WEIGHT: Record<AdjustKind, number> = { count: 0, swap: 0.15, remove: 0.08, add: 0.12 };

/** The fitting adjustments, the closest to the aim first, the smallest change on a near tie. */
export function rankAdjustments<T extends { candidate: AdjustCandidate; distance: number; fits: boolean }>(
  tried: T[]
): T[] {
  return tried
    .filter((t) => t.fits)
    .sort(
      (a, b) =>
        a.distance + KIND_WEIGHT[a.candidate.kind] - (b.distance + KIND_WEIGHT[b.candidate.kind]) ||
        a.candidate.label.localeCompare(b.candidate.label)
    );
}

/**
 * What the table can do that the simulator does not: terrain and tactics that move a fight the
 * way it needs to go. Suggestions in words; none of them is simulated.
 */
export function tacticsFor(direction: AdjustDirection): string[] {
  return direction === "easier"
    ? [
        "Give the party a choke point or high ground, so the foes come a few at a time.",
        "Let the foes flee or bargain when half of them are down.",
        "Let the party see them first: no surprise round for the foes, and room to prepare.",
      ]
    : [
        "Let the foes ambush: they act first, from cover or out of sight.",
        "Give them terrain the party must cross under fire (water, a slope, difficult ground).",
        "Keep a leader or a caster at the back, behind the others, so the party must break through.",
      ];
}
