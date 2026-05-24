/**
 * Tales of the Valiant character proficiencies configuration.
 *
 * All four lists are optional. When a list is omitted the block reads its
 * value from the resolved features view's traits map (`Armor`, `Weapons`,
 * `Tools`, `Languages`). When set explicitly the YAML wins as-is. The
 * matching `additional:` slot inside each list lets authors append
 * homebrew/ad-hoc entries on top of either source.
 *
 * These keys deliberately skip the `P./J./E.` proficiency taxonomy used for
 * skill / save / initiative rolls — here "proficiency" means "knows how to
 * use a weapon / wear armor / read a language", not a PB-scaled roll
 * modifier, so the single plural-noun key is sufficient.
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
  /** Override the auto-derived damage-resistance list. */
  resistance?: string[];
  /** Override the auto-derived damage-immunity list. */
  immunity?: string[];
  /** Override the auto-derived damage-vulnerability list. */
  vulnerability?: string[];
  /** Author additions appended on top of the resolved (or YAML) lists. */
  additional?: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
    languages?: string[];
    resistance?: string[];
    immunity?: string[];
    vulnerability?: string[];
  };
};
