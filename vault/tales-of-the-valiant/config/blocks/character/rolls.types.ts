/**
 * Types for the Rolls block.
 *
 * The block aggregates rolls from four sources at render time:
 *   1. Equipped weapons from the sibling `rpg character.inventory`
 *      block, auto-derived via `deriveWeaponRolls()` (handles
 *      Versatile / Thrown / Two-Handed property fan-out).
 *   2. Spells whose `rpg spell` body declares a `roll:` aspect.
 *   3. Features (class / heritage / item-granted) with a `roll:`
 *      aspect on their `rpg feature.details` block.
 *   4. Manual entries authored directly on this block's `rolls:`
 *      YAML for homebrew / one-off rolls.
 */

/** Legacy manual-entry shape — still accepted on `self.rolls`. */
export type RollEntry = {
  name?: string;
  label?: string;
  /** Attack bonus — scalar number OR a pre-rendered string (`"+5 (STR)"`). */
  to_hit?: number | string;
  range?: string;
  damage?: {
    roll: string;
    type: string;
    bonus?: string;
  };
  property?: string[];
  options?: string[];
  notes?: string;
};

export type RollsProps = {
  /** Manual roll entries — rendered alongside derived rows. */
  rolls?: RollEntry[];
  /** Open-ended passthrough so the block satisfies the entity-block
   *  `Record<string, unknown>` constraint. */
  [key: string]: unknown;
};
