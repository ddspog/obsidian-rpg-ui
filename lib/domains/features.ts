/**
 * Features domain
 * 
 * Handles parsing and logic for the features block.
 * Phase 2: Basic structure with minimal functionality.
 */

import { parse } from "yaml";
import * as Utils from "lib/utils/utils";

/**
 * Feature requirement
 */
export interface FeatureRequirement {
  level?: number;
  feature?: string;
  attribute?: Record<string, number>;
}

/**
 * Feature definition
 */
export interface Feature {
  name: string;
  level?: number;
  description?: string;
  reset_on?: string;
  uses?: number;
  state_key?: string;
  requires?: FeatureRequirement;
  optional?: boolean;
}

/**
 * Choice definition
 */
export interface Choice {
  name: string;
  pick: number;
  options: string[];
}

/**
 * Feature category
 */
export interface FeatureCategory {
  name: string;
  icon?: string;
  requires?: FeatureRequirement;
  features?: Feature[];
  choices?: Choice[];
}

/**
 * Features block definition
 */
export interface FeaturesBlock {
  state_key?: string;
  class?: string;
  categories: FeatureCategory[];
}

/**
 * Parse features block from YAML
 */
export function parseFeaturesBlock(yamlString: string): FeaturesBlock {
  const def: FeaturesBlock = {
    categories: [],
  };

  const parsed = parse(yamlString);
  return Utils.mergeWithDefaults(parsed, def);
}

/**
 * Check if a feature's requirements are met
 */
export function areRequirementsMet(
  requires: FeatureRequirement | undefined,
  context: {
    level: number;
    attributes: Record<string, number>;
    availableFeatures: string[];
  }
): boolean {
  if (!requires) {
    return true;
  }

  // Check level requirement
  if (requires.level !== undefined && context.level < requires.level) {
    return false;
  }

  // Check feature prerequisite
  if (requires.feature !== undefined && !context.availableFeatures.includes(requires.feature)) {
    return false;
  }

  // Check attribute requirements
  if (requires.attribute) {
    for (const [attr, minValue] of Object.entries(requires.attribute)) {
      const currentValue = context.attributes[attr] || 0;
      if (currentValue < minValue) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get all available features (those whose requirements are met)
 */
export function getAvailableFeatures(
  categories: FeatureCategory[],
  context: {
    level: number;
    attributes: Record<string, number>;
  }
): Feature[] {
  const available: Feature[] = [];
  
  // Build available feature names iteratively
  const availableNames: string[] = [];
  
  for (const category of categories) {
    if (!areRequirementsMet(category.requires, { ...context, availableFeatures: availableNames })) {
      continue;
    }
    
    if (category.features) {
      for (const feature of category.features) {
        if (areRequirementsMet(feature.requires, { ...context, availableFeatures: availableNames })) {
          available.push(feature);
          availableNames.push(feature.name);
        }
      }
    }
  }
  
  return available;
}
