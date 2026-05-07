/**
 * YAML surface for the `rpg character.spells` block.
 *
 * The block is multiclass-aware: one `casters:` entry per class that
 * declared a Spellcasting feature (detected by the resolver from the
 * feature's `spellcasting:` config fragment). Picks and spent slots
 * live under each caster so independent classes don't collide on keys
 * like "cantrips" or "prepared".
 *
 * Additions at the block level stay flat — `additional.spells` joins
 * every caster's known pool (homebrew-of-the-table spells that apply
 * regardless of which source owns the caster).
 */
export type SpellCircle = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SpellRef = string;

export interface CasterState {
  /** Cantrip picks. Renderer merges with `granted.cantrips` for display. */
  cantrips?: SpellRef[];
  /**
   * Known spells for the given caster — keyed by circle (1-9). Used by
   * `known`-type casters (Ranger). `prepared`-type casters derive
   * their "known" list from the pool + grants instead, so this field
   * is ignored for them.
   */
  known?: Partial<Record<number, SpellRef[]>>;
  /** Spells prepared today, keyed by circle. Merged with `granted.prepared`
   *  for the final "active" list. */
  prepared?: Partial<Record<number, SpellRef[]>>;
  /** Ritual picks keyed by circle. Always-castable without a slot. */
  rituals?: Partial<Record<number, SpellRef[]>>;
  /** Slots consumed this rest, keyed by circle. Tally against the
   *  resolved `slots[circle]` max to render usage pips. */
  spent?: Partial<Record<number, number>>;
}

export type SpellsProps = {
  /** Per-caster YAML state, keyed by source name (e.g. `Cleric`,
   *  `Wizard`). */
  casters?: Record<string, CasterState>;
  /** Homebrew / table-level spell appendices that flow into every
   *  caster's known pool. */
  additional?: {
    spells?: SpellRef[];
  };
  /** Magic styles this character is attuned to — applied to every
   *  caster's flavor picker on top of any `style:` declared on the
   *  class's own `spellcasting:` config. Accepts the same shapes as
   *  the class-side field (bare strings, wikilinks, nested flow
   *  arrays) — the spells block normalises them. */
  style?: string[];
};
