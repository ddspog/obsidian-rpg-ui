/**
 * Stories for the Tales of the Valiant character.stats block
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
import { system as systemPromise } from "../../vault/systems/tales-of-the-valiant/config/index";

// ─── Args type ────────────────────────────────────────────────────────────────

type StatsArgs = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  str_save_prof: number;
  dex_save_prof: number;
  con_save_prof: number;
  int_save_prof: number;
  wis_save_prof: number;
  cha_save_prof: number;
  proficiency_bonus: number;
  level: number;
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<StatsArgs> = {
  title: "Vault / Character / Stats",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
  argTypes: {
    strength:     { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Strength" },
    dexterity:    { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Dexterity" },
    constitution: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Constitution" },
    intelligence: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Intelligence" },
    wisdom:       { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Wisdom" },
    charisma:     { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Charisma" },
    str_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "STR Save Proficiency" },
    dex_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "DEX Save Proficiency" },
    con_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "CON Save Proficiency" },
    int_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "INT Save Proficiency" },
    wis_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "WIS Save Proficiency" },
    cha_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "CHA Save Proficiency" },
    proficiency_bonus: { control: { type: "number" }, name: "Proficiency Bonus" },
    level:             { control: { type: "number" }, name: "Level" },
  },
};
export default meta;

type Story = StoryObj<StatsArgs>;

// ─── Shared render ────────────────────────────────────────────────────────────

function renderStats(args: StatsArgs, system: RPGSystem) {
  return (
    <RpgBlock
      system={system}
      entity="character"
      block="stats"
      yaml={`
STR:
  value: ${args.strength}
  save:
    proficiency: ${args.str_save_prof}
    vantage: 0
    bonus: 0
DEX:
  value: ${args.dexterity}
  save:
    proficiency: ${args.dex_save_prof}
    vantage: 0
    bonus: 0
CON:
  value: ${args.constitution}
  save:
    proficiency: ${args.con_save_prof}
    vantage: 0
    bonus: 0
INT:
  value: ${args.intelligence}
  save:
    proficiency: ${args.int_save_prof}
    vantage: 0
    bonus: 0
WIS:
  value: ${args.wisdom}
  save:
    proficiency: ${args.wis_save_prof}
    vantage: 0
    bonus: 0
CHA:
  value: ${args.charisma}
  save:
    proficiency: ${args.cha_save_prof}
    vantage: 0
    bonus: 0
`}
      frontmatter={{
        proficiency_bonus: args.proficiency_bonus,
        level: args.level,
        strength: args.strength,
        dexterity: args.dexterity,
        constitution: args.constitution,
        intelligence: args.intelligence,
        wisdom: args.wisdom,
        charisma: args.charisma,
      }}
      blocks={{}}
    />
  );
}

// ─── Default state ────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default state",
  args: {
    strength: 18,
    dexterity: 14,
    constitution: 16,
    intelligence: 10,
    wisdom: 12,
    charisma: 8,
    str_save_prof: 1,
    dex_save_prof: 0,
    con_save_prof: 1,
    int_save_prof: 0,
    wis_save_prof: 0,
    cha_save_prof: 0,
    proficiency_bonus: 3,
    level: 5,
  },
  render: (args, { loaded }) => renderStats(args, loaded.system),
};
