/**
 * Tales of the Valiant character proficiencies configuration.
 *
 * All four lists are optional. When a list is omitted the block reads its
 * value from the resolved features view's traits map (`Armor`,
 * `Weapon Proficiency`, `Tool P.`, `Languages`). When set explicitly the
 * YAML wins as-is. The matching `additional:` slot inside each list lets
 * authors append homebrew/ad-hoc entries on top of either source.
 */
export type ProficienciesProps = {
  /** Override the auto-derived armor proficiency list. */
  armor?: string[];
  /** Override the auto-derived weapon proficiency list. */
  weapons?: string[];
  /** Override the auto-derived tool proficiency list. */
  tools?: string[];
  /** Override the auto-derived language list. */
  languages?: string[];
  /** Author additions appended on top of the resolved (or YAML) lists. */
  additional?: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
    languages?: string[];
  };
};
