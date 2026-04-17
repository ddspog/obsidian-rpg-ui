/**
 * Declarative feature import — type definitions.
 *
 * Pure types for compendium-driven character feature resolution.
 * No Obsidian / vault dependencies; safe to import from tests and the resolver.
 */

// ─── Tags ─────────────────────────────────────────────────────────────────────

/**
 * Inline grant tags. A `FeatureDetails` (or `FeatureChoiceOption`) carrying one
 * of these tags is rendered inline as `Skill P. (+Medicine, +Insight)` rather
 * than as a feature card.
 *
 * Action category tags (`passive`, `action`, `bonus_action`, …) live on the
 * `type` field, not here.
 */
export type TagId =
  | "hp"
  | "armor"
  | "weapons"
  | "save"
  | "skill_proficiency"
  | "tool"
  | "language"
  | "speed"
  | "size"
  | "talent";

// ─── Source-document blocks ───────────────────────────────────────────────────

/**
 * One feature, parsed from a `rpg feature.details` code block.
 * If `pick` is set, the feature is a choice slot — its options come from
 * `feature.choice` blocks that declare `parent: <this name>`.
 */
export interface FeatureDetails {
  name: string;
  tag?: TagId;
  value?: string;
  values?: string[];
  type?: string;
  level?: number;
  uses?: number;
  link?: string;
  description?: string;
  pick?: number;
}

/**
 * One option for a choice slot, parsed from a `rpg feature.choice` code block.
 * Carries a full feature object — picking it can grant tagged values AND
 * additional sub-features.
 */
export interface FeatureChoiceOption {
  parent: string;
  name?: string;
  value?: string;
  values?: string[];
  tag?: TagId;
  type?: string;
  link?: string;
  description?: string;
  features?: FeatureDetails[];
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

export interface Grant {
  tag: TagId;
  values: string[];
}

export interface ResolvedSource {
  source: string;
  kind: SourceDocKind;
  level?: number;
  /** Already-grouped grants ready to render as `Skill P. (+Medicine, +Insight)`. */
  grants: Grant[];
  /** Non-grant features (Spellcasting, Channel Divinity, Manifestation of Faith). */
  features: FeatureDetails[];
  pendingChoices: PendingChoice[];
}

export interface ResolvedView {
  sources: ResolvedSource[];
  /** Flat list of every pending choice across sources, for "you still need to pick" CTAs. */
  pendingChoices: PendingChoice[];
}
