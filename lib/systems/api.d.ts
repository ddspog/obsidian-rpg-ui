import type { ReactNode } from "react";

/**
 * RPG UI Toolkit – Public API type declarations
 *
 * Users import this file in their `tsconfig.json` to get IDE autocompletion
 * when writing TypeScript system definitions:
 *
 * ```json
 * {
 *   "compilerOptions": {
 *     "paths": {
 *       "rpg-ui-toolkit": [".obsidian/plugins/obsidian-rpg-ui/api.d.ts"]
 *     }
 *   }
 * }
 * ```
 *
 * Then in your `systems/my-system/index.ts`:
 * ```ts
 * import { CreateSystem } from "rpg-ui-toolkit";
 *
 * export const system = CreateSystem({
 *   name: "My System",
 *   attributes: ["strength", "dexterity", ...],
 *   // ...
 * });
 * ```
 */

// ─── Core System Types ────────────────────────────────────────────────────────

/** Attribute definition */
export interface AttributeDefinition {
  $name: string;
  subtitle?: string;
  alias?: string;
  $contents?: string;
  [key: string]: unknown;
}

/** Trait definition — represents character capabilities */
export interface TraitDefinition {
  $name: string;
  $contents?: string;
  mechanical?: boolean;
  effect?: (context: Record<string, unknown>) => void;
}

/**
 * Props schema entry for a block definition.
 * A string shorthand ("string" | "number" | "boolean") or a full object
 * with `type`, optional `default`, and an optional `required` flag.
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
     * Create an entity definition. Accepts either a plain `EntityConfig` or a
     * factory function which receives `{ wiki }` and returns an `EntityConfig`
     * (or a Promise thereof). Returned value is consumed by `CreateSystem` which
     * will resolve any factories before building the system.
     *
     * @typeParam TBlocks - Shape of all block props in this entity (e.g. `{ header: HeaderProps; health: HealthProps }`)
     * @typeParam TLookup - Lookup data type for this entity
     * @typeParam TFrontmatter - Frontmatter type for this entity
     */
    export declare function CreateEntity<
          TEntity extends EntityDescriptor<any, any, any, any> = EntityDescriptor
        >(
          cfg: TEntity | ((ctx: { wiki: Wiki }) => TEntity | Promise<TEntity>),
        ):
          | TEntity
          | ((ctx: { wiki: Wiki }) => TEntity | Promise<TEntity>);

    /**
     * Bundled entity descriptor type to simplify CreateEntity generics.
     *
     * Order: TBlocks, TLookup, TExpressions, TFrontmatter (friendly for authors)
     */
    export type EntityDescriptor<
      TBlocks extends Record<string, Record<string, unknown>> = Record<string, Record<string, unknown>>,
      TLookup = Record<string, unknown>,
      TExpressions extends Record<string, (...args: any[]) => unknown> = Record<string, (...args: any[]) => unknown>,
      TFrontmatter = Record<string, unknown>
    > = EntityConfig<TFrontmatter, TLookup, TBlocks, TExpressions>;

/**
 * Block definition — registers a React component for an `rpg entity.<blockName>`
 * code block in Obsidian notes.
 *
 * When the plugin encounters `\`\`\`rpg entity.<blockName>\`\`\`` in a note, it:
 * 1. Parses the YAML body into a props object (validated against `props` schema)
 * 2. Renders the `component` with those parsed props
 *
 * @example
 * ```ts
 * blocks: {
 *   stats: {
 *     props: {
 *       strength: { type: "number", default: 10 },
 *       dexterity: { type: "number", default: 10 },
 *     },
 *     component: ({ strength, dexterity }) => (
 *       <div>STR: {strength} | DEX: {dexterity}</div>
 *     ),
 *   },
 * }
 * ```
 */
/** @deprecated Use Component (returned by CreateComponent) instead */
export interface BlockDefinition {
  /**
   * Props schema — describes the YAML fields the block expects.
   * Each key maps to a type shorthand or a full prop definition.
   */
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
 *
 * @typeParam TLookup - Entity lookup type
 * @typeParam TFrontmatter - Entity frontmatter type
 * @typeParam TBlocks - All blocks' prop shapes
 */
export interface ExpressionProps<
  TLookup = Record<string, unknown>,
  TFrontmatter = Record<string, unknown>,
  TBlocks = Record<string, unknown>,
  TExpressions extends Record<string, unknown> = Record<string, unknown>
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
  TExpressions extends Record<string, unknown> = Record<string, unknown>
> {
  /** Block's own YAML props, augmented with a `setFoo` setter for every `foo` key. */
  self: TProps & Setters<TProps>;
  lookup: TLookup;
  frontmatter: TFrontmatter;
  blocks: TBlocks;
  /** Entity expressions bound to context — call directly: `expressions.mod()` */
  expressions: TExpressions;
  system: SystemContext;  /**
   * Trigger a named event scoped to this entity instance (file).
   * All blocks within the same note share the same event scope.
   * @param eventName - One of the event names declared in the system's `events` array.
   */
  trigger: (eventName: string) => void;}

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

/**
 * Create a typed block component.
 *
 * Pass a React component function; the resulting descriptor is registered
 * as a value in the entity `blocks` map.
 *
 * @typeParam TProps - This block's own YAML-parsed props
 * @typeParam TLookup - Entity lookup type (from CreateEntity)
 * @typeParam TFrontmatter - Entity frontmatter type (from CreateEntity)
 * @typeParam TBlocks - All blocks' prop shapes map (from CreateEntity)
 *
 * @example
 * ```ts
 * const header = CreateComponent<HeaderProps, CharacterLookup, CharacterFrontmatter, CharacterBlocks>(
 *   ({ self, entity, system }) => (
 *     <div>
 *       <h1>{self.name}</h1>
 *       <p>Level: {self.classes[0]?.level}</p>
 *       <p>HP: {blocks.health.hp.current}</p>
 *     </div>
 *   )
 * );
 * ```
 */
export declare function CreateComponent<
  TProps = Record<string, unknown>,
  TLookup = Record<string, unknown>,
  TFrontmatter = Record<string, unknown>,
  TBlocks = Record<string, unknown>,
  TExpressions extends Record<string, (...args: any[]) => unknown> = Record<string, (...args: any[]) => unknown>
>(
  fn: Component<TProps, TLookup, TFrontmatter, TBlocks, TExpressions>
): Component<TProps, TLookup, TFrontmatter, TBlocks, TExpressions>;

/**
 * Helper type extractors for EntityDescriptor generics
 */
type _EntityLookup<T> = T extends EntityDescriptor<any, infer L, any, any> ? L : Record<string, unknown>;
type _EntityFrontmatter<T> = T extends EntityDescriptor<any, any, any, infer F> ? F : Record<string, unknown>;
type _EntityBlocks<T> = T extends EntityDescriptor<infer B, any, any, any> ? B : Record<string, Record<string, unknown>>;
type _EntityExpressions<T> = T extends EntityDescriptor<any, any, infer E, any> ? E : Record<string, (...args: any[]) => unknown>;

/** Map extracted expression signatures into callable functions preserving parameters */
type _CallableExpressions<T> = {
  [K in keyof _EntityExpressions<T>]: _EntityExpressions<T>[K] extends (...args: infer A) => infer R
    ? (...args: A) => R
    : (...args: any[]) => unknown;
};

/**
 * Typed function signature for an entity block.
 *
 * TBlock is the shape of this block's own YAML-parsed props.
 * TEntity is an EntityDescriptor describing the parent entity; its generic
 * parameters are used to derive lookup/frontmatter/blocks/expressions types.
 */
export type EntityBlock<
  TBlock = Record<string, unknown>,
  TEntity = EntityDescriptor
> = (
  props: ComponentProps<
    TBlock,
    _EntityLookup<TEntity>,
    _EntityFrontmatter<TEntity>,
    _EntityBlocks<TEntity>,
    _CallableExpressions<TEntity>
  >
) => ReactNode;

/**
 * Entity configuration for use in CreateEntity / SystemConfig.
 *
 * @typeParam TFrontmatter - Frontmatter data shape for this entity
 * @typeParam TLookup - Lookup values shape for this entity
 * @typeParam TBlocks - Record mapping each block name to its own YAML-parsed props shape
 */
export interface EntityConfig<
  TFrontmatter = Record<string, unknown>,
  TLookup = Record<string, unknown>,
  TBlocks extends Record<string, Record<string, unknown>> = Record<string, Record<string, unknown>>,
  TExpressions extends Record<string, (...args: any[]) => unknown> = Record<string, (...args: any[]) => unknown>
> {
  frontmatter?: TFrontmatter;
  features?: FeatureEntry[];
  xpTable?: number[];
  lookup?: Readonly<TLookup>;
  lookups?: Record<string, unknown>;
  /**
   * Named expressions — receive `(args, props)` at definition; exposed as
   * call-ready functions in block/expression props.
   *
   * @example
   * ```ts
   * expressions: {
   *   calc_y: ([a, b], { frontmatter }) => a + b + (frontmatter as any).total,
   * }
   * // called inside a block:
   * expressions.calc_y(2, 4)
   * ```
   */
  expressions?: {
    [K in keyof TExpressions]: TExpressions[K] extends (...args: infer A) => infer R
      ? (args: A, props: ExpressionProps<TLookup, TFrontmatter, TBlocks, TExpressions>) => R
      : never;
  };
  blocks?: { [K in keyof TBlocks]: Component<TBlocks[K], TLookup, TFrontmatter, TBlocks, TExpressions> };
}

/** Simple feature entry used in entity default features */
export interface FeatureEntry {
  $name: string;
  $contents?: string;
  type?: string;
  detailed?: boolean;
  /** Sub-features (aspects) that further detail this feature */
  aspects?: FeatureEntry[];
}

/** Skill definition */
export interface SkillDefinition {
  $name: string;
  attribute: string;
  subtitle?: string;
  $contents?: string;
  [key: string]: unknown;
}

/** Feature type definition */
export interface FeatureTypeDefinition {
  id: string;
  label: string;
  icon?: string;
}

/** Feature system configuration */
export interface FeatureSystemConfig {
  categories: FeatureTypeDefinition[];
  traits?: FeatureTypeDefinition[];
  providers: string[];
  collectors: string[];
}

/** Spell circle/level definition */
export interface SpellCircleDefinition {
  id: string;
  label: string;
  icon?: string;
}

/** Spell list definition */
export interface SpellListDefinition {
  id: string;
  label: string;
  icon?: string;
}

/** Spell school definition */
export interface SpellSchoolDefinition {
  id: string;
  label: string;
  icon?: string;
}

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
  circles: SpellCircleDefinition[];
  lists?: SpellListDefinition[];
  schools?: SpellSchoolDefinition[];
  tags?: string[];
  spellElements?: string[];
  providers: string[];
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
  $name: string;
  icon?: string;
  $contents?: string;
  [key: string]: unknown;
}

// ─── User-facing CreateSystem config ─────────────────────────────────────────

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
  name: string;
  attributes: Array<string | AttributeDefinition>;
  entities?: Record<string, any>;
  skills?: SkillDefinition[];
  features?: Partial<FeatureSystemConfig>;
  spellcasting?: Partial<SpellcastingSystemConfig>;
  conditions?: ConditionDefinition[];
  traits?: TraitDefinition[];
  /**
   * Named events that can be triggered from entity block components via `trigger(eventName)`.
   * Scoped per entity instance — triggering in one note file does not affect other notes.
   */
  events?: string[];
}

/** Result of fetching a file from the vault — includes frontmatter and contents */
export interface WikiFileResult {
  [key: string]: any;
  /** Vault-relative path to the file. */
  $path: string;
  /** Bare file name used to reference the file (typically without extension). */
  $name: string;
  /** Body text that follows the frontmatter block. */
  $contents: string;
  /** Deduplicated list of tags extracted from frontmatter, normalised to `#tag` form. */
  $tags: string[];
  /** List of aliases extracted from frontmatter `alias` / `aliases` keys. */
  $aliases: string[];
}

/** Function to fetch a single file by name from the vault */
export interface WikiFileFunction {
  (filename: string): Promise<WikiFileResult>;
}

/** Function to fetch all files in a folder from the vault */
export interface WikiFolderFunction {
  (folderPath: string): Promise<WikiFileResult[]>;
}

/**
 * Wiki fixture providing file and folder access utilities.
 *
 * @example
 * ```ts
 * CreateSystem(({ wiki }) => ({
 *   skills: wiki.folder("systems/dnd5e/skills"),
 *   conditions: [wiki.file("Poisoned")]
 * }))
 * ```
 */
export interface Wiki {
  /** Fetch a single file by name from the vault */
  file: WikiFileFunction;
  /** Fetch all files in a folder from the vault */
  folder: WikiFolderFunction;
}

// ─── UI Components ───────────────────────────────────────────────────────────

export {
  CharacterHeaderBlock,
  HealthBlock,
  FeaturesCollectorBlock,
  SpellsCollectorBlock,
  ClassFeaturesBlock,
  SpellInfoBlock,
  SpellEffectsBlock,
  FeatureEntryBlock,
  FeatureAspectsBlock,
  StatblockHeaderBlock,
  StatblockTraitsBlock,
  StatblockAttributesBlock,
  StatblockFeaturesBlock,
  TitleAnchor,
  Pill,
  ProgressBar,
  TriggerButton,
  InspirationalLevel,
  getBannerStyle,
} from "../ui";
export type { ProgressBarProps } from "../ui";
export type { TriggerButtonProps } from "../ui";
export type { InspirationalLevelProps } from "../ui";
export { Stat } from "../ui";
export type { StatProps } from "../ui";
export { StatUL, SkillLI } from "../ui";
export type { StatULProps, SkillLIProps } from "../ui";

/**
 * Convert a banner frontmatter value into a style object usable in React.
 * Accepts a string (URL or CSS color) or other values; returns an object
 * with either `backgroundImage` or `backgroundColor`, or `undefined`.
 */
export type BannerValue =
  | `#${string}`
  | `rgb(${string})`
  | `rgba(${string})`
  | `hsl(${string})`
  | `hsla(${string})`
  | `http://${string}`
  | `https://${string}`
  | `data:${string}`
  | string;

export declare function getBannerStyle(raw?: BannerValue | unknown): { backgroundImage: string } | { backgroundColor: string } | undefined;


// ─── Factory function ─────────────────────────────────────────────────────────

/**
 * Create a type-safe RPGSystem from a SystemConfig.
 *
 * @param configFn - Function that receives wiki utilities and returns system configuration
 * @returns A fully realized RPGSystem ready for use by the plugin
 *
 * @example
 * ```ts
 * import { CreateSystem } from "rpg-ui-toolkit";
 *
 * export const system = CreateSystem(({ wiki }) => ({
 *   name: "D&D 5e",
 *   attributes: [
 *     { $name: "strength", alias: "STR" },
 *     { $name: "dexterity", alias: "DEX" },
 *   ],
 *   entities: {
 *     character: {
 *       fields: [
 *         { name: "proficiency_bonus", type: "number", default: 2 },
 *         { name: "level", type: "number", default: 1 },
 *       ],
 *       computed: {
 *         modifier: (ctx) => Math.floor((Number(ctx.score) - 10) / 2),
 *       },
 *     },
 *   },
 *   skills: [{ name: "Acrobatics", attribute: "dexterity" }],
 *   // Use wiki to load data from vault files
 *   conditions: [wiki.file("conditions/Poisoned")],
 * }));
 * ```
 */
export declare function CreateSystem(
  configFn: (context: { wiki: Wiki }) => SystemConfig | Promise<SystemConfig>,
): Promise<{
  name: string;
  /** Attribute definitions — strings in the config are normalized to full objects at build time */
  attributes: AttributeDefinition[];
  entities: Record<
    string,
    {
      frontmatter: unknown[];
      features?: FeatureEntry[];
      /** Computed expressions scoped to this entity */
      computed?: Record<string, (context: Record<string, unknown>) => unknown>;
      /** Compiled expression map for this entity */
      expressions?: Map<string, unknown>;
      /** Block component definitions for `rpg entity.<blockName>` code blocks */
      blocks?: Record<string, Component>;
      /** XP thresholds per level for this entity */
      xpTable?: number[];
    }
  >;

  skills: SkillDefinition[];
  features: FeatureSystemConfig;
  spellcasting: SpellcastingSystemConfig;
  conditions: ConditionDefinition[];
  traits?: TraitDefinition[];
}>;
