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
import { buildAttacksYaml, buildFeaturesYaml, buildProficienciesYaml, buildSkillsYaml, buildStatsYaml, type AbilityScores } from "../lib/character-yaml";

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
  wis_save_prof: number;
  cha_save_prof: number;
  dot_padding: number;
  dot_inset: number;

  // Senses / Skills args
  perception_prof: number;
  insight_prof: number;
  investigation_prof: number;
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
    wis_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "WIS Save Proficiency" },
    cha_save_prof: { control: { type: "range", min: 0, max: 1, step: 1 }, name: "CHA Save Proficiency" },
    dot_padding: { control: { type: "range", min: 0, max: 60, step: 4 }, name: "Dot Padding (px)" },
    dot_inset: { control: { type: "range", min: 0, max: 40, step: 2 }, name: "Dot Inset (px)" },

    // Senses / Skills controls
    perception_prof:    { control: { type: "range", min: 0, max: 2, step: 1 }, name: "Perception Prof." },
    insight_prof:       { control: { type: "range", min: 0, max: 2, step: 1 }, name: "Insight Prof." },
    investigation_prof: { control: { type: "range", min: 0, max: 2, step: 1 }, name: "Investigation Prof." },

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
const PREFERRED_BLOCK_ORDER = ["header", "health", "stats", "senses", "skills", "attacks", "proficiencies", "features"];

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
  - name: [[Cleric]]
    level: ${args.level}
lineage:
  file: [[Human]]
heritage:
  file: [[Great House]]
background:
  file: [[Adherent]]
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
portrait: [[cleric-harold-davies.webp]]
speed:
${speedEntries.join("\n")}
hit_dice:
  d8:
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
  const abilities: AbilityScores = {
    strength: args.strength,
    dexterity: args.dexterity,
    constitution: args.constitution,
    intelligence: args.intelligence,
    wisdom: args.wisdom,
    charisma: args.charisma,
  };
  blocksYaml.stats = buildStatsYaml(abilities, {
    str: args.str_save_prof,
    con: args.con_save_prof,
    wis: args.wis_save_prof,
    cha: args.cha_save_prof,
  });

  // Skills YAML — auto-derived from the resolved features view (`Skill P.`
  // trait). Set fields under `additional:` here to promote a skill beyond
  // what the traits granted. A non-empty stub keeps the sheet's per-block
  // early return from skipping the render.
  blocksYaml.skills = `additional: {}\n`;

  // Senses YAML (Human has no special senses)
  blocksYaml.senses = `senses_list: []
`;

  // Attacks YAML
  blocksYaml.attacks = buildAttacksYaml([
    { name: "Longsword", to_hit: 7, range: "5 ft.", damage: { roll: "1d8+4", type: "slashing" } },
    { name: "Javelin", to_hit: 7, range: "30/120 ft.", damage: { roll: "1d6+4", type: "piercing" } },
  ]);

  // Proficiencies YAML — no explicit lists, so the block auto-derives from
  // the resolved feature traits (Armor / Weapon Proficiency / Tool P. /
  // Languages). The empty `additional:` map is a non-empty stub so the
  // sheet's per-block early return doesn't skip rendering — set fields here
  // to append homebrew entries on top of the auto-derived lists.
  blocksYaml.proficiencies = `additional: {}\n`;

  // Features YAML — resolver pulls Cleric features from the compendium based
  // on the header's declared class; the per-source feature list lives there,
  // so this block just carries any pending-choice picks and spent-use state.
  // Both keys are seeded empty so Storybook's RpgBlock generates matching
  // `setChoices` / `setSpent` setters from self.
  blocksYaml.features = `choices: {}
spent: {}
`;

  return blocksYaml;
}

function renderSheet(args: SheetArgs, system: RPGSystem) {
  const orderedBlocks = getOrderedBlocks(system);
  const blocksYaml = buildBlocksYaml(args);

  return <Sheet args={args} system={system} orderedBlocks={orderedBlocks} blocksYaml={blocksYaml} />;
}

function Sheet({
  args,
  system,
  orderedBlocks,
  blocksYaml,
}: {
  args: SheetArgs;
  system: RPGSystem;
  orderedBlocks: string[];
  blocksYaml: Record<string, string>;
}) {
  // Shared state container so a pick made in one block (e.g. the features
  // block's `setChoices`) propagates into every sibling block's `blocks`
  // prop on the next render. Each block seeds itself from its initial YAML
  // on first mount, then bubbles state changes up via `onBlockSelfChange`.
  const [sharedBlocks, setSharedBlocks] = React.useState<Record<string, Record<string, unknown>>>({});
  const handleBlockSelfChange = React.useCallback(
    (name: string, next: Record<string, unknown>) => {
      setSharedBlocks((prev) => {
        if (prev[name] === next) return prev;
        return { ...prev, [name]: next };
      });
    },
    [],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        background: args.background,
        ["--rpg-stats-dot-padding" as string]: `${args.dot_padding}px`,
        ["--rpg-stats-dot-inset" as string]: `${args.dot_inset}px`,
      }}
    >
      {orderedBlocks.map((blockName) => (
        <SheetBlock
          key={blockName}
          blockName={blockName}
          args={args}
          system={system}
          blocksYaml={blocksYaml}
          sharedBlocks={sharedBlocks}
          onBlockSelfChange={handleBlockSelfChange}
        />
      ))}
    </div>
  );
}

// ─── Individual block renderer ─────────────────────────────────────────────────

/** User-authored headings that appear before certain blocks (simulates Obsidian note content) */
const BLOCK_HEADINGS: Record<string, string> = {
  features: "Features",
};

interface SheetBlockProps {
  blockName: string;
  args: SheetArgs;
  system: RPGSystem;
  blocksYaml: Record<string, string>;
  sharedBlocks: Record<string, Record<string, unknown>>;
  onBlockSelfChange: (name: string, next: Record<string, unknown>) => void;
}

function SheetBlock({ blockName, args, system, blocksYaml, sharedBlocks, onBlockSelfChange }: SheetBlockProps): React.ReactNode {
  const yaml = blocksYaml[blockName] || "";

  if (!yaml) {
    return null;
  }

  const heading = BLOCK_HEADINGS[blockName];

  return (
    <>
      {heading && <h2 style={{ margin: "1em 0 0.25em" }}>{heading}</h2>}
      <RpgBlock
      system={system}
      entity="character"
      block={blockName}
      filename={args.filename}
      yaml={yaml}
      blocks={blocksYaml}
      sharedBlocks={sharedBlocks}
      onBlockSelfChange={onBlockSelfChange}
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
    </>
  );
}

// ─── Default state ────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default state",
  args: {
    // Sheet
    background: "transparent",

    // Header
    filename: "Jacqui Ilitul",
    xp: 6500,
    luck: 3,
    banner: "#ac8080",

    // Stats
    strength: 14,
    dexterity: 11,
    constitution: 12,
    intelligence: 8,
    wisdom: 18,
    charisma: 10,
    str_save_prof: 0,
    con_save_prof: 0,
    wis_save_prof: 1,
    cha_save_prof: 1,
    dot_padding: 4,
    dot_inset: 18,

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

    // Senses / Skills
    perception_prof: 1,
    insight_prof: 0,
    investigation_prof: 0,
  },
  render: (args, { loaded }) => renderSheet(args, loaded.system),
};
