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
  entities: Record<string, EntityTypeDef>;
  
  /** Skill definitions with attribute associations */
  skills: SkillDefinition[];
  
  /** Expression registry (id → compiled expression) */
  expressions: Map<string, ExpressionDef>;
  
  /** Feature system configuration */
  features: FeatureSystemConfig;
  
  /** Spellcasting system configuration */
  spellcasting: SpellcastingSystemConfig;
}

/**
 * Entity type definition (character, monster, item, etc.)
 * Defines frontmatter fields and default features for an entity type.
 */
export interface EntityTypeDef {
  /** Frontmatter field definitions for this entity type */
  frontmatter: FrontmatterFieldDef[];
  
  /** Default features available to all entities of this type (e.g., Dash, Opportunity Attack for characters) */
  features?: Feature[];
}

/**
 * Feature definition for default entity features in system definitions
 * Simplified version with only essential fields for default features
 */
export interface Feature {
  /** Feature name */
  name: string;
  
  /** Feature description */
  description?: string;
  
  /** Feature type identifier (e.g., "action", "bonus_action", "reaction") */
  type?: string;
  
  /** Whether this feature should be displayed in detail (full text) or as a badge with hover details */
  detailed?: boolean;
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

/**
 * Spell circle/level definition
 */
export interface SpellCircleDefinition {
  /** Circle identifier (e.g., "cantrip", "1", "2", ..., "9") */
  id: string;
  
  /** Display label (e.g., "Cantrip", "1st Level", "2nd Level") */
  label: string;
  
  /** Optional icon or emoji for the spell circle */
  icon?: string;
}

/**
 * Spell list definition
 */
export interface SpellListDefinition {
  /** Spell list identifier (e.g., "wizard", "cleric", "druid") */
  id: string;
  
  /** Display label (e.g., "Wizard Spells", "Cleric Spells") */
  label: string;
  
  /** Optional icon or emoji for the spell list */
  icon?: string;
}

/**
 * Spellcasting system configuration
 */
export interface SpellcastingSystemConfig {
  /** Spell circles/levels (cantrip, 1st, 2nd, etc.) - order determines display order */
  circles: SpellCircleDefinition[];
  
  /** Spell lists (wizard, cleric, etc.) - different categories of spells available to different classes */
  lists?: SpellListDefinition[];
  
  /** Spellcasting provider types (class, subclass, etc.) - entity types that provide spells to others */
  providers: string[];
  
  /** Spellcasting collector types (character, monster, etc.) - entity types that can cast spells */
  collectors: string[];
}
