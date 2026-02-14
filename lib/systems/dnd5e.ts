/**
 * Built-in D&D 5e system
 * 
 * Extracts the hardcoded D&D 5e logic into a system implementation.
 * This is the default system when no custom system is assigned.
 */

import { EntityTypeDef, ExpressionDef, RPGSystem, SkillDefinition } from "./types";

/**
 * D&D 5e ability names
 */
const DND5E_ATTRIBUTES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

/**
 * D&D 5e skill list
 * Moved from domains/skills.ts
 */
const DND5E_SKILLS: SkillDefinition[] = [
  { label: "Acrobatics", attribute: "dexterity" },
  { label: "Animal Handling", attribute: "wisdom" },
  { label: "Arcana", attribute: "intelligence" },
  { label: "Athletics", attribute: "strength" },
  { label: "Deception", attribute: "charisma" },
  { label: "History", attribute: "intelligence" },
  { label: "Insight", attribute: "wisdom" },
  { label: "Intimidation", attribute: "charisma" },
  { label: "Investigation", attribute: "intelligence" },
  { label: "Medicine", attribute: "wisdom" },
  { label: "Nature", attribute: "intelligence" },
  { label: "Perception", attribute: "wisdom" },
  { label: "Performance", attribute: "charisma" },
  { label: "Persuasion", attribute: "charisma" },
  { label: "Religion", attribute: "intelligence" },
  { label: "Sleight of Hand", attribute: "dexterity" },
  { label: "Stealth", attribute: "dexterity" },
  { label: "Survival", attribute: "wisdom" },
];

/**
 * Character type definition for D&D 5e
 */
const DND5E_CHARACTER_TYPE: EntityTypeDef = {
  fields: [
    {
      name: "proficiency_bonus",
      type: "number",
      default: 2,
    },
    {
      name: "level",
      type: "number",
      default: 1,
    },
  ],
};

/**
 * D&D 5e ability modifier expression
 * Formula: floor((score - 10) / 2)
 */
const modifierExpression: ExpressionDef = {
  id: "modifier",
  params: ["score"],
  formula: "{{floor (divide (subtract score 10) 2)}}",
  evaluate: (context) => {
    const score = Number(context.score) || 0;
    return Math.floor((score - 10) / 2);
  },
};

/**
 * D&D 5e saving throw expression
 * Formula: modifier + proficiency_bonus (if proficient)
 */
const savingThrowExpression: ExpressionDef = {
  id: "saving_throw",
  params: ["score", "proficiency_bonus", "is_proficient"],
  formula: "{{add (modifier score) (if is_proficient proficiency_bonus 0)}}",
  evaluate: (context) => {
    const score = Number(context.score) || 0;
    const proficiencyBonus = Number(context.proficiency_bonus) || 0;
    const isProficient = Boolean(context.is_proficient);
    
    const modifier = Math.floor((score - 10) / 2);
    return modifier + (isProficient ? proficiencyBonus : 0);
  },
};

/**
 * D&D 5e skill check expression
 * Formula: modifier + proficiency_bonus (based on proficiency level)
 */
const skillModifierExpression: ExpressionDef = {
  id: "skill_modifier",
  params: ["score", "proficiency_bonus", "proficiency_level"],
  formula: "{{add (modifier score) (multiply proficiency_bonus proficiency_level)}}",
  evaluate: (context) => {
    const score = Number(context.score) || 0;
    const proficiencyBonus = Number(context.proficiency_bonus) || 0;
    const proficiencyLevel = Number(context.proficiency_level) || 0;
    
    const modifier = Math.floor((score - 10) / 2);
    return modifier + (proficiencyBonus * proficiencyLevel);
  },
};

/**
 * Built-in D&D 5e system
 */
export const DND5E_SYSTEM: RPGSystem = {
  name: "D&D 5e",
  attributes: DND5E_ATTRIBUTES,
  types: {
    character: DND5E_CHARACTER_TYPE,
  },
  skills: DND5E_SKILLS,
  expressions: new Map([
    ["modifier", modifierExpression],
    ["saving_throw", savingThrowExpression],
    ["skill_modifier", skillModifierExpression],
  ]),
};
