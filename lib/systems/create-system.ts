/**
 * CreateSystem factory
 *
 * Type-safe factory for building RPGSystem instances from a user-provided
 * SystemConfig. Used by TypeScript-based system definitions (index.ts files
 * in vault system folders) as well as the built-in D&D 5e system.
 */

import type {
  SystemConfig,
  RPGSystem,
  AttributeDefinition,
  EntityTypeDef,
  FrontmatterFieldDef,
  ExpressionDef,
  SkillDefinition,
  FeatureSystemConfig,
  SpellcastingSystemConfig,
  ConditionDefinition,
  EntityConfig,
  BlockDefinition,
} from "./types";

/**
 * Build a fully realized RPGSystem from a user-facing SystemConfig.
 *
 * - Validates required fields (`name`, `attributes`)
 * - Normalizes attribute strings into AttributeDefinition objects
 * - Converts entity `computed` functions into ExpressionDef entries
 * - Builds the `expressions` Map from all entity computed functions
 */
export function CreateSystem(config: SystemConfig): RPGSystem;
export function CreateSystem(
  configFn: (ctx: { wiki?: any }) => SystemConfig | Promise<SystemConfig>,
): Promise<RPGSystem>;
export function CreateSystem(
  configOrFn: SystemConfig | ((ctx: { wiki?: any }) => SystemConfig | Promise<SystemConfig>),
): RPGSystem | Promise<RPGSystem> {
  // Helper that performs the synchronous build from a resolved SystemConfig
  const build = (config: SystemConfig): RPGSystem => {
    if (!config.name || typeof config.name !== "string") {
      throw new Error("CreateSystem: 'name' is required and must be a string");
    }
    if (!Array.isArray(config.attributes) || config.attributes.length === 0) {
      throw new Error("CreateSystem: 'attributes' is required and must be a non-empty array");
    }

    // Normalize attributes: strings → AttributeDefinition
    const attributes: AttributeDefinition[] = config.attributes.map(normalizeAttribute);

    // Build entities and collect computed expressions
    const entities: Record<string, EntityTypeDef> = {};
    const expressions = new Map<string, ExpressionDef>();

    for (const [entityName, entityConfig] of Object.entries(config.entities ?? {})) {
      const { entityDef, computedExpressions } = buildEntity(entityName, entityConfig);
      entities[entityName] = entityDef;
      for (const [id, expr] of computedExpressions) {
        expressions.set(id, expr);
      }
    }

    // Normalize features
    const features = normalizeFeatures(config.features);

    // Normalize spellcasting
    const spellcasting = normalizeSpellcasting(config.spellcasting);

    // Normalize conditions
    const conditions = normalizeConditions(config.conditions);

    return {
      name: config.name,
      attributes,
      entities,
      skills: (config.skills ?? []) as SkillDefinition[],
      expressions,
      features,
      spellcasting,
      conditions,
      traits: config.traits,
    };
  };

  // If a plain config object was provided, build synchronously.
  if (typeof configOrFn !== "function") {
    return build(configOrFn as SystemConfig);
  }

  // Otherwise it's a factory function. Call it with the wiki fixture and
  // support either synchronous or Promise-returning factories.
  const wiki = (globalThis as any).__rpg_wiki;
  const maybe = (configOrFn as (ctx: { wiki?: any }) => SystemConfig | Promise<SystemConfig>)({ wiki });

  const resolveAndBuild = async (cfgOrPromise: SystemConfig | Promise<SystemConfig>) => {
    const cfg = await (cfgOrPromise as Promise<SystemConfig>);
    const resolvedConfig = await resolveEntityFactories(cfg, wiki);
    return build(resolvedConfig);
  };

  if (maybe && typeof (maybe as any).then === "function") {
    return resolveAndBuild(maybe as Promise<SystemConfig>);
  }
  return resolveAndBuild(maybe as SystemConfig);
}

/**
 * Resolve any entity factories present in a SystemConfig.
 *
 * Entity entries may be plain `EntityConfig`, a factory function that
 * receives `{ wiki }` and returns an `EntityConfig` (or a Promise thereof),
 * or a Promise resolving to an `EntityConfig`. This helper normalizes all
 * entries to concrete `EntityConfig` objects.
 */
async function resolveEntityFactories(config: SystemConfig, wiki?: any): Promise<SystemConfig> {
  const entities = config.entities ?? {};
  const resolved: Record<string, EntityConfig> = {};
  for (const [key, val] of Object.entries(entities)) {
    try {
      if (typeof val === "function") {
        const maybe = (val as any)({ wiki });
        resolved[key] = maybe && typeof maybe.then === "function" ? await maybe : (maybe as EntityConfig);
      } else if (val && typeof (val as any).then === "function") {
        resolved[key] = await (val as Promise<EntityConfig>);
      } else {
        resolved[key] = val as EntityConfig;
      }
    } catch (e) {
      // On error, rethrow with context to help debugging user code
      throw new Error(`Failed to resolve entity factory for '${key}': ${String(e)}`);
    }
  }
  return { ...config, entities: resolved };
}

/**
 * Helper for user-authored TypeScript systems: create an entity definition
 * that can be either a plain `EntityConfig` or a factory function that
 * receives `{ wiki }` and returns an `EntityConfig` (or a Promise thereof).
 *
 * This function is primarily a typed convenience and simply returns the
 * provided value; `CreateSystem` will detect and resolve function-typed
 * entity entries at build time.
 */
export function CreateEntity(
  cfg: EntityConfig | ((ctx: { wiki?: any }) => EntityConfig | Promise<EntityConfig>),
): EntityConfig | ((ctx: { wiki?: any }) => EntityConfig | Promise<EntityConfig>) {
  return cfg as any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeAttribute(attr: string | AttributeDefinition): AttributeDefinition {
  if (typeof attr === "string") {
    return { $name: attr };
  }
  return attr;
}

function buildEntity(
  entityName: string,
  entityConfig: EntityConfig,
): { entityDef: EntityTypeDef; computedExpressions: Map<string, ExpressionDef> } {
  const frontmatter: FrontmatterFieldDef[] = (entityConfig.fields ?? []).map(normalizeField);
  const features = entityConfig.features ?? [];
  const blocks = entityConfig.blocks as Record<string, BlockDefinition> | undefined;
  const xpTable = entityConfig.xpTable;

  const entityDef: EntityTypeDef = { frontmatter, features, xpTable, blocks };

  const computedExpressions = new Map<string, ExpressionDef>();
  for (const [fnName, fn] of Object.entries(entityConfig.computed ?? {})) {
    const exprId = fnName;
    const expr: ExpressionDef = {
      id: exprId,
      params: getFunctionParams(fn),
      formula: buildFormulaDescription(entityName, fnName, fn),
      evaluate: fn,
    };
    computedExpressions.set(exprId, expr);
  }

  return { entityDef, computedExpressions };
}

function normalizeField(
  field:
    | string
    | { name: string; type?: "number" | "string" | "boolean"; default?: unknown; derived?: string; aliases?: string[] },
): FrontmatterFieldDef {
  if (typeof field === "string") {
    return { name: field, type: "string" };
  }
  return {
    name: field.name,
    type: field.type ?? "string",
    default: field.default,
    derived: field.derived,
    aliases: field.aliases,
  };
}

/**
 * Attempt to extract parameter names from a function via its `toString()`.
 * Returns an empty array if parsing fails.
 */
function getFunctionParams(fn: Function): string[] {
  try {
    const src = fn.toString();
    // Arrow function: (a, b) => ... or a => ...
    const arrowMatch = src.match(/^\s*(?:async\s+)?\(([^)]*)\)\s*=>/);
    if (arrowMatch) {
      return parseParamList(arrowMatch[1]);
    }
    const singleArrow = src.match(/^\s*(?:async\s+)?(\w+)\s*=>/);
    if (singleArrow) {
      return [singleArrow[1]];
    }
    // Regular function: function name(a, b) { ... }
    const funcMatch = src.match(/^(?:async\s+)?function\s*\w*\s*\(([^)]*)\)/);
    if (funcMatch) {
      return parseParamList(funcMatch[1]);
    }
  } catch {
    // ignore
  }
  return [];
}

function parseParamList(paramStr: string): string[] {
  return paramStr
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function buildFormulaDescription(entityName: string, fnName: string, fn: Function): string {
  const params = getFunctionParams(fn);
  return `${entityName}.${fnName}(${params.join(", ")})`;
}

function normalizeFeatures(features?: Partial<FeatureSystemConfig>): FeatureSystemConfig {
  return {
    categories: features?.categories ?? [],
    traits: features?.traits,
    providers: features?.providers ?? [],
    collectors: features?.collectors ?? [],
  };
}

function normalizeSpellcasting(spellcasting?: Partial<SpellcastingSystemConfig>): SpellcastingSystemConfig {
  return {
    circles: spellcasting?.circles ?? [],
    lists: spellcasting?.lists,
    schools: spellcasting?.schools,
    tags: spellcasting?.tags,
    spellElements: spellcasting?.spellElements,
    providers: spellcasting?.providers ?? [],
    collectors: spellcasting?.collectors ?? [],
    spellcastTable: spellcasting?.spellcastTable,
  };
}

function normalizeConditions(conditions?: ConditionDefinition[]): ConditionDefinition[] {
  return conditions ?? [];
}
