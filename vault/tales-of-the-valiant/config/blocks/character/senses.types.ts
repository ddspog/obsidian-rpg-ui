/**
 * Types for the Senses block of the Character Entity.
 *
 * `senses_list` is optional — when omitted, the block infers entries from
 * the resolved features view's `Senses` trait. Each YAML entry can be a
 * full `{ type, range? }` object or a shorthand string like
 * `"darkvision 60"` (parsed as `{ type: "darkvision", range: 60 }`).
 *
 * `additional:` lets authors append homebrew senses on top of the trait-
 * derived list.
 */
export type SenseEntry =
  | string
  | {
      /** Range in feet, if applicable (e.g. darkvision), otherwise omitted (e.g. blindsight). */
      range?: number;
      /** Type of sense, e.g. "darkvision", "blindsight", "tremorsense", "truesight".
       *  May be a plain string or an Obsidian wikilink (`[[Darkvision]]`,
       *  `[[path|Darvision]]`) — when a wikilink is present, the renderer
       *  surfaces it as an internal-link anchor with Obsidian's hover-preview. */
      type: string;
      /** Explicit link target, overriding any wikilink parsed from `type`. */
      link?: string;
    };

export type SensesProps = {
  /** Override the auto-derived senses list from feature traits. */
  senses_list?: SenseEntry[];
  /** Author additions appended on top of the resolved senses list. */
  additional?: {
    senses?: SenseEntry[];
  };
};
