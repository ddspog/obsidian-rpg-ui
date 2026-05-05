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

const rawClasses = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/classes/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawSubclasses = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/subclasses/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawLineages = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/lineages/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawHeritages = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/heritages/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawBackgrounds = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/backgrounds/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// Universal "default actions" bundled with every character — loaded from
// folders of standalone vault pages so they can be surfaced as trivial
// entries (compact link lists) in each aspect bucket of the Features panel.
const rawActions = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/actions/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawReactions = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/reactions/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawBonusActions = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/bonus-actions/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// Talents live in category subfolders (magic / martial / technical). Use a
// recursive glob so every talent `.md` surfaces under a single import, then
// the character entity's `@folder/path` indexer registers each file under
// both its parent subfolder (e.g. `compendium/talents/magic`) and the
// umbrella `compendium/talents` key.
const rawTalents = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/talents/**/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// Worldbuilding items used for `@folder/path` expansion inside `choose.options`
// arrays on the character sheet — e.g. an Adherent background asking the user
// to pick any tool from the `tools` folder as their proficiency.
const rawTools = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/worldbuilding/tools/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawMartial = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/worldbuilding/martial/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawSimple = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/worldbuilding/simple/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawCantrips = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/worldbuilding/cantrips/*.md",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const rawLanguages = import.meta.glob(
  "../../vault/systems/tales-of-the-valiant/compendium/languages/*.md",
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
  $path?: string;
  attribute: string;
  subtitle?: string;
  $contents?: string;
  [key: string]: unknown;
}

function stripSystemPrefix(fullPath: string): string {
  const idx = fullPath.indexOf("systems/");
  const trimmed = idx >= 0 ? fullPath.slice(idx) : fullPath;
  return trimmed.startsWith("systems/tales-of-the-valiant/")
    ? trimmed.slice("systems/tales-of-the-valiant/".length)
    : trimmed;
}

export const skills: SkillDefinition[] = Object.entries(rawSkills).map(([path, raw]) => {
  const { fm, body } = splitFrontmatter(raw);
  const skill = (fm[".SKILL"] ?? {}) as Record<string, unknown>;
  return {
    $name: basename(path),
    $path: stripSystemPrefix(path),
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

// ── Compendium docs (classes / subclasses / lineages / heritages / backgrounds) ──
//
// Each entry mirrors what the real Obsidian wiki.folder() returns: the
// frontmatter is spread onto the object alongside `$name` and `$contents`.
// parseSourceDoc(raw, kind) consumes this shape directly.

export interface CompendiumRaw {
  $name: string;
  $contents: string;
  [key: string]: unknown;
}

function buildCompendium(rawMap: Record<string, string>): CompendiumRaw[] {
  return Object.entries(rawMap).map(([path, raw]) => {
    const { fm, body } = splitFrontmatter(raw);
    return { $name: basename(path), $contents: body, ...fm };
  });
}

export const classes: CompendiumRaw[] = buildCompendium(rawClasses);
export const subclasses: CompendiumRaw[] = buildCompendium(rawSubclasses);
export const lineages: CompendiumRaw[] = buildCompendium(rawLineages);
export const heritages: CompendiumRaw[] = buildCompendium(rawHeritages);
export const backgrounds: CompendiumRaw[] = buildCompendium(rawBackgrounds);

// ── Worldbuilding items (tools, weapons) ──────────────────────────────────────
//
// Each entry mirrors `WikiFileDescriptor`: besides `$name` and `$contents`, we
// also expose `$path` and `$tags` so the character entity can derive a
// `folderIndex` from the path and a `tagIndex` from the tags via
// `buildCompendiumIndex`.

export interface WorldbuildingRaw extends CompendiumRaw {
  $path: string;
  $tags: string[];
}

function buildWorldbuilding(rawMap: Record<string, string>, prefix: string): WorldbuildingRaw[] {
  return Object.entries(rawMap).map(([path, raw]) => {
    const { fm, body } = splitFrontmatter(raw);
    const name = basename(path);
    // The raw import path starts at `../../vault/systems/.../worldbuilding/...`.
    // Strip everything up to the `systems/` segment so the remaining path
    // matches what `wiki.folder("worldbuilding/tools")` would return.
    const idx = path.indexOf("systems/");
    const trimmed = idx >= 0 ? path.slice(idx) : path;
    const $path = trimmed.startsWith("systems/tales-of-the-valiant/")
      ? trimmed.slice("systems/tales-of-the-valiant/".length)
      : `${prefix}/${name}.md`;
    const tagsRaw = (fm.tags ?? fm.tag ?? []) as unknown;
    const $tags = Array.isArray(tagsRaw)
      ? tagsRaw.filter(Boolean).map((t) => String(t).trim())
      : [];
    return { $name: name, $contents: body, $path, $tags, ...fm };
  });
}

export const tools: WorldbuildingRaw[] = buildWorldbuilding(
  rawTools,
  "worldbuilding/tools",
);
export const martial: WorldbuildingRaw[] = buildWorldbuilding(
  rawMartial,
  "worldbuilding/martial",
);
export const simple: WorldbuildingRaw[] = buildWorldbuilding(
  rawSimple,
  "worldbuilding/simple",
);
export const cantrips: WorldbuildingRaw[] = buildWorldbuilding(
  rawCantrips,
  "worldbuilding/cantrips",
);
export const languages: WorldbuildingRaw[] = buildWorldbuilding(
  rawLanguages,
  "compendium/languages",
);

export const actions: WorldbuildingRaw[] = buildWorldbuilding(
  rawActions,
  "compendium/actions",
);
export const reactions: WorldbuildingRaw[] = buildWorldbuilding(
  rawReactions,
  "compendium/reactions",
);
export const bonusActions: WorldbuildingRaw[] = buildWorldbuilding(
  rawBonusActions,
  "compendium/bonus-actions",
);
export const talents: WorldbuildingRaw[] = buildWorldbuilding(
  rawTalents,
  "compendium/talents",
);
