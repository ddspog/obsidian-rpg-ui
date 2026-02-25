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
import { CreateSystem, CreateEntity } from "rpg-ui-toolkit";
import type {
  ConditionDefinition,
  SkillDefinition,
  CharacterHeaderBlock,
  HealthBlock,
  FeaturesCollectorBlock,
  SpellsCollectorBlock,
  ClassFeaturesBlock,
  SpellInfoBlock,
  SpellEffectsBlock,
  FeatureEntryBlock,
  FeatureAspectsBlock,
  StatblockHeaderBlock,
  StatblockTraitsBlock,
  StatblockAttributesBlock,
  StatblockFeaturesBlock,
} from "rpg-ui-toolkit";
import attributes from './attributes';
import spellcastTable from './spellslots';
import character from "./entities/character";

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
    character,

    class: CreateEntity(({ wiki }: { wiki?: any }) => ({
      frontmatter: [{ name: "hit_die", type: "string", default: "d8" }],
      blocks: {
        features: () => null,
      },
    })),

    subclass: CreateEntity(({ wiki }: { wiki?: any }) => ({ frontmatter: [{ name: "parent_class", type: "string", default: "" }] })),

    race: CreateEntity(({ wiki }: { wiki?: any }) => ({ frontmatter: [{ name: "size", type: "string", default: "medium" }, { name: "speed", type: "number", default: 30 }] })),

    monster: CreateEntity(async ({ wiki }: { wiki?: any }) => {
      const external = (await wiki.file("compendium/entities/monster/extra").catch(() => null)) as any;
      return {
        frontmatter: [{ name: "cr", type: "number", default: 0 }],
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

    spell: CreateEntity(({ wiki }: { wiki?: any }) => ({
      frontmatter: [
        { name: "level", type: "number", default: 0 },
        { name: "school", type: "string", default: "" },
      ],
      blocks: {
        info: () => null,
        effects: () => null,
      },
    })),

    feature: CreateEntity(({ wiki }: { wiki?: any }) => ({
      blocks: {
        feature: () => null,
        aspects: () => null,
      },
    })),

    statblock: CreateEntity(({ wiki }: { wiki?: any }) => ({
      frontmatter: [{ name: "cr", type: "number", default: 0 }],
      blocks: {
        header: () => null,
        traits: () => null,
        attributes: () => null,
        features: () => null,
      },
    })),
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
    casters: {
      full: { name: "Full Caster", levelConversion: (l: number) => l },
      half: { name: "Half Caster", levelConversion: (l: number) => Math.floor(l / 2) },
      third: { name: "Third Caster", levelConversion: (l: number) => Math.floor(l / 3) },
    },
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
