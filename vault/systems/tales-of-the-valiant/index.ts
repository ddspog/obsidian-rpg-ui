/**
 * Tales of the Valiant System Definition
 *
 * This file demonstrates the TypeScript-based system definition format.
 * It mirrors the built-in Tales of the Valiant system and serves as a reference for
 * creating your own custom systems.
 *
 * To use this system:
 * 1. Copy this folder to your vault (e.g., `systems/tales-of-the-valiant/`)
 * 2. In the plugin settings, add a system mapping:
 *    - Content folder: your campaign folder (e.g., `campaigns/my-campaign`)
 *    - System folder: `systems/tales-of-the-valiant`
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
import { ConditionDefinition, CreateSystem, CreateEntity, SkillDefinition } from "rpg-ui-toolkit";
import attributes from './attributes';
import xpTable from './xp-table';
import spellcastTable from './spellcast-table';

export const system = CreateSystem(async ({ wiki }) => ({
  name: "Tales of the Valiant",
  attributes,
  skills: await wiki.folder("compendium/skills") as unknown as SkillDefinition[],
  conditions: await wiki.folder("compendium/conditions") as unknown as ConditionDefinition[],

  // ── Entity Types ─────────────────────────────────────────────────────────────
  entities: {
    // Use CreateEntity so the definition can be authored as a factory that
    // receives the `wiki` fixture. This lets you keep complex entity
    // definitions in separate vault files and load them here via `wiki.file`
    // or `wiki.folder`.
    character: CreateEntity(async ({ wiki }: { wiki?: any }) => {
      const externalFeatures = (await wiki.folder("compendium/entities/character/features").catch(() => [])) as any[];
      return {
        fields: [
          { name: "proficiency_bonus", type: "number", default: 2 },
          { name: "level", type: "number", default: 1 },
        ],
        xpTable,
        features: [
          { $name: "Dash", type: "action", $contents: "Double your speed for the current turn." },
          {
            $name: "Disengage",
            type: "action",
            $contents: "Your movement doesn't provoke opportunity attacks for the rest of the turn.",
          },
          {
            $name: "Dodge",
            type: "action",
            $contents: "Attack rolls against you have disadvantage until your next turn.",
          },
          {
            $name: "Help",
            type: "action",
            $contents: "Give an ally advantage on their next ability check or attack roll.",
          },
          { $name: "Hide", type: "action", $contents: "Make a Dexterity (Stealth) check to hide." },
          {
            $name: "Ready",
            type: "action",
            $contents: "Prepare an action to trigger in response to a specified circumstance.",
          },
          {
            $name: "Search",
            type: "action",
            $contents: "Make a Wisdom (Perception) or Intelligence (Investigation) check to find something.",
          },
          {
            $name: "Use an Object",
            type: "action",
            $contents: "Interact with an object or the environment.",
          },
          {
            $name: "Opportunity Attack",
            type: "reaction",
            $contents: "Make a melee attack against a creature that leaves your reach.",
          },
          // merge any external features defined in the vault
          ...externalFeatures.map((f) => ({ $name: f.$name ?? f.$path, $contents: f.$contents ?? "" })),
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
      };
    }),

    class: CreateEntity(({ wiki }: { wiki?: any }) => ({ fields: [{ name: "hit_die", type: "string", default: "d8" }] })),

    subclass: CreateEntity(({ wiki }: { wiki?: any }) => ({ fields: [{ name: "parent_class", type: "string", default: "" }] })),

    race: CreateEntity(({ wiki }: { wiki?: any }) => ({ fields: [{ name: "size", type: "string", default: "medium" }, { name: "speed", type: "number", default: 30 }] })),

    monster: CreateEntity(async ({ wiki }: { wiki?: any }) => {
      const external = (await wiki.file("compendium/entities/monster/extra").catch(() => null)) as any;
      return {
        fields: [{ name: "cr", type: "number", default: 0 }],
        features: [
          {
            $name: "Opportunity Attack",
            type: "reaction",
            $contents: "Make a melee attack against a creature that leaves your reach.",
          },
          ...(external ? [{ $name: external.$name ?? external.$path, $contents: external.$contents ?? "" }] : []),
        ],
      };
    }),
  },

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
    spellcastTable,
  },

  // ── Traits ────────────────────────────────────────────────────────────────────
  traits: [
    { $name: "Proficiency", mechanical: true, $contents: "Standard proficiency with weapons, tools, or skills." },
    { $name: "Expertise", mechanical: true, $contents: "Double proficiency bonus with specific skills or tools." },
    { $name: "Darkvision", mechanical: true, $contents: "See in darkness up to a specified range." },
    { $name: "Resistance", mechanical: true, $contents: "Take half damage from a specified damage type." },
    { $name: "Immunity", mechanical: true, $contents: "Take no damage from a specified damage type." },
  ],
}));
