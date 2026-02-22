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
 * Lists markdown file paths inside a folder.
 * Returns an array of vault-relative `.md` file paths, or an empty array
 * if the path is not a folder.
 */
export type FolderLister = (folderPath: string) => Promise<string[]>;

/**
 * Resolve a string reference that may be a single file path or a folder path.
 * When a `folderLister` is provided and the path resolves to a non-empty list
 * of files, those file paths are returned. Otherwise the original path is
 * returned as a single-element array so the caller can load it as a file.
 */
export async function resolveFileOrFolder(
  refPath: string,
  folderLister?: FolderLister,
): Promise<string[]> {
  if (folderLister) {
    const files = await folderLister(refPath);
    if (files.length > 0) return files;
  }
  return [refPath];
}

/**
 * Derive a name from a file path by taking the last segment and stripping .md
 */
function nameFromFilePath(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.md$/i, "");
}

/** Extract YAML frontmatter from a markdown file. */
function parseMarkdownFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  try {
    return (parseYaml(match[1]) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

/** Strip YAML frontmatter, returning only the body. */
function getMarkdownBody(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

/**
 * Resolve attributes from various sources (inline, array, or external file/folder)
 * 
 * @param attributesField - Raw attributes field from system YAML
 * @param fileContent - Current file content for parsing inline definitions
 * @param fileLoader - Optional function to load external files
 * @param folderLister - Optional function to list files in a folder
 * @returns Object with attributes array and definitions
 */
export async function resolveAttributes(
  attributesField: unknown,
  fileContent: string,
  fileLoader?: FileLoader,
  folderLister?: FolderLister,
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
    const filePaths = await resolveFileOrFolder(attributesField, folderLister);
    const allDefinitions: AttributeDefinition[] = [];
    for (const fp of filePaths) {
      const content = await fileLoader(fp);
      if (content) {
        const defs = parseAttributeDefinitionsFromMarkdown(content);
        if (defs.length > 0) {
          allDefinitions.push(...defs);
        } else {
          // Single-file note: derive attribute from frontmatter or filename
          const fm = parseMarkdownFrontmatter(content);
          const name = typeof fm.name === "string" && fm.name
            ? fm.name
            : nameFromFilePath(fp);
          allDefinitions.push({
            name,
            ...(typeof fm.alias === "string" && fm.alias && { alias: fm.alias }),
            ...(typeof fm.subtitle === "string" && fm.subtitle && { subtitle: fm.subtitle }),
            ...(getMarkdownBody(content) && { description: getMarkdownBody(content) }),
          });
        }
      }
    }
    if (allDefinitions.length > 0) {
      return {
        attributes: allDefinitions.map((attr) => attr.name),
        attributeDefinitions: allDefinitions,
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
