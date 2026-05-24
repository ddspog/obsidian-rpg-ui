import type { HeaderProps } from "./header.types";
import type { HealthProps } from "./health.types";
import type { StatsProps } from "./stats.types";
import type { SensesProps } from "./senses.types";
import type { SkillsProps } from "./skills.types";
import type { RollsProps } from "./rolls.types";
import type { ProficienciesProps } from "./proficiencies.types";

/**
 * Superset of the seven "sheet" blocks' props — authors can drop any
 * subset into a single `rpg character.sheet` fence and each sub-
 * renderer picks out only the fields it cares about.
 */
export type SheetProps = Partial<HeaderProps> &
  Partial<HealthProps> &
  Partial<StatsProps> &
  Partial<SensesProps> &
  Partial<SkillsProps> &
  Partial<RollsProps> &
  Partial<ProficienciesProps> & { [key: string]: unknown };
