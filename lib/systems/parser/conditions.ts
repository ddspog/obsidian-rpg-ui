/**
 * Conditions Parser
 *
 * Handles parsing and loading of conditions system configuration.
 * Supports both YAML format and wikilink list format:
 *
 * **YAML format:**
 * ```rpg system.conditions
 * - name: Blinded
 *   icon: 🙈
 *   description: A blinded creature can't see...
 * ```
 *
 * **Wikilink list format (links to condition notes):**
 * ```rpg system.conditions
 * - [[Blinded]]
 * - [[Charmed]]
 * ```
 */

import { parse as parseYaml } from "yaml";
import { ConditionDefinition, ConditionsSystemConfig } from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";

export type FileLoader = (filePath: string) => Promise<string | null>;

/**
 * Detect whether a conditions block uses the wikilink list format.
 */
function isWikilinkFormat(content: string): boolean {
  return content.split("\n").some((line) => /^\s*-\s*\[\[/.test(line));
}

/**
 * A wikilink reference parsed from a conditions block line.
 */
interface WikilinkRef {
  /** The Obsidian file path (without .md extension) */
  filePath: string;
  /** Display name – the alias if present, otherwise the last path segment */
  displayName: string;
}

/**
 * Parse wikilink references from a conditions block.
 * Supports:
 *   - [[Condition Name]]
 *   - [[path/to/Condition Name|Display Alias]]
 */
function parseWikilinkRefs(content: string): WikilinkRef[] {
  const refs: WikilinkRef[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*-\s*\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/);
    if (match) {
      const filePath = match[1].trim();
      const displayName = match[2]?.trim() || (filePath.split("/").pop() ?? filePath);
      refs.push({ filePath, displayName });
    }
  }
  return refs;
}

/**
 * Parse conditions configuration from inline object or array
 *
 * @param conditionsObj - Conditions configuration object from YAML (array or object with conditions field)
 * @returns Parsed conditions configuration
 */
export function parseConditionsConfig(conditionsObj: unknown): ConditionsSystemConfig {
  let conditions: ConditionDefinition[];

  if (Array.isArray(conditionsObj)) {
    conditions = conditionsObj.map(parseConditionEntry);
  } else if (
    conditionsObj &&
    typeof conditionsObj === "object" &&
    "conditions" in conditionsObj &&
    Array.isArray((conditionsObj as { conditions: unknown }).conditions)
  ) {
    conditions = (conditionsObj as { conditions: unknown[] }).conditions.map(parseConditionEntry);
  } else {
    conditions = [];
  }

  return { conditions };
}

/**
 * Parse a single condition entry from YAML data.
 */
function parseConditionEntry(entry: unknown): ConditionDefinition {
  if (typeof entry === "string") {
    return { name: entry };
  }
  if (entry && typeof entry === "object") {
    const obj = entry as Record<string, unknown>;
    return {
      name: (obj.name as string) || "Unknown",
      icon: obj.icon as string | undefined,
      description: obj.description as string | undefined,
      ...Object.fromEntries(
        Object.entries(obj).filter(([k]) => !["name", "icon", "description"].includes(k)),
      ),
    };
  }
  return { name: "Unknown" };
}

/**
 * Parse conditions from markdown content containing `rpg system.conditions` blocks.
 *
 * Supports two formats:
 * - **YAML format**: array of condition objects
 * - **Wikilink list format**: links to individual condition notes
 *
 * @param fileContent - Markdown content containing conditions blocks
 * @returns Parsed conditions configuration
 */
export function parseConditions(fileContent: string): ConditionsSystemConfig {
  const conditionBlocks = extractCodeBlocks(fileContent, "rpg system.conditions");
  if (conditionBlocks.length === 0) {
    return { conditions: [] };
  }

  const blockContent = conditionBlocks[0];

  // Wikilink list format
  if (isWikilinkFormat(blockContent)) {
    const refs = parseWikilinkRefs(blockContent);
    return {
      conditions: refs.map((ref) => ({
        name: ref.displayName,
      })),
    };
  }

  // YAML format
  const conditionsYaml = parseYaml(blockContent);
  if (!conditionsYaml || typeof conditionsYaml !== "object") {
    return { conditions: [] };
  }

  return parseConditionsConfig(conditionsYaml);
}

/**
 * Load conditions configuration from external file
 *
 * @param filePath - Path to file containing rpg system.conditions block
 * @param fileLoader - Function to load file content
 * @returns Parsed conditions configuration
 */
export async function loadConditionsFromFile(
  filePath: string,
  fileLoader: FileLoader,
): Promise<ConditionsSystemConfig> {
  try {
    const content = await fileLoader(filePath);
    if (!content) {
      console.error(`Failed to load conditions file: ${filePath}`);
      return { conditions: [] };
    }

    return parseConditions(content);
  } catch (error) {
    console.error(`Error loading conditions from ${filePath}:`, error);
    return { conditions: [] };
  }
}

/**
 * Load conditions configuration from multiple external files
 *
 * @param filePaths - Paths to files containing condition definitions
 * @param fileLoader - Function to load file content
 * @returns Merged conditions configuration
 */
export async function loadConditionsFromFiles(
  filePaths: string[],
  fileLoader: FileLoader,
): Promise<ConditionsSystemConfig> {
  const allConditions: ConditionDefinition[] = [];

  for (const fp of filePaths) {
    const result = await loadConditionsFromFile(fp, fileLoader);
    allConditions.push(...result.conditions);
  }

  return { conditions: allConditions };
}
