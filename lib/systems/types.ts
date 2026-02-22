/** System abstraction layer types — defines the interface for RPG systems to enable multi-system support. */

/** Attribute definition */
export interface AttributeDefinition {
  /** Attribute identifier (e.g., "strength", "intelligence") */
  name: string;
  /** Subtitle with associated skills or special description */
  subtitle?: string;
  /** Abbreviated form (e.g., "STR", "INT") */
  alias?: string;
  /** Description in markdown format */
  description?: string;
  /** Custom properties for tables/cards */
  [key: string]: unknown;
}

/** Core RPG system interface */
export interface RPGSystem {
  /** System name (e.g., "D&D 5e", "Fate Core") */
  name: string;
  /** Core attributes — simple string array for backward compatibility */
  attributes: string[];
  /** Detailed attribute definitions with descriptions (optional, for enhanced display) */
  attributeDefinitions?: AttributeDefinition[];
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
  /** Conditions system configuration */
  conditions: ConditionsSystemConfig;
}

/** Entity type definition — defines frontmatter fields and default features for an entity type */
export interface EntityTypeDef {
  /** Frontmatter field definitions for this entity type */
  frontmatter: FrontmatterFieldDef[];
  /** Default features available to all entities of this type */
  features?: Feature[];
}

/** Feature definition for default entity features in system definitions */
export interface Feature {
  /** Feature name */
  name: string;
  /** Feature description */
  description?: string;
  /** Feature type identifier (e.g., "action", "bonus_action", "reaction") */
  type?: string;
  /** Whether this feature should be displayed in detail or as a badge with hover details */
  detailed?: boolean;
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
  /** Compiled evaluation function — context can include any values for JS function expressions */
  evaluate: (context: Record<string, unknown>) => unknown;
}

/** Skill definition */
export interface SkillDefinition {
  /** Skill display name */
  name: string;
  /** Associated attribute identifier */
  attribute: string;
  /** Optional subtitle describing the skill */
  subtitle?: string;
  /** Optional description of the skill */
  description?: string;
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
}

/** Condition definition */
export interface ConditionDefinition {
  /** Condition identifier (e.g., "blinded", "charmed") */
  name: string;
  /** Optional icon or emoji for the condition */
  icon?: string;
  /** Brief description of the condition's effect */
  description?: string;
  /** Custom properties for tables/cards */
  [key: string]: unknown;
}

/** Conditions system configuration */
export interface ConditionsSystemConfig {
  /** Condition definitions */
  conditions: ConditionDefinition[];
}
