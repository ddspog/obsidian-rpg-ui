/**
 * System markdown parser
 * 
 * Parses RPG system definitions from markdown files containing rpg code blocks.
 * Reads `rpg system`, `rpg expression`, and `rpg skill-list` blocks.
 */

import { parse as parseYaml } from "yaml";
import * as Handlebars from "handlebars";
import {
  RPGSystem,
  EntityTypeDef,
  FrontmatterFieldDef,
  ExpressionDef,
  SkillDefinition,
} from "./types";
import { extractCodeBlocks } from "../utils/codeblock-extractor";

/**
 * Parse a system definition from markdown file content
 * 
 * @param fileContent - Raw markdown content containing rpg code blocks
 * @returns Parsed RPG system or null if no valid system block found
 */
export function parseSystemFromMarkdown(fileContent: string): RPGSystem | null {
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

  // Build system object with defaults for features and spellcasting
  const system: RPGSystem = {
    name,
    attributes,
    entities,
    skills,
    expressions,
    features: systemYaml.features || {
      categories: [],
      providers: [],
      collectors: [],
    },
    spellcasting: systemYaml.spellcasting || {
      circles: [],
      providers: [],
      collectors: [],
    },
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
