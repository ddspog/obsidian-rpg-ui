/**
 * Creature notes for the template and summon sheets: the bestiary of a system
 * (to try a template on), one creature's `stat.monster` block with its features
 * resolved, saving a homebrew draft, and a character's numbers (to fill a
 * summon). Reads the vault through the running Obsidian app.
 */

import { parseYaml, TFile, type App } from "obsidian";
import { parseMonsterTemplate } from "lib/domains/statblocks/monster-template";
import { resolveStatFeatures } from "lib/domains/statblocks/resolve-features";
import { parseTemplateBlock, templateBlockOf, type TemplateBlock } from "lib/domains/statblocks/template-block";
import type { ResolvedStatFeature, StatFeatureRef } from "lib/domains/statblocks/types";
import { SystemRegistry } from "lib/systems/registry";
import { splitFenceBody } from "lib/utils/fence-split";
import { buildEntityContext, entityTypeOf } from "./entity-context";
import { EntityResolver } from "./entity-resolver";

const appOf = (): App | undefined => (globalThis as unknown as { app?: App }).app;

/** The system folder a note sits in ("tales-of-the-valiant/…" → "tales-of-the-valiant"). */
export function systemRootOf(path: string): string {
  return path.split("/")[0] ?? "";
}

export interface CreatureEntry {
  path: string;
  name: string;
}

/**
 * The system's lineages for NPCs: the lineage notes that hold an NPC block (a `stat.template`
 * of kind lineage), and the humanoids' notes in `bestiary/templates/lineages/`, by name.
 */
export async function lineagesOf(fromPath: string): Promise<CreatureEntry[]> {
  const app = appOf();
  if (!app) return [];
  const root = systemRootOf(fromPath);
  const own = `${root}/worldbuilding/traits/lineages/`;
  const humanoids = `${root}/worldbuilding/bestiary/templates/lineages/`;
  const out: CreatureEntry[] = [];
  for (const f of app.vault.getMarkdownFiles()) {
    if (f.path.startsWith(humanoids)) out.push({ path: f.path, name: f.basename });
    else if (f.path.startsWith(own) && /```+\s*rpg\s+stat\.template\b/.test(await app.vault.cachedRead(f)))
      out.push({
        path: f.path,
        name: f.basename.replace(/\s*\((.+?) Variant\)$/, "").replace(/^.+ Lineage Variant,\s*/, ""),
      });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The system's bestiary notes, the template notes left out, by name. */
export function bestiaryOf(fromPath: string): CreatureEntry[] {
  const app = appOf();
  if (!app) return [];
  const prefix = `${systemRootOf(fromPath)}/worldbuilding/bestiary/`;
  return app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith(prefix) && !f.path.startsWith(`${prefix}templates/`))
    .map((f) => ({ path: f.path, name: f.basename }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface LoadedCreature {
  path: string;
  name: string;
  /** The block's YAML data. */
  data: Record<string, unknown>;
  /** Prose after the block's `---`. */
  rest?: string;
  features: ResolvedStatFeature[];
}

const STAT_FENCE = /^(`{3,})\s*rpg\s+stat\.monster\b[^\n]*\n([\s\S]*?)\n\1\s*$/m;

/** A note's `stat.monster` block, its features resolved; null when it has none. */
export async function loadCreature(path: string): Promise<LoadedCreature | null> {
  const app = appOf();
  const file = app?.vault.getAbstractFileByPath(path);
  if (!app || !(file instanceof TFile)) return null;
  const text = await app.vault.cachedRead(file);
  const m = text.match(STAT_FENCE);
  if (!m) return null;
  const { yaml, text: rest } = splitFenceBody(m[2]);
  const data = (parseYaml(yaml) ?? {}) as Record<string, unknown>;
  const name = typeof data.name === "string" && data.name ? data.name : file.basename;
  const refs = Array.isArray(data.features) ? (data.features as StatFeatureRef[]) : [];
  const features = await resolveStatFeatures(refs, path, {
    name: name.toLowerCase(),
    cr: data.cr,
    abilities: data.abilities,
    stats: data.stats,
  });
  return { path, name, data, ...(rest ? { rest: `---\n${rest}` } : {}), features };
}

/** Writes a new note; refuses one that exists. Returns its path. */
export async function createNote(path: string, text: string): Promise<string> {
  const app = appOf();
  if (!app) throw new Error("Obsidian is not ready.");
  if (app.vault.getAbstractFileByPath(path)) throw new Error(`${path} exists: choose another name.`);
  const folder = path.split("/").slice(0, -1).join("/");
  if (folder && !app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
  await app.vault.create(path, text);
  return path;
}

/** Opens a note in a new tab. */
export function openNote(path: string): void {
  const app = appOf();
  void app?.workspace.openLinkText(path, "", true);
}

export interface CharacterEntry {
  path: string;
  name: string;
}

let resolver: EntityResolver | undefined;

/** The characters of a system (notes with a `character.sheet` or `character.header` block), by name. */
export async function charactersOf(fromPath: string): Promise<CharacterEntry[]> {
  const app = appOf();
  if (!app) return [];
  const root = `${systemRootOf(fromPath)}/`;
  const out: CharacterEntry[] = [];
  for (const f of app.vault.getMarkdownFiles()) {
    if (!f.path.startsWith(root) || !/\/characters\//.test(f.path)) continue;
    const text = await app.vault.cachedRead(f);
    if (/```+\s*rpg\s+character\.(?:sheet|header)\b/.test(text)) out.push({ path: f.path, name: f.basename });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

/**
 * A character's numbers, for a summon's formulas: `level`, `pb`, `level_<class>`
 * (`level_ranger`), `mod_<ability>` (`mod_wis`). Empty when it cannot be read.
 */
export async function characterNumbers(path: string): Promise<Record<string, number>> {
  const app = appOf();
  if (!app) return {};
  try {
    resolver ??= new EntityResolver(app);
    const entity = await resolver.resolveEntity({ file: path });
    const system = SystemRegistry.getInstance().getSystemForFile(path);
    const type = entityTypeOf(system, entity.codeBlocks);
    if (!type) return {};
    const ctx = buildEntityContext(system, type, entity.codeBlocks, entity.frontmatter as Record<string, unknown>);
    const ex = ctx.expressions as Record<string, ((...a: unknown[]) => unknown) | undefined>;
    const out: Record<string, number> = {};
    const level = Number(ex.CharacterLevel?.());
    if (Number.isFinite(level)) out.level = level;
    const pb = Number(ex.ProficiencyBonus?.());
    if (Number.isFinite(pb)) out.pb = pb;
    for (const a of ABILITIES) {
      const v = Number(ex.Modifier?.(a));
      if (Number.isFinite(v)) out[`mod_${a.toLowerCase()}`] = v;
    }
    // Class levels from the sheet: `classes: - name: [[…/Ranger]] level: 3`.
    const sheet = [ctx.blocks.header, ctx.blocks.sheet].find(
      (b) => b && Array.isArray((b as { classes?: unknown }).classes)
    ) as { classes?: Array<{ name?: unknown; level?: unknown }> } | undefined;
    for (const c of sheet?.classes ?? []) {
      const raw = Array.isArray(c.name) ? String((c.name as unknown[]).flat(2)[0] ?? "") : String(c.name ?? "");
      const cls = raw
        .replace(/^\[\[|\]\]$/g, "")
        .split("/")
        .pop()
        ?.split("|")[0]
        .trim()
        .toLowerCase()
        .replace(/[^a-z]+/g, "_");
      const lv = Number(c.level);
      if (cls && Number.isFinite(lv)) out[`level_${cls}`] = lv;
    }
    return out;
  } catch {
    return {};
  }
}

const TEMPLATE_FENCE = /^(`{3,})\s*rpg\s+stat\.template\b[^\n]*\n([\s\S]*?)\n\1\s*$/m;

/** A template note's block: the `stat.template` it holds, or the one its prose makes. */
export async function loadTemplateBlock(link: string, sourcePath: string): Promise<TemplateBlock | null> {
  const app = appOf();
  if (!app) return null;
  const target = link.replace(/^\[\[|\]\]$/g, "").split("|")[0];
  const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
  if (!(file instanceof TFile)) return null;
  const text = await app.vault.cachedRead(file);
  const m = text.match(TEMPLATE_FENCE);
  if (m) return parseTemplateBlock((parseYaml(m[2]) ?? {}) as Record<string, unknown>);
  const featureNote = `${systemRootOf(file.path)}/worldbuilding/traits/features/Monster Template Traits`;
  return templateBlockOf(parseMonsterTemplate(file.basename, text), featureNote);
}

/** The active note, when it is one of these. */
export function activePath(): string | undefined {
  return appOf()?.workspace.getActiveFile()?.path;
}
