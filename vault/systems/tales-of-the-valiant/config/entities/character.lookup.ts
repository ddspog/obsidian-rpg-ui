/**
 * Tales of the Valiant Experience Point Table
 *
 * XP thresholds for each character level. Index 0 = XP required to reach level 1,
 * index 1 = level 2, and so on through level 20.
 *
 * Tales of the Valiant uses the same XP progression as D&D 5e.
 * Source: Tales of the Valiant Player's Guide (Kobold Press)
 */

export const xpTable: number[] = [
  0,      // Level 1
  300,    // Level 2
  900,    // Level 3
  2700,   // Level 4
  6500,   // Level 5
  14000,  // Level 6
  23000,  // Level 7
  34000,  // Level 8
  48000,  // Level 9
  64000,  // Level 10
  85000,  // Level 11
  100000, // Level 12
  120000, // Level 13
  140000, // Level 14
  165000, // Level 15
  195000, // Level 16
  225000, // Level 17
  265000, // Level 18
  305000, // Level 19
  355000, // Level 20
];

/**
 * Spell-slot progressions (Tales of the Valiant / D&D 5e standard).
 *
 * Each row is a caster's slots at class level 1-20 for each circle
 * (index 0 = circle 1, index 1 = circle 2, …). Zero entries mean no
 * slots at that circle yet. The `full` table mirrors the Cleric /
 * Druid / Wizard / Bard progression; `half` is Paladin / Ranger
 * (starts at level 2); `third` is the Eldritch-Knight / Arcane-Trickster
 * subclass table (starts at level 3).
 *
 * Indexed by class level (1-based). `slotsForCaster("full", 5)` →
 * `[4, 3, 2, 0, 0, 0, 0, 0, 0]`.
 */
const FULL_SLOTS: number[][] = [
  /*  1 */ [2, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  2 */ [3, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  3 */ [4, 2, 0, 0, 0, 0, 0, 0, 0],
  /*  4 */ [4, 3, 0, 0, 0, 0, 0, 0, 0],
  /*  5 */ [4, 3, 2, 0, 0, 0, 0, 0, 0],
  /*  6 */ [4, 3, 3, 0, 0, 0, 0, 0, 0],
  /*  7 */ [4, 3, 3, 1, 0, 0, 0, 0, 0],
  /*  8 */ [4, 3, 3, 2, 0, 0, 0, 0, 0],
  /*  9 */ [4, 3, 3, 3, 1, 0, 0, 0, 0],
  /* 10 */ [4, 3, 3, 3, 2, 0, 0, 0, 0],
  /* 11 */ [4, 3, 3, 3, 2, 1, 0, 0, 0],
  /* 12 */ [4, 3, 3, 3, 2, 1, 0, 0, 0],
  /* 13 */ [4, 3, 3, 3, 2, 1, 1, 0, 0],
  /* 14 */ [4, 3, 3, 3, 2, 1, 1, 0, 0],
  /* 15 */ [4, 3, 3, 3, 2, 1, 1, 1, 0],
  /* 16 */ [4, 3, 3, 3, 2, 1, 1, 1, 0],
  /* 17 */ [4, 3, 3, 3, 2, 1, 1, 1, 1],
  /* 18 */ [4, 3, 3, 3, 3, 1, 1, 1, 1],
  /* 19 */ [4, 3, 3, 3, 3, 2, 1, 1, 1],
  /* 20 */ [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const HALF_SLOTS: number[][] = [
  /*  1 */ [0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  2 */ [2, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  3 */ [3, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  4 */ [3, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  5 */ [4, 2, 0, 0, 0, 0, 0, 0, 0],
  /*  6 */ [4, 2, 0, 0, 0, 0, 0, 0, 0],
  /*  7 */ [4, 3, 0, 0, 0, 0, 0, 0, 0],
  /*  8 */ [4, 3, 0, 0, 0, 0, 0, 0, 0],
  /*  9 */ [4, 3, 2, 0, 0, 0, 0, 0, 0],
  /* 10 */ [4, 3, 2, 0, 0, 0, 0, 0, 0],
  /* 11 */ [4, 3, 3, 0, 0, 0, 0, 0, 0],
  /* 12 */ [4, 3, 3, 0, 0, 0, 0, 0, 0],
  /* 13 */ [4, 3, 3, 1, 0, 0, 0, 0, 0],
  /* 14 */ [4, 3, 3, 1, 0, 0, 0, 0, 0],
  /* 15 */ [4, 3, 3, 2, 0, 0, 0, 0, 0],
  /* 16 */ [4, 3, 3, 2, 0, 0, 0, 0, 0],
  /* 17 */ [4, 3, 3, 3, 1, 0, 0, 0, 0],
  /* 18 */ [4, 3, 3, 3, 1, 0, 0, 0, 0],
  /* 19 */ [4, 3, 3, 3, 2, 0, 0, 0, 0],
  /* 20 */ [4, 3, 3, 3, 2, 0, 0, 0, 0],
];

const THIRD_SLOTS: number[][] = [
  /*  1 */ [0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  2 */ [0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  3 */ [2, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  4 */ [3, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  5 */ [3, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  6 */ [3, 0, 0, 0, 0, 0, 0, 0, 0],
  /*  7 */ [4, 2, 0, 0, 0, 0, 0, 0, 0],
  /*  8 */ [4, 2, 0, 0, 0, 0, 0, 0, 0],
  /*  9 */ [4, 2, 0, 0, 0, 0, 0, 0, 0],
  /* 10 */ [4, 3, 0, 0, 0, 0, 0, 0, 0],
  /* 11 */ [4, 3, 0, 0, 0, 0, 0, 0, 0],
  /* 12 */ [4, 3, 0, 0, 0, 0, 0, 0, 0],
  /* 13 */ [4, 3, 2, 0, 0, 0, 0, 0, 0],
  /* 14 */ [4, 3, 2, 0, 0, 0, 0, 0, 0],
  /* 15 */ [4, 3, 2, 0, 0, 0, 0, 0, 0],
  /* 16 */ [4, 3, 3, 0, 0, 0, 0, 0, 0],
  /* 17 */ [4, 3, 3, 0, 0, 0, 0, 0, 0],
  /* 18 */ [4, 3, 3, 0, 0, 0, 0, 0, 0],
  /* 19 */ [4, 3, 3, 1, 0, 0, 0, 0, 0],
  /* 20 */ [4, 3, 3, 1, 0, 0, 0, 0, 0],
];

export function slotsForCaster(
  tier: "full" | "half" | "third",
  classLevel: number,
): number[] {
  const table = tier === "full" ? FULL_SLOTS : tier === "half" ? HALF_SLOTS : THIRD_SLOTS;
  const clamped = Math.max(1, Math.min(20, Math.floor(classLevel)));
  return table[clamped - 1].slice();
}
