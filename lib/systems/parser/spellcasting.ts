/**
 * Spellcasting Parser
 *
 * Handles parsing and loading of spellcasting system configuration.
 * Supports multiple `rpg system.spellcasting` blocks per file, each defining
 * different aspects (lists, circles, schools, tags, spell-elements, etc.).
 * All blocks are merged into a single SpellcastingSystemConfig.
 */

import { parse as parseYaml } from "yaml";
import { SpellcastingSystemConfig } from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";

export type FileLoader = (filePath: string) => Promise<string | null>;

const EMPTY_CONFIG: SpellcastingSystemConfig = {
  circles: [],
  providers: [],
  collectors: [],
};

/**
 * Parse spellcasting configuration from inline object
 *
 * @param spellcastingObj - Spellcasting configuration object from YAML
 * @returns Parsed spellcasting configuration
 */
export function parseSpellcastingConfig(spellcastingObj: any): SpellcastingSystemConfig {
  const config: SpellcastingSystemConfig = {
    circles: spellcastingObj.circles || [],
    lists: spellcastingObj.lists,
    schools: spellcastingObj.schools,
    tags: spellcastingObj.tags,
    spellElements: spellcastingObj["spell-elements"],
    providers: spellcastingObj.providers || [],
    collectors: spellcastingObj.collectors || [],
  };
  return config;
}

/**
 * Merge two spellcasting configs, combining arrays from both.
 */
function mergeSpellcastingConfigs(
  base: SpellcastingSystemConfig,
  overlay: SpellcastingSystemConfig
): SpellcastingSystemConfig {
  return {
    circles: [...base.circles, ...overlay.circles],
    lists: mergeMaybeArrays(base.lists, overlay.lists),
    schools: mergeMaybeArrays(base.schools, overlay.schools),
    tags: mergeMaybeArrays(base.tags, overlay.tags),
    spellElements: mergeMaybeArrays(base.spellElements, overlay.spellElements),
    providers: [...base.providers, ...overlay.providers],
    collectors: [...base.collectors, ...overlay.collectors],
  };
}

function mergeMaybeArrays<T>(a?: T[], b?: T[]): T[] | undefined {
  if (!a && !b) return undefined;
  return [...(a || []), ...(b || [])];
}

/**
 * Load spellcasting configuration from external file.
 * Reads all `rpg system.spellcasting` blocks and merges them.
 *
 * @param filePath - Path to file containing rpg system.spellcasting block(s)
 * @param fileLoader - Function to load file content
 * @returns Parsed and merged spellcasting configuration
 */
export async function loadSpellcastingFromFile(
  filePath: string,
  fileLoader: FileLoader
): Promise<SpellcastingSystemConfig> {
  try {
    const content = await fileLoader(filePath);
    if (!content) {
      console.error(`Failed to load spellcasting file: ${filePath}`);
      return { ...EMPTY_CONFIG };
    }

    const spellcastingBlocks = extractCodeBlocks(content, "rpg system.spellcasting");
    if (spellcastingBlocks.length === 0) {
      console.error(`No rpg system.spellcasting block found in ${filePath}`);
      return { ...EMPTY_CONFIG };
    }

    let merged: SpellcastingSystemConfig = { ...EMPTY_CONFIG };

    for (const block of spellcastingBlocks) {
      const spellcastingYaml = parseYaml(block);
      if (!spellcastingYaml || typeof spellcastingYaml !== "object") {
        continue;
      }
      merged = mergeSpellcastingConfigs(merged, parseSpellcastingConfig(spellcastingYaml));
    }

    return merged;
  } catch (error) {
    console.error(`Error loading spellcasting from ${filePath}:`, error);
    return { ...EMPTY_CONFIG };
  }
}
