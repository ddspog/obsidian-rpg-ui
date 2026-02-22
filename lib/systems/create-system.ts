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
  ConditionsSystemConfig,
  ConditionDefinition,
  EntityConfig,
} from "./types";

/**
 * Build a fully realized RPGSystem from a user-facing SystemConfig.
 *
 * - Validates required fields (`name`, `attributes`)
 * - Normalizes attribute strings into AttributeDefinition objects
 * - Converts entity `computed` functions into ExpressionDef entries
 * - Builds the `expressions` Map from all entity computed functions
 */
export function CreateSystem(config: SystemConfig): RPGSystem {
  if (!config.name || typeof config.name !== "string") {
    throw new Error("CreateSystem: 'name' is required and must be a string");
  }
  if (!Array.isArray(config.attributes) || config.attributes.length === 0) {
    throw new Error("CreateSystem: 'attributes' is required and must be a non-empty array");
  }

  // Normalize attributes: strings → AttributeDefinition
  const attributeDefinitions: AttributeDefinition[] = config.attributes.map(normalizeAttribute);
  const attributes: string[] = attributeDefinitions.map((a) => a.name);

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
    attributeDefinitions: attributeDefinitions.some((a) => a.alias || a.subtitle || a.description)
      ? attributeDefinitions
      : undefined,
    entities,
    skills: (config.skills ?? []) as SkillDefinition[],
    expressions,
    features,
    spellcasting,
    conditions,
    traits: config.traits,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeAttribute(attr: string | AttributeDefinition): AttributeDefinition {
  if (typeof attr === "string") {
    return { name: attr };
  }
  return attr;
}

function buildEntity(
  entityName: string,
  entityConfig: EntityConfig,
): { entityDef: EntityTypeDef; computedExpressions: Map<string, ExpressionDef> } {
  const frontmatter: FrontmatterFieldDef[] = (entityConfig.fields ?? []).map(normalizeField);
  const features = entityConfig.features ?? [];

  const entityDef: EntityTypeDef = { frontmatter, features };

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
  };
}

function normalizeConditions(
  conditions?: Partial<ConditionsSystemConfig> | ConditionDefinition[],
): ConditionsSystemConfig {
  if (!conditions) {
    return { conditions: [] };
  }
  if (Array.isArray(conditions)) {
    return { conditions };
  }
  return { conditions: conditions.conditions ?? [] };
}
