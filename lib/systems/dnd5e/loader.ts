/**
 * D&D 5e System Loader
 * Assembles D&D 5e system using the CreateSystem factory
 */

import { CreateSystem } from "../create-system";
import type { RPGSystem } from "../types";

// Import data modules
import * as attributes from "./data/attributes";
import * as skills from "./data/skills";
import * as featureTypes from "./data/feature-types";
import * as spellCircles from "./data/spell-circles";
import * as spellLists from "./data/spell-lists";
import * as conditions from "./data/conditions";

/**
 * Build the D&D 5e system from data files using CreateSystem
 */
export function buildDND5ESystem(): RPGSystem {
  return CreateSystem({
    name: "D&D 5e",
    attributes: attributes.default,
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
          { name: "Use an Object", type: "action", description: "Interact with an object or the environment." },
          {
            name: "Opportunity Attack",
            type: "reaction",
            description: "Make a melee attack against a creature that leaves your reach.",
          },
        ],
        computed: {
          /** floor((score - 10) / 2) */
          modifier: (ctx: Record<string, unknown>) => {
            const score = Number(ctx.score) || 0;
            return Math.floor((score - 10) / 2);
          },
          /** modifier + proficiency_bonus (if proficient) */
          saving_throw: (ctx: Record<string, unknown>) => {
            const score = Number(ctx.score) || 0;
            const proficiencyBonus = Number(ctx.proficiency_bonus) || 0;
            const isProficient = Boolean(ctx.is_proficient);
            const mod = Math.floor((score - 10) / 2);
            return mod + (isProficient ? proficiencyBonus : 0);
          },
          /** modifier + proficiency_bonus * proficiency_level */
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
    skills: skills.default,
    features: {
      categories: featureTypes.default,
      providers: ["class", "race"],
      collectors: ["character", "monster"],
    },
    spellcasting: {
      circles: spellCircles.default,
      lists: spellLists.default,
      providers: ["class", "subclass"],
      collectors: ["character", "monster"],
    },
    conditions: conditions.default,
  });
}
