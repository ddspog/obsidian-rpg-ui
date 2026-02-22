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
  name: string;
  subtitle?: string;
  alias?: string;
  description?: string;
  [key: string]: unknown;
}

/** Trait definition — represents character capabilities */
export interface TraitDefinition {
  name: string;
  description?: string;
  mechanical?: boolean;
  effect?: (context: Record<string, unknown>) => void;
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
  computed?: Record<string, (context: Record<string, unknown>) => unknown>;
}

/** Simple feature entry used in entity default features */
export interface FeatureEntry {
  name: string;
  description?: string;
  type?: string;
  detailed?: boolean;
}

/** Skill definition */
export interface SkillDefinition {
  name: string;
  attribute: string;
  subtitle?: string;
  description?: string;
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

/** Spellcasting system configuration */
export interface SpellcastingSystemConfig {
  circles: SpellCircleDefinition[];
  lists?: SpellListDefinition[];
  schools?: SpellSchoolDefinition[];
  tags?: string[];
  spellElements?: string[];
  providers: string[];
  collectors: string[];
}

/** Condition definition */
export interface ConditionDefinition {
  name: string;
  icon?: string;
  description?: string;
  [key: string]: unknown;
}

/** Conditions system configuration */
export interface ConditionsSystemConfig {
  conditions: ConditionDefinition[];
}

// ─── User-facing CreateSystem config ─────────────────────────────────────────

/** User-facing configuration shape for CreateSystem */
export interface SystemConfig {
  name: string;
  attributes: Array<string | AttributeDefinition>;
  entities?: Record<string, EntityConfig>;
  skills?: SkillDefinition[];
  features?: Partial<FeatureSystemConfig>;
  spellcasting?: Partial<SpellcastingSystemConfig>;
  conditions?: Partial<ConditionsSystemConfig> | ConditionDefinition[];
  traits?: TraitDefinition[];
}

// ─── Factory function ─────────────────────────────────────────────────────────

/**
 * Create a type-safe RPGSystem from a SystemConfig.
 *
 * @param config - System configuration
 * @returns A fully realized RPGSystem ready for use by the plugin
 *
 * @example
 * ```ts
 * import { CreateSystem } from "rpg-ui-toolkit";
 *
 * export const system = CreateSystem({
 *   name: "D&D 5e",
 *   attributes: [
 *     { name: "strength", alias: "STR" },
 *     { name: "dexterity", alias: "DEX" },
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
 * });
 * ```
 */
export declare function CreateSystem(config: SystemConfig): {
  name: string;
  attributes: string[];
  attributeDefinitions?: AttributeDefinition[];
  entities: Record<string, { frontmatter: unknown[]; features?: FeatureEntry[] }>;
  skills: SkillDefinition[];
  expressions: Map<string, unknown>;
  features: FeatureSystemConfig;
  spellcasting: SpellcastingSystemConfig;
  conditions: ConditionsSystemConfig;
  traits?: TraitDefinition[];
};
