/**
 * System abstraction layer types
 * 
 * Defines the interface for RPG systems to enable multi-system support.
 * D&D 5e is the built-in default, but systems can be defined in markdown files.
 */

/**
 * Core RPG system interface
 */
export interface RPGSystem {
  /** System name (e.g., "D&D 5e", "Fate Core") */
  name: string;
  
  /** Core attributes (e.g., ["strength", "dexterity", ...]) */
  attributes: string[];
  
  /** Entity type definitions (character, monster, item, etc.) */
  types: Record<string, EntityTypeDef>;
  
  /** Skill definitions with attribute associations */
  skills: SkillDefinition[];
  
  /** Expression registry (id → compiled expression) */
  expressions: Map<string, ExpressionDef>;
  
  /** Feature system configuration */
  features: FeatureSystemConfig;
}

/**
 * Entity type definition (character, monster, item, etc.)
 */
export interface EntityTypeDef {
  /** Frontmatter field definitions for this entity type */
  fields: FrontmatterFieldDef[];
  
  /** Role of this entity type in the feature system */
  role?: "provider" | "collector";
}

/**
 * Frontmatter field definition
 */
export interface FrontmatterFieldDef {
  /** Field name in frontmatter */
  name: string;
  
  /** Field data type */
  type: "number" | "string" | "boolean";
  
  /** Default value if not specified */
  default?: unknown;
  
  /** Derived formula (Handlebars template) - evaluated if value not set */
  derived?: string;
  
  /** Alternative frontmatter key names */
  aliases?: string[];
}

/**
 * Expression definition
 */
export interface ExpressionDef {
  /** Expression identifier */
  id: string;
  
  /** Parameter names */
  params: string[];
  
  /** Formula as Handlebars template string */
  formula: string;
  
  /** Compiled evaluation function */
  evaluate: (context: Record<string, number | string | boolean>) => number | string | boolean;
}

/**
 * Skill definition
 */
export interface SkillDefinition {
  /** Skill display name */
  label: string;
  
  /** Associated attribute identifier */
  attribute: string;
}

/**
 * Feature type definition
 */
export interface FeatureTypeDefinition {
  /** Feature type identifier (e.g., "action", "bonus_action") */
  id: string;
  
  /** Display label (e.g., "Action", "Bonus Action") */
  label: string;
  
  /** Optional icon or emoji for the feature type */
  icon?: string;
}

/**
 * Feature system configuration
 */
export interface FeatureSystemConfig {
  /** Feature categories (action, bonus action, reaction, etc.) - order determines display order */
  categories: FeatureTypeDefinition[];
  
  /** Feature provider types (class, race, etc.) - entity types that provide features to others */
  providers: string[];
  
  /** Feature collector types (character, monster, etc.) - entity types that collect features from providers */
  collectors: string[];
}
