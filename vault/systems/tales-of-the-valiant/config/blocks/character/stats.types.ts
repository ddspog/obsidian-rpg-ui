import { SkillDetails } from "../../entities/character.common";

type AttributeDetails = {
  /** Current attribute score */
  value: number;
  /** Current saving throw proficiency and vantage */
  save: SkillDetails;
}

/**
 * Types for the Stats block of the Character Entity, defining the shape of its data and subcomponents.
 */
export type StatsProps = {
    /** Each core attribute with its value and saving throw details */
    STR: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    DEX: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    CON: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    INT: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    WIS: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    CHA: AttributeDetails;
}
