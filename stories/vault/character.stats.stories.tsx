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
import { system as systemPromise } from "../../vault/tales-of-the-valiant/config/index";

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
  dot_padding: number;
  dot_inset: number;
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
    strength: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Strength" },
    dexterity: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Dexterity" },
    constitution: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Constitution" },
    intelligence: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Intelligence" },
    wisdom: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Wisdom" },
    charisma: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Charisma" },
    str_save_prof: { control: { type: "range", min: 0, max: 2, step: 0.5 }, name: "STR Save Proficiency" },
    dex_save_prof: { control: { type: "range", min: 0, max: 2, step: 0.5 }, name: "DEX Save Proficiency" },
    con_save_prof: { control: { type: "range", min: 0, max: 2, step: 0.5 }, name: "CON Save Proficiency" },
    int_save_prof: { control: { type: "range", min: 0, max: 2, step: 0.5 }, name: "INT Save Proficiency" },
    wis_save_prof: { control: { type: "range", min: 0, max: 2, step: 0.5 }, name: "WIS Save Proficiency" },
    cha_save_prof: { control: { type: "range", min: 0, max: 2, step: 0.5 }, name: "CHA Save Proficiency" },
    proficiency_bonus: { control: { type: "number" }, name: "Proficiency Bonus" },
    level: { control: { type: "number" }, name: "Level" },
    dot_padding: { control: { type: "range", min: 0, max: 60, step: 4 }, name: "Dot Padding (px)" },
    dot_inset: { control: { type: "range", min: 0, max: 40, step: 2 }, name: "Dot Inset (px)" },
  },
};
export default meta;

type Story = StoryObj<StatsArgs>;

// ─── Shared render ────────────────────────────────────────────────────────────

function renderStats(args: StatsArgs, system: RPGSystem) {
  return (
    <div
      style={{
        ["--rpg-stats-dot-padding" as string]: `${args.dot_padding}px`,
        ["--rpg-stats-dot-inset" as string]: `${args.dot_inset}px`,
      }}
    >
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
        blocks={{
          header: `
classes:
  - name: Fighter
    level: ${args.level}
`,
        }}
      />
    </div>
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
    con_save_prof: 2,
    int_save_prof: 0,
    wis_save_prof: 0,
    cha_save_prof: 0,
    proficiency_bonus: 3,
    level: 5,
    dot_padding: 0,
    dot_inset: 12,
  },
  render: (args, { loaded }) => renderStats(args, loaded.system),
};

// ─── Mobile viewport ──────────────────────────────────────────────────────────

export const Mobile: Story = {
  name: "Mobile (3 per row)",
  args: Default.args,
  render: (args, { loaded }) => <div style={{ maxWidth: 400 }}>{renderStats(args, loaded.system)}</div>,
};

// ─── Desktop viewport ────────────────────────────────────────────────────────────

export const Desktop: Story = {
  name: "Desktop (6 per row)",
  args: Default.args,
  render: (args, { loaded }) => <div style={{ maxWidth: 900 }}>{renderStats(args, loaded.system)}</div>,
};
