/**
 * Features Parser
 * 
 * Handles parsing and loading of feature system configuration
 */

import { parse as parseYaml } from "yaml";
import { FeatureSystemConfig } from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";

export type FileLoader = (filePath: string) => Promise<string | null>;

/**
 * Parse features configuration from inline object
 * 
 * @param featuresObj - Features configuration object from YAML
 * @returns Parsed features configuration
 */
export function parseFeaturesConfig(featuresObj: any): FeatureSystemConfig {
  return {
    categories: featuresObj.categories || [],
    providers: featuresObj.providers || [],
    collectors: featuresObj.collectors || [],
  };
}

/**
 * Load features configuration from external file
 * 
 * @param filePath - Path to file containing rpg system.features block
 * @param fileLoader - Function to load file content
 * @returns Parsed features configuration
 */
export async function loadFeaturesFromFile(
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
