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
import { expect, userEvent, within, waitFor } from "storybook/test";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";
import { buildHeaderYaml, buildFeaturesYaml, type HeaderFixture } from "../lib/feature-fixtures";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/tales-of-the-valiant/config/index";

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
  choices: Record<string, Record<string, string | string[]>> = {}
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
        Cleric: { "Manifestation of Faith": "Manifest Might" },
        Human: { "Skill Versatility": ["Stealth"] },
        "Great House": { Language: "Dwarvish" },
        Adherent: { "Background Skills": ["Investigation", "Religion"] },
      }
    ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Cleric")).toBeInTheDocument();
    await expect(c.getByText("Human")).toBeInTheDocument();
    await expect(c.getByText("Great House")).toBeInTheDocument();
    await expect(c.getByText("Adherent")).toBeInTheDocument();
    // Manifest Might picked → its `Armor Proficiency: +Heavy Armor` trait
    // is aggregated into the top Traits section.
    await expect(c.getByText("Armor Proficiency")).toBeInTheDocument();
    await expect(c.getByText(/\+Heavy Armor/)).toBeInTheDocument();
    // Cleric Lv 1 brings Spellcasting in the source list
    await expect(c.getByText("Spellcasting")).toBeInTheDocument();
    // No pending choices when everything is resolved
    await expect(c.queryByText("Choices to make")).not.toBeInTheDocument();
  },
};

export const LevelProgression: Story = {
  name: "Cleric Lv 3 (Channel Divinity + Cleric Subclass unlocked)",
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
        Cleric: { "Manifestation of Faith": "Manifest Miracles" },
        Human: { "Skill Versatility": ["Perception"] },
        "Great House": { Language: "Elvish" },
        Adherent: { "Background Skills": ["Religion", "Persuasion"] },
      }
    ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // Channel Divinity becomes available at Lv 2
    await expect(c.getByText("Channel Divinity")).toBeInTheDocument();
    // Hit Dice trait is aggregated at the top
    await expect(c.getByText("Hit Dice")).toBeInTheDocument();
    // Cleric Subclass unlocks at Lv 3
    await expect(c.getByText("Cleric Subclass")).toBeInTheDocument();
  },
};

export const PendingChoices: Story = {
  name: "Cleric Lv 1 (Manifestation of Faith unresolved)",
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
          // Manifestation of Faith deliberately omitted
        },
        Human: { "Skill Versatility": ["Stealth"] },
        "Great House": { Language: "Dwarvish" },
        Adherent: { "Background Skills": ["Investigation", "Religion"] },
      }
    ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Choices to make")).toBeInTheDocument();
    // Pending row mentions the parent feature
    await expect(c.getByText(/pick 1 more/i)).toBeInTheDocument();
    await expect(c.getAllByText("Manifestation of Faith").length).toBeGreaterThan(0);
    // Option buttons render and are not yet pressed
    const might = c.getByRole("button", { name: "Manifest Might" });
    await expect(might).toBeEnabled();
    await expect(might).toHaveAttribute("aria-pressed", "false");

    // Pick one option → the pending row disappears.
    await userEvent.click(might);
    await waitFor(async () => {
      await expect(c.queryByText("Choices to make")).not.toBeInTheDocument();
    });
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
        Cleric: { "Manifestation of Faith": "Manifest Might" },
        Human: { "Skill Versatility": ["Acrobatics"] },
        "Great House": { Language: "Dwarvish" },
        Adherent: { "Background Skills": ["Investigation", "Religion"] },
      }
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
    // Picked Fighting Style: Defense → traits AC +1
    await expect(c.getByText(/\+1 \(while wearing armor\)/)).toBeInTheDocument();
  },
};
