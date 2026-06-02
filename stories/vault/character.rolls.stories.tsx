/**
 * Stories for the Tales of the Valiant character.rolls block
 *
 * Renders the rolls table via RpgBlock. Story variants demonstrate
 * different class archetypes with distinct weapon loadouts.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";
import { buildRollsYaml, buildStatsYaml, type AbilityScores, type RollDef } from "../lib/character-yaml";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/tales-of-the-valiant/config/index";

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: "Vault / Character / Rolls",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
};
export default meta;

type Story = StoryObj;

// ─── Shared render ────────────────────────────────────────────────────────────

function renderRolls(system: RPGSystem, abilities: AbilityScores, rolls: RollDef[]) {
  return (
    <RpgBlock
      system={system}
      entity="character"
      block="rolls"
      yaml={buildRollsYaml(rolls)}
      frontmatter={{ ...abilities, proficiency_bonus: 3, level: 5 }}
      blocks={{
        header: `
classes:
  - name: Fighter
    level: 5
`,
        stats: buildStatsYaml(abilities),
      }}
    />
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Fighter: Story = {
  name: "Fighter (melee + ranged)",
  render: (_args, { loaded }) =>
    renderRolls(
      loaded.system,
      { strength: 18, dexterity: 14, constitution: 16, intelligence: 10, wisdom: 12, charisma: 8 },
      [
        { name: "Longsword", to_hit: 7, range: "5 ft.", damage: { roll: "1d8+4", type: "slashing" } },
        { name: "Javelin", to_hit: 7, range: "30/120 ft.", damage: { roll: "1d6+4", type: "piercing" } },
        { name: "Shield Bash", to_hit: 7, range: "5 ft.", damage: { roll: "1d4+4", type: "bludgeoning" } },
      ]
    ),
};

export const Ranger: Story = {
  name: "Ranger (ranged focus)",
  render: (_args, { loaded }) =>
    renderRolls(
      loaded.system,
      { strength: 12, dexterity: 18, constitution: 14, intelligence: 10, wisdom: 16, charisma: 8 },
      [
        { name: "Longbow", to_hit: 7, range: "150/600 ft.", damage: { roll: "1d8+4", type: "piercing" } },
        { name: "Shortsword", to_hit: 7, range: "5 ft.", damage: { roll: "1d6+4", type: "piercing" } },
      ]
    ),
};

export const Monk: Story = {
  name: "Monk (unarmed + simple)",
  render: (_args, { loaded }) =>
    renderRolls(
      loaded.system,
      { strength: 10, dexterity: 18, constitution: 14, intelligence: 10, wisdom: 16, charisma: 8 },
      [
        { name: "Unarmed Strike", to_hit: 7, range: "5 ft.", damage: { roll: "1d6+4", type: "bludgeoning" } },
        { name: "Quarterstaff", to_hit: 7, range: "5 ft.", damage: { roll: "1d8+4", type: "bludgeoning" } },
        { name: "Dart", to_hit: 7, range: "20/60 ft.", damage: { roll: "1d4+4", type: "piercing" } },
      ]
    ),
};
