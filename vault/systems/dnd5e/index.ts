/**
 * D&D 5e System Definition
 *
 * This file demonstrates the TypeScript-based system definition format.
 * It mirrors the built-in D&D 5e system and serves as a reference for
 * creating your own custom systems.
 *
 * To use this system:
 * 1. Copy this folder to your vault (e.g., `systems/dnd5e/`)
 * 2. In the plugin settings, add a system mapping:
 *    - Content folder: your campaign folder (e.g., `campaigns/my-campaign`)
 *    - System folder: `systems/dnd5e`
 *
 * For IDE autocompletion, create a `tsconfig.json` in your vault with:
 * ```json
 * {
 *   "compilerOptions": {
 *     "paths": {
 *       "rpg-ui-toolkit": [".obsidian/plugins/obsidian-rpg-ui/api.d.ts"]
 *     }
 *   }
 * }
 * ```
 */

// @ts-ignore — resolved at runtime by the plugin's esbuild-wasm bundler
import { CreateSystem } from "rpg-ui-toolkit";

export const system = CreateSystem({
  name: "D&D 5e",

  // ── Attributes ──────────────────────────────────────────────────────────────
  attributes: [
    { name: "strength", alias: "STR", subtitle: "Physical power" },
    { name: "dexterity", alias: "DEX", subtitle: "Agility and reflexes" },
    { name: "constitution", alias: "CON", subtitle: "Endurance and health" },
    { name: "intelligence", alias: "INT", subtitle: "Reasoning and memory" },
    { name: "wisdom", alias: "WIS", subtitle: "Perception and insight" },
    { name: "charisma", alias: "CHA", subtitle: "Force of personality" },
  ],

  // ── Entity Types ─────────────────────────────────────────────────────────────
  entities: {
    character: {
      fields: [
        { name: "proficiency_bonus", type: "number", default: 2 },
        { name: "level", type: "number", default: 1 },
      ],
      features: [
        { name: "Dash", type: "action", description: "Double your speed for the current turn." },
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
        { name: "Hide", type: "action", description: "Make a Dexterity (Stealth) check to hide." },
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
      computed: {
        /** Ability modifier: floor((score - 10) / 2) */
        modifier: (ctx: Record<string, unknown>) => {
          const score = Number(ctx.score) || 0;
          return Math.floor((score - 10) / 2);
        },
        /** Saving throw: modifier + proficiency_bonus (if proficient) */
        saving_throw: (ctx: Record<string, unknown>) => {
          const score = Number(ctx.score) || 0;
          const proficiencyBonus = Number(ctx.proficiency_bonus) || 0;
          const isProficient = Boolean(ctx.is_proficient);
          const mod = Math.floor((score - 10) / 2);
          return mod + (isProficient ? proficiencyBonus : 0);
        },
        /** Skill modifier: modifier + proficiency_bonus * proficiency_level */
        skill_modifier: (ctx: Record<string, unknown>) => {
          const score = Number(ctx.score) || 0;
          const proficiencyBonus = Number(ctx.proficiency_bonus) || 0;
          const proficiencyLevel = Number(ctx.proficiency_level) || 0;
          const mod = Math.floor((score - 10) / 2);
          return mod + proficiencyBonus * proficiencyLevel;
        },
      },
    },

    class: {
      fields: [{ name: "hit_die", type: "string", default: "d8" }],
    },

    subclass: {
      fields: [{ name: "parent_class", type: "string", default: "" }],
    },

    race: {
      fields: [
        { name: "size", type: "string", default: "medium" },
        { name: "speed", type: "number", default: 30 },
      ],
    },

    monster: {
      fields: [{ name: "cr", type: "number", default: 0 }],
      features: [
        {
          name: "Opportunity Attack",
          type: "reaction",
          description: "Make a melee attack against a creature that leaves your reach.",
        },
      ],
    },
  },

  // ── Skills ────────────────────────────────────────────────────────────────────
  skills: [
    { name: "Acrobatics", attribute: "dexterity", subtitle: "Associated Ability: DEX" },
    { name: "Animal Handling", attribute: "wisdom", subtitle: "Associated Ability: WIS" },
    { name: "Arcana", attribute: "intelligence", subtitle: "Associated Ability: INT" },
    { name: "Athletics", attribute: "strength", subtitle: "Associated Ability: STR" },
    { name: "Deception", attribute: "charisma", subtitle: "Associated Ability: CHA" },
    { name: "History", attribute: "intelligence", subtitle: "Associated Ability: INT" },
    { name: "Insight", attribute: "wisdom", subtitle: "Associated Ability: WIS" },
    { name: "Intimidation", attribute: "charisma", subtitle: "Associated Ability: CHA" },
    { name: "Investigation", attribute: "intelligence", subtitle: "Associated Ability: INT" },
    { name: "Medicine", attribute: "wisdom", subtitle: "Associated Ability: WIS" },
    { name: "Nature", attribute: "intelligence", subtitle: "Associated Ability: INT" },
    { name: "Perception", attribute: "wisdom", subtitle: "Associated Ability: WIS" },
    { name: "Performance", attribute: "charisma", subtitle: "Associated Ability: CHA" },
    { name: "Persuasion", attribute: "charisma", subtitle: "Associated Ability: CHA" },
    { name: "Religion", attribute: "intelligence", subtitle: "Associated Ability: INT" },
    { name: "Sleight of Hand", attribute: "dexterity", subtitle: "Associated Ability: DEX" },
    { name: "Stealth", attribute: "dexterity", subtitle: "Associated Ability: DEX" },
    { name: "Survival", attribute: "wisdom", subtitle: "Associated Ability: WIS" },
  ],

  // ── Features ──────────────────────────────────────────────────────────────────
  features: {
    categories: [
      { id: "action", label: "Action", icon: "⚔️" },
      { id: "bonus_action", label: "Bonus Action", icon: "⚡" },
      { id: "reaction", label: "Reaction", icon: "🛡️" },
      { id: "free_action", label: "Free Action", icon: "✨" },
      { id: "passive", label: "Passive", icon: "📋" },
    ],
    providers: ["class", "race"],
    collectors: ["character", "monster"],
  },

  // ── Spellcasting ─────────────────────────────────────────────────────────────
  spellcasting: {
    circles: [
      { id: "cantrip", label: "Cantrip", icon: "0" },
      { id: "1", label: "1st Level", icon: "1" },
      { id: "2", label: "2nd Level", icon: "2" },
      { id: "3", label: "3rd Level", icon: "3" },
      { id: "4", label: "4th Level", icon: "4" },
      { id: "5", label: "5th Level", icon: "5" },
      { id: "6", label: "6th Level", icon: "6" },
      { id: "7", label: "7th Level", icon: "7" },
      { id: "8", label: "8th Level", icon: "8" },
      { id: "9", label: "9th Level", icon: "9" },
    ],
    lists: [
      { id: "bard", label: "Bard Spells" },
      { id: "cleric", label: "Cleric Spells" },
      { id: "druid", label: "Druid Spells" },
      { id: "paladin", label: "Paladin Spells" },
      { id: "ranger", label: "Ranger Spells" },
      { id: "sorcerer", label: "Sorcerer Spells" },
      { id: "warlock", label: "Warlock Spells" },
      { id: "wizard", label: "Wizard Spells" },
    ],
    providers: ["class", "subclass"],
    collectors: ["character", "monster"],
  },

  // ── Conditions ───────────────────────────────────────────────────────────────
  conditions: [
    { name: "Blinded", icon: "🙈", description: "A blinded creature can't see." },
    { name: "Charmed", icon: "💖", description: "A charmed creature can't attack the charmer." },
    { name: "Deafened", icon: "🔇", description: "A deafened creature can't hear." },
    { name: "Frightened", icon: "😱", description: "A frightened creature has disadvantage while it can see the source." },
    { name: "Grappled", icon: "🤼", description: "A grappled creature's speed becomes 0." },
    { name: "Incapacitated", icon: "💫", description: "An incapacitated creature can't take actions or reactions." },
    { name: "Invisible", icon: "👻", description: "An invisible creature is impossible to see." },
    { name: "Paralyzed", icon: "⚡", description: "A paralyzed creature is incapacitated and can't move or speak." },
    { name: "Petrified", icon: "🪨", description: "A petrified creature is transformed into stone." },
    { name: "Poisoned", icon: "☠️", description: "A poisoned creature has disadvantage on attack rolls and ability checks." },
    { name: "Prone", icon: "🛏️", description: "A prone creature is on the ground." },
    { name: "Restrained", icon: "⛓️", description: "A restrained creature's speed becomes 0." },
    { name: "Stunned", icon: "💥", description: "A stunned creature is incapacitated." },
    { name: "Unconscious", icon: "💤", description: "An unconscious creature is incapacitated." },
  ],

  // ── Traits ────────────────────────────────────────────────────────────────────
  traits: [
    { name: "Proficiency", mechanical: true, description: "Standard proficiency with weapons, tools, or skills." },
    { name: "Expertise", mechanical: true, description: "Double proficiency bonus with specific skills or tools." },
    { name: "Darkvision", mechanical: true, description: "See in darkness up to a specified range." },
    { name: "Resistance", mechanical: true, description: "Take half damage from a specified damage type." },
    { name: "Immunity", mechanical: true, description: "Take no damage from a specified damage type." },
  ],
});
