import { SkillDetails } from "../../entities/character.common";

/**
 * Types for the Health block of the Character Entity, defining the shape of its data and subcomponents.
 */
export type HealthProps = {
    /** Portrait image for the character */
    portrait: string;
    /** Maximum hit points */
    max_hp: number;
    /** Current hit points */
    current_hp: number;
    /** Temporary hit points */
    temp_hp: number;
    /** Hit dice available for the character */
    hit_dice: Record<string, {
      /* Maximum number of hit dice of this type (e.g. 2d10) */
      max: number;
      /* Current number of hit dice of this type (e.g. 2d10) */
      current: number
    }>;
    /** Death saves tracking */
    death_saves: {
      /** Number of successful death saves. When reaching 3, the character stabilizes and stops making death saves, but remains unconscious until healed. */
      successes: number;
      /** Number of failed death saves. When reaching 3, the character dies. */
      failures: number;
    },
    /** Current exhaustion level */
    exhaustion: number;
    /** List of current conditions affecting the character */
    conditions: string[];
    /** Initiative details for the character */
    initiative: SkillDetails;
    /** Natural Armor Class of the character */
    natural_ac: number;
    /** Movement speed details */
    speed: {
      /** Speed in feet */
      value: number;
      /** Type of movement, e.g. "walk", "fly", "swim", etc. */
      type: string;
    };
}
