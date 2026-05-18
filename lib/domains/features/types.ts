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
  type: "traits" | "asi" | "talent" | "spellcasting";
  /** Trait bucket picks contribute to. Required for `traits`; optional for
   *  `asi` (defaults to "Ability Scores" for display purposes), for
   *  `talent` (defaults to "Talent"), and for `spellcasting` (must be
   *  `"ability"` — the picked value drives the caster's save DC / attack
   *  modifier / prepared count expression). */
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
  /** Incremental spellcasting contributions unlocked at this level
   *  (e.g. Cleric's `feature.level` blocks at 4 / 10 add +1 cantrip).
   *  Folded additively onto the parent caster just like declaration
   *  fragments, but gated by the character's class level. */
  spellcasting?: SpellcastingFragment;
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

// Re-export the roll aspect types so downstream modules can import
// `RollAspect` from the same surface as the other feature types.
export type { RollAspect, DamageSpec, RollSave, RollEffect } from "./roll";

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
   * granting a Skill P. pick and a Tools pick in the same feature). Each
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
  /**
   * Rendering hint for the `rpg feature.details` block in an Obsidian
   * reading-mode view. Currently recognised: `"No Title"` (also
   * `"no-title"` / `"notitle"` — case and separator insensitive) hides
   * the `<h3>` card title, useful when the host note's `# Heading`
   * already serves as the feature name. Ignored elsewhere.
   */
  view?: string;
  /**
   * Heading level (1–6) for the feature name in reading-mode cards.
   * Defaults to 3 (`<h3>`). Set to match the surrounding document
   * structure — e.g. `heading: 4` under an `### h3` section.
   */
  heading?: number;
  pick?: number;
  /**
   * Budget-based picking. Mutually exclusive with `pick` — when `buy` is
   * set, the feature's `feature.choice` options carry `cost:` values and
   * the user may select any combination whose total cost ≤ the numeric
   * value of `buy`. Accepts a literal (`buy: 5`) or an expression string
   * (`buy: "5 + PB"`) evaluated against the character's EvalContext at
   * render time so homebrew can parameterise budgets by proficiency /
   * level / ability modifier. Unlike `pick`, the pending choice stays
   * visible so the player can keep spending remaining points.
   */
  buy?: number | string;
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
   * Roll aspect — describes any dice-roll this feature grants (attack,
   * save, rider, healing, or temp-HP). Surfaced by `rpg character.rolls`
   * as a row in the rolls table; NOT routed into the features accordion's
   * aspect buckets (Action / Bonus / …) because rolls have their own
   * renderer and picker.
   */
  roll?: import("./roll").RollAspect;
  /**
   * Spellcasting configuration. Set on a feature to declare a caster
   * (on the Spellcasting feature itself) or to augment one (feature.level
   * blocks adding slots, subclass grants, talents). The shape is the same
   * in all three roles — the resolver aggregates them across a source.
   */
  spellcasting?: SpellcastingFragment;
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
 * Spellcasting fragment. Three roles share one shape:
 *
 *   1. **Declaration** — set on the feature that establishes a caster
 *      (Cleric's Spellcasting, Druid's Spellcasting, Ranger's
 *      Spellcasting, …). `ability` + `type` + `tier` must be present.
 *   2. **Increment** — set on `feature.level` blocks under the same
 *      parent. Numeric fields are applied additively on top of the
 *      declaration's totals.
 *   3. **Augmentation** — set on subclass / heroic-boon / talent
 *      features that add slots or grants to the primary caster in the
 *      same source (Sage: +2 cantrips +2 rituals; Life Domain Spells:
 *      granted.prepared at caster levels 3/5/7/9).
 *
 * The resolver walks every feature in a source with a `spellcasting:`
 * fragment, folds them together, and emits one `ResolvedCaster` per
 * source that produced a declaration.
 */
export interface SpellcastingFragment {
  // ── Declaration fields ──────────────────────────────────────────────
  /** Ability score used for save DC, attack rolls, and `prepared_max`. */
  ability?: string;
  /** `prepared` means the caster prepares a subset of the full list each
   *  day (Cleric / Druid). `known` means a fixed known pool (Ranger). */
  type?: "prepared" | "known";
  /** Slot-progression tier. `full` gets the full 9-circle table, `half`
   *  the half-caster 5-circle table, `third` the third-caster 4-circle
   *  (Eldritch Knight / Arcane Trickster style). `none` means the source
   *  grants cantrips / rituals without any leveled spell slot progression
   *  (Acolyte heritage, High-Elf-style cantrip grants, …). */
  tier?: "full" | "half" | "third" | "none";
  /** Spell-list source — tag (`#Divine`) or folder (`@compendium/spells/cleric`). */
  pool?: string;
  /** Optional separate pool for cantrip picks when the caster's class
   *  tags cantrips in a different location than its main spell list
   *  (Tales of the Valiant stores cantrips in `worldbuilding/cantrips`
   *  rather than under the Divine / Primordial / Arcane lists). When
   *  unset, the block falls back to `pool`. */
  cantrip_pool?: string;
  /** Pool for ritual picks — typically a folder ref pointing to a
   *  dedicated rituals directory. The character's ritual picker pulls
   *  options from this pool, constrained per-level to circles the
   *  caster has unlocked at that acquisition level. */
  ritual_pool?: string;
  /** Styles of magic the caster is attuned to (Dream, Portal, …).
   *  Picker rows add "flavor exception" options — spells whose own
   *  `style` entry matches any of these, even if the spell itself
   *  falls outside the declared `pool`. Rendered with a distinct
   *  dashed-border button treatment so the player sees at a glance
   *  which picks are stylistic rather than list-regular. */
  style?: string[];
  /** Expression evaluated via substituteExpressions to compute the
   *  per-day prepared budget (e.g. `"WIS_MOD + LV"`). Prepared casters only. */
  prepared_max?: string;

  // ── Counters (additive across every fragment in the source) ─────────
  /** Number of cantrip slots. +1 per level-step is the common pattern. */
  cantrips?: number;
  /** Number of ritual slots (plural to match the plural grant shape). */
  rituals?: number;
  /** Known-spell slots (known-type casters only). */
  known?: number;
  /** Ritual slots that scale with the caster's available spell circles
   *  (Ritualist talent). `1` → one ritual per unlocked circle. */
  rituals_per_circle?: number;

  // ── Grants (always-prepared / always-known lists from features) ─────
  granted?: {
    /** Always-prepared spells keyed by the caster level that unlocks them. */
    prepared?: Record<number, unknown[]>;
    /** Always-known cantrips keyed by caster level. */
    cantrips?: Record<number, unknown[]>;
    /** Always-known rituals keyed by caster level. */
    rituals?: Record<number, unknown[]>;
  };
}

/**
 * The resolver's aggregated view of a single caster.
 *
 * One `ResolvedCaster` is emitted per source that contributed a
 * Spellcasting declaration (so multiclass produces multiple — each with
 * its own slot progression, pool, and grants). Augmentations and level
 * increments from the same source are pre-folded.
 */
export interface ResolvedCaster {
  /** Source that declared the caster (class / subclass doc name). */
  source: string;
  /** Character's level in that source — drives slot row lookup. */
  level: number;
  /** Ability score used for save DC / attack rolls / prepared count.
   *  Empty string means the source declared a caster via a spellcasting
   *  `choose: category: ability` pick that the user hasn't made yet. */
  ability: string;
  /** Prepared vs known, drives the picker UX. */
  type: "prepared" | "known";
  /** Slot progression. `none` = cantrips / rituals only, no leveled table. */
  tier: "full" | "half" | "third" | "none";
  /** Spell-list source (tag or folder) used to expand pickable options. */
  pool?: string;
  /** Resolved cantrip pool (falls back to `pool` when the caster didn't
   *  declare a separate cantrip list). */
  cantrip_pool?: string;
  /** Resolved ritual pool — where the ritual picker sources options. */
  ritual_pool?: string;
  /** Magic styles the caster is attuned to. Picker rows surface
   *  flavor-exception options for spells that share any of these
   *  styles even when outside the `pool`. */
  style: string[];
  /** Raw expression string for `prepared_max` — evaluated at render-time
   *  against the EvalContext so it can see the character's ability
   *  modifiers and level. */
  prepared_max?: string;
  /** Folded cantrip slot count across the source's fragments. */
  cantrips: number;
  /** Folded ritual slot count. */
  rituals: number;
  /** Per-character-level increments contributing to the ritual count.
   *  Keyed by the class level at which each delta is granted (e.g.
   *  Cleric → `{ 1: 1, 3: 1, 5: 1, 7: 1, 9: 1, 11: 1, 13: 1, 15: 1, 17: 1 }`).
   *  The picker uses this to break the ritual choices into per-level
   *  pending rows so each pick is anchored to the level it came from. */
  ritualsByLevel: Record<number, number>;
  /** Folded known-spell slot count (known-type). */
  known: number;
  /** Ritual slots that scale per available spell circle (Ritualist). */
  rituals_per_circle: number;
  /** Always-prepared spells keyed by caster level (merged from every
   *  granting feature in the source). */
  granted: {
    prepared: Record<number, string[]>;
    cantrips: Record<number, string[]>;
    rituals: Record<number, string[]>;
  };
  /**
   * Provenance map for entries in `granted.*` — the source (class,
   * subclass, talent feature name) that granted each spell. Keyed by
   * the spell's bare stem (`Bless`, `Cure Wounds`, …). User picks
   * don't appear here; their enabling source is always `caster.source`.
   */
  grantedBy: Record<string, string>;
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
  /**
   * Cost paid from the parent feature's `buy` budget. Only consulted when
   * the parent `feature.details` declares `buy:` — in a plain `pick:`
   * feature the option is always free to select within the slot count.
   */
  cost?: number;
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

export type SourceDocKind = "class" | "subclass" | "lineage" | "heritage" | "background" | "talent" | "item";

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
export type ExtraRef = string | { ref: string; source?: string; level?: number };

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
   * `"[[Tag]]"` references inside inline `choose.options` arrays — when a
   * wikilink's bare target matches a key here, it expands to the tagged
   * set; otherwise it passes through as a literal.
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
  /**
   * Set when a detail on this source declared `choose: { type:
   * "spellcasting", category: "ability" }`. The field records the user's
   * pick (CHA / INT / WIS / …) or the empty string when the pick is
   * still pending. Its presence tells `resolveCasters` this source wants
   * its own standalone caster even without an explicit `ability/type/tier`
   * declaration on any `spellcasting:` fragment.
   */
  spellcastingAbilityPick?: string;
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
  /**
   * One entry per source that declared a `spellcasting:` fragment at
   * feature-declaration level. Multiclass produces multiple entries
   * (each carries its own slot progression, pool, and grants).
   */
  casters: ResolvedCaster[];
}
