/**
 * System markdown parser
 * 
 * Parses RPG system definitions from markdown files containing rpg code blocks.
 * Reads `rpg system`, `rpg expression`, `rpg skill-list`, `rpg system-features`, and `rpg system-spellcasting` blocks.
 */

import { parse as parseYaml } from "yaml";
import * as Handlebars from "handlebars";
import {
  RPGSystem,
  EntityTypeDef,
  FrontmatterFieldDef,
  ExpressionDef,
  SkillDefinition,
  FeatureSystemConfig,
  SpellcastingSystemConfig,
} from "./types";
import { extractCodeBlocks } from "../utils/codeblock-extractor";

/**
 * File loader function type for loading external system definition files
 */
export type FileLoader = (filePath: string) => Promise<string | null>;

/**
 * Parse a system definition from markdown file content
 * 
 * @param fileContent - Raw markdown content containing rpg code blocks
 * @param fileLoader - Optional function to load external files (for file path references)
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
  const attributes = systemYaml.attributes || [];
  
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

  // Extract and parse expressions
  const expressions = parseExpressions(fileContent);

  // Extract and parse skills
  const skills = parseSkills(fileContent);

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
    entities,
    skills,
    expressions,
    features,
    spellcasting,
  };

  return system;
}

/**
 * Parse frontmatter field definitions
 */
function parseFieldDefinitions(fields: any[]): FrontmatterFieldDef[] {
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields.map((field) => {
    const def: FrontmatterFieldDef = {
      name: field.name,
      type: field.type || "string",
    };

    if (field.default !== undefined) {
      def.default = field.default;
    }
    if (field.derived) {
      def.derived = field.derived;
    }
    if (field.aliases) {
      def.aliases = Array.isArray(field.aliases) ? field.aliases : [field.aliases];
    }

    return def;
  });
}

/**
 * Parse all rpg expression blocks from markdown
 */
function parseExpressions(fileContent: string): Map<string, ExpressionDef> {
  const expressionMap = new Map<string, ExpressionDef>();
  const expressionBlocks = extractCodeBlocks(fileContent, "rpg expression");

  for (const block of expressionBlocks) {
    const exprYaml = parseYaml(block);
    if (!exprYaml || typeof exprYaml !== "object") {
      continue;
    }

    const id = exprYaml.id;
    const params = exprYaml.params || [];
    const formula = exprYaml.formula || "";

    if (!id) {
      console.warn("Expression block missing 'id' field");
      continue;
    }

    // Compile the Handlebars template
    let compiledTemplate: HandlebarsTemplateDelegate;
    try {
      compiledTemplate = Handlebars.compile(formula);
    } catch (error) {
      console.error(`Failed to compile expression '${id}':`, error);
      continue;
    }

    // Create evaluate function
    const evaluate = (context: Record<string, number | string | boolean>): number | string | boolean => {
      try {
        const result = compiledTemplate(context);
        // Try to parse as number if possible
        const numResult = parseFloat(result);
        if (!isNaN(numResult)) {
          return numResult;
        }
        // Return as boolean if it's a boolean string
        if (result === "true") return true;
        if (result === "false") return false;
        return result;
      } catch (error) {
        console.error(`Failed to evaluate expression '${id}':`, error);
        return 0;
      }
    };

    const expressionDef: ExpressionDef = {
      id,
      params,
      formula,
      evaluate,
    };

    expressionMap.set(id, expressionDef);
  }

  return expressionMap;
}

/**
 * Parse rpg skill-list blocks from markdown
 */
function parseSkills(fileContent: string): SkillDefinition[] {
  const skillBlocks = extractCodeBlocks(fileContent, "rpg skill-list");
  if (skillBlocks.length === 0) {
    return [];
  }

  const skillYaml = parseYaml(skillBlocks[0]);
  if (!skillYaml || typeof skillYaml !== "object") {
    return [];
  }

  const skills = skillYaml.skills;
  if (!Array.isArray(skills)) {
    return [];
  }

  return skills.map((skill) => ({
    label: skill.label || "",
    attribute: skill.attribute || "",
  }));
}

/**
 * Parse features configuration from inline object
 */
function parseFeaturesConfig(featuresObj: any): FeatureSystemConfig {
  return {
    categories: featuresObj.categories || [],
    providers: featuresObj.providers || [],
    collectors: featuresObj.collectors || [],
  };
}

/**
 * Parse spellcasting configuration from inline object
 */
function parseSpellcastingConfig(spellcastingObj: any): SpellcastingSystemConfig {
  return {
    circles: spellcastingObj.circles || [],
    lists: spellcastingObj.lists,
    providers: spellcastingObj.providers || [],
    collectors: spellcastingObj.collectors || [],
  };
}

/**
 * Load features configuration from external file
 * 
 * @param filePath - Path to file containing rpg system-features block
 * @param fileLoader - Function to load file content
 * @returns Parsed features configuration
 */
async function loadFeaturesFromFile(
  filePath: string,
  fileLoader: FileLoader
): Promise<FeatureSystemConfig> {
  try {
    const content = await fileLoader(filePath);
    if (!content) {
      console.error(`Failed to load features file: ${filePath}`);
      return {
        categories: [],
        providers: [],
        collectors: [],
      };
    }

    const featureBlocks = extractCodeBlocks(content, "rpg system-features");
    if (featureBlocks.length === 0) {
      console.error(`No rpg system-features block found in ${filePath}`);
      return {
        categories: [],
        providers: [],
        collectors: [],
      };
    }

    const featuresYaml = parseYaml(featureBlocks[0]);
    if (!featuresYaml || typeof featuresYaml !== "object") {
      console.error(`Invalid features YAML in ${filePath}`);
      return {
        categories: [],
        providers: [],
        collectors: [],
      };
    }

    return parseFeaturesConfig(featuresYaml);
  } catch (error) {
    console.error(`Error loading features from ${filePath}:`, error);
    return {
      categories: [],
      providers: [],
      collectors: [],
    };
  }
}

/**
 * Load spellcasting configuration from external file
 * 
 * @param filePath - Path to file containing rpg system-spellcasting block
 * @param fileLoader - Function to load file content
 * @returns Parsed spellcasting configuration
 */
async function loadSpellcastingFromFile(
  filePath: string,
  fileLoader: FileLoader
): Promise<SpellcastingSystemConfig> {
  try {
    const content = await fileLoader(filePath);
    if (!content) {
      console.error(`Failed to load spellcasting file: ${filePath}`);
      return {
        circles: [],
        providers: [],
        collectors: [],
      };
    }

    const spellcastingBlocks = extractCodeBlocks(content, "rpg system-spellcasting");
    if (spellcastingBlocks.length === 0) {
      console.error(`No rpg system-spellcasting block found in ${filePath}`);
      return {
        circles: [],
        providers: [],
        collectors: [],
      };
    }

    const spellcastingYaml = parseYaml(spellcastingBlocks[0]);
    if (!spellcastingYaml || typeof spellcastingYaml !== "object") {
      console.error(`Invalid spellcasting YAML in ${filePath}`);
      return {
        circles: [],
        providers: [],
        collectors: [],
      };
    }

    return parseSpellcastingConfig(spellcastingYaml);
  } catch (error) {
    console.error(`Error loading spellcasting from ${filePath}:`, error);
    return {
      circles: [],
      providers: [],
      collectors: [],
    };
  }
}
