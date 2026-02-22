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
 * Detect whether a skills block uses the wikilink list format:
 *   - [[Skill Name]]
 *   - [[Skill Name]]
 */
function isWikilinkFormat(content: string): boolean {
  return content.split("\n").some((line) => /^\s*-\s*\[\[/.test(line));
}

/**
 * A wikilink reference parsed from a skills block line.
 */
interface WikilinkRef {
  /** The Obsidian file path (without .md extension) */
  filePath: string;
  /** Display name – the alias if present, otherwise the last path segment */
  displayName: string;
}

/**
 * Parse wikilink references from a skills block that uses the wikilink list format.
 * Supports:
 *   - [[Skill Name]]
 *   - [[path/to/Skill Name|Display Alias]]
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
 * Extract YAML frontmatter from a markdown file.
 * Returns an empty object when no frontmatter block is present.
 */
function parseMarkdownFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  try {
    return (parseYaml(match[1]) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

/**
 * Strip YAML frontmatter from a markdown file, returning only the body.
 */
function getMarkdownBody(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

/**
 * Parse rpg skill-list or rpg system.skills blocks from markdown content.
 *
 * Supports two block formats:
 *
 * **YAML format** (full skill metadata):
 * ```rpg system.skills
 * - name: Acrobatics
 *   attribute: dexterity
 *   description: ...
 * ```
 *
 * **Wikilink list format** (links to individual skill notes):
 * ```rpg system.skills
 * - [[Acrobatics]]
 * - [[Athletics]]
 * ```
 * When using the wikilink format without a `fileLoader`, only the skill name is
 * captured (attribute/description require loading the linked files – use
 * `loadSkillsFromFile` instead for the full experience).
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

  const blockContent = skillBlocks[0];

  // ── Wikilink list format ──────────────────────────────────────────────────
  if (isWikilinkFormat(blockContent)) {
    return parseWikilinkRefs(blockContent).map((ref) => ({
      name: ref.displayName,
      attribute: "",
    }));
  }

  // ── YAML format ───────────────────────────────────────────────────────────
  const skillYaml = parseYaml(blockContent);
  if (!skillYaml || typeof skillYaml !== "object") {
    return [];
  }

  // Support both direct array (new format without wrapper)
  // and wrapped in 'skills' field (old format)
  let skills: any[];
  if (Array.isArray(skillYaml)) {
    // Direct array (new format): [{label: "Acrobatics", attribute: "dexterity"}, ...]
    skills = skillYaml;
  } else if (Array.isArray((skillYaml as any).skills)) {
    // Array in 'skills' field (old format): {skills: [{...}, {...}]}
    skills = (skillYaml as any).skills;
  } else {
    return [];
  }

  return skills.map((skill) => {
    const base: Record<string, unknown> = {};
    if (skill.name !== undefined) base.name = skill.name;
    if (skill.label !== undefined) base.label = skill.label;
    base.attribute = skill.attribute || "";
    if (skill.subtitle !== undefined) base.subtitle = skill.subtitle;
    if (skill.description !== undefined) base.description = skill.description;
    // Pass through any additional custom properties
    const extras = Object.fromEntries(
      Object.entries(skill).filter(
        ([k]) => !["name", "label", "attribute", "subtitle", "description"].includes(k)
      )
    );
    return { ...base, ...extras } as SkillDefinition;
  });
}

/**
 * Derive a skill name from a file path by taking the last path segment
 * and stripping any `.md` extension.
 *
 *   "skills/Acrobatics.md" → "Acrobatics"
 *   "Arcana"               → "Arcana"
 */
function nameFromFilePath(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.md$/i, "");
}

// File-loading functions are in a separate module to keep this file focused on parsing.
export { loadSkillsFromFile, loadSkillsFromFiles } from "./skills-file-loader";
