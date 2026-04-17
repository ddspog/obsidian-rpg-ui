/**
 * Stories for the Tales of the Valiant character.features block
 *
 * Renders Traits grouped by source (class, lineage, heritage, background)
 * via the declarative compendium → resolver → block pipeline. Each story
 * seeds a sibling `header` block fixture; the features block reads
 * class/level/lineage/heritage/background from `blocks.header` and only
 * carries the `choices` map.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { expect, within } from "storybook/test";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";
import { buildHeaderYaml, buildFeaturesYaml, type HeaderFixture } from "../lib/feature-fixtures";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/systems/tales-of-the-valiant/config/index";

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: "Vault / Character / Features",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
};
export default meta;

type Story = StoryObj;

// ─── Shared render ────────────────────────────────────────────────────────────

function renderFeatures(
  system: RPGSystem,
  header: HeaderFixture,
  choices: Record<string, Record<string, string | string[]>> = {},
) {
  const headerYaml = buildHeaderYaml(header);
  const featuresYaml = buildFeaturesYaml(choices);
  return (
    <RpgBlock
      system={system}
      entity="character"
      block="features"
      yaml={featuresYaml}
      blocks={{
        header: headerYaml,
        features: featuresYaml,
      }}
    />
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Lv1Cleric: Story = {
  name: "Cleric Lv 1 (all choices resolved)",
  render: (_args, { loaded }) =>
    renderFeatures(
      loaded.system,
      {
        classes: [{ name: "Cleric", level: 1 }],
        lineage: "Human",
        heritage: "Great House",
        background: "Adherent",
      },
      {
        Cleric: {
          "Skill Proficiencies": ["Medicine", "Insight"],
          "Divine Order": "Protector",
        },
        Human: { "Skill Versatility": ["Stealth"] },
        "Great House": { Language: "Dwarvish" },
        Adherent: { "Background Skills": ["Investigation", "Religion"] },
      },
    ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Cleric")).toBeInTheDocument();
    await expect(c.getByText("Human")).toBeInTheDocument();
    await expect(c.getByText("Great House")).toBeInTheDocument();
    await expect(c.getByText("Adherent")).toBeInTheDocument();
    // Picked skill proficiency surfaces as a tagged grant
    await expect(c.getByText("+Medicine")).toBeInTheDocument();
    await expect(c.getByText("+Insight")).toBeInTheDocument();
    // Protector picked → grants Heavy Armor and adds Manifestation of Faith
    await expect(c.getByText("+Heavy Armor")).toBeInTheDocument();
    await expect(c.getByText("Manifestation of Faith")).toBeInTheDocument();
    // No pending choices when everything is resolved
    await expect(c.queryByText("Choices to make")).not.toBeInTheDocument();
  },
};

export const LevelProgression: Story = {
  name: "Cleric Lv 3 (HP accumulates, Channel Divinity unlocked)",
  render: (_args, { loaded }) =>
    renderFeatures(
      loaded.system,
      {
        classes: [{ name: "Cleric", level: 3 }],
        lineage: "Human",
        heritage: "Great House",
        background: "Adherent",
      },
      {
        Cleric: {
          "Skill Proficiencies": ["Medicine", "Insight"],
          "Divine Order": "Thaumaturge",
        },
        Human: { "Skill Versatility": ["Perception"] },
        "Great House": { Language: "Elvish" },
        Adherent: { "Background Skills": ["Religion", "Persuasion"] },
      },
    ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // Channel Divinity becomes available at Lv 2
    await expect(c.getByText("Channel Divinity")).toBeInTheDocument();
    // Three HP grants accumulate (one per level)
    const plus8 = c.getAllByText(/\+\+8 \+CON mod/);
    await expect(plus8.length).toBeGreaterThanOrEqual(1);
    // Thaumaturge grants Extra Cantrip via nested feature
    await expect(c.getByText("Extra Cantrip")).toBeInTheDocument();
  },
};

export const PendingChoices: Story = {
  name: "Cleric Lv 1 (Skill Proficiencies unresolved)",
  render: (_args, { loaded }) =>
    renderFeatures(
      loaded.system,
      {
        classes: [{ name: "Cleric", level: 1 }],
        lineage: "Human",
        heritage: "Great House",
        background: "Adherent",
      },
      {
        Cleric: {
          // Skill Proficiencies deliberately omitted
          "Divine Order": "Protector",
        },
        Human: { "Skill Versatility": ["Stealth"] },
        "Great House": { Language: "Dwarvish" },
        Adherent: { "Background Skills": ["Investigation", "Religion"] },
      },
    ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Choices to make")).toBeInTheDocument();
    // Pending row mentions the parent feature
    await expect(c.getByText(/pick 2 more/i)).toBeInTheDocument();
    await expect(c.getByText("Skill Proficiencies")).toBeInTheDocument();
    // Option buttons render and are not yet pressed
    const medicine = c.getByRole("button", { name: "Medicine" });
    await expect(medicine).toBeEnabled();
    await expect(medicine).toHaveAttribute("aria-pressed", "false");
  },
};

export const MulticlassFighterCleric: Story = {
  name: "Multiclass Fighter 2 / Cleric 1",
  render: (_args, { loaded }) =>
    renderFeatures(
      loaded.system,
      {
        classes: [
          { name: "Fighter", level: 2 },
          { name: "Cleric", level: 1 },
        ],
        lineage: "Human",
        heritage: "Great House",
        background: "Adherent",
      },
      {
        Fighter: { "Fighting Style": "Defense" },
        Cleric: {
          "Skill Proficiencies": ["Medicine", "Insight"],
          "Divine Order": "Protector",
        },
        Human: { "Skill Versatility": ["Acrobatics"] },
        "Great House": { Language: "Dwarvish" },
        Adherent: { "Background Skills": ["Investigation", "Religion"] },
      },
    ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // Both class groups appear
    await expect(c.getByText("Fighter")).toBeInTheDocument();
    await expect(c.getByText("Cleric")).toBeInTheDocument();
    // Fighter Lv 2 brings Action Surge
    await expect(c.getByText("Action Surge")).toBeInTheDocument();
    // Cleric Lv 1 brings Spellcasting
    await expect(c.getByText("Spellcasting")).toBeInTheDocument();
    // Picked Fighting Style: Defense
    await expect(c.getByText("+Defense")).toBeInTheDocument();
  },
};
