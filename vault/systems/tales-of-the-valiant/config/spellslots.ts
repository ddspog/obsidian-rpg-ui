/**
 * Tales of the Valiant Full Caster Spell Slot Table
 *
 * Standard spell slot progression for full spellcasting classes. Each entry contains
 * the caster level and an array of spell slots available per spell circle
 * (index 0 = 1st-level slots, index 1 = 2nd-level, etc.).
 *
 * Tales of the Valiant uses the same spell slot progression as D&D 5e.
 * Source: Tales of the Valiant Player's Guide (Kobold Press)
 */

// @ts-ignore — resolved at runtime by the plugin's esbuild-wasm bundler
import type { SpellSlotDistribution } from "rpg-ui-toolkit";

const table: SpellSlotDistribution[] = [
  { level: 1,  slots: [2, 0, 0, 0, 0, 0, 0, 0, 0] },
  { level: 2,  slots: [3, 0, 0, 0, 0, 0, 0, 0, 0] },
  { level: 3,  slots: [4, 2, 0, 0, 0, 0, 0, 0, 0] },
  { level: 4,  slots: [4, 3, 0, 0, 0, 0, 0, 0, 0] },
  { level: 5,  slots: [4, 3, 2, 0, 0, 0, 0, 0, 0] },
  { level: 6,  slots: [4, 3, 3, 0, 0, 0, 0, 0, 0] },
  { level: 7,  slots: [4, 3, 3, 1, 0, 0, 0, 0, 0] },
  { level: 8,  slots: [4, 3, 3, 2, 0, 0, 0, 0, 0] },
  { level: 9,  slots: [4, 3, 3, 3, 1, 0, 0, 0, 0] },
  { level: 10, slots: [4, 3, 3, 3, 2, 0, 0, 0, 0] },
  { level: 11, slots: [4, 3, 3, 3, 2, 1, 0, 0, 0] },
  { level: 12, slots: [4, 3, 3, 3, 2, 1, 0, 0, 0] },
  { level: 13, slots: [4, 3, 3, 3, 2, 1, 1, 0, 0] },
  { level: 14, slots: [4, 3, 3, 3, 2, 1, 1, 0, 0] },
  { level: 15, slots: [4, 3, 3, 3, 2, 1, 1, 1, 0] },
  { level: 16, slots: [4, 3, 3, 3, 2, 1, 1, 1, 0] },
  { level: 17, slots: [4, 3, 3, 3, 2, 1, 1, 1, 1] },
  { level: 18, slots: [4, 3, 3, 3, 3, 1, 1, 1, 1] },
  { level: 19, slots: [4, 3, 3, 3, 3, 2, 1, 1, 1] },
  { level: 20, slots: [4, 3, 3, 3, 3, 2, 1, 1, 1] },
];

export default table;
