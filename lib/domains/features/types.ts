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
 *
 * `type: "asi"` (Ability Score Improvement) reuses the same picking flow but
 * allows duplicate picks: the user may select the same option more than once
 * up to `number` total, with each pick contributing `quantity` points (1 by
 * default) to the chosen value.
 */
export interface ChooseSpec {
  type: "traits" | "asi" | "talent";
  /** Trait bucket picks contribute to. Required for `traits`; optional for
   *  `asi` (defaults to "Ability Scores" for display purposes) and for
   *  `talent` (defaults to "Talent"). */
  category?: string;
  number: number;
  /** Points added per pick. `asi` only; defaults to 1. Ignored by `traits`. */
  quantity?: number;
  /**
   * ASI only. When true (default) each option can be picked at most once
   * — the `+` control disables for attributes already chosen. Set to
   * `false` to allow repeat picks (e.g. stacking all three points from a
   * talent into a single attribute).
   */
  unique?: boolean;
  /**
   * Options available to pick from. For `asi` this may be omitted — the
   * resolver falls back to the six core attributes (Strength, Dexterity,
   * Constitution, Intelligence, Wisdom, Charisma) so compendium authors
   * don't have to repeat the list on every ASI spec.
   */
  options?: string[];
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
  max?: number | string | Record<number, number>;
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
  /**
   * Inline pick spec that contributes picked values to `traits[category]`.
   *
   * May be a single spec or an array of specs — an array lets one block
   * declare multiple independent picks (e.g. the Adherent background
   * granting a Skill P. pick and a Tool P. pick in the same feature). Each
   * spec in an array is tracked by its own pick key so the picks don't
   * overwrite each other.
   */
  choose?: ChooseSpec | ChooseSpec[];
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
  max?: number | string | Record<number, number>;
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
  /**
   * Override an aspect on a previously-loaded feature. The first present
   * aspect key (`action`, `bonus`, `reaction`, `active`, `passive`,
   * `resource`) names the bucket and its value identifies the aspect by
   * name (e.g. `action: "Preserve Life"` targets the action aspect named
   * "Preserve Life"). All other fields under `update:` are the patch:
   * `text`, `name`, `recharge`, `recovery`, `max`, `resource` get
   * shallow-merged onto the matched aspect, replacing any prior values.
   *
   * Used by progression features that rewrite an earlier ability — e.g.
   * Cleric's Greater Preservation (Lv 11) updates Preserve Life's range
   * from 30 ft. to 60 ft. and adds a condition-cure clause.
   */
  update?: FeatureUpdate;
}

export interface FeatureUpdate {
  /** Aspect-bucket selectors. Set the one whose value names the aspect to
   *  patch (typically just one is set). */
  action?: string;
  bonus?: string;
  reaction?: string;
  active?: string;
  passive?: string;
  resource?: string;
  /** Patch fields applied on top of the matched aspect. */
  name?: string;
  text?: string;
  recharge?: string;
  recovery?: string;
  max?: number | string | Record<number, number>;
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
  /**
   * Inline pick spec that fires as a sub-choice once the parent option is
   * picked. Values picked against this choose contribute to the named trait
   * category on the character sheet (same semantics as `FeatureDetails.choose`).
   */
  choose?: ChooseSpec;
}

/** Non-feature progression marker (e.g. "subclass becomes pickable at level 3"). */
export interface UnlockBlock {
  kind: "subclass";
  level: number;
}

export type SourceDocKind = "class" | "subclass" | "lineage" | "heritage" | "background" | "talent";

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
  /**
   * Homebrew / one-off additions layered on top of the standard compendium
   * sources. Each list is references to existing feature.details-bearing
   * vault pages. The resolver loads each referenced doc and spreads its
   * feature.details into the specified source (defaulting to a synthetic
   * Homebrew source when `source` is omitted).
   */
  additional?: {
    talents?: ExtraRef[];
    features?: ExtraRef[];
    boons?: ExtraRef[];
    curses?: ExtraRef[];
  };
}

/** Reference to an extra compendium page. Bare wikilink string is
 *  shorthand; object form carries optional `source` (attributes the
 *  content into a specific ResolvedSource by name) and `level`. */
export type ExtraRef =
  | string
  | { ref: string; source?: string; level?: number };

export interface CompendiumLib {
  classes: Record<string, SourceDoc>;
  subclasses: Record<string, SourceDoc>;
  lineages: Record<string, SourceDoc>;
  heritages: Record<string, SourceDoc>;
  backgrounds: Record<string, SourceDoc>;
  /**
   * Parsed talent docs keyed by their file basename. Talents aren't
   * top-level sources — they're looked up when a `choose.type: "talent"`
   * pick is resolved, and the talent's feature.details blocks are spread
   * into the picking source's features attributed to the picking detail's
   * level (e.g. Cleric's Talented Growth at Lv. 4).
   */
  talents?: Record<string, SourceDoc>;
  /**
   * Flat lookup: tag name → list of `"[[Item]]"` wikilinks, built at load
   * time from every compendium item's frontmatter `tags:`. Used to expand
   * `"#Tag"` references inside inline `choose.options` arrays.
   */
  tagIndex?: Record<string, string[]>;
  /**
   * Flat lookup: folder path → list of `"[[Item]]"` wikilinks for each item
   * in that folder's direct children. Used to expand `"@folder/path"`
   * references inside inline `choose.options` arrays.
   */
  folderIndex?: Record<string, string[]>;
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
  /**
   * Traits contributed by features that don't carry an explicit `level:`
   * (the base rules of a class / lineage / heritage / background / talent).
   * Same shape as `ResolvedView.traits` but scoped to this one source.
   */
  baseTraits: Record<string, string[]>;
  /**
   * Traits contributed by features that DO carry a `level:` annotation,
   * plus all `feature.level` augmentations. For classes these render as a
   * bulleted sub-list beneath the base-rules line on the character sheet.
   */
  leveledTraits: Record<string, string[]>;
  /**
   * Per-level breakdown of every trait contribution this source made at the
   * character's current level. Keys are level numbers (unlevelled features
   * are bucketed at level 1, since that's when the class is taken). Used by
   * the character sheet to render the Cleric/class traits row as one line
   * per class level (skipping empty ones) rather than one long rules line.
   */
  traitsByLevel: Record<number, Record<string, string[]>>;
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
