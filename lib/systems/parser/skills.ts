/**
 * Skills Parser
 * 
 * Handles parsing and loading of skill definitions
 */

import { parse as parseYaml } from "yaml";
import { SkillDefinition } from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";

export type FileLoader = (filePath: string) => Promise<string | null>;

/**
 * Parse rpg skill-list or rpg system.skills blocks from markdown content
 * 
 * @param fileContent - Markdown content containing skill blocks
 * @returns Array of skill definitions
 */
export function parseSkills(fileContent: string): SkillDefinition[] {
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
 * Load skills from external file
 * 
 * @param filePath - Path to file containing rpg skill-list or rpg system.skills block
 * @param fileLoader - Function to load file content
 * @returns Array of skill definitions
 */
export async function loadSkillsFromFile(
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
 * @returns Merged array of skill definitions from all files
 */
export async function loadSkillsFromFiles(
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
