/**
 * Types for the Attacks block.
 *
 * The block aggregates attacks from four sources at render time:
 *   1. Equipped weapons from the sibling `rpg character.inventory`
 *      block, auto-derived via `deriveWeaponAttacks()` (handles
 *      Versatile / Thrown / Two-Handed property fan-out).
 *   2. Spells whose `rpg spell` body declares an `attack:` aspect.
 *   3. Features (class / heritage / item-granted) with an `attack:`
 *      aspect on their `rpg feature.details` block.
 *   4. Manual entries authored directly on this block's `attacks:`
 *      YAML for homebrew / one-off attacks.
 */

/** Legacy manual-entry shape — still accepted on `self.attacks`. */
export type AttackEntry = {
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

export type AttacksProps = {
  /** Manual attack entries — rendered alongside derived rows. */
  attacks?: AttackEntry[];
  /** Open-ended passthrough so the block satisfies the entity-block
   *  `Record<string, unknown>` constraint. */
  [key: string]: unknown;
};

