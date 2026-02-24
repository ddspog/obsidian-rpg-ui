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
     */
    export declare function CreateEntity(
      cfg: EntityConfig | ((ctx: { wiki: Wiki }) => EntityConfig | Promise<EntityConfig>),
    ): EntityConfig | ((ctx: { wiki: Wiki }) => EntityConfig | Promise<EntityConfig>);

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
export interface BlockDefinition {
  /**
   * Props schema — describes the YAML fields the block expects.
   * Each key maps to a type shorthand or a full prop definition.
   */
  props?: Record<string, BlockPropSchema>;
  /** React component that receives the parsed YAML fields as props */
  component: (props: Record<string, unknown>) => unknown;
}

/** Entity configuration for use in SystemConfig */
export interface EntityConfig {
  fields?: Array<
    | string
    | {
        name: string;
        type?: "number" | "string" | "boolean";
        default?: unknown;
        derived?: string;
        aliases?: string[];
      }
  >;
  features?: FeatureEntry[];
  /**
   * Experience point thresholds per level (index 0 = XP needed to reach level 1, etc.).
   * Used to calculate the current level from total XP and to track level-up progress.
   */
  xpTable?: number[];
  /**
   * Computed expressions — functions that calculate values from entity
   * frontmatter data (e.g., ability modifiers, saving throws).
   */
  computed?: Record<string, (context: Record<string, unknown>) => unknown>;
  /**
   * Block component definitions.
   * Each key becomes the `rpg entity.<key>` code block handler.
   */
  blocks?: Record<string, BlockDefinition>;
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
  entities?: Record<string, EntityConfig | ((ctx: { wiki: Wiki }) => EntityConfig | Promise<EntityConfig>)>;
  skills?: SkillDefinition[];
  features?: Partial<FeatureSystemConfig>;
  spellcasting?: Partial<SpellcastingSystemConfig>;
  conditions?: ConditionDefinition[];
  traits?: TraitDefinition[];
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
} from "../ui";

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
      blocks?: Record<string, BlockDefinition>;
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
