/**
 * Full Cleric class page — loads the real Cleric.md compendium document and
 * renders it end-to-end via the shared Obsidian-markdown renderer.
 *
 * Cleric.md interleaves prose markdown with `rpg feature.{details,choice,unlock}`
 * code blocks. ObsidianMarkdown dispatches the code blocks to the feature
 * entity renderers (so feature cards appear in situ) while rendering
 * surrounding markdown (h1/h2/h3/h4 headings, paragraphs, lists, callouts,
 * `tx` tables) directly.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { expect, within } from "storybook/test";
import { ObsidianMarkdown } from "../lib/obsidian-md-renderer";
import { classes } from "../lib/wiki-fixtures";
import type { RPGSystem } from "../../lib/systems/types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/systems/tales-of-the-valiant/config/index";

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: "Vault / Feature / Documents",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
};
export default meta;

type Story = StoryObj;

// ─── Story ────────────────────────────────────────────────────────────────────

function findClericSource(): string {
  const doc = classes.find((d) => d.$name === "Cleric");
  if (!doc) throw new Error("Cleric.md not found in classes fixtures");
  return doc.$contents ?? "";
}

export const ClericFullClassPage: Story = {
  name: "Class · Cleric (full book page)",
  render: (_args, { loaded }) => (
    <ObsidianMarkdown system={loaded.system as RPGSystem} source={findClericSource()} ariaLabel="Compendium Cleric" />
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);

    // Title + h2 sections from the markdown body
    await expect(c.getByRole("heading", { name: "Cleric", level: 1 })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Clerics as Adventurers", level: 2 })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Class Features", level: 2 })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Cleric Subclasses", level: 2 })).toBeInTheDocument();

    // Feature names rendered via feature.details (h4 inside the card)
    for (const h of [
      "Hit Points",
      "Proficiencies",
      "Starting Equipment",
      "Spellcasting",
      "Manifestation of Faith",
      "Channel Divinity",
      "Cleric Subclass",
      "Improvement",
      "Destroy the Profane",
      "Divine Intervention",
      "Heroic Boon",
      "Epic Boon",
    ]) {
      await expect(c.getByRole("heading", { name: h, level: 3 })).toBeInTheDocument();
    }

    // Subtitle overrides render verbatim
    await expect(c.getByText("10th-Level Cleric Feature")).toBeInTheDocument();
    await expect(c.getByText("2nd, 6th, 13th, and 18th-Level Cleric Feature")).toBeInTheDocument();

    // Choice options rendered via feature.choice (h5 inside each option card)
    for (const opt of [
      "Manifest Might",
      "Manifest Miracles",
      "Ability Score Boost",
      "Balanced Growth",
      "Talented Growth",
      "Gift of Consecration",
      "Gift of Wrath",
      "Divine Herald",
    ]) {
      await expect(c.getByRole("heading", { name: opt, level: 5 })).toBeInTheDocument();
    }

    // tx tables render
    await expect(c.getByText("CLERIC PROGRESSION")).toBeInTheDocument();
    await expect(c.getByText("DESTROY THE PROFANE")).toBeInTheDocument();

    // Callouts render with their titles
    await expect(c.getByText("Cleric Quick Build")).toBeInTheDocument();
    await expect(c.getByText("Clerics and Gods")).toBeInTheDocument();

    // Subclass unlock badge
    await expect(c.getByText(/Unlocks subclass at Lv\. 3/)).toBeInTheDocument();
  },
};
