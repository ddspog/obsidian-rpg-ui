/**
 * Stories for the Tales of the Valiant character.senses block
 *
 * Renders the full block via RpgBlock. Controls for ability scores and the three
 * passive skill proficiencies (Insight, Investigation, Perception) drive the
 * computed passive values. Story variants demonstrate different lineage senses.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";
import { buildSkillsYaml, buildStatsYaml, type AbilityScores } from "../lib/character-yaml";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/systems/tales-of-the-valiant/config/index";

// ─── Args type ────────────────────────────────────────────────────────────────

type SensesArgs = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiency_bonus: number;
  level: number;
  insight_prof: number;
  investigation_prof: number;
  perception_prof: number;
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<SensesArgs> = {
  title: "Vault / Character / Senses",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
  argTypes: {
    wisdom:             { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Wisdom" },
    intelligence:       { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Intelligence" },
    strength:           { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Strength" },
    dexterity:          { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Dexterity" },
    constitution:       { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Constitution" },
    charisma:           { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Charisma" },
    proficiency_bonus:  { control: { type: "number" }, name: "Proficiency Bonus" },
    level:              { control: { type: "number" }, name: "Level" },
    perception_prof:    { control: { type: "range", min: 0, max: 2, step: 1 }, name: "Perception Prof." },
    insight_prof:       { control: { type: "range", min: 0, max: 2, step: 1 }, name: "Insight Prof." },
    investigation_prof: { control: { type: "range", min: 0, max: 2, step: 1 }, name: "Investigation Prof." },
  },
};
export default meta;

type Story = StoryObj<SensesArgs>;

// ─── Shared render ────────────────────────────────────────────────────────────

type SenseEntry = { type: string; range?: number };

function renderSenses(args: SensesArgs, system: RPGSystem, senses_list: SenseEntry[]) {
  const abilities: AbilityScores = {
    strength: args.strength,
    dexterity: args.dexterity,
    constitution: args.constitution,
    intelligence: args.intelligence,
    wisdom: args.wisdom,
    charisma: args.charisma,
  };

  const proficient: string[] = [];
  const expert: string[] = [];
  const push = (prof: number, name: string) => {
    if (prof === 1) proficient.push(name);
    if (prof === 2) expert.push(name);
  };
  push(args.insight_prof, "Insight");
  push(args.investigation_prof, "Investigation");
  push(args.perception_prof, "Perception");

  const listYaml =
    senses_list.length === 0
      ? "senses_list: []"
      : `senses_list:\n${senses_list
          .map((s) => `  - type: ${s.type}${s.range != null ? `\n    range: ${s.range}` : ""}`)
          .join("\n")}`;

  return (
    <RpgBlock
      system={system}
      entity="character"
      block="senses"
      yaml={listYaml}
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
        skills: buildSkillsYaml(abilities, args.proficiency_bonus, proficient, expert),
      }}
    />
  );
}

// ─── Default args ─────────────────────────────────────────────────────────────

const baseArgs: SensesArgs = {
  strength: 16,
  dexterity: 12,
  constitution: 14,
  intelligence: 13,
  wisdom: 11,
  charisma: 10,
  proficiency_bonus: 3,
  level: 5,
  insight_prof: 0,
  investigation_prof: 0,
  perception_prof: 1,
};

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Human: Story = {
  name: "Human (no special senses)",
  args: baseArgs,
  render: (args, { loaded }) => renderSenses(args, loaded.system, []),
};

export const Elf: Story = {
  name: "Elf (darkvision 60 ft)",
  args: { ...baseArgs, wisdom: 14, perception_prof: 1 },
  render: (args, { loaded }) =>
    renderSenses(args, loaded.system, [{ type: "darkvision", range: 60 }]),
};

export const Drow: Story = {
  name: "Drow (superior darkvision 120 ft)",
  args: { ...baseArgs, wisdom: 12, charisma: 16, perception_prof: 1 },
  render: (args, { loaded }) =>
    renderSenses(args, loaded.system, [{ type: "darkvision", range: 120 }]),
};

export const BeastMaster: Story = {
  name: "Beast Master (multiple senses)",
  args: { ...baseArgs, wisdom: 16, perception_prof: 2, insight_prof: 1 },
  render: (args, { loaded }) =>
    renderSenses(args, loaded.system, [
      { type: "darkvision", range: 60 },
      { type: "tremorsense", range: 10 },
    ]),
};
