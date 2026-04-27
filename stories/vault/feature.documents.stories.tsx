/**
 * Stories for full Tales of the Valiant compendium provider documents.
 *
 * Each story walks the source markdown (Cleric.md, Human.md, …) and renders
 * every embedded `rpg feature.{details,choice,unlock}` block in document
 * order. This mirrors what an Obsidian reader sees when opening one of these
 * notes — useful for previewing layout changes to the feature card renderers.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { expect, within } from "storybook/test";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";
import {
  backgrounds,
  classes,
  heritages,
  lineages,
  subclasses,
  type CompendiumRaw,
} from "../lib/wiki-fixtures";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FeatureBlockKind = "details" | "choice" | "unlock";

interface ParsedBlock {
  kind: FeatureBlockKind;
  yaml: string;
}

/**
 * Pull every `rpg feature.<kind>` fence out of a markdown body, preserving the
 * order in which they appear so the rendered output matches the source doc.
 */
function extractFeatureBlocks(body: string): ParsedBlock[] {
  const re = /```rpg feature\.(details|choice|unlock)\n([\s\S]*?)```/g;
  const out: ParsedBlock[] = [];
  for (const m of body.matchAll(re)) {
    out.push({ kind: m[1] as FeatureBlockKind, yaml: m[2].trim() });
  }
  return out;
}

function findDoc(pool: CompendiumRaw[], name: string): CompendiumRaw {
  const doc = pool.find((d) => d.$name === name);
  if (!doc) throw new Error(`Compendium doc "${name}" not found in fixtures`);
  return doc;
}

function renderDocument(system: RPGSystem, doc: CompendiumRaw) {
  const blocks = extractFeatureBlocks(doc.$contents ?? "");
  return (
    <article aria-label={`Compendium ${doc.$name}`}>
      <h2>{doc.$name}</h2>
      {blocks.map((b, i) => (
        <RpgBlock
          key={`${b.kind}-${i}`}
          system={system}
          entity="feature"
          block={b.kind}
          yaml={b.yaml}
        />
      ))}
    </article>
  );
}

// ─── Class documents ──────────────────────────────────────────────────────────

// Note: Cleric is intentionally not represented here — its compendium doc
// stores its feature data in `.features` frontmatter and renders its body as
// pure markdown. See `cleric.page.stories.tsx` for the full-page preview.

export const FighterDocument: Story = {
  name: "Class · Fighter",
  render: (_args, { loaded }) => renderDocument(loaded.system, findDoc(classes, "Fighter")),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Fighter" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Fighting Style" })).toBeInTheDocument();
    // Three Fighting Style options
    await expect(c.getByRole("heading", { name: "Defense" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Dueling" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Great Weapon Fighting" })).toBeInTheDocument();
    // Lv 2 Action Surge
    await expect(c.getByRole("heading", { name: "Action Surge" })).toBeInTheDocument();
    await expect(c.getByText(/Unlocks subclass at Lv\. 3/)).toBeInTheDocument();
  },
};

// ─── Subclass document ────────────────────────────────────────────────────────

export const LifeDomainDocument: Story = {
  name: "Subclass · Life Domain",
  render: (_args, { loaded }) =>
    renderDocument(loaded.system, findDoc(subclasses, "Life Domain")),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Life Domain" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Disciple of Life" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Bonus Proficiency" })).toBeInTheDocument();
  },
};

// ─── Lineage document ─────────────────────────────────────────────────────────

export const HumanDocument: Story = {
  name: "Lineage · Human",
  render: (_args, { loaded }) => renderDocument(loaded.system, findDoc(lineages, "Human")),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Human" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Speed" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Skill Versatility" })).toBeInTheDocument();
    // Choice options
    await expect(c.getByRole("heading", { name: "Acrobatics" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Stealth" })).toBeInTheDocument();
  },
};

// ─── Heritage document ────────────────────────────────────────────────────────

export const GreatHouseDocument: Story = {
  name: "Heritage · Great House",
  render: (_args, { loaded }) =>
    renderDocument(loaded.system, findDoc(heritages, "Great House")),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Great House" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Noble Connections" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Language" })).toBeInTheDocument();
    // Language choices
    await expect(c.getByRole("heading", { name: "Dwarvish" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Celestial" })).toBeInTheDocument();
  },
};

// ─── Background document ──────────────────────────────────────────────────────

export const AdherentDocument: Story = {
  name: "Background · Adherent",
  render: (_args, { loaded }) =>
    renderDocument(loaded.system, findDoc(backgrounds, "Adherent")),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Adherent" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Talent" })).toBeInTheDocument();
    await expect(c.getByText("Devout")).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Background Skills" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Tool Proficiency" })).toBeInTheDocument();
    await expect(c.getByText("Calligrapher's Supplies")).toBeInTheDocument();
  },
};
