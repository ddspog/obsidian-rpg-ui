import { EntityDescriptor, CharacterDecl, CompendiumLib, FeatureEntry, ResolvedView } from "rpg-ui-toolkit";
import { HeaderProps } from "../blocks/character/header.types";
import { HealthProps } from "../blocks/character/health.types";
import { StatsProps } from "../blocks/character/stats.types";
import { SensesProps } from "../blocks/character/senses.types";
import { SkillsProps } from "../blocks/character/skills.types";
import { AttacksProps } from "../blocks/character/attacks.types";
import { ProficienciesProps } from "../blocks/character/proficiencies.types";
import type { FeaturesBlockData } from "../blocks/character/features.types";
import type { SpellsProps } from "../blocks/character/spells.types";
import type { InventoryProps } from "../blocks/character/inventory.types";
import type { SheetProps } from "../blocks/character/sheet.types";

/**
 * Types for the Character Entity, defining the shape of its blocks, lookup, and expressions.
 */
export type CharacterLookup = {
  /** Set of helpful tables to help calculating stuff. */
  table: {
    /** Table of Experience Milestone to advance on Character Levels */
    xp: number[];
  };
  /** Compendium libraries (classes, subclasses, lineages, heritages, backgrounds) loaded from wiki.folder. */
  $compendium: CompendiumLib;
  /**
   * Universal character features (Dash, Disengage, Dodge, …) shared by
   * every character regardless of class. The features block renders these
   * as a compact comma-separated link list inside their bucket
   * (Action/Reaction/…), rather than as full cards — each entry lives as
   * its own page in the vault.
   */
  $defaultFeatures: FeatureEntry[];
  /**
   * Resolve features for the current character given header + recorded
   * picks. Memoised by content within a render cycle so multiple
   * consuming blocks (proficiencies, skills, stats…) share a single
   * `resolveFeatures()` call. Returns the same `ResolvedView` the
   * features block uses to render the accordion + traits bucket.
   */
  $features: (
    header: unknown,
    choices?: Record<string, Record<string, string | string[]>>,
    additional?: CharacterDecl["additional"],
    inventoryRaw?: unknown,
  ) => ResolvedView;
  /**
   * Parsed `rpg spell` fence bodies from every spell doc under
   * `worldbuilding/spells/…`, keyed by the doc's bare wikilink stem
   * (`Guidance`, `Bane`, `Cure Wounds`, …). The spells block reads this
   * to surface each picked/granted/known spell's full content (range,
   * duration, components, text, …) without re-scanning the files at
   * render time.
   */
  $spells: Record<string, Record<string, unknown>>;
  /**
   * Flat item-frontmatter lookup for the inventory block. Keyed by the
   * bare wikilink stem (`Longsword`, `Leather`, `Backpack`, …) so
   * `[[Longsword]]` in a `rpg character.inventory` items list resolves to
   * the item note's frontmatter (weight, cost, type, damage, …) without
   * the block having to round-trip through the vault at render time.
   */
  $items: Record<string, Record<string, unknown>>;
  /**
   * Compendium magic-effect templates, keyed by bare file stem (e.g.
   * `Sentinel Shield`, `Weapon, +1, +2 or +3`). Used by the inventory
   * resolver to overlay bonuses + traits onto a `rpg item.personal`'s
   * base element. See `lib/domains/items/magic-overlay.ts`.
   */
  $magic: Record<string, Record<string, unknown>>;
  /**
   * Character-owned `rpg item.personal` instances, keyed by bare file
   * stem (`Eyeshield`, `Druid Glaive`). Inventory wikilinks pointing at
   * a personal file take this resolution chain:
   * personal → base element + magic templates → effective item.
   */
  $personal: Record<string, Record<string, unknown>>;
  /**
   * World-attached `rpg item.container` stashes (Guild Chest, Kowyn's
   * Bag, party shared vaults), keyed by bare file stem. When a
   * character's inventory row targets a container file, the inventory
   * block pulls the container's own sections and renders them inline
   * so the stash is visible from the carrier's sheet.
   */
  $containers: Record<string, Record<string, unknown>>;
  /**
   * Vault paths for the container files in `$containers`, keyed by the
   * same basename. The inventory block uses these to write back to the
   * owning container's `rpg item.container` fence (via
   * `self.patchForeignBlock`) when the carrier toggles `for_sale` on
   * an item that lives inside an external stash. Missing entries fall
   * back to local-only writes.
   */
  $containerPaths: Record<string, string>;
}

/** Return types of each named expression on the character entity */
export type CharacterExpressions = {
  /** Sum of classes levels. */
  CharacterLevel: () => number;
  /** Proficiency Bonus based on Character Level. */
  ProficiencyBonus: () => number;
  /** Generic calculation for any attribute or skill modifier, given the attribute value, proficiency bonus, and any other bonuses or penalties. */
  ModifierTotal: (params: { attribute: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', proficiency: number, bonus: number }) => number;
  /** Passive value, calculated as 10 + modifier + proficiency bonus (if proficient) */
  Passive: (params: { attribute: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', proficiency: number, vantage: number, bonus: number }) => number;
};

/** Props shapes for each block in the character entity */
export type CharacterBlocks = {
  /** The Header of a Character Sheet, with defining aspects of the character. */
  header: HeaderProps;
  health: HealthProps;
  stats: StatsProps,
  senses: SensesProps,
  skills: SkillsProps,
  attacks: AttacksProps,
  proficiencies: ProficienciesProps;
  features: FeaturesBlockData;
  spells: SpellsProps;
  inventory: InventoryProps;
  /**
   * Amalgamated top-of-sheet block — header + health + stats + senses +
   * skills + attacks + proficiencies rendered from one merged YAML
   * body. Lets authors skip boilerplate empty fences for a default
   * sheet layout.
   */
  sheet: SheetProps;
  description: {
    filter?: string;
  };
};

export type CharacterEntity = EntityDescriptor<CharacterBlocks, CharacterLookup, CharacterExpressions>;
