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
};
