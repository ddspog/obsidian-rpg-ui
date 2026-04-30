/**
 * Declarative feature import — type definitions.
 *
 * Pure types for compendium-driven character feature resolution.
 * No Obsidian / vault dependencies; safe to import from tests and the resolver.
 */

import type { TableDef } from "../tables/types";

// ─── Source-document blocks ───────────────────────────────────────────────────

/**
 * Mapping of trait group → contribution. The character sheet aggregates
 * traits across all loaded features by key.
 *
 * A value can be a single string (`"+8 +CON mod"`) or a string array
 * (`["[[Light Armor]]", "[[Medium Armor]]"]`) when a feature contributes
 * multiple discrete entries to the same group. YAML wikilinks (`[[X]]`)
 * authored without quotes parse as nested arrays — the resolver normalises
 * those back to `"[[X]]"` strings so the rendered output keeps the link.
 */
export type TraitValue = string | string[];
export type TraitMap = Record<string, TraitValue>;

/**
 * Inline pick spec on a `feature.details` block. Each picked option is added
 * verbatim as a value to the named trait `category`. No separate
 * `feature.choice` blocks needed — handy for simple "pick N from list"
 * features like proficiency choices.
 */
export interface ChooseSpec {
  type: "traits";
  category: string;
  number: number;
  options: string[];
}

/**
 * A `feature.level` block: extra contributions applied to the preceding
 * `feature.details` once the character reaches the specified class level.
 * Data-only — renders no visible UI in the compendium doc.
 */
export interface FeatureLevelAddition {
  level: number;
  traits?: TraitMap;
}

/**
 * One feature, parsed from a `rpg feature.details` code block.
 *
 * If `pick` is set, the feature is a choice slot — its options come from
 * `feature.choice` blocks that declare `parent: <this name>`.
 *
 * If `choose` is set, the feature offers an inline pick that aggregates
 * picked values into a named trait category.
 *
 * `text` is multiline Obsidian markdown rendered as the body of the feature
 * card; the surrounding compendium prose is folded into this field.
 * `traits` describe the contributions this feature makes to a character
 * sheet's aggregated traits row.
 */
/**
 * A single aspect of a feature. Authored as a sub-object under one of the
 * recognised aspect keys (`action`, `bonus`, `reaction`, `active`, `passive`,
 * `resource`) on `FeatureDetails`. When present, each aspect produces its
 * own entry in the character sheet's type-grouped accordion, with the
 * aspect's `text` shown on the card instead of the parent feature's full
 * compendium prose.
 */
export interface FeatureAspect {
  /** Aspect-specific name, overrides the parent feature's name in the bucket. */
  name?: string;
  /** Aspect card text on the character sheet. Falls back to parent `text`. */
  text?: string;
  /** Name of a resource feature this aspect consumes (by-name reference). */
  resource?: string;
  /** Pool max when the aspect is itself a resource. Scalar or per-level map. */
  max?: number | Record<number, number>;
  /** Free-form recovery cadence ("short rest", "1/long rest", …). */
  recovery?: string;
  /** Inline cooldown within a single turn ("once per turn", "once per round"). */
  recharge?: string;
}

export interface FeatureDetails {
  name: string;
  /**
   * Explicit subtitle line (e.g. `"2nd, 6th, 13th, and 18th-Level Cleric Feature"`).
   * When set, it replaces the auto-composed `Lv. N · type · uses · Pick N` row
   * so compendium docs can match book phrasing verbatim.
   */
  subtitle?: string;
  /** Multiline Obsidian-flavored markdown rendered as the feature body. */
  text?: string;
  /** Group → contribution. Aggregated across features in the character sheet. */
  traits?: TraitMap;
  /** Inline pick spec that contributes picked values to `traits[category]`. */
  choose?: ChooseSpec;
  /**
   * Per-level augmentations from sibling `rpg feature.level` blocks. Each
   * entry's traits are applied to the running aggregate when the character's
   * class level is at or above the entry's `level`.
   */
  levels?: FeatureLevelAddition[];
  type?: string;
  level?: number;
  uses?: number;
  link?: string;
  pick?: number;
  /**
   * When `type === "resource"`: max charges. Scalar or per-level map
   * (`{ 2: 1, 6: 2 }` → 1 charge at Lv 2, 2 at Lv 6, …).
   */
  max?: number | Record<number, number>;
  /** When `type === "resource"`: free-form recovery cadence ("short rest", "1/day"). */
  recovery?: string;
  /** Optional reference to another feature (a resource) by name — purely declarative. */
  uses_resource?: string;
  /**
   * Aspect sub-objects. Each key, when present, places the feature in that
   * type's bucket on the character-sheet accordion with the aspect's own
   * `text` on the card. A feature can carry multiple aspects (e.g. an
   * `active:` and a `passive:` version of the same ability).
   */
  action?: FeatureAspect;
  bonus?: FeatureAspect;
  reaction?: FeatureAspect;
  active?: FeatureAspect;
  passive?: FeatureAspect;
  resource?: FeatureAspect;
}

/**
 * One option for a choice slot, parsed from a `rpg feature.choice` code block.
 * Carries a full feature object — picking it can grant traits and/or
 * additional sub-features.
 */
export interface FeatureChoiceOption {
  parent: string;
  name?: string;
  text?: string;
  traits?: TraitMap;
  type?: string;
  link?: string;
  features?: FeatureDetails[];
  /** Optional reference to a `feature.resource` by name. */
  uses_resource?: string;
}

/** Non-feature progression marker (e.g. "subclass becomes pickable at level 3"). */
export interface UnlockBlock {
  kind: "subclass";
  level: number;
}

export type SourceDocKind = "class" | "subclass" | "lineage" | "heritage" | "background";

/** All blocks parsed from one compendium document. */
export interface SourceDoc {
  name: string;
  kind: SourceDocKind;
  meta: Record<string, unknown>;
  details: FeatureDetails[];
  options: FeatureChoiceOption[];
  unlocks: UnlockBlock[];
  tables: TableDef[];
  parent_class?: string;
}

// ─── Inputs to the resolver ───────────────────────────────────────────────────

/**
 * Input to the resolver. The features block reads class/lineage/heritage/background
 * from `blocks.header` (HeaderProps) and combines with its own `choices` map.
 *
 * `classes` is an array because the header supports multiclass natively.
 */
export interface CharacterDecl {
  classes: Array<{ name: string; level: number; subclass?: string }>;
  lineage?: string;
  heritage?: string;
  background?: string;
  /** picks[sourceName][featureName] = string | string[] (option name(s)) */
  choices?: Record<string, Record<string, string | string[]>>;
}

export interface CompendiumLib {
  classes: Record<string, SourceDoc>;
  subclasses: Record<string, SourceDoc>;
  lineages: Record<string, SourceDoc>;
  heritages: Record<string, SourceDoc>;
  backgrounds: Record<string, SourceDoc>;
}

// ─── Outputs of the resolver ──────────────────────────────────────────────────

/** A choice slot ready for the UI: the parent feature plus the matching options. */
export interface PendingChoice {
  source: string;
  feature: FeatureDetails;
  options: FeatureChoiceOption[];
  picked: string[];
  remaining: number;
}

export interface ResolvedSource {
  source: string;
  kind: SourceDocKind;
  level?: number;
  /** Features that apply at the character's level (already filtered). */
  features: FeatureDetails[];
  pendingChoices: PendingChoice[];
}

/**
 * The resolver's top-level output.
 *
 * `traits` aggregates every contributing feature's `traits` map into a single
 * key → values list, ready for the character sheet to render one line per
 * group (`Hit Dice: +8 +CON mod  +1d10`).
 */
export interface ResolvedView {
  sources: ResolvedSource[];
  traits: Record<string, string[]>;
  /** Flat list of every pending choice across sources. */
  pendingChoices: PendingChoice[];
  /**
   * Every table from every loaded source, keyed both by `<source>:<name>`
   * (fully qualified) and by bare `<name>` (latest-wins when multiple sources
   * declare the same name). Ready to hand to the expression evaluator.
   */
  tables: Record<string, TableDef>;
}
