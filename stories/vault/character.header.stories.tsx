/**
 * Stories for the Tales of the Valiant character.header block
 *
 * These stories render the full block component as it would appear in a vault
 * note, via the RpgBlock wrapper (no Obsidian dependency).
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";

// The system is a Promise<RPGSystem> — resolved in a Storybook loader.
// We import the live system definition directly from the vault config folder.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/tales-of-the-valiant/config/index";

// ─── Args type ────────────────────────────────────────────────────────────────

type HeaderArgs = {
  filename: string;
  xp: number;
  luck: number;
  banner: string;
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<HeaderArgs> = {
  title: "Vault / Character / Header",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
  argTypes: {
    filename: { control: "text", name: "Character Name" },
    banner: { control: "color", name: "Banner Color" },
    luck: { control: { type: "range", min: 0, max: 5, step: 1 }, name: "Luck" },
    xp: { control: { type: "number" }, name: "XP" },
  },
};
export default meta;

type Story = StoryObj<HeaderArgs>;

// ─── LowTier ─────────────────────────────────────────────────────────────────

export const LowTier: Story = {
  name: "Low Tier",
  args: {
    filename: "Aldric Ironveil",
    xp: 40,
    luck: 5,
    banner: "#ac8080",
  },
  render: (args, { loaded }) => (
    <RpgBlock
      system={loaded.system}
      entity="character"
      block="header"
      filename={args.filename}
      yaml={`
classes:
  - name: [[Druid]]
    level: 1
  - name: [[Ranger]]
    level: 2
lineage:
  file: [[Elf]]
heritage:
  file: [[Cosmopolitan]]
background:
  file: [[Adherent]]
xp: ${args.xp}
luck: ${args.luck}
banner: "${args.banner}"
`}
    />
  ),
};

// ─── MidTier ───────────────────────────────────────────────────────────────

export const MidTier: Story = {
  name: "Mid Tier",
  args: {
    filename: "Seraphel Voss",
    xp: 6500,
    luck: 1,
    banner: "#182030",
  },
  render: (args, { loaded }) => (
    <RpgBlock
      system={loaded.system}
      entity="character"
      block="header"
      filename={args.filename}
      yaml={`
banner: "${args.banner}"
xp: ${args.xp}
luck: ${args.luck}
classes:
  - name: [[Fighter]]
    level: 4
    subclass: Battle Master
  - name: [[Wizard]]
    level: 3
    subclass: School of Evocation
lineage:
  file: [[High Elf]]
  text: High Elf
`}
    />
  ),
};
