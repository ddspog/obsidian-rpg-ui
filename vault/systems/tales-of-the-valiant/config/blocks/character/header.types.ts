import { PillDetails } from "../../entities/character.common";

/**
 * Types for the Character Entity, defining the shape of its blocks, lookup, and expressions.
 */
export type HeaderProps = {
    /** URL or vault path used as background image for the header */
    banner: string;
    /** List of classes, allowing user to multiclass */
    classes: {
      /** File name defining the Class with its features */
      name: string;
      /** Current level in that class */
      level: number
      /** File name for a Subclass, if any applied */
      subclass?: string;
    }[];
    /** Lineage defining the DNA of the character. */
    lineage: PillDetails;
    /** Heritage defining a bit of character manners and history. */
    heritage: PillDetails;
    /** Background defining a bit on how character came to adventure. */
    background: PillDetails;
    /** Current XP value */
    xp: number;
    /** Current Luck points available */
    luck: number;
}
