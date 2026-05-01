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
};
