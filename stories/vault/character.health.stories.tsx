/**
 * Stories for the Tales of the Valiant character.health block
 *
 * These stories render the full block component as it would appear in a vault
 * note, via the RpgBlock wrapper (no Obsidian dependency).
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/tales-of-the-valiant/config/index";

// ─── Args type ────────────────────────────────────────────────────────────────

type HealthArgs = {
  current_hp: number;
  max_hp: number;
  temp_hp: number;
  natural_ac: number;
  speed_walk: number;
  speed_fly: number;
  hit_dice_max: number;
  hit_dice_current: number;
  death_successes: number;
  death_failures: number;
  exhaustion: number;
  proficiency_bonus: number;
  level: number;
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<HealthArgs> = {
  title: "Vault / Character / Health",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
  argTypes: {
    current_hp: { control: { type: "number" }, name: "Current HP" },
    max_hp: { control: { type: "number" }, name: "Max HP" },
    temp_hp: { control: { type: "number" }, name: "Temp HP" },
    natural_ac: { control: { type: "number" }, name: "Natural AC" },
    speed_walk: { control: { type: "number" }, name: "Speed Walk (ft)" },
    speed_fly: { control: { type: "number" }, name: "Speed Fly (ft)" },
    hit_dice_max: { control: { type: "number" }, name: "Hit Dice (max)" },
    hit_dice_current: { control: { type: "number" }, name: "Hit Dice (current)" },
    death_successes: { control: { type: "range", min: 0, max: 3, step: 1 }, name: "Death Save Successes" },
    death_failures: { control: { type: "range", min: 0, max: 3, step: 1 }, name: "Death Save Failures" },
    exhaustion: { control: { type: "range", min: 0, max: 6, step: 1 }, name: "Exhaustion" },
    proficiency_bonus: { control: { type: "number" }, name: "Proficiency Bonus" },
    level: { control: { type: "number" }, name: "Level" },
  },
};
export default meta;

type Story = StoryObj<HealthArgs>;

// ─── Shared render ────────────────────────────────────────────────────────────

function renderHealth(args: HealthArgs, system: RPGSystem, conditions: string[] = []) {
  const conditionsYaml = conditions.length
    ? conditions.map((c) => `  - name: ${c}\n    file: ${c}`).join("\n")
    : "  []";

  const speedEntries = [`  - type: Walk\n    value: ${args.speed_walk}`];
  if (args.speed_fly > 0) {
    speedEntries.push(`  - type: Fly\n    value: ${args.speed_fly}`);
  }

  return (
    <RpgBlock
      system={system}
      entity="character"
      block="health"
      yaml={`
current_hp: ${args.current_hp}
max_hp: ${args.max_hp}
temp_hp: ${args.temp_hp}
natural_ac: ${args.natural_ac}
portrait: [[character-portrait.webp]]
speed:
${speedEntries.join("\n")}
hit_dice:
  d10:
    max: ${args.hit_dice_max}
    current: ${args.hit_dice_current}
death_saves:
  successes: ${args.death_successes}
  failures: ${args.death_failures}
exhaustion: ${args.exhaustion}
conditions:
${conditionsYaml}
`}
      frontmatter={{
        proficiency_bonus: args.proficiency_bonus,
        level: args.level,
        strength: 18,
        dexterity: 14,
        constitution: 16,
        intelligence: 10,
        wisdom: 12,
        charisma: 8,
      }}
      blocks={{
        header: `
classes:
  - name: Fighter
    level: ${args.level}
`,
      }}
    />
  );
}

// ─── Default state ────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default state",
  args: {
    current_hp: 32,
    max_hp: 58,
    temp_hp: 5,
    natural_ac: 16,
    speed_walk: 30,
    speed_fly: 0,
    hit_dice_max: 5,
    hit_dice_current: 4,
    death_successes: 0,
    death_failures: 0,
    exhaustion: 0,
    proficiency_bonus: 3,
    level: 5,
  },
  render: (args, { loaded }) => renderHealth(args, loaded.system, ["Poisoned"]),
};

// ─── Bloodied ─────────────────────────────────────────────────────────────────

export const Bloodied: Story = {
  name: "Bloodied (low HP)",
  args: {
    current_hp: 8,
    max_hp: 58,
    temp_hp: 0,
    natural_ac: 16,
    speed_walk: 30,
    speed_fly: 0,
    hit_dice_max: 5,
    hit_dice_current: 1,
    death_successes: 0,
    death_failures: 0,
    exhaustion: 2,
    proficiency_bonus: 3,
    level: 5,
  },
  render: (args, { loaded }) => renderHealth(args, loaded.system, ["Poisoned", "Frightened"]),
};

// ─── Dying ────────────────────────────────────────────────────────────────────

export const Dying: Story = {
  name: "Dying (death saves)",
  args: {
    current_hp: 0,
    max_hp: 58,
    temp_hp: 0,
    natural_ac: 16,
    speed_walk: 30,
    speed_fly: 0,
    hit_dice_max: 5,
    hit_dice_current: 0,
    death_successes: 2,
    death_failures: 1,
    exhaustion: 1,
    proficiency_bonus: 3,
    level: 5,
  },
  render: (args, { loaded }) => renderHealth(args, loaded.system, ["Unconscious"]),
};

// ─── Multiclass ──────────────────────────────────────────────────────────

export const Multiclass: Story = {
  name: "Multiclass (mixed hit dice)",
  args: {
    current_hp: 45,
    max_hp: 62,
    temp_hp: 8,
    natural_ac: 14,
    speed_walk: 30,
    speed_fly: 0,
    hit_dice_max: 7,
    hit_dice_current: 5,
    death_successes: 0,
    death_failures: 0,
    exhaustion: 0,
    proficiency_bonus: 3,
    level: 7,
  },
  render: (_, { loaded }) => (
    <RpgBlock
      system={loaded.system}
      entity="character"
      block="health"
      yaml={`
current_hp: 45
max_hp: 62
temp_hp: 8
natural_ac: 14
portrait: [[character-portrait.webp]]
speed:
  - type: Walk
    value: 30
hit_dice:
  d10:
    max: 4
    current: 3
  d8:
    max: 3
    current: 2
death_saves:
  successes: 0
  failures: 0
exhaustion: 0
conditions:
  []
`}
      frontmatter={{
        proficiency_bonus: 3,
        level: 7,
        strength: 16,
        dexterity: 14,
        constitution: 14,
        intelligence: 12,
        wisdom: 10,
        charisma: 14,
      }}
      blocks={{
        header: `
classes:
  - name: Fighter
    level: 4
  - name: Bard
    level: 3
`,
      }}
    />
  ),
};
