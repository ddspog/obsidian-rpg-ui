import type { ReactNode } from "react";

/** System abstraction layer types — defines the interface for RPG systems to enable multi-system support. */

// ─────────────────────────────────────────────────────────────────────────────
// User-facing CreateSystem API types
// ─────────────────────────────────────────────────────────────────────────────

/** Trait definition — represents character capabilities (proficiency, expertise, racial traits) */
export interface TraitDefinition {
  /** Trait name (e.g., "Darkvision", "Lucky") */
  $name: string;
  /** Optional description of the trait */
  $contents?: string;
  /** Whether this trait has mechanical effects */
  mechanical?: boolean;
  /** Optional effect function applied to a context */
  effect?: (context: Record<string, unknown>) => void;
}

/** Entity configuration — user-facing shape for entities in SystemConfig */
type BaseEntityConfig<
  TLookup = Record<string, unknown>,
  TFrontmatter = Record<string, unknown>,
  TBlocks extends Record<string, Record<string, unknown>> = Record<string, Record<string, unknown>>,
  TExpressions extends Record<string, (...args: any[]) => unknown> = Record<string, (...args: any[]) => unknown>
> = {
  features?: Feature[];
  xpTable?: number[];
  lookup?: Readonly<TLookup>;
  /** @deprecated use `expressions` instead */
  computed?: Record<string, (context: any) => unknown>;
  /**
   * Named expressions — receive `(args, props)` at definition time;
   * exposed as call-ready functions in block/expression props.
   *
   * @example
   * ```ts
   * expressions: {
   *   calc_y: ([a, b], { frontmatter }) => a + b + frontmatter.total,
   * }
   * // called inside blocks:
   * expressions.calc_y(2, 4)
   * ```
   */
  expressions?: {
    [K in keyof TExpressions]: TExpressions[K] extends (...args: infer A) => infer R
      ? (args: A, props: ExpressionProps<TLookup, TFrontmatter, TBlocks, TExpressions>) => R
      : never;
  };
  blocks?: { [K in keyof TBlocks]: Component<TBlocks[K], TLookup, TFrontmatter, TBlocks, TExpressions> };
};

export type EntityConfig<TFrontmatter = Record<string, unknown>, TLookup = Record<string, unknown>, TBlocks extends Record<string, Record<string, unknown>> = Record<string, Record<string, unknown>>, TExpressions extends Record<string, (...args: any[]) => unknown> = Record<string, (...args: any[]) => unknown>> =
  TFrontmatter extends never ? BaseEntityConfig<TLookup, TFrontmatter, TBlocks, TExpressions> : BaseEntityConfig<TLookup, TFrontmatter, TBlocks, TExpressions> & { frontmatter?: TFrontmatter };

/**
 * Props schema entry for a block — shorthand type string or a full definition
 * describing the expected YAML field type, default, and requirements.
 */
export type BlockPropSchema =
  | "string"
  | "number"
  | "boolean"
  | {
      type: "string" | "number" | "boolean";
      default?: unknown;
      required?: boolean;
      description?: string;
    };

/**
 * Block definition — a React component registered for an `rpg entity.<name>`
 * code block. The plugin parses the YAML body and passes it as props to the
 * component.
 * @deprecated Use Component (returned by CreateComponent) instead.
 */
export interface BlockDefinition {
  /** Props schema describing the expected YAML fields */
  props?: Record<string, BlockPropSchema>;
  /** React component that receives the parsed YAML fields as props */
  component: (props: Record<string, unknown>) => ReactNode;
}

/** System context passed to every block component */
export interface SystemContext {
  skills: SkillDefinition[];
  attributes: AttributeDefinition[];
  conditions?: ConditionDefinition[];
  traits?: TraitDefinition[];
}

/**
 * Context passed to expression functions — entity + system without the `self` block props.
 */
export interface ExpressionProps<
  TLookup = Record<string, unknown>,
  TFrontmatter = Record<string, unknown>,
  TBlocks = Record<string, unknown>,
  TExpressions extends Record<string, (...args: any[]) => unknown> = Record<string, (...args: any[]) => unknown>
> {
  lookup: TLookup;
  frontmatter: TFrontmatter;
  blocks: TBlocks;
  /** Sibling expressions bound to entity context — call directly: `expressions.mod()` */
  expressions: TExpressions;
  system: SystemContext;
}

/**
 * Derives a setter function for every key in T, following React useState convention.
 *
 * `{ xp: number; label: string }` → `{ setXp: (v: number | ((p: number) => number)) => void; setLabel: ... }`
 *
 * The setter accepts either a plain value or an updater function, identical to
 * the dispatch overload returned by `useState`.
 */
export type Setters<T> = {
  [K in keyof T as K extends string ? `set${Capitalize<K>}` : never]:
    (value: T[K] | ((prev: T[K]) => T[K])) => void;
};

/**
 * Full props object passed to a block component created with CreateComponent.
 *
 * @typeParam TProps - This block's own YAML-parsed props
 * @typeParam TLookup - Entity lookup type (from CreateEntity)
 * @typeParam TFrontmatter - Entity frontmatter type (from CreateEntity)
 * @typeParam TBlocks - All blocks' prop shapes (from CreateEntity)
 */
export interface ComponentProps<
  TProps = Record<string, unknown>,
  TLookup = Record<string, unknown>,
  TFrontmatter = Record<string, unknown>,
  TBlocks = Record<string, unknown>,
  TExpressions extends Record<string, (...args: any[]) => unknown> = Record<string, (...args: any[]) => unknown>
> {
  /** Block's own YAML props, augmented with a `setFoo` setter for every `foo` key. */
  self: TProps & Setters<TProps>;
  lookup: TLookup;
  frontmatter: TFrontmatter;
  blocks: TBlocks;
  /** Entity expressions bound to context — call directly: `expressions.mod()` */
  expressions: TExpressions;
  system: SystemContext;
  /**
   * Trigger a named event scoped to this entity instance (file).
   * All blocks within the same note share the same event scope.
   * @param eventName - One of the event names declared in the system's `events` array.
   */
  trigger: (eventName: string) => void;
}

/**
 * A typed block React component.
 * Registered directly as a value in the entity `blocks` map.
 *
 * @typeParam TProps - This block's own YAML-parsed props
 * @typeParam TLookup - Entity lookup type
 * @typeParam TFrontmatter - Entity frontmatter type
 * @typeParam TBlocks - All blocks' prop shapes
 */
export type Component<
  TProps = Record<string, unknown>,
  TLookup = Record<string, unknown>,
  TFrontmatter = Record<string, unknown>,
  TBlocks = Record<string, unknown>,
  TExpressions extends Record<string, (...args: any[]) => unknown> = Record<string, (...args: any[]) => unknown>
> = (props: ComponentProps<TProps, TLookup, TFrontmatter, TBlocks, TExpressions>) => ReactNode;

/** Caster type definition — describes a spellcasting progression style */
export interface CasterTypeDefinition {
  /** Display name for this caster type (e.g., "Full Caster", "Half Caster") */
  name: string;
  /**
   * Converts a character level into a spellcaster level for this caster type.
   * For example, a half-caster divides the character level by 2.
   */
  levelConversion: (characterLevel: number) => number;
}

/** User-facing configuration shape for CreateSystem */
export interface SystemConfig {
  /** System name (e.g., "D&D 5e", "Fate Core") */
  name: string;
  /**
   * Core attributes — may be simple strings (auto-expanded) or full AttributeDefinition objects.
   * Strings are automatically expanded into AttributeDefinition with `$name` set.
   */
  attributes: Array<string | AttributeDefinition>;
  /** Entity type configurations */
  entities?: Record<string, any>;
  /** Skill definitions */
  skills?: SkillDefinition[];
  /** Feature system configuration (plain object, not a Map) */
  features?: Partial<FeatureSystemConfig>;
  /** Spellcasting system configuration */
  spellcasting?: Partial<SpellcastingSystemConfig>;
  /** Condition definitions */
  conditions?: ConditionDefinition[];
  /** Trait definitions for character capabilities */
  traits?: TraitDefinition[];
  /**
   * Named events that can be triggered from entity block components via `trigger(eventName)`.
   * Scoped per entity instance — triggering in one note file does not affect other notes.
   */
  events?: string[];
}


/** Attribute definition */
export interface AttributeDefinition {
  /** Attribute identifier (e.g., "strength", "intelligence") */
  $name: string;
  /** Subtitle with associated skills or special description */
  subtitle?: string;
  /** Abbreviated form (e.g., "STR", "INT") */
  alias?: string;
  /** Description in markdown format */
  $contents?: string;
  /** Custom properties for tables/cards */
  [key: string]: unknown;
}

/** Core RPG system interface */
export interface RPGSystem {
  /** System name (e.g., "D&D 5e", "Fate Core") */
  name: string;
  /** Attribute definitions — always full objects, strings are normalized at build time */
  attributes: AttributeDefinition[];
  /** Entity type definitions (character, monster, item, etc.) */
  entities: Record<string, EntityTypeDef>;
  /** Skill definitions with attribute associations */
  skills: SkillDefinition[];
  /** Expression registry (id → compiled expression) */
  expressions: Map<string, ExpressionDef>;
  /** Feature system configuration */
  features: FeatureSystemConfig;
  /** Spellcasting system configuration */
  spellcasting: SpellcastingSystemConfig;
  /** Condition definitions */
  conditions: ConditionDefinition[];
  /** Trait definitions for character capabilities */
  traits?: TraitDefinition[];
  /** Named events that blocks may trigger (scoped per entity file). */
  events: string[];
}

/** Entity type definition — defines frontmatter fields and default features for an entity type */
export interface EntityTypeDef<TLookup = Record<string, unknown>> {
  /** Frontmatter field definitions for this entity type */
  frontmatter: FrontmatterFieldDef[];
  /** Default features available to all entities of this type */
  features?: Feature[];
  /**
   * Experience point thresholds per level (index 0 = XP to reach level 1, etc.).
   * Carried through from EntityConfig.xpTable.
   */
  xpTable?: number[];
  /**
   * Read-only lookup values carried from entity config (constants, tables).
   * Typed by the `TLookup` generic parameter when using `CreateEntity`.
   */
  lookup?: Readonly<TLookup>;
  /** Block component definitions for `rpg entity.<name>` code blocks */
  blocks?: Record<string, Component>;
}

/** Feature definition for default entity features in system definitions */
export interface Feature {
  /** Feature name */
  $name: string;
  /** Feature description */
  $contents?: string;
  /** Feature type identifier (e.g., "action", "bonus_action", "reaction") */
  type?: string;
  /** Whether this feature should be displayed in detail or as a badge with hover details */
  detailed?: boolean;
  /** Sub-features (aspects) that further detail this feature */
  aspects?: Feature[];
}

/** Frontmatter field definition */
export interface FrontmatterFieldDef {
  /** Field name in frontmatter */
  name: string;
  /** Field data type */
  type: "number" | "string" | "boolean";
  /** Default value if not specified */
  default?: unknown;
  /** Derived formula (Handlebars template) — evaluated if value not set */
  derived?: string;
  /** Alternative frontmatter key names */
  aliases?: string[];
}

/** Expression definition */
export interface ExpressionDef {
  /** Expression identifier */
  id: string;
  /** Parameter names */
  params: string[];
  /** Formula as Handlebars template string or function signature display */
  formula: string;
  /** Whether the expression is async (e.g., for dice rolling) */
  isAsync?: boolean;
  /** Raw function body for JS function expressions */
  body?: string;
  /** Compiled evaluation function */
  evaluate: (context: any) => unknown;
}

/** Skill definition */
export interface SkillDefinition {
  /** Skill display name */
  $name: string;
  /** Associated attribute identifier */
  attribute: string;
  /** Optional subtitle describing the skill */
  subtitle?: string;
  /** Optional description of the skill */
  $contents?: string;
  /** Custom properties for tables/cards */
  [key: string]: unknown;
}

/** Feature type definition */
export interface FeatureTypeDefinition {
  /** Feature type identifier (e.g., "action", "bonus_action") */
  id: string;
  /** Display label (e.g., "Action", "Bonus Action") */
  label: string;
  /** Optional icon or emoji for the feature type */
  icon?: string;
}

/** Feature system configuration */
export interface FeatureSystemConfig {
  /** Feature categories (action, bonus action, reaction, etc.) */
  categories: FeatureTypeDefinition[];
  /** Feature trait types (hit-points, save-proficiency, etc.) */
  traits?: FeatureTypeDefinition[];
  /** Feature provider types (class, race, etc.) */
  providers: string[];
  /** Feature collector types (character, monster, etc.) */
  collectors: string[];
}

/** Spell circle/level definition */
export interface SpellCircleDefinition {
  /** Circle identifier (e.g., "cantrip", "1", "2", ..., "9") */
  id: string;
  /** Display label (e.g., "Cantrip", "1st Level", "2nd Level") */
  label: string;
  /** Optional icon or emoji for the spell circle */
  icon?: string;
}

/** Spell list definition */
export interface SpellListDefinition {
  /** Spell list identifier (e.g., "wizard", "cleric", "druid") */
  id: string;
  /** Display label (e.g., "Wizard Spells", "Cleric Spells") */
  label: string;
  /** Optional icon or emoji for the spell list */
  icon?: string;
}

/** Spell school definition */
export interface SpellSchoolDefinition {
  /** School identifier (e.g., "abjuration", "evocation") */
  id: string;
  /** Display label (e.g., "Abjuration", "Evocation") */
  label: string;
  /** Optional icon or emoji for the spell school */
  icon?: string;
}

/** Spell tag definition (e.g., Ritual) */
export type SpellTagDefinition = string;

/** Spell element definition (e.g., Casting, Range, Area) */
export type SpellElementDefinition = string;

/** Spell slot distribution for a single caster level */
export interface SpellSlotDistribution {
  /** Caster level (1–20) */
  level: number;
  /**
   * Number of spell slots per spell circle at this caster level.
   * Index 0 = 1st-level spell slots, index 1 = 2nd-level, etc.
   * Cantrips are unlimited and are not included here.
   */
  slots: number[];
}

/** Spellcasting system configuration */
export interface SpellcastingSystemConfig {
  /** Spell circles/levels (cantrip, 1st, 2nd, etc.) */
  circles: SpellCircleDefinition[];
  /** Spell lists (wizard, cleric, etc.) */
  lists?: SpellListDefinition[];
  /** Spell schools (abjuration, conjuration, etc.) */
  schools?: SpellSchoolDefinition[];
  /** Spell tags (ritual, etc.) */
  tags?: SpellTagDefinition[];
  /** Spell elements (casting time, range, area, components, duration) */
  spellElements?: SpellElementDefinition[];
  /** Spellcasting provider types (class, subclass, etc.) */
  providers: string[];
  /** Spellcasting collector types (character, monster, etc.) */
  collectors: string[];
  /**
   * Default spell slot progression table for this system.
   * Each entry is an array of slot counts per spell level at a given caster level.
   * Index 0 = level 1, index 1 = level 2, etc.
   * Example: `[[2], [3], [4, 2]]` means level 1: 2×1st, level 2: 3×1st, level 3: 4×1st + 2×2nd.
   */
  slots?: number[][];
  /**
   * Caster type definitions — describe spellcasting progression styles (full, half, third, etc.).
   * Each key is a caster type identifier, and the value defines the name and level conversion.
   */
  casters?: Record<string, CasterTypeDefinition>;
}

/** Condition definition */
export interface ConditionDefinition {
  /** Condition identifier (e.g., "blinded", "charmed") */
  $name: string;
  /** Optional icon or emoji for the condition */
  icon?: string;
  /** Brief description of the condition's effect */
  $contents?: string;
  /** Custom properties for tables/cards */
  [key: string]: unknown;
}


