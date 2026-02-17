/**
 * System Parser - Main Entry Point
 * 
 * Orchestrates parsing of RPG system definitions from markdown files.
 * Reads `rpg system`, `rpg expression`, `rpg skill-list`, `rpg system.features`, 
 * and `rpg system.spellcasting` blocks from markdown content.
 */

import { parse as parseYaml } from "yaml";
import {
  RPGSystem,
  EntityTypeDef,
  ExpressionDef,
  SkillDefinition,
  FeatureSystemConfig,
  SpellcastingSystemConfig,
} from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";
import { parseFieldDefinitions } from "./fields";
import { resolveAttributes, FileLoader } from "./attributes";
import {
  parseExpressions,
  loadExpressionsFromFile,
  loadExpressionsFromFiles,
} from "./expressions";
import {
  parseSkills,
  loadSkillsFromFile,
  loadSkillsFromFiles,
} from "./skills";
import {
  parseFeaturesConfig,
  loadFeaturesFromFile,
} from "./features";
import {
  parseSpellcastingConfig,
  loadSpellcastingFromFile,
} from "./spellcasting";

// Initialize Handlebars helpers on module load
import "./handlebars";

/**
 * Parse a system definition from markdown file content
 * 
 * @param fileContent - Raw markdown content containing rpg code blocks
 * @param fileLoader - Optional function to load external files
 * @returns Parsed RPG system or null if no valid system block found
 */
export async function parseSystemFromMarkdown(
  fileContent: string,
  fileLoader?: FileLoader
): Promise<RPGSystem | null> {
  // Extract system block
  const systemBlocks = extractCodeBlocks(fileContent, "rpg system");
  if (systemBlocks.length === 0) {
    return null;
  }

  const systemYaml = parseYaml(systemBlocks[0]);
  if (!systemYaml || typeof systemYaml !== "object") {
    console.error("Invalid system YAML");
    return null;
  }

  // Parse basic system properties
  const name = systemYaml.name || "Unnamed System";
  const { attributes, attributeDefinitions } = await resolveAttributes(
    systemYaml.attributes,
    fileContent,
    fileLoader
  );
  
  // Parse entity types
  const entities: Record<string, EntityTypeDef> = {};
  if (systemYaml.types && typeof systemYaml.types === "object") {
    for (const [typeName, typeDef] of Object.entries(systemYaml.types)) {
      if (typeof typeDef === "object" && typeDef !== null) {
        const typeObj = typeDef as any;
        entities[typeName] = {
          frontmatter: parseFieldDefinitions(typeObj.fields || []),
          features: typeObj.features || [],
        };
      }
    }
  }

  // Parse expressions (either from inline blocks, external file, or file list)
  let expressions: Map<string, ExpressionDef>;
  if (typeof systemYaml.expressions === "string" && fileLoader) {
    // Load from external file
    expressions = await loadExpressionsFromFile(systemYaml.expressions, fileLoader);
  } else if (Array.isArray(systemYaml.expressions) && fileLoader) {
    // Load from multiple files
    expressions = await loadExpressionsFromFiles(systemYaml.expressions, fileLoader);
  } else {
    // Parse from inline blocks in current file (backward compatibility)
    expressions = parseExpressions(fileContent);
  }

  // Parse skills (either from inline blocks, external file, or file list)
  let skills: SkillDefinition[];
  if (typeof systemYaml.skills === "string" && fileLoader) {
    // Load from external file
    skills = await loadSkillsFromFile(systemYaml.skills, fileLoader);
  } else if (Array.isArray(systemYaml.skills) && fileLoader) {
    // Load from multiple files
    skills = await loadSkillsFromFiles(systemYaml.skills, fileLoader);
  } else {
    // Parse from inline blocks in current file (backward compatibility)
    skills = parseSkills(fileContent);
  }

  // Parse features (either inline or from external file)
  let features: FeatureSystemConfig;
  if (typeof systemYaml.features === "string" && fileLoader) {
    // Load from external file
    features = await loadFeaturesFromFile(systemYaml.features, fileLoader);
  } else if (systemYaml.features && typeof systemYaml.features === "object") {
    // Parse inline definition
    features = parseFeaturesConfig(systemYaml.features);
  } else {
    // Use default
    features = {
      categories: [],
      providers: [],
      collectors: [],
    };
  }

  // Parse spellcasting (either inline or from external file)
  let spellcasting: SpellcastingSystemConfig;
  if (typeof systemYaml.spellcasting === "string" && fileLoader) {
    // Load from external file
    spellcasting = await loadSpellcastingFromFile(systemYaml.spellcasting, fileLoader);
  } else if (systemYaml.spellcasting && typeof systemYaml.spellcasting === "object") {
    // Parse inline definition
    spellcasting = parseSpellcastingConfig(systemYaml.spellcasting);
  } else {
    // Use default
    spellcasting = {
      circles: [],
      providers: [],
      collectors: [],
    };
  }

  // Build system object
  const system: RPGSystem = {
    name,
    attributes,
    attributeDefinitions: attributeDefinitions.length > 0 ? attributeDefinitions : undefined,
    entities,
    skills,
    expressions,
    features,
    spellcasting,
  };

  return system;
}

// Re-export types and functions for consumers
export type { FileLoader };
export {
  parseExpressions,
  loadExpressionsFromFile,
  loadExpressionsFromFiles,
} from "./expressions";
export {
  parseSkills,
  loadSkillsFromFile,
  loadSkillsFromFiles,
} from "./skills";
export {
  parseFeaturesConfig,
  loadFeaturesFromFile,
} from "./features";
export {
  parseSpellcastingConfig,
  loadSpellcastingFromFile,
} from "./spellcasting";
export {
  resolveAttributes,
  parseAttributeDefinitionsFromMarkdown,
} from "./attributes";
export { parseFieldDefinitions } from "./fields";
