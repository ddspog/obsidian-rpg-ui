/**
 * Spellcasting Parser
 * 
 * Handles parsing and loading of spellcasting system configuration
 */

import { parse as parseYaml } from "yaml";
import { SpellcastingSystemConfig } from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";

export type FileLoader = (filePath: string) => Promise<string | null>;

/**
 * Parse spellcasting configuration from inline object
 * 
 * @param spellcastingObj - Spellcasting configuration object from YAML
 * @returns Parsed spellcasting configuration
 */
export function parseSpellcastingConfig(spellcastingObj: any): SpellcastingSystemConfig {
  return {
    circles: spellcastingObj.circles || [],
    lists: spellcastingObj.lists,
    providers: spellcastingObj.providers || [],
    collectors: spellcastingObj.collectors || [],
  };
}

/**
 * Load spellcasting configuration from external file
 * 
 * @param filePath - Path to file containing rpg system.spellcasting block
 * @param fileLoader - Function to load file content
 * @returns Parsed spellcasting configuration
 */
export async function loadSpellcastingFromFile(
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
