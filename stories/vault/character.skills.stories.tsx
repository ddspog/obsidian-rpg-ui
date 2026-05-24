/**
 * Stories for the Tales of the Valiant character.skills block
 *
 * Renders the full block via RpgBlock. Ability score and proficiency bonus
 * controls automatically recompute all 18 skill bonus totals. Story variants
 * demonstrate different class archetypes with distinct proficiency sets.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";
import { buildSkillsYaml, buildStatsYaml, type AbilityScores } from "../lib/character-yaml";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/tales-of-the-valiant/config/index";

// ─── Args type ────────────────────────────────────────────────────────────────

type SkillsArgs = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiency_bonus: number;
  level: number;
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<SkillsArgs> = {
  title: "Vault / Character / Skills",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
  argTypes: {
    strength: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Strength" },
    dexterity: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Dexterity" },
    constitution: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Constitution" },
    intelligence: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Intelligence" },
    wisdom: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Wisdom" },
    charisma: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Charisma" },
    proficiency_bonus: { control: { type: "number" }, name: "Proficiency Bonus" },
    level: { control: { type: "number" }, name: "Level" },
  },
};
export default meta;

type Story = StoryObj<SkillsArgs>;

// ─── Shared render ────────────────────────────────────────────────────────────

function renderSkills(args: SkillsArgs, system: RPGSystem, proficient: string[] = [], expert: string[] = []) {
  const abilities: AbilityScores = {
    strength: args.strength,
    dexterity: args.dexterity,
    constitution: args.constitution,
    intelligence: args.intelligence,
    wisdom: args.wisdom,
    charisma: args.charisma,
  };

  return (
    <RpgBlock
      system={system}
      entity="character"
      block="skills"
      yaml={buildSkillsYaml(abilities, args.proficiency_bonus, proficient, expert)}
      frontmatter={{
        proficiency_bonus: args.proficiency_bonus,
        level: args.level,
        ...abilities,
      }}
      blocks={{
        header: `
classes:
  - name: Fighter
    level: ${args.level}
`,
        stats: buildStatsYaml(abilities),
      }}
    />
  );
}

// ─── Default args ─────────────────────────────────────────────────────────────

const baseArgs: SkillsArgs = {
  strength: 18,
  dexterity: 14,
  constitution: 16,
  intelligence: 10,
  wisdom: 12,
  charisma: 8,
  proficiency_bonus: 3,
  level: 5,
};

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Fighter: Story = {
  name: "Fighter (STR build)",
  args: baseArgs,
  render: (args, { loaded }) =>
    renderSkills(args, loaded.system, ["Athletics", "Intimidation", "Perception", "Survival"]),
};

export const Rogue: Story = {
  name: "Rogue (DEX build)",
  args: {
    ...baseArgs,
    strength: 10,
    dexterity: 18,
    constitution: 14,
    intelligence: 12,
    wisdom: 10,
    charisma: 14,
  },
  render: (args, { loaded }) =>
    renderSkills(
      args,
      loaded.system,
      ["Deception", "Insight", "Perception", "Persuasion", "Sleight of Hand"],
      ["Acrobatics", "Stealth"]
    ),
};

export const Wizard: Story = {
  name: "Wizard (INT build)",
  args: {
    ...baseArgs,
    strength: 8,
    dexterity: 14,
    constitution: 14,
    intelligence: 18,
    wisdom: 12,
    charisma: 10,
  },
  render: (args, { loaded }) =>
    renderSkills(args, loaded.system, ["Arcana", "History", "Nature", "Religion"], ["Investigation"]),
};
