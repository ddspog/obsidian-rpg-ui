import { SkillDetails } from "../../entities/character.common";

/**
 * Types for the Skills block.
 *
 * Every skill field is optional. When omitted, the block derives the
 * proficiency level from the resolved features view:
 *   - `Skill P.` trait, skill present once  → proficient (level 1)
 *   - `Skill P.` trait, skill present twice → expertise  (level 2)
 *   - `Skill P. (½)` trait, skill present   → half-prof  (level 0.5)
 *
 * `additional:` supplies author-only promotions on top of whatever the
 * traits granted — useful for homebrew or one-off adjustments the trait
 * system can't express. Entries are skill names matching the table (e.g.
 * `"Animal Handling"`).
 */
export type SkillsProps = Partial<Record<
  | "Acrobatics" | "Animal Handling" | "Arcana" | "Athletics"
  | "Deception" | "History" | "Insight" | "Intimidation"
  | "Investigation" | "Medicine" | "Nature" | "Perception"
  | "Performance" | "Persuasion" | "Religion" | "Sleight of Hand"
  | "Stealth" | "Survival",
  SkillDetails
>> & {
  additional?: {
    /** Skills promoted to proficient (level 1) on top of traits. */
    profs?: string[];
    /** Skills promoted to expertise (level 2) on top of traits. */
    expertise?: string[];
    /** Skills promoted to half-proficient (level 0.5) on top of traits. */
    half_profs?: string[];
  };
};
