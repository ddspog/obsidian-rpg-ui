/**
 * Attribute Parser
 * 
 * Handles parsing of attribute definitions from system configuration
 */

import { parse as parseYaml } from "yaml";
import { AttributeDefinition } from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";

export type FileLoader = (filePath: string) => Promise<string | null>;

/**
 * Resolve attributes from various sources (inline, array, or external file)
 * 
 * @param attributesField - Raw attributes field from system YAML
 * @param fileContent - Current file content for parsing inline definitions
 * @param fileLoader - Optional function to load external files
 * @returns Object with attributes array and definitions
 */
export async function resolveAttributes(
  attributesField: unknown,
  fileContent: string,
  fileLoader?: FileLoader
): Promise<{ attributes: string[]; attributeDefinitions: AttributeDefinition[] }> {
  const attributeDefinitions: AttributeDefinition[] = [];

  if (Array.isArray(attributesField)) {
    const hasObjects = attributesField.some((item) => typeof item === "object" && item !== null);
    if (hasObjects) {
      for (const item of attributesField) {
        if (item && typeof item === "object" && "name" in item) {
          attributeDefinitions.push(item as AttributeDefinition);
        }
      }
      return {
        attributes: attributeDefinitions.map((attr) => attr.name),
        attributeDefinitions,
      };
    }

    const attributes = attributesField.filter((item) => typeof item === "string") as string[];
    const inlineDefinitions = parseAttributeDefinitionsFromMarkdown(fileContent);
    return {
      attributes,
      attributeDefinitions: inlineDefinitions,
    };
  }

  if (typeof attributesField === "string" && fileLoader) {
    const content = await fileLoader(attributesField);
    if (content) {
      const definitions = parseAttributeDefinitionsFromMarkdown(content);
      return {
        attributes: definitions.map((attr) => attr.name),
        attributeDefinitions: definitions,
      };
    }
  }

  const inlineDefinitions = parseAttributeDefinitionsFromMarkdown(fileContent);
  return {
    attributes: [],
    attributeDefinitions: inlineDefinitions,
  };
}

/**
 * Parse attribute definitions from markdown file content
 * 
 * @param content - Markdown content containing rpg system.attributes block
 * @returns Array of attribute definitions
 */
export function parseAttributeDefinitionsFromMarkdown(content: string): AttributeDefinition[] {
  const blocks = extractCodeBlocks(content, "rpg system.attributes");
  if (blocks.length === 0) return [];

  const parsed = parseYaml(blocks[0]);
  const definitions = Array.isArray(parsed) ? parsed : (parsed as any)?.attributes;

  if (!Array.isArray(definitions)) return [];

  return definitions.filter((item) => item && typeof item === "object" && "name" in item) as AttributeDefinition[];
}
