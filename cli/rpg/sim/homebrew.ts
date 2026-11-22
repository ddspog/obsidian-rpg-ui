/**
 * `rpg sim homebrew "<base>" --name "<new name>"`: a new creature made from a
 * bestiary statblock, as the Game Master's Guide's "Modifying a Stat Block"
 * describes, kept as a draft in `<system>/worldbuilding/bestiary/homebrew/`:
 *
 * - reflavoured: a new name, and with `--type` / `--habitat` a new type line or habitat;
 * - a role template (`--role controller|leader|soldier|striker`): the features the
 *   template gives (Game Master's Guide Role Template Traits), with the numbers for its CR;
 * - a new CR (`--cr`): HP and AC moved by the Creature Statistics by Challenge Rating
 *   table, features that pick their numbers by CR re-picked. Attack damage written as
 *   plain text cannot be rescaled: the damage per round to aim for is reported instead.
 *
 * A dry run prints the statblock; `--write` writes the note (never over one).
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  bestSubrole,
  crBenchmark,
  guessRole,
  parseRole,
  parseSubrole,
  roleOfSubrole,
  type MonsterRole,
  type Subrole,
} from "lib/domains/encounter-sim/monster-role";
import { applyTemplateBlock } from "lib/domains/statblocks/template-block";
import { homebrewNoteText, homebrewPath } from "lib/domains/statblocks/homebrew-note";
import { templateFits } from "lib/domains/statblocks/monster-template";
import type { Ctx } from "../app";
import { fencesOf } from "../fences";
import { readNote, writeNote } from "../write";
import { noteRef } from "./brief";
import type { SimHandler } from "./dispatch";
import { UsageError, type SimOptions } from "./flags";
import { crNumber, loadMonster } from "./monsters";
import { featuresNoteText, findTemplate, loadTemplates, TEMPLATE_FEATURES_NOTE, TEMPLATES_FOLDER } from "./templates";

const TEMPLATE_NOTE = "tales-of-the-valiant/worldbuilding/traits/features/Game Master's Guide Role Template Traits";

/** The subrole a role template leans to (the book's example for it). */
const TEMPLATE_SUBROLE: Record<MonsterRole, Subrole> = {
  controller: "hexer",
  leader: "commander",
  soldier: "guardian",
  striker: "ambusher",
};

/** The proficiency bonus of a CR. */
export function pbOf(cr: number): number {
  return cr < 5 ? 2 : cr < 9 ? 3 : cr < 13 ? 4 : cr < 17 ? 5 : cr < 21 ? 6 : cr < 25 ? 7 : cr < 29 ? 8 : 9;
}

/** Tactical Commands' "Hold On": d4s equal to half the CR, rounded down, at least one. */
export function holdOn(cr: number): string {
  const n = Math.max(1, Math.floor(cr / 2));
  return `${Math.floor(n * 2.5)} (${n}d4)`;
}

/** The feature refs a role template adds, with the parameters its CR and abilities call for. */
export function templateRefs(
  role: MonsterRole,
  cr: number,
  abilities: Record<string, number>
): Array<Record<string, unknown>> {
  const ref = (name: string, params: Record<string, unknown> = {}) => ({
    ref: `@[[${TEMPLATE_NOTE}]]#${name}`,
    ...params,
  });
  switch (role) {
    case "controller": {
      // The highest of INT, WIS and CHA; save DC 10 + that modifier (the Spellcasting Template).
      const [ability, mod] = (["int", "wis", "cha"] as const)
        .map((k) => [k, abilities[k] ?? 0] as const)
        .reduce((best, a) => (a[1] > best[1] ? a : best));
      return [
        ref("Spellcasting Multiattack"),
        ref("Controller: Spellcasting", {
          ability: ability.toUpperCase(),
          dc: 10 + mod,
          at_will: "choose up to three abjuration, enchantment or transmutation spells",
          three_day: "choose up to three",
          one_day: "choose up to two",
        }),
      ];
    }
    case "leader":
      return [ref("Inspiring Leader"), ref("Tactical Commands", { hold_on: holdOn(cr) })];
    case "soldier":
      return [ref("Warrior's Advance"), ref("Protect Ally")];
    case "striker":
      return [ref("Shrouded Step"), ref("Ambushing Strike (Recharge 5–6)", { pb: pbOf(cr) })];
  }
}

/** A stat line with its leading number replaced, its note kept: "17 (natural armor)" → "19 (natural armor)". */
function withNumber(line: unknown, n: number): string {
  const text = String(line ?? "");
  return /^\s*\d+/.test(text) ? text.replace(/^\s*\d+/, String(n)) : String(n);
}

const CR_TEXT = (cr: number) => (cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr));

/** A note's `stat.monster` block: its YAML, and the prose after its `---` line. */
export function readStatblock(ctx: Ctx, path: string, ref = path): { data: Record<string, unknown>; rest: string } {
  const text = readNote(ctx.root, path) ?? "";
  const fence = fencesOf(text, "stat.monster")[0];
  if (fence === undefined) throw new UsageError(`"${ref}" has no rpg stat.monster block.`);
  const lines = fence.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  const yamlText = sep >= 0 ? lines.slice(0, sep).join("\n") : fence;
  const rest = sep >= 0 ? lines.slice(sep).join("\n") : "";
  return { data: (parseYaml(yamlText) as Record<string, unknown>) ?? {}, rest };
}

export const simHomebrew: SimHandler = async (ctx: Ctx, options: SimOptions) => {
  const baseRef = options.args[0];
  let basePath: string;
  try {
    basePath = ctx.note(baseRef).path;
  } catch {
    throw new UsageError(`No monster note "${baseRef}".`);
  }
  const name = options.name!;
  const { data, rest } = readStatblock(ctx, basePath, baseRef);
  const base = await loadMonster(ctx, basePath);
  const baseCr = crNumber(base.cr);
  const cr = options.cr !== undefined ? crNumber(options.cr) : baseCr;

  const next: Record<string, unknown> = { ...data, name };
  const notes: string[] = [];
  if (options.habitat) next.habitat = options.habitat;
  const stats = { ...((data.stats as Record<string, unknown>) ?? {}) };

  // A new CR: HP and AC move with the table, features keyed by CR pick their own numbers.
  let hp = base.actor.maxHp;
  let ac = base.actor.armorClass;
  if (cr !== baseCr) {
    next.cr = CR_TEXT(cr);
    const from = crBenchmark(baseCr);
    const to = crBenchmark(cr);
    hp = Math.max(1, Math.round((base.actor.maxHp * to.hp) / from.hp));
    ac = Math.max(5, Math.round(base.actor.armorClass + (to.ac - from.ac)));
    stats.hp = withNumber(stats.hp, hp);
    stats.ac = withNumber(stats.ac, ac);
    // An explicit numeric tier would pin a CR-keyed feature to the old CR.
    next.features = ((data.features as Array<Record<string, unknown>>) ?? []).map((f) => {
      const t = f.tier;
      if (t === undefined || !/^\d+(\/\d+)?$/.test(String(t))) return f;
      const restOf = { ...f };
      delete restOf.tier;
      return restOf;
    });
  }
  next.stats = stats;

  // A role template: its features, and the role written.
  const asked = options.roles[0];
  const askedSub = parseSubrole(asked);
  const role = askedSub ? roleOfSubrole(askedSub) : parseRole(asked);
  if (role) {
    const abilities = (data.abilities as Record<string, number>) ?? {};
    next.features = [
      ...((next.features as unknown[]) ?? (data.features as unknown[]) ?? []),
      ...templateRefs(role, cr, abilities),
    ];
    next.role = role;
    next.subrole = askedSub ?? TEMPLATE_SUBROLE[role];
    if (role === "controller")
      notes.push("Choose the controller's spells (abjuration, enchantment, transmutation) in its Spellcasting ref.");
  } else {
    delete next.role;
    delete next.subrole;
  }

  // A creature template (Zombie, Shadow, Element-Infused…): its statistics and features.
  let templated: Record<string, unknown> | undefined;
  if (options.template) {
    const templates = loadTemplates(ctx);
    const t = findTemplate(templates, options.template);
    if (!t) {
      throw new UsageError(
        `No template "${options.template}" in ${TEMPLATES_FOLDER} (${templates.map((x) => x.name).join(", ") || "none"}).`
      );
    }
    const fit = templateFits(t.block.applies, {
      name: base.name,
      type: base.monsterType,
      cr,
      int: Number((data.abilities as Record<string, unknown> | undefined)?.int ?? 0) || 0,
    });
    if (!fit.fits)
      notes.push(`${t.name} is for ${fit.unmet.join("; ")}: ${base.name} is not (${t.block.appliesText}).`);
    if (fit.unchecked.length) notes.push(`${t.name} asks for a creature ${fit.unchecked.join(", ")}: check it.`);
    const applied = applyTemplateBlock(next, t.block, {
      choice: options.choose,
      picks: options.traits,
      baseFeatures: base.features,
      cr,
    });
    Object.assign(next, applied.data);
    const st = next.stats as Record<string, unknown>;
    hp = parseInt(String(st.hp ?? hp), 10) || hp;
    ac = parseInt(String(st.ac ?? ac), 10) || ac;
    if (next.cr !== undefined && crNumber(String(next.cr)) !== cr) next.cr = CR_TEXT(crNumber(String(next.cr)));
    if (readNote(ctx.root, `${TEMPLATE_FEATURES_NOTE}.md`) !== featuresNoteText(templates)) {
      if (options.write) writeNote(ctx.root, `${TEMPLATE_FEATURES_NOTE}.md`, featuresNoteText(templates));
      notes.push(
        options.write
          ? `Wrote the template features note (${TEMPLATE_FEATURES_NOTE}.md) its refs point to.`
          : `--write also writes the template features note (${TEMPLATE_FEATURES_NOTE}.md) its refs point to.`
      );
    }
    templated = {
      name: t.name,
      ...(applied.choice ? { choice: `${applied.choice.key} (${applied.choice.damage})` } : {}),
      applied: applied.applied,
      added: applied.added,
      byHand: applied.manual,
    };
  }
  if (options.type) next.type = options.type;

  // Damage written as plain numbers does not scale with the CR: say what to aim for.
  const guess = guessRole({
    name,
    type: String(next.type ?? ""),
    cr,
    ac,
    hp,
    speed: base.speedText,
    features: base.features,
    actions: base.actor.actions,
  });
  const aim = crBenchmark(cr).dpr;
  const dprNow = Math.round(guess.ratios.dpr * aim);
  if (cr !== baseCr) {
    notes.push(
      `Damage per round is about ${dprNow} (the table's ${Math.round(aim)} for CR ${CR_TEXT(cr)}): rewrite attack damage that is plain text in its features to come near it.`
    );
  }
  // Text written for the base names it: "the wolf's Perception". Those features are the base's own words.
  const baseWord = base.name.split(/[ ,]/)[0].toLowerCase();
  const naming = base.features.filter((f) => new RegExp(`\\bthe ${baseWord}\\b`, "i").test(f.text)).map((f) => f.name);
  if (naming.length && baseWord !== name.split(/[ ,]/)[0].toLowerCase()) {
    notes.push(
      `${naming.join(", ")} still call it "the ${baseWord}" (the base's own text): copy them into features of its own to reword them.`
    );
  }
  if (!role) {
    notes.push(`Without --role the role is left to the guess: ${guess.role}/${bestSubrole(guess, guess.role)}.`);
  }

  const system = basePath.split("/")[0];
  const outPath = homebrewPath(system, name);
  const body = `${stringifyYaml(next, { lineWidth: 0 }).trimEnd()}${rest ? `\n${rest}` : ""}`;
  const note = homebrewNoteText({
    name,
    basePath,
    baseName: base.name,
    templates: [role, templated?.name as string | undefined].filter((t): t is string => !!t),
    data: next,
    rest,
  });

  let written = false;
  if (options.write) {
    if (readNote(ctx.root, outPath) !== null) throw new UsageError(`"${outPath}" exists: choose another --name.`);
    writeNote(ctx.root, outPath, note);
    written = true;
    notes.push("Written as a draft (homebrew: draft); `rpg sim roles`, `build` and `adjust` see it at once.");
  } else {
    notes.push("A dry run: --write writes the note.");
  }

  return {
    doc: {
      base: noteRef(ctx, basePath),
      note: outPath,
      written,
      cr: { from: base.cr, to: CR_TEXT(cr) },
      hp: { from: base.actor.maxHp, to: hp },
      ac: { from: base.actor.armorClass, to: ac },
      ...(role ? { template: role, added: templateRefs(role, cr, {}).map((r) => String(r.ref).split("#")[1]) } : {}),
      ...(templated ? { creatureTemplate: templated } : {}),
      notes,
      statblock: body,
    },
  };
};
