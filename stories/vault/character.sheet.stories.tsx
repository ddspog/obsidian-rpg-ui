/**
 * Stories for the Tales of the Valiant character sheet (composite)
 *
 * This story renders the complete character sheet by dynamically discovering
 * and rendering all character blocks in a preferred order. As new block types
 * are added to the system, they automatically appear here.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/systems/tales-of-the-valiant/config/index";

// ─── Args type ────────────────────────────────────────────────────────────────

type SheetArgs = {
  // Sheet args
  background: string;

  // Header args
  filename: string;
  xp: number;
  luck: number;
  banner: string;

  // Health args
  current_hp: number;
  max_hp: number;
  temp_hp: number;
  natural_ac: number;
  speed_walk: number;
  speed_fly: number;
  hit_dice_max: number;
  hit_dice_current: number;
  death_successes: number;
  death_failures: number;
  exhaustion: number;
  proficiency_bonus: number;
  level: number;

  // Stats args
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  str_save_prof: number;
  con_save_prof: number;
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<SheetArgs> = {
  title: "Vault / Character / Sheet",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
  argTypes: {
    // Sheet controls
    background: { control: "color", name: "Sheet Background" },

    // Header controls
    filename: { control: "text", name: "Character Name" },
    banner: { control: "color", name: "Banner Color" },
    luck: { control: { type: "range", min: 0, max: 5, step: 1 }, name: "Luck" },
    xp: { control: { type: "number" }, name: "XP" },

    // Stats controls
    strength: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Strength" },
    dexterity: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Dexterity" },
    constitution: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Constitution" },
    intelligence: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Intelligence" },
    wisdom: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Wisdom" },
    charisma: { control: { type: "range", min: 1, max: 20, step: 1 }, name: "Charisma" },
    str_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "STR Save Proficiency" },
    con_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "CON Save Proficiency" },

    // Health controls
    current_hp: { control: { type: "number" }, name: "Current HP" },
    max_hp: { control: { type: "number" }, name: "Max HP" },
    temp_hp: { control: { type: "number" }, name: "Temp HP" },
    natural_ac: { control: { type: "number" }, name: "Natural AC" },
    speed_walk: { control: { type: "number" }, name: "Speed Walk (ft)" },
    speed_fly: { control: { type: "number" }, name: "Speed Fly (ft)" },
    hit_dice_max: { control: { type: "number" }, name: "Hit Dice (max)" },
    hit_dice_current: { control: { type: "number" }, name: "Hit Dice (current)" },
    death_successes: { control: { type: "range", min: 0, max: 3, step: 1 }, name: "Death Save Successes" },
    death_failures: { control: { type: "range", min: 0, max: 3, step: 1 }, name: "Death Save Failures" },
    exhaustion: { control: { type: "range", min: 0, max: 6, step: 1 }, name: "Exhaustion" },
    proficiency_bonus: { control: { type: "number" }, name: "Proficiency Bonus" },
    level: { control: { type: "number" }, name: "Level" },
  },
};
export default meta;

type Story = StoryObj<SheetArgs>;

// ─── Block ordering ───────────────────────────────────────────────────────────

/**
 * Preferred order for character sheet blocks. Blocks not in this list will
 * appear at the end in alphabetical order.
 */
const PREFERRED_BLOCK_ORDER = ["header", "health", "stats"];

function getOrderedBlocks(system: RPGSystem): string[] {
  const entityDef = (system.entities as Record<string, any>)?.character;
  const allBlocks = Object.keys(entityDef?.blocks ?? {});

  // Sort: preferred blocks first in order, then remaining blocks alphabetically
  const ordered: string[] = [];
  for (const blockName of PREFERRED_BLOCK_ORDER) {
    if (allBlocks.includes(blockName)) {
      ordered.push(blockName);
    }
  }
  const remaining = allBlocks.filter((b) => !PREFERRED_BLOCK_ORDER.includes(b)).sort();
  return [...ordered, ...remaining];
}

// ─── Shared render ────────────────────────────────────────────────────────────

function buildBlocksYaml(args: SheetArgs): Record<string, string> {
  const blocksYaml: Record<string, string> = {};

  // Header YAML
  blocksYaml.header = `
classes:
  - name: [[Fighter]]
    level: ${args.level}
lineage:
  file: [[High Elf]]
  text: High Elf
banner: "${args.banner}"
xp: ${args.xp}
luck: ${args.luck}
`;

  // Health YAML
  const speedEntries = [`  - type: Walk\n    value: ${args.speed_walk}`];
  if (args.speed_fly > 0) {
    speedEntries.push(`  - type: Fly\n    value: ${args.speed_fly}`);
  }

  blocksYaml.health = `
current_hp: ${args.current_hp}
max_hp: ${args.max_hp}
temp_hp: ${args.temp_hp}
natural_ac: ${args.natural_ac}
portrait: [[character-portrait.webp]]
speed:
${speedEntries.join("\n")}
hit_dice:
  d10:
    max: ${args.hit_dice_max}
    current: ${args.hit_dice_current}
death_saves:
  successes: ${args.death_successes}
  failures: ${args.death_failures}
exhaustion: ${args.exhaustion}
conditions:
  - "[[Poisoned]]"
  - "[[Frightened]]"
`;

  // Stats YAML
  blocksYaml.stats = `
STR:
  value: ${args.strength}
  save:
    proficiency: ${args.str_save_prof}
    vantage: 0
    bonus: 0
DEX:
  value: ${args.dexterity}
  save:
    proficiency: 0
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
    proficiency: 0
    vantage: 0
    bonus: 0
WIS:
  value: ${args.wisdom}
  save:
    proficiency: 0
    vantage: 0
    bonus: 0
CHA:
  value: ${args.charisma}
  save:
    proficiency: 0
    vantage: 0
    bonus: 0
`;

  return blocksYaml;
}

function renderSheet(args: SheetArgs, system: RPGSystem) {
  const orderedBlocks = getOrderedBlocks(system);
  const blocksYaml = buildBlocksYaml(args);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: args.background }}>
      {orderedBlocks.map((blockName) => (
        <SheetBlock key={blockName} blockName={blockName} args={args} system={system} blocksYaml={blocksYaml} />
      ))}
    </div>
  );
}

// ─── Individual block renderer ─────────────────────────────────────────────────

interface SheetBlockProps {
  blockName: string;
  args: SheetArgs;
  system: RPGSystem;
  blocksYaml: Record<string, string>;
}

function SheetBlock({ blockName, args, system, blocksYaml }: SheetBlockProps): React.ReactNode {
  const yaml = blocksYaml[blockName] || "";

  if (!yaml) {
    return null;
  }

  return (
    <RpgBlock
      system={system}
      entity="character"
      block={blockName}
      filename={args.filename}
      yaml={yaml}
      blocks={blocksYaml}
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
    />
  );
}

// ─── Default state ────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default state",
  args: {
    // Sheet
    background: "#1e1e1e",

    // Header
    filename: "Aldric Ironveil",
    xp: 6500,
    luck: 3,
    banner: "#ac8080",

    // Stats
    strength: 18,
    dexterity: 14,
    constitution: 16,
    intelligence: 10,
    wisdom: 12,
    charisma: 8,
    str_save_prof: 1,
    con_save_prof: 1,

    // Health
    current_hp: 32,
    max_hp: 58,
    temp_hp: 5,
    natural_ac: 16,
    speed_walk: 30,
    speed_fly: 0,
    hit_dice_max: 5,
    hit_dice_current: 4,
    death_successes: 0,
    death_failures: 0,
    exhaustion: 0,
    proficiency_bonus: 3,
    level: 5,
  },
  render: (args, { loaded }) => renderSheet(args, loaded.system),
};
