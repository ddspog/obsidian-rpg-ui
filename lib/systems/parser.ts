/**
 * System markdown parser
 * 
 * Parses RPG system definitions from markdown files containing rpg code blocks.
 * Reads `rpg system`, `rpg expression`, `rpg skill-list`, `rpg system.features`, and `rpg system.spellcasting` blocks.
 */

import { parse as parseYaml } from "yaml";
import * as Handlebars from "handlebars";
import { calculateModifier } from "../domains/abilities";
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
 * Initialize Handlebars helpers for template expressions
 */
function initializeHandlebarsHelpers() {
  // Register helper functions for math operations
  Handlebars.registerHelper("add", (...args: any[]) => {
    // Last argument is handlebars options object, filter it out
    const numbers = args
      .slice(0, -1)
      .map((n) => Number(n))
      .filter((n) => !isNaN(n));
    return numbers.reduce((sum, n) => sum + n, 0);
  });

  Handlebars.registerHelper("subtract", (a: number, b: number) => a - b);
  Handlebars.registerHelper("multiply", (a: number, b: number) => a * b);
  Handlebars.registerHelper("divide", (a: number, b: number) => a / b);
  Handlebars.registerHelper("floor", (a: number) => Math.floor(a));
  Handlebars.registerHelper("ceil", (a: number) => Math.ceil(a));
  Handlebars.registerHelper("round", (a: number) => Math.round(a));
  Handlebars.registerHelper("modifier", (score: number) => calculateModifier(score));

  // Text helpers
  Handlebars.registerHelper("strip-link", (a: string) => a.replace(/\[\[([^|]+)\|([^\]]+)\]\]/g, "$2"));
}

// Initialize helpers when module loads
initializeHandlebarsHelpers();

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
 * Parse all rpg expression or rpg system.expressions blocks from markdown
 */
function parseExpressions(fileContent: string): Map<string, ExpressionDef> {
  const expressionMap = new Map<string, ExpressionDef>();
  
  // Try both rpg expression and rpg system.expressions (new format)
  let expressionBlocks = extractCodeBlocks(fileContent, "rpg system.expressions");
  if (expressionBlocks.length === 0) {
    // Fall back to rpg expression (backward compatibility)
    expressionBlocks = extractCodeBlocks(fileContent, "rpg expression");
  }

  for (const block of expressionBlocks) {
    const exprYaml = parseYaml(block);
    if (!exprYaml || typeof exprYaml !== "object") {
      continue;
    }

    // Support both array of expressions (new format without wrapper)
    // and single expression or expressions wrapped in 'expressions:' field (old format)
    let expressions: any[];
    if (Array.isArray(exprYaml)) {
      // Direct array (new format): [{id: "modifier", ...}, {id: "saving_throw", ...}]
      expressions = exprYaml;
    } else if (Array.isArray(exprYaml.expressions)) {
      // Array in 'expressions' field (old format): {expressions: [{...}, {...}]}
      expressions = exprYaml.expressions;
    } else {
      // Single expression object: {id: "modifier", ...}
      expressions = [exprYaml];
    }

    for (const expr of expressions) {
      const id = expr.id;
      const params = expr.params || [];
      const formula = expr.formula || "";

      if (!id) {
        console.warn("Expression missing 'id' field");
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
  }

  return expressionMap;
}

/**
 * Parse rpg skill-list or rpg system.skills blocks from markdown
 */
function parseSkills(fileContent: string): SkillDefinition[] {
  // Try rpg system.skills first (new format)
  let skillBlocks = extractCodeBlocks(fileContent, "rpg system.skills");
  if (skillBlocks.length === 0) {
    // Fall back to rpg skill-list (backward compatibility)
    skillBlocks = extractCodeBlocks(fileContent, "rpg skill-list");
  }
  
  if (skillBlocks.length === 0) {
    return [];
  }

  const skillYaml = parseYaml(skillBlocks[0]);
  if (!skillYaml || typeof skillYaml !== "object") {
    return [];
  }

  // Support both direct array (new format without wrapper)
  // and wrapped in 'skills' field (old format)
  let skills: any[];
  if (Array.isArray(skillYaml)) {
    // Direct array (new format): [{label: "Acrobatics", attribute: "dexterity"}, ...]
    skills = skillYaml;
  } else if (Array.isArray(skillYaml.skills)) {
    // Array in 'skills' field (old format): {skills: [{...}, {...}]}
    skills = skillYaml.skills;
  } else {
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
 * @param filePath - Path to file containing rpg system.features block
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

    const featureBlocks = extractCodeBlocks(content, "rpg system.features");
    if (featureBlocks.length === 0) {
      console.error(`No rpg system.features block found in ${filePath}`);
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
 * @param filePath - Path to file containing rpg system.spellcasting block
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

    const spellcastingBlocks = extractCodeBlocks(content, "rpg system.spellcasting");
    if (spellcastingBlocks.length === 0) {
      console.error(`No rpg system.spellcasting block found in ${filePath}`);
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

/**
 * Load skills from external file
 * 
 * @param filePath - Path to file containing rpg skill-list or rpg system.skills block
 * @param fileLoader - Function to load file content
 * @returns Parsed skill definitions
 */
async function loadSkillsFromFile(
  filePath: string,
  fileLoader: FileLoader
): Promise<SkillDefinition[]> {
  try {
    const content = await fileLoader(filePath);
    if (!content) {
      console.error(`Failed to load skills file: ${filePath}`);
      return [];
    }

    // Try both rpg system.skills and rpg skill-list (backward compatibility)
    let skillBlocks = extractCodeBlocks(content, "rpg system.skills");
    if (skillBlocks.length === 0) {
      skillBlocks = extractCodeBlocks(content, "rpg skill-list");
    }

    if (skillBlocks.length === 0) {
      console.error(`No rpg system.skills or rpg skill-list block found in ${filePath}`);
      return [];
    }

    const skillYaml = parseYaml(skillBlocks[0]);
    if (!skillYaml || typeof skillYaml !== "object") {
      console.error(`Invalid skills YAML in ${filePath}`);
      return [];
    }

    // Support both direct array (new format) and wrapped in 'skills' field (old format)
    let skills: any[];
    if (Array.isArray(skillYaml)) {
      skills = skillYaml;
    } else if (Array.isArray(skillYaml.skills)) {
      skills = skillYaml.skills;
    } else {
      return [];
    }

    return skills.map((skill) => ({
      label: skill.label || "",
      attribute: skill.attribute || "",
    }));
  } catch (error) {
    console.error(`Error loading skills from ${filePath}:`, error);
    return [];
  }
}

/**
 * Load skills from multiple external files
 * 
 * @param filePaths - Array of paths to files containing skill definitions
 * @param fileLoader - Function to load file content
 * @returns Merged skill definitions from all files
 */
async function loadSkillsFromFiles(
  filePaths: string[],
  fileLoader: FileLoader
): Promise<SkillDefinition[]> {
  const allSkills: SkillDefinition[] = [];

  for (const filePath of filePaths) {
    const skills = await loadSkillsFromFile(filePath, fileLoader);
    allSkills.push(...skills);
  }

  return allSkills;
}

/**
 * Load expressions from external file
 * 
 * @param filePath - Path to file containing rpg expression or rpg system.expressions blocks
 * @param fileLoader - Function to load file content
 * @returns Parsed expression definitions
 */
async function loadExpressionsFromFile(
  filePath: string,
  fileLoader: FileLoader
): Promise<Map<string, ExpressionDef>> {
  try {
    const content = await fileLoader(filePath);
    if (!content) {
      console.error(`Failed to load expressions file: ${filePath}`);
      return new Map();
    }

    // Parse expressions from the file (supports both rpg expression and rpg system.expressions)
    return parseExpressions(content);
  } catch (error) {
    console.error(`Error loading expressions from ${filePath}:`, error);
    return new Map();
  }
}

/**
 * Load expressions from multiple external files
 * 
 * @param filePaths - Array of paths to files containing expression definitions
 * @param fileLoader - Function to load file content
 * @returns Merged expression definitions from all files
 */
async function loadExpressionsFromFiles(
  filePaths: string[],
  fileLoader: FileLoader
): Promise<Map<string, ExpressionDef>> {
  const allExpressions = new Map<string, ExpressionDef>();

  for (const filePath of filePaths) {
    const expressions = await loadExpressionsFromFile(filePath, fileLoader);
    // Merge expressions (later files override earlier ones if same id)
    for (const [id, expr] of expressions.entries()) {
      allExpressions.set(id, expr);
    }
  }

  return allExpressions;
}
