/**
 * DEPRECATED: This file has been refactored into modular components.
 * 
 * This file is kept for backwards compatibility only. All imports should use:
 *     import { parseSystemFromMarkdown, ... } from "./parser"
 * 
 * Which will automatically resolve to the new modular parser/index.ts
 * 
 * The parser has been split into focused modules:
 * - parser/handlebars.ts - Handlebars helper initialization
 * - parser/attributes.ts - Attribute parsing and resolution
 * - parser/expressions.ts - Expression parsing and loading
 * - parser/skills.ts - Skills parsing and loading
 * - parser/features.ts - Features parsing and loading
 * - parser/spellcasting.ts - Spellcasting parsing and loading
 * - parser/fields.ts - Frontmatter field definitions
 * - parser/index.ts - Main orchestration and exports
 * 
 * This file should be deleted after all imports are verified to work with the new structure.
 */

// Re-export everything from the new modular parser for backwards compatibility
export { parseSystemFromMarkdown } from "./parser/index";
export type { FileLoader } from "./parser/index";
export {
  parseExpressions,
  loadExpressionsFromFile,
  loadExpressionsFromFiles,
} from "./parser/expressions";
export {
  parseSkills,
  loadSkillsFromFile,
  loadSkillsFromFiles,
} from "./parser/skills";
export {
  parseFeaturesConfig,
  loadFeaturesFromFile,
} from "./parser/features";
export {
  parseSpellcastingConfig,
  loadSpellcastingFromFile,
} from "./parser/spellcasting";
export {
  resolveAttributes,
  parseAttributeDefinitionsFromMarkdown,
} from "./parser/attributes";
export { parseFieldDefinitions } from "./parser/fields";
export { extractWikilinkRef, normalizeRef } from "./parser/wikilink-ref";
