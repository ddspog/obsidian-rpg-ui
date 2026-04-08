/**
 * wiki-fixtures.ts
 *
 * Loads vault compendium files at Storybook build time using import.meta.glob.
 * The resulting arrays replicate what the real Obsidian wiki.folder() API returns
 * so the vault system initialises with real skills, conditions, and features.
 *
 * Frontmatter format used by these files:
 *   ---
 *   .metadata: { cssclasses: [...] }
 *   .SKILL: { attribute: "intelligence", subtitle: "..." }
 *   ---
 *   <markdown body>
 */

import { parse as parseYaml } from "yaml";

// ── Raw file imports ──────────────────────────────────────────────────────────

const rawSkills = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/skills/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawConditions = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/conditions/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// ── Frontmatter parser ────────────────────────────────────────────────────────

function splitFrontmatter(raw: string): { fm: Record<string, unknown>; body: string } {
  if (!raw.startsWith("---")) return { fm: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { fm: {}, body: raw };
  const fmRaw = raw.slice(4, end); // skip opening "---\n"
  const body = raw.slice(end + 4).trim(); // skip closing "\n---"
  let fm: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(fmRaw);
    if (parsed && typeof parsed === "object") fm = parsed as Record<string, unknown>;
  } catch {
    // malformed frontmatter — leave empty
  }
  return { fm, body };
}

function basename(filePath: string): string {
  return filePath.split("/").pop()?.replace(/\.md$/, "") ?? filePath;
}

// ── Skills ────────────────────────────────────────────────────────────────────

export interface SkillDefinition {
  $name: string;
  attribute: string;
  subtitle?: string;
  $contents?: string;
  [key: string]: unknown;
}

export const skills: SkillDefinition[] = Object.entries(rawSkills).map(([path, raw]) => {
  const { fm, body } = splitFrontmatter(raw);
  const skill = (fm[".SKILL"] ?? {}) as Record<string, unknown>;
  return {
    $name: basename(path),
    attribute: (skill.attribute as string) ?? "strength",
    subtitle: skill.subtitle as string | undefined,
    $contents: body || undefined,
  };
});

// ── Conditions ────────────────────────────────────────────────────────────────

export interface ConditionDefinition {
  $name: string;
  icon?: string;
  $contents?: string;
  [key: string]: unknown;
}

export const conditions: ConditionDefinition[] = Object.entries(rawConditions).map(
  ([path, raw]) => {
    const { body } = splitFrontmatter(raw);
    return {
      $name: basename(path),
      $contents: body || undefined,
    };
  },
);
