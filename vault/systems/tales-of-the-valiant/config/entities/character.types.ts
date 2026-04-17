import { EntityDescriptor } from "rpg-ui-toolkit";
import { HeaderProps } from "../blocks/character/header.types";
import { HealthProps } from "../blocks/character/health.types";
import { StatsProps } from "../blocks/character/stats.types";
import { SensesProps } from "../blocks/character/senses.types";
import { SkillsProps } from "../blocks/character/skills.types";
import { AttacksProps } from "../blocks/character/attacks.types";
import { ProficienciesProps } from "../blocks/character/proficiencies.types";
import type { FeaturesBlockData } from "../blocks/character/features.types";
import type { CompendiumLib } from "../../../../../lib/domains/features/types";

/**
 * Types for the Character Entity, defining the shape of its blocks, lookup, and expressions.
 */
export type CharacterLookup = {
  /** Set of helpful tables to help calculating stuff. */
  table: {
    /** Table of Experience Milestone to advance on Character Levels */
    xp: number[];
  };
  /** Compendium libraries (classes, subclasses, lineages, heritages, backgrounds) loaded from wiki.folder. */
  $compendium: CompendiumLib;
}

/** Return types of each named expression on the character entity */
export type CharacterExpressions = {
  /** Sum of classes levels. */
  CharacterLevel: () => number;
  /** Proficiency Bonus based on Character Level. */
  ProficiencyBonus: () => number;
  /** Generic calculation for any attribute or skill modifier, given the attribute value, proficiency bonus, and any other bonuses or penalties. */
  ModifierTotal: (params: { attribute: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', proficiency: number, bonus: number }) => number;
  /** Passive value, calculated as 10 + modifier + proficiency bonus (if proficient) */
  Passive: (params: { attribute: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', proficiency: number, vantage: number, bonus: number }) => number;
};

/** Props shapes for each block in the character entity */
export type CharacterBlocks = {
  /** The Header of a Character Sheet, with defining aspects of the character. */
  header: HeaderProps;
  health: HealthProps;
  stats: StatsProps,
  senses: SensesProps,
  skills: SkillsProps,
  attacks: AttacksProps,
  proficiencies: ProficienciesProps;
  features: FeaturesBlockData;
  spells: {
    filter?: string;
  };
  inventory: {
    filter?: string;
  };
  description: {
    filter?: string;
  };
};

export type CharacterEntity = EntityDescriptor<CharacterBlocks, CharacterLookup, CharacterExpressions>;
