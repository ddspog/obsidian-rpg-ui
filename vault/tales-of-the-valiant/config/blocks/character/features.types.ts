/**
 * Minimal data shape for the character `features` code block.
 *
 * Class, level, subclass, lineage, heritage, and background all live in the
 * sibling `header` block — the features block reads them via `blocks.header`
 * and only carries `choices` so character data isn't duplicated.
 */
export type FeaturesBlockData = {
  /**
   * Picks keyed by source name (matching a class/lineage/heritage/background
   * file stem) → choice slot name (matching a `feature.details` block with
   * `pick: N`) → option name(s).
   */
  choices?: Record<string, Record<string, string | string[]>>;
  /**
   * Number of uses spent on each feature aspect that carries a `max`. Keys
   * are `${source}:${featureName}:${bucket}` so the same feature can track
   * separate counters on distinct aspects. Value is the count of filled
   * dots in the character-sheet accordion.
   */
  spent?: Record<string, number>;
  /**
   * Homebrew / one-off additions the trait + pick system can't capture
   * through the standard compendium sources. Each list carries wikilink
   * references to existing `rpg feature.details`-bearing pages (talents,
   * boons, curses, any feature page). Entries can be a bare `"[[Name]]"`
   * shorthand or an object with optional `source` / `level` that attributes
   * the extra's feature cards + traits to a specific ResolvedSource (e.g.
   * a boon granted mid-campaign by the Cleric's 4th-level milestone).
   */
  additional?: {
    talents?: ExtraRef[];
    features?: ExtraRef[];
    boons?: ExtraRef[];
    curses?: ExtraRef[];
  };
  /**
   * User-trivialised feature aspects, keyed by source → feature name →
   * list of *aspect keys*. An aspect key identifies one specific instance
   * of an aspect on a feature and has the form `<bucket>:<aspectId>`
   * where `aspectId` is the aspect's `name:` if set, otherwise its index
   * within that bucket on the feature (0-based).
   *
   * Per-aspect-instance granularity means a feature like "Elf Lineage
   * Traits" with two distinct passive aspects can have one collapsed and
   * the other left expanded. A bare bucket id without colon (e.g.
   * `"passive"`) is still accepted for backwards compatibility with the
   * earlier "collapse all aspects in this bucket" shape — it matches
   * every aspect in that bucket on the feature.
   */
  trivialized?: Record<string, Record<string, string[]>>;
};

/** Shorthand `"[[Name]]"` or a fully-specified `{ ref, source?, level? }`. */
export type ExtraRef = string | { ref: string; source?: string; level?: number };
