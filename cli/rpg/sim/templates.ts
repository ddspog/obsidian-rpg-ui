/**
 * `rpg sim templates ["<base>"] [--write]`: the creature templates of the vault
 * (`<system>/worldbuilding/bestiary/templates/`), read by
 * lib/domains/statblocks/monster-template.ts: what each applies to, what it
 * changes and the features it gives. With a monster note, which of them fit it.
 * `--write` writes the note of their features (`<system>/worldbuilding/traits/
 * features/Monster Template Traits.md`), which `homebrew --template` refers to.
 */

import {
  parseMonsterTemplate,
  templateFeaturesNote,
  templateFits,
  type MonsterTemplate,
} from "lib/domains/statblocks/monster-template";
import type { Ctx } from "../app";
import { readNote, writeNote } from "../write";
import type { SimHandler } from "./dispatch";
import { UsageError, type SimOptions } from "./flags";
import { readStatblock } from "./homebrew";
import { BESTIARY_PREFIX, crNumber, loadMonster } from "./monsters";

const SYSTEM = BESTIARY_PREFIX.split("/")[0];
export const TEMPLATES_FOLDER = `${BESTIARY_PREFIX}templates/`;
export const TEMPLATE_FEATURES_NOTE = `${SYSTEM}/worldbuilding/traits/features/Monster Template Traits`;
const SOURCE =
  'From **Tales of the Valiant** "Game Master\'s Guide", "Monster Vault 2" and "Labyrinth Worldbook" by **Kobold Press**.';

/** Every template note in the vault, read. */
export function loadTemplates(ctx: Ctx): MonsterTemplate[] {
  return ctx.vault
    .getMarkdownFiles()
    .map((f) => f.path)
    .filter((p) => p.startsWith(TEMPLATES_FOLDER))
    .sort()
    .map((p) =>
      parseMonsterTemplate(p.slice(TEMPLATES_FOLDER.length).replace(/\.md$/, ""), readNote(ctx.root, p) ?? "")
    )
    .filter((t) => t.stats.length > 0 || t.features.length > 0);
}

/** A template by name, loosely ("zombie", "skeleton (dragon)", "dragon skeleton"). */
export function findTemplate(templates: MonsterTemplate[], name: string): MonsterTemplate | undefined {
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

/** The template's features note, as it should read now. */
export function featuresNoteText(templates: MonsterTemplate[]): string {
  return templateFeaturesNote(templates, SOURCE);
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
  if (options.write) {
    const text = featuresNoteText(templates);
    const path = `${TEMPLATE_FEATURES_NOTE}.md`;
    if (readNote(ctx.root, path) !== text) {
      writeNote(ctx.root, path, text);
      written = true;
    }
    notes.push(written ? `Wrote ${path}.` : `${path} is up to date.`);
  } else if (readNote(ctx.root, `${TEMPLATE_FEATURES_NOTE}.md`) !== featuresNoteText(templates)) {
    notes.push(
      `The features note is missing or older than the templates: --write writes ${TEMPLATE_FEATURES_NOTE}.md.`
    );
  }

  const list = templates.map((t) => {
    const fit = creature ? templateFits(t.appliesTo, creature) : undefined;
    return {
      template: t.name,
      appliesTo: t.appliesText.replace(/^This template can be applied (?:only )?to /, ""),
      ...(fit ? { fits: fit.fits, ...(fit.unmet.length ? { unmet: fit.unmet } : {}) } : {}),
      ...(fit?.unchecked.length ? { check: fit.unchecked } : {}),
      changes: t.stats.map((s) => s.label),
      ...(t.choices.length ? { choose: t.choices.map((c) => `${c.key} (${c.damage.join("/")})`) } : {}),
      features: t.features.filter((f) => !f.alters && !f.optional).map((f) => f.key),
      ...(t.features.some((f) => f.optional) ? { traits: t.features.filter((f) => f.optional).map((f) => f.key) } : {}),
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
      ...(options.write ? { written } : {}),
      notes,
    },
  };
};
