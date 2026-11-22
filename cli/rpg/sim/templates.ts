/**
 * `rpg sim templates ["<base>"] [--write]`: the creature templates of the vault
 * (`<system>/worldbuilding/bestiary/templates/`), read by
 * lib/domains/statblocks/monster-template.ts: what each applies to, what it
 * changes and the features it gives. With a monster note, which of them fit it.
 * `--write` writes the note of their features (`<system>/worldbuilding/traits/
 * features/Monster Template Traits.md`), which `homebrew --template` refers to.
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  parseMonsterTemplate,
  templateFeaturesNote,
  templateFits,
  type MonsterTemplate,
} from "lib/domains/statblocks/monster-template";
import {
  describeChange,
  parseTemplateBlock,
  templateBlockData,
  templateBlockOf,
  type TemplateBlock,
} from "lib/domains/statblocks/template-block";
import type { Ctx } from "../app";
import { fencesOf } from "../fences";
import { readNote, writeNote } from "../write";
import type { SimHandler } from "./dispatch";
import { UsageError, type SimOptions } from "./flags";
import { readStatblock } from "./homebrew";
import { BESTIARY_PREFIX, crNumber, loadMonster } from "./monsters";

const SYSTEM = BESTIARY_PREFIX.split("/")[0];
export const TEMPLATES_FOLDER = `${BESTIARY_PREFIX}templates/`;
const LINEAGE_NOTES = `${SYSTEM}/worldbuilding/traits/lineages/`;
export const TEMPLATE_FEATURES_NOTE = `${SYSTEM}/worldbuilding/traits/features/Monster Template Traits`;
const SOURCE =
  'From **Tales of the Valiant** "Game Master\'s Guide", "Monster Vault 2" and "Labyrinth Worldbook" by **Kobold Press**.';

/** A template note: its prose read, and the block it holds (or the one its prose makes). */
export interface LoadedTemplate {
  path: string;
  name: string;
  template: MonsterTemplate;
  block: TemplateBlock;
  /** The note holds a `stat.template` block of its own. */
  hasBlock: boolean;
  text: string;
}

/** Every template note in the vault, read. A block in the note wins over its prose (it may be corrected by hand). */
export function loadTemplates(ctx: Ctx): LoadedTemplate[] {
  return ctx.vault
    .getMarkdownFiles()
    .map((f) => f.path)
    .filter((p) => p.startsWith(TEMPLATES_FOLDER) || p.startsWith(LINEAGE_NOTES))
    .sort()
    .flatMap((path) => {
      const text = readNote(ctx.root, path) ?? "";
      // A lineage note is a template only with its block (`rpg sim lineages --write`).
      if (path.startsWith(LINEAGE_NOTES) && !fencesOf(text, "stat.template").length) return [];
      const name = path.split("/").pop()!.replace(/\.md$/, "");
      const template = parseMonsterTemplate(name, text);
      const fence = fencesOf(text, "stat.template")[0];
      let block = templateBlockOf(template, TEMPLATE_FEATURES_NOTE);
      if (fence !== undefined) {
        try {
          const written = parseTemplateBlock((parseYaml(fence) as Record<string, unknown>) ?? {});
          // The written block lacks the features' text: take it from the prose.
          const texts = new Map(block.features.map((f) => [f.id, f.text]));
          block = { ...written, features: written.features.map((f) => ({ ...f, text: texts.get(f.id) })) };
        } catch {
          // A block that does not parse: the prose stands.
        }
      }
      return [{ path, name: block.name || name, template, block, hasBlock: fence !== undefined, text }];
    })
    .filter((t) => t.block.changes.length > 0 || t.block.features.length > 0);
}

/** A template by name, loosely ("zombie", "skeleton (dragon)", "dragon skeleton"). */
export function findTemplate<T extends { name: string }>(templates: T[], name: string): T | undefined {
  const key = (s: string) =>
    s
      .toLowerCase()
      .replace(/[()]/g, " ")
      .split(/[\s-]+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  const want = key(name);
  return (
    templates.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? templates.find((t) => key(t.name) === want)
  );
}

/** The `rpg stat.template` fence a block is written as. */
export function templateFence(block: TemplateBlock): string {
  return ["```rpg stat.template", stringifyYaml(templateBlockData(block), { lineWidth: 0 }).trimEnd(), "```"].join(
    "\n"
  );
}

/**
 * A template note with its block written in: in place of the one it has, or
 * after the introduction (before its first tab or section heading).
 */
export function withTemplateBlock(text: string, block: TemplateBlock): string {
  const fence = templateFence(block);
  const existing = /^```+\s*rpg\s+stat\.template\b[^\n]*\n[\s\S]*?\n```+\s*$/m;
  if (existing.test(text)) return text.replace(existing, () => fence);
  const lines = text.split("\n");
  const fm = lines[0] === "---" ? lines.indexOf("---", 1) + 1 : 0;
  const at = lines.findIndex((l, i) => i >= fm && (/^```+\s*rpg\s+rule\.tab\b/.test(l) || /^#{2,3}\s/.test(l)));
  if (at < 0) return `${text.trimEnd()}\n${fence}\n`;
  return [...lines.slice(0, at), fence, ...lines.slice(at)].join("\n");
}

/** The template's features note, as it should read now. */
export function featuresNoteText(templates: LoadedTemplate[]): string {
  return templateFeaturesNote(
    templates.filter((t) => t.block.kind !== "lineage").map((t) => t.template),
    SOURCE
  );
}

export const simTemplates: SimHandler = async (ctx: Ctx, options: SimOptions) => {
  const templates = loadTemplates(ctx);
  if (templates.length === 0) throw new UsageError(`No template notes in ${TEMPLATES_FOLDER}.`);
  const notes: string[] = [];

  let creature: { name: string; type: string; cr: number; int: number } | undefined;
  if (options.args[0]) {
    let path: string;
    try {
      path = ctx.note(options.args[0]).path;
    } catch {
      throw new UsageError(`No monster note "${options.args[0]}".`);
    }
    const m = await loadMonster(ctx, path);
    const { data } = readStatblock(ctx, path);
    const int = Number((data.abilities as Record<string, unknown> | undefined)?.int ?? 0) || 0;
    creature = { name: m.name, type: m.monsterType, cr: crNumber(m.cr), int };
  }

  let written = false;
  const blocksWritten: string[] = [];
  if (options.write) {
    const text = featuresNoteText(templates);
    const path = `${TEMPLATE_FEATURES_NOTE}.md`;
    if (readNote(ctx.root, path) !== text) {
      writeNote(ctx.root, path, text);
      written = true;
    }
    notes.push(written ? `Wrote ${path}.` : `${path} is up to date.`);
    // Each note's block: written where it has none, rewritten from its prose only with --force.
    let kept = 0;
    for (const t of templates) {
      // A lineage's block is written by `rpg sim lineages`.
      if (t.block.kind === "lineage") continue;
      if (t.hasBlock && !options.force) {
        kept++;
        continue;
      }
      const next = withTemplateBlock(t.text, templateBlockOf(t.template, TEMPLATE_FEATURES_NOTE));
      if (next !== t.text) {
        writeNote(ctx.root, t.path, next);
        blocksWritten.push(t.name);
      }
    }
    if (blocksWritten.length) notes.push(`Wrote the stat.template block of ${blocksWritten.join(", ")}.`);
    if (kept)
      notes.push(`Kept the stat.template block ${kept} notes already have (--force writes them again from the prose).`);
  } else if (readNote(ctx.root, `${TEMPLATE_FEATURES_NOTE}.md`) !== featuresNoteText(templates)) {
    notes.push(
      `The features note is missing or older than the templates: --write writes ${TEMPLATE_FEATURES_NOTE}.md.`
    );
  }

  const list = templates.map((t) => {
    const fit = creature ? templateFits(t.block.applies, creature) : undefined;
    return {
      template: t.name,
      appliesTo: t.block.appliesText.replace(/^This template can be applied (?:only )?to /, ""),
      ...(fit ? { fits: fit.fits, ...(fit.unmet.length ? { unmet: fit.unmet } : {}) } : {}),
      ...(fit?.unchecked.length ? { check: fit.unchecked } : {}),
      changes: t.block.changes.map((c) => {
        const w = describeChange(c);
        return c.stat === "note" ? `${w.label} (by hand)` : `${w.label} ${w.text}`;
      }),
      ...(t.block.choose?.length ? { choose: t.block.choose.map((c) => `${c.key} (${c.damage.join("/")})`) } : {}),
      features: t.block.features.filter((f) => !f.optional).map((f) => f.name),
      ...(t.block.features.some((f) => f.optional)
        ? { traits: t.block.features.filter((f) => f.optional).map((f) => f.name) }
        : {}),
    };
  });
  const shown = creature ? [...list].sort((a, b) => Number(b.fits) - Number(a.fits)) : list;
  if (creature) {
    const fitting = list.filter((t) => t.fits).length;
    notes.push(
      `${fitting} of ${list.length} templates fit ${creature.name}; \`homebrew "${options.args[0]}" --name "…" --template <name>\` makes one.`
    );
  }
  return {
    doc: {
      ...(creature ? { creature: creature.name } : {}),
      templates: shown,
      ...(options.write ? { written, blocks: blocksWritten } : {}),
      notes,
    },
  };
};
