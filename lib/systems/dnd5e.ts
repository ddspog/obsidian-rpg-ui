/**
 * Built-in D&D 5e system
 * 
 * Extracts the hardcoded D&D 5e logic into a system implementation.
 * This is the default system when no custom system is assigned.
 */

import { EntityTypeDef, ExpressionDef, FeatureTypeDefinition, RPGSystem, SkillDefinition } from "./types";

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
 * D&D 5e feature types
 */
const DND5E_FEATURE_TYPES: FeatureTypeDefinition[] = [
  { id: "action", label: "Action", icon: "⚔️" },
  { id: "bonus_action", label: "Bonus Action", icon: "⚡" },
  { id: "reaction", label: "Reaction", icon: "🛡️" },
  { id: "passive", label: "Passive", icon: "👁️" },
  { id: "active", label: "Active", icon: "✨" },
];

/**
 * D&D 5e spell circles (spell levels)
 */
const DND5E_SPELL_CIRCLES: import("./types").SpellCircleDefinition[] = [
  { id: "cantrip", label: "Cantrip", icon: "✨" },
  { id: "1", label: "1st Level", icon: "1️⃣" },
  { id: "2", label: "2nd Level", icon: "2️⃣" },
  { id: "3", label: "3rd Level", icon: "3️⃣" },
  { id: "4", label: "4th Level", icon: "4️⃣" },
  { id: "5", label: "5th Level", icon: "5️⃣" },
  { id: "6", label: "6th Level", icon: "6️⃣" },
  { id: "7", label: "7th Level", icon: "7️⃣" },
  { id: "8", label: "8th Level", icon: "8️⃣" },
  { id: "9", label: "9th Level", icon: "9️⃣" },
];

/**
 * D&D 5e spell lists (spell sources by class)
 */
const DND5E_SPELL_LISTS: import("./types").SpellListDefinition[] = [
  { id: "artificer", label: "Artificer Spells", icon: "🔧" },
  { id: "bard", label: "Bard Spells", icon: "🎵" },
  { id: "cleric", label: "Cleric Spells", icon: "✝️" },
  { id: "druid", label: "Druid Spells", icon: "🌿" },
  { id: "paladin", label: "Paladin Spells", icon: "⚔️" },
  { id: "ranger", label: "Ranger Spells", icon: "🏹" },
  { id: "sorcerer", label: "Sorcerer Spells", icon: "🔮" },
  { id: "warlock", label: "Warlock Spells", icon: "👁️" },
  { id: "wizard", label: "Wizard Spells", icon: "📚" },
];

/**
 * Character entity type for D&D 5e
 * Includes default combat actions available to all characters
 */
const DND5E_CHARACTER_TYPE: EntityTypeDef = {
  frontmatter: [
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
  features: [
    {
      name: "Dash",
      type: "action",
      description: "Double your speed for the current turn.",
    },
    {
      name: "Disengage",
      type: "action",
      description: "Your movement doesn't provoke opportunity attacks for the rest of the turn.",
    },
    {
      name: "Dodge",
      type: "action",
      description: "Attack rolls against you have disadvantage until your next turn.",
    },
    {
      name: "Help",
      type: "action",
      description: "Give an ally advantage on their next ability check or attack roll.",
    },
    {
      name: "Hide",
      type: "action",
      description: "Make a Dexterity (Stealth) check to hide.",
    },
    {
      name: "Ready",
      type: "action",
      description: "Prepare an action to trigger in response to a specified circumstance.",
    },
    {
      name: "Search",
      type: "action",
      description: "Make a Wisdom (Perception) or Intelligence (Investigation) check to find something.",
    },
    {
      name: "Use an Object",
      type: "action",
      description: "Interact with an object or the environment.",
    },
    {
      name: "Opportunity Attack",
      type: "reaction",
      description: "Make a melee attack against a creature that leaves your reach.",
    },
  ],
};

/**
 * Class entity type for D&D 5e
 */
const DND5E_CLASS_TYPE: EntityTypeDef = {
  frontmatter: [
    {
      name: "hit_die",
      type: "string",
      default: "d8",
    },
  ],
};

/**
 * Subclass entity type for D&D 5e
 */
const DND5E_SUBCLASS_TYPE: EntityTypeDef = {
  frontmatter: [
    {
      name: "parent_class",
      type: "string",
      default: "",
    },
  ],
};

/**
 * Race entity type for D&D 5e
 */
const DND5E_RACE_TYPE: EntityTypeDef = {
  frontmatter: [
    {
      name: "size",
      type: "string",
      default: "medium",
    },
    {
      name: "speed",
      type: "number",
      default: 30,
    },
  ],
};

/**
 * Monster entity type for D&D 5e
 * Includes default combat actions available to all monsters
 */
const DND5E_MONSTER_TYPE: EntityTypeDef = {
  frontmatter: [
    {
      name: "cr",
      type: "number",
      default: 0,
    },
  ],
  features: [
    {
      name: "Opportunity Attack",
      type: "reaction",
      description: "Make a melee attack against a creature that leaves your reach.",
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
  entities: {
    character: DND5E_CHARACTER_TYPE,
    class: DND5E_CLASS_TYPE,
    subclass: DND5E_SUBCLASS_TYPE,
    race: DND5E_RACE_TYPE,
    monster: DND5E_MONSTER_TYPE,
  },
  skills: DND5E_SKILLS,
  expressions: new Map([
    ["modifier", modifierExpression],
    ["saving_throw", savingThrowExpression],
    ["skill_modifier", skillModifierExpression],
  ]),
  features: {
    categories: DND5E_FEATURE_TYPES,
    providers: ["class", "race"],
    collectors: ["character", "monster"],
  },
  spellcasting: {
    circles: DND5E_SPELL_CIRCLES,
    lists: DND5E_SPELL_LISTS,
    providers: ["class", "subclass"],
    collectors: ["character", "monster"],
  },
};
