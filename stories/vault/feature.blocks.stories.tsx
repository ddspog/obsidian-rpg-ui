/**
 * Stories for the Tales of the Valiant `feature` entity blocks.
 *
 * The compendium provider docs (Cleric.md, Human.md, Adherent.md, …) embed
 * their per-feature data as `rpg feature.details`, `rpg feature.choice`, and
 * `rpg feature.unlock` code blocks. These stories render each block in
 * isolation so the YAML shape and rendered output stay easy to eyeball.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { expect, within } from "storybook/test";
import { stringify as stringifyYaml } from "yaml";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/systems/tales-of-the-valiant/config/index";

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: "Vault / Feature / Blocks",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
};
export default meta;

type Story = StoryObj;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderBlock(system: RPGSystem, block: "details" | "choice" | "unlock", data: Record<string, unknown>) {
  return <RpgBlock system={system} entity="feature" block={block} yaml={stringifyYaml(data)} />;
}

// ─── feature.details ──────────────────────────────────────────────────────────

export const DetailsSimpleTrait: Story = {
  name: "Details · simple trait (Hit Points)",
  render: (_args, { loaded }) =>
    renderBlock(loaded.system, "details", {
      name: "Hit Points",
      level: 1,
      text: "**Hit Dice:** 1d8 per cleric level\n\n**Hit Points at 1st Level:** 8 + your CON modifier",
      traits: { "Hit Dice": "+8 +CON mod" },
    }),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Hit Points" })).toBeInTheDocument();
    await expect(c.getByText("Lv. 1")).toBeInTheDocument();
  },
};

export const DetailsMultiTrait: Story = {
  name: "Details · multi-trait (Proficiencies)",
  render: (_args, { loaded }) =>
    renderBlock(loaded.system, "details", {
      name: "Proficiencies",
      level: 1,
      text: "**Armor:** Light, Medium, Shields\n\n**Saves:** WIS, CHA",
      traits: {
        "Armor Proficiency": "Light, Medium, Shields",
        "Saving Throws": "WIS, CHA",
      },
    }),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Proficiencies" })).toBeInTheDocument();
  },
};

export const DetailsChoiceSlot: Story = {
  name: "Details · choice slot (Manifestation of Faith, pick 1)",
  render: (_args, { loaded }) =>
    renderBlock(loaded.system, "details", {
      name: "Manifestation of Faith",
      subtitle: "1st-Level Cleric Feature",
      level: 1,
      pick: 1,
      text: "Clerics demonstrate their faith in one of two primary ways.",
    }),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Manifestation of Faith" })).toBeInTheDocument();
    await expect(c.getByText("1st-Level Cleric Feature")).toBeInTheDocument();
  },
};

export const DetailsDescriptiveFeature: Story = {
  name: "Details · descriptive feature (Spellcasting)",
  render: (_args, { loaded }) =>
    renderBlock(loaded.system, "details", {
      name: "Spellcasting",
      subtitle: "1st-Level Cleric Feature",
      type: "passive",
      level: 1,
      link: "[[Spellcasting]]",
      text: "As a conduit for divine power, you can cast cleric spells.",
    }),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Spellcasting" })).toBeInTheDocument();
    await expect(c.getByText("1st-Level Cleric Feature")).toBeInTheDocument();
    await expect(c.getByRole("link", { name: "Spellcasting" })).toBeInTheDocument();
  },
};

export const DetailsLimitedUses: Story = {
  name: "Details · limited uses (Channel Divinity)",
  render: (_args, { loaded }) =>
    renderBlock(loaded.system, "details", {
      name: "Channel Divinity",
      subtitle: "2nd-Level Cleric Feature",
      type: "free_action",
      level: 2,
      uses: 1,
      link: "[[Channel Divinity]]",
      text: "Channel divine energy directly from your deity.",
    }),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("2nd-Level Cleric Feature")).toBeInTheDocument();
  },
};

// ─── feature.choice ───────────────────────────────────────────────────────────

export const ChoiceSimpleValue: Story = {
  name: "Choice · simple value (Skill: Medicine)",
  render: (_args, { loaded }) =>
    renderBlock(loaded.system, "choice", {
      parent: "Skill Proficiencies",
      name: "Medicine",
      traits: { "Skill Proficiency": "+Medicine" },
    }),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Medicine" })).toBeInTheDocument();
    await expect(c.getByText("→ Skill Proficiencies")).toBeInTheDocument();
  },
};

export const ChoiceRichOption: Story = {
  name: "Choice · rich option (Manifest Might)",
  render: (_args, { loaded }) =>
    renderBlock(loaded.system, "choice", {
      parent: "Manifestation of Faith",
      name: "Manifest Might",
      text: "**_Manifest Might._** You gain proficiency with [[Heavy Armor]] and one type of [[Martial]] weapon of your choice.",
      traits: {
        "Armor Proficiency": "+Heavy Armor",
        "Weapon Proficiency": "+1 Martial weapon",
      },
    }),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Manifest Might" })).toBeInTheDocument();
    await expect(c.getByText("→ Manifestation of Faith")).toBeInTheDocument();
  },
};

export const ChoiceWithSubFeatures: Story = {
  name: "Choice · sub-features (Divine Order: Thaumaturge)",
  render: (_args, { loaded }) =>
    renderBlock(loaded.system, "choice", {
      parent: "Divine Order",
      name: "Thaumaturge",
      text: "Gain an additional cantrip and a damaging spell.",
      features: [
        {
          name: "Extra Cantrip",
          type: "passive",
          text: "Learn one additional cleric cantrip.",
        },
      ],
    }),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Thaumaturge" })).toBeInTheDocument();
    await expect(c.getByText("Extra Cantrip")).toBeInTheDocument();
  },
};

// ─── feature.unlock ───────────────────────────────────────────────────────────

export const UnlockSubclassAtLv3: Story = {
  name: "Unlock · subclass at Lv 3",
  render: (_args, { loaded }) =>
    renderBlock(loaded.system, "unlock", {
      kind: "subclass",
      level: 3,
    }),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/Unlocks subclass at Lv\. 3/)).toBeInTheDocument();
  },
};
