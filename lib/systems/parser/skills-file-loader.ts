/**
 * Skills File Loader
 *
 * Loads skill definitions from external vault files.
 * Handles index files (rpg system.skills blocks) and single-skill note files.
 */

import { parse as parseYaml } from "yaml";
import { SkillDefinition } from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";
import type { FileLoader } from "./skills";

/**
 * Derive a skill name from a file path by taking the last path segment
 * and stripping any `.md` extension.
 */
function nameFromFilePath(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.md$/i, "");
}

/** Extract YAML frontmatter from a markdown file. */
function parseMarkdownFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  try { return (parseYaml(match[1]) as Record<string, unknown>) ?? {}; } catch { return {}; }
}

/** Strip YAML frontmatter from a markdown file. */
function getMarkdownBody(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

function isWikilinkFormat(content: string): boolean {
  return content.split("\n").some((line) => /^\s*-\s*\[\[/.test(line));
}

interface WikilinkRef { filePath: string; displayName: string; }

function parseWikilinkRefs(content: string): WikilinkRef[] {
  const refs: WikilinkRef[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*-\s*\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/);
    if (match) {
      const filePath = match[1].trim();
      refs.push({ filePath, displayName: match[2]?.trim() || (filePath.split("/").pop() ?? filePath) });
    }
  }
  return refs;
}

function mapYamlSkills(skills: any[]): SkillDefinition[] {
  return skills.map((skill) => {
    const base: Record<string, unknown> = {};
    if (skill.name !== undefined) base.name = skill.name;
    if (skill.label !== undefined) base.label = skill.label;
    base.attribute = skill.attribute || "";
    if (skill.subtitle !== undefined) base.subtitle = skill.subtitle;
    if (skill.description !== undefined) base.description = skill.description;
    const extras = Object.fromEntries(
      Object.entries(skill).filter(([k]) => !["name", "label", "attribute", "subtitle", "description"].includes(k))
    );
    return { ...base, ...extras } as SkillDefinition;
  });
}

/**
 * Load skills from an external file (index file or single skill note).
 */
export async function loadSkillsFromFile(
  filePath: string,
  fileLoader: FileLoader
): Promise<SkillDefinition[]> {
  try {
    const content = await fileLoader(filePath);
    if (!content) { console.error(`Failed to load skills file: ${filePath}`); return []; }

    let skillBlocks = extractCodeBlocks(content, "rpg system.skills");
    if (skillBlocks.length === 0) skillBlocks = extractCodeBlocks(content, "rpg skill-list");

    if (skillBlocks.length === 0) {
      const fm = parseMarkdownFrontmatter(content);
      const body = getMarkdownBody(content);
      const name = typeof fm.name === "string" && fm.name ? fm.name : nameFromFilePath(filePath);
      return [{
        name,
        attribute: typeof fm.attribute === "string" ? fm.attribute : "",
        ...(typeof fm.subtitle === "string" && fm.subtitle && { subtitle: fm.subtitle }),
        ...(body && { description: body }),
        ...Object.fromEntries(Object.entries(fm).filter(([k]) => !["name", "attribute", "subtitle"].includes(k))),
      }];
    }

    const blockContent = skillBlocks[0];

    if (isWikilinkFormat(blockContent)) {
      const skills: SkillDefinition[] = [];
      for (const ref of parseWikilinkRefs(blockContent)) {
        const linkedContent = (await fileLoader(`${ref.filePath}.md`)) ?? (await fileLoader(ref.filePath)) ?? null;
        if (linkedContent) {
          const fm = parseMarkdownFrontmatter(linkedContent);
          const body = getMarkdownBody(linkedContent);
          skills.push({
            name: ref.displayName,
            attribute: typeof fm.attribute === "string" ? fm.attribute : "",
            ...(typeof fm.subtitle === "string" && fm.subtitle && { subtitle: fm.subtitle }),
            ...(body && { description: body }),
          });
        } else {
          skills.push({ name: ref.displayName, attribute: "" });
        }
      }
      return skills;
    }

    const skillYaml = parseYaml(blockContent);
    if (!skillYaml || typeof skillYaml !== "object") { console.error(`Invalid skills YAML in ${filePath}`); return []; }

    const skills: any[] = Array.isArray(skillYaml) ? skillYaml : Array.isArray((skillYaml as any).skills) ? (skillYaml as any).skills : [];
    return mapYamlSkills(skills);
  } catch (error) {
    console.error(`Error loading skills from ${filePath}:`, error);
    return [];
  }
}

/**
 * Load skills from multiple external files.
 */
export async function loadSkillsFromFiles(
  filePaths: string[],
  fileLoader: FileLoader
): Promise<SkillDefinition[]> {
  const result: SkillDefinition[] = [];
  for (const fp of filePaths) {
    result.push(...(await loadSkillsFromFile(fp, fileLoader)));
  }
  return result;
}
