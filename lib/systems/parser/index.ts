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
  ConditionsSystemConfig,
} from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";
import { parseFieldDefinitions } from "./fields";
import { resolveAttributes, FileLoader, FolderLister, resolveFileOrFolder } from "./attributes";
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
import {
  parseConditionsConfig,
  loadConditionsFromFile,
  loadConditionsFromFiles,
} from "./conditions";
import { normalizeRef } from "./wikilink-ref";

// Initialize Handlebars helpers on module load
import "./handlebars";

/**
 * Parse a system definition from markdown file content
 * 
 * @param fileContent - Raw markdown content containing rpg code blocks
 * @param fileLoader - Optional function to load external files
 * @param folderLister - Optional function to list files in a folder
 * @returns Parsed RPG system or null if no valid system block found
 */
export async function parseSystemFromMarkdown(
  fileContent: string,
  fileLoader?: FileLoader,
  folderLister?: FolderLister,
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

  // Normalize wikilink references: [[Path]] is parsed by YAML as [["Path"]]
  const attributesField = normalizeRef(systemYaml.attributes);
  const expressionsField = normalizeRef(systemYaml.expressions);
  const skillsField = normalizeRef(systemYaml.skills);
  const featuresField = normalizeRef(systemYaml.features);
  const spellcastingField = normalizeRef(systemYaml.spellcasting);
  const conditionsField = normalizeRef(systemYaml.conditions);

  const { attributes, attributeDefinitions } = await resolveAttributes(
    attributesField,
    fileContent,
    fileLoader,
    folderLister,
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
  if (typeof expressionsField === "string" && fileLoader) {
    // Load from external file
    expressions = await loadExpressionsFromFile(expressionsField, fileLoader);
  } else if (Array.isArray(expressionsField) && fileLoader) {
    // Load from multiple files
    expressions = await loadExpressionsFromFiles(expressionsField, fileLoader);
  } else {
    // Parse from inline blocks in current file (backward compatibility)
    expressions = parseExpressions(fileContent);
  }

  // Parse skills (either from inline blocks, external file, folder, or file list)
  let skills: SkillDefinition[];
  if (typeof skillsField === "string" && fileLoader) {
    // Load from external file or folder
    const filePaths = await resolveFileOrFolder(skillsField, folderLister);
    if (filePaths.length === 1 && filePaths[0] === skillsField) {
      skills = await loadSkillsFromFile(skillsField, fileLoader);
    } else {
      skills = await loadSkillsFromFiles(filePaths, fileLoader);
    }
  } else if (Array.isArray(skillsField) && fileLoader) {
    // Load from multiple files
    skills = await loadSkillsFromFiles(skillsField, fileLoader);
  } else {
    // Parse from inline blocks in current file (backward compatibility)
    skills = parseSkills(fileContent);
  }

  // Parse features (either inline or from external file)
  let features: FeatureSystemConfig;
  if (typeof featuresField === "string" && fileLoader) {
    // Load from external file
    features = await loadFeaturesFromFile(featuresField, fileLoader);
  } else if (featuresField && typeof featuresField === "object") {
    // Parse inline definition
    features = parseFeaturesConfig(featuresField);
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
  if (typeof spellcastingField === "string" && fileLoader) {
    // Load from external file
    spellcasting = await loadSpellcastingFromFile(spellcastingField, fileLoader);
  } else if (spellcastingField && typeof spellcastingField === "object") {
    // Parse inline definition
    spellcasting = parseSpellcastingConfig(spellcastingField);
  } else {
    // Use default
    spellcasting = {
      circles: [],
      providers: [],
      collectors: [],
    };
  }

  // Parse conditions (either inline, from external file, or file list)
  let conditions: ConditionsSystemConfig;
  if (typeof conditionsField === "string" && fileLoader) {
    // Load from external file or folder
    const filePaths = await resolveFileOrFolder(conditionsField, folderLister);
    if (filePaths.length === 1 && filePaths[0] === conditionsField) {
      conditions = await loadConditionsFromFile(conditionsField, fileLoader);
    } else {
      conditions = await loadConditionsFromFiles(filePaths, fileLoader);
    }
  } else if (Array.isArray(conditionsField) && conditionsField.length > 0 && typeof conditionsField[0] === "string" && fileLoader) {
    // Load from multiple files (array of strings)
    conditions = await loadConditionsFromFiles(conditionsField as string[], fileLoader);
  } else if (conditionsField && typeof conditionsField === "object") {
    // Parse inline definition (array of objects or wrapped object)
    conditions = parseConditionsConfig(conditionsField);
  } else {
    // Use default
    conditions = {
      conditions: [],
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
    conditions,
  };

  return system;
}

// Re-export types and functions for consumers
export type { FileLoader, FolderLister };
export { resolveFileOrFolder } from "./attributes";
export {
  parseExpressions,
  loadExpressionsFromFile,
  loadExpressionsFromFiles,
} from "./expressions";
export {
  parseFunctionBlock,
  parseFunctionExpressions,
  compileFunctionExpressions,
  isFunctionExpressionBlock,
} from "./function-expressions";
export type { ParsedFunction } from "./function-expressions";
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
  parseConditionsConfig,
  loadConditionsFromFile,
  loadConditionsFromFiles,
} from "./conditions";
export {
  resolveAttributes,
  parseAttributeDefinitionsFromMarkdown,
} from "./attributes";
export { parseFieldDefinitions } from "./fields";
