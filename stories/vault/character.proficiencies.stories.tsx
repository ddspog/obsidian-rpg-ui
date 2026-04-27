/**
 * Stories for the Tales of the Valiant character.proficiencies block
 *
 * Renders the proficiencies definition list via RpgBlock. Story variants
 * demonstrate different class archetypes with distinct proficiency sets.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";
import { buildProficienciesYaml, buildStatsYaml, type AbilityScores } from "../lib/character-yaml";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/systems/tales-of-the-valiant/config/index";

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: "Vault / Character / Proficiencies",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
};
export default meta;

type Story = StoryObj;

// ─── Shared render ────────────────────────────────────────────────────────────

function renderProficiencies(
  system: RPGSystem,
  abilities: AbilityScores,
  profs: { armor?: string[]; weapons?: string[]; tools?: string[]; languages?: string[] },
) {
  return (
    <RpgBlock
      system={system}
      entity="character"
      block="proficiencies"
      yaml={buildProficienciesYaml(profs)}
      frontmatter={{ ...abilities, proficiency_bonus: 3, level: 5 }}
      blocks={{
        header: `
classes:
  - name: Fighter
    level: 5
`,
        stats: buildStatsYaml(abilities),
        proficiencies: buildProficienciesYaml(profs),
      }}
    />
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Fighter: Story = {
  name: "Fighter (heavy armor + martial)",
  render: (_args, { loaded }) =>
    renderProficiencies(
      loaded.system,
      { strength: 18, dexterity: 14, constitution: 16, intelligence: 10, wisdom: 12, charisma: 8 },
      {
        armor: ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"],
        weapons: ["Simple Weapons", "Martial Weapons"],
        tools: ["Smith's Tools"],
        languages: ["Common", "Dwarvish"],
      },
    ),
};

export const Rogue: Story = {
  name: "Rogue (light armor + finesse)",
  render: (_args, { loaded }) =>
    renderProficiencies(
      loaded.system,
      { strength: 10, dexterity: 18, constitution: 14, intelligence: 12, wisdom: 10, charisma: 14 },
      {
        armor: ["Light Armor"],
        weapons: ["Simple Weapons", "Hand Crossbows", "Longswords", "Rapiers", "Shortswords"],
        tools: ["Thieves' Tools"],
        languages: ["Common", "Thieves' Cant"],
      },
    ),
};

export const Wizard: Story = {
  name: "Wizard (minimal gear)",
  render: (_args, { loaded }) =>
    renderProficiencies(
      loaded.system,
      { strength: 8, dexterity: 14, constitution: 14, intelligence: 18, wisdom: 12, charisma: 10 },
      {
        armor: [],
        weapons: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light Crossbows"],
        tools: [],
        languages: ["Common", "Elvish", "Draconic"],
      },
    ),
};
