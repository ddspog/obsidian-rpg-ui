/**
 * The simulator's party: PC notes resolved to combat actors. A PC's numbers
 * and weapon attacks come from `characterSheet` (so they equal `rpg character
 * --json`); its spells come from the note's `rpg character.spells` fence,
 * each spell note's `rpg spell` fence resolved through the pure spell resolver.
 */

import { parse } from "yaml";
import { areaTargets } from "lib/domains/encounter-sim/monster-actions";
import { isRollable } from "lib/domains/encounter-sim/rng";
import { resolveSpellOption, type SpellNumbers, type SpellOptionInput } from "lib/domains/encounter-sim/spell-actions";
import {
  ABILITY_KEYS,
  type AbilityKey,
  type AbilityStat,
  type CombatActor,
  type DamageRider,
  type FidelityRecord,
  type Inflict,
  isDamaging,
  MODELLED_CONDITIONS,
  type ModelledAction,
  type ModelledCondition,
  type WeaponAttackAction,
} from "lib/domains/encounter-sim/types";
import { parseDamage } from "lib/domains/session-log/session-actions";
import { splitFenceBody } from "lib/utils/fence-split";
import type { Ctx } from "../app";
import { characterSheet, type CharacterSheet } from "../commands/character";
import { codeBlocksOf, fencesOf } from "../fences";
import { UsageError } from "./flags";

/** The four level-1 PCs the simulator uses when no `--pc` is given. */
export const DEFAULT_PARTY: string[] = [
  "tales-of-the-valiant/adventuring/characters/Jacqui Ilitul.md",
  "tales-of-the-valiant/adventuring/characters/Kowyn.md",
  "tales-of-the-valiant/adventuring/characters/Lilith.md",
  "tales-of-the-valiant/adventuring/characters/Talon Pallton.md",
];

export interface LoadedParty {
  actors: CombatActor[];
  /** Fidelity records keyed by the PC's display name. */
  fidelity: Record<string, FidelityRecord[]>;
}

/** What a sheet action carries that the simulator reads. */
interface SheetAction {
  name?: unknown;
  origin?: unknown;
  bucket?: unknown;
  hit?: unknown;
  damage?: unknown;
  /** "CON 14": the save the action asks for. */
  save?: unknown;
  /** The condition it puts on its target: `{ condition, on, note }`. */
  inflicts?: unknown;
  /** A feature's extra damage on hits: `{ damage: "1d4 origin", cost, mark }`. */
  rider?: unknown;
}

const SAVE_TEXT = /^\s*(STR|DEX|CON|INT|WIS|CHA)\s+(\d+)\s*$/i;

/**
 * The condition a sheet action inflicts, as the engine plays it, or undefined (no condition, or one the engine
 * does not model, such as pinned). A spell attack that also asks for a save lands it on a failed save; a save
 * action's own save decides it. How long: "until the end of its next turn", "1 minute" (the fight, a save each
 * turn), prone until it stands.
 */
export function inflictOfSheet(raw: SheetAction, action: ModelledAction): Inflict | undefined {
  if (!isRecord(raw.inflicts)) return undefined;
  const condition = String(raw.inflicts.condition ?? "").toLowerCase() as ModelledCondition;
  if (!(MODELLED_CONDITIONS as readonly string[]).includes(condition)) return undefined;
  const note = String(raw.inflicts.note ?? "");
  const lasts: Inflict["lasts"] =
    condition === "prone"
      ? "start"
      : /\b1\s*m(?:in(?:ute)?)?\b|\(1m\)|minute/i.test(note) || condition === "restrained"
        ? "fight"
        : "end";
  const m = typeof raw.save === "string" ? raw.save.match(SAVE_TEXT) : null;
  const save = m ? { ability: m[1].toLowerCase().slice(0, 3) as AbilityKey, dc: parseInt(m[2], 10) } : undefined;
  if (action.kind === "save") return { condition, lasts, ...(lasts === "fight" && save ? { save } : {}) };
  return { condition, lasts, ...(save ? { save } : {}) };
}

/** A damage-free spell the sheet gives a modelled condition and a save for, as a save action that deals nothing. */
function controlSpell(sheet: CharacterSheet, spell: string, circle: number): ModelledAction | undefined {
  const raw = (sheet.actions as SheetAction[]).find((a) => a.name === spell);
  if (!raw || raw.damage !== undefined) return undefined;
  const m = typeof raw.save === "string" ? raw.save.match(SAVE_TEXT) : null;
  if (!m) return undefined;
  const save: ModelledAction = {
    kind: "save",
    name: spell,
    dc: parseInt(m[2], 10),
    ability: m[1].toLowerCase().slice(0, 3) as AbilityKey,
    damage: { expr: "0" },
    onSuccess: "none",
    area: true,
    ...areaTargets(
      `${String((raw.inflicts as { note?: unknown } | undefined)?.note ?? "")} ${String((raw as { range?: unknown }).range ?? "")}`
    ),
    circle,
  };
  const inflicts = inflictOfSheet(raw, save);
  if (!inflicts) return undefined;
  if (save.kind === "save" && save.targets === undefined) save.targets = 1;
  return { ...save, inflicts } as ModelledAction;
}

/** A feature's extra damage, from its sheet rider and its text ("a number of times equal to your PB"). */
export function riderOfSheet(
  raw: SheetAction,
  featureText: string,
  pb: number,
  mods: Record<AbilityKey, number>
): DamageRider | undefined {
  if (!isRecord(raw.rider) || typeof raw.name !== "string") return undefined;
  const dice = String(raw.rider.damage ?? "").match(/^\s*(\d*d\d+(?:\s*[+-]\s*\d+)?)/i)?.[1];
  if (!dice || !isRollable(dice)) return undefined;
  let uses: number | undefined;
  if (/equal to your (?:PB|proficiency bonus)/i.test(featureText)) uses = pb;
  else {
    const mod = featureText.match(
      /equal to your (STR|DEX|CON|INT|WIS|CHA|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i
    );
    if (mod) uses = Math.max(1, mods[mod[1].toLowerCase().slice(0, 3) as AbilityKey]);
    else {
      const times = featureText.match(/\b(once|twice|(\d+) times)\b[^.]*\b(?:long|short) rest/i);
      if (times) uses = times[1] === "once" ? 1 : times[1] === "twice" ? 2 : parseInt(times[2], 10);
    }
  }
  return {
    name: raw.name,
    damage: dice.replace(/\s+/g, ""),
    kind: raw.rider.mark ? "mark" : "once-a-turn",
    ...(uses !== undefined ? { uses } : {}),
  };
}

/** One spell as the character's spell lists name it, with where it was listed. */
interface ListedSpell {
  link: string;
  /** The circle it is listed under: 0 for a cantrip. */
  circle: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The 3-letter key of an ability named long ("Wisdom") or short ("WIS"), case-insensitive. */
function abilityKeyOf(name: unknown): AbilityKey | undefined {
  if (typeof name !== "string") return undefined;
  const key = name.trim().slice(0, 3).toLowerCase();
  return (ABILITY_KEYS as readonly string[]).includes(key) ? (key as AbilityKey) : undefined;
}

/** The note a wikilink (`[[Folder/Name#Heading|alias]]`) or plain reference points at. */
function linkTarget(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const inner = raw
    .trim()
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")[0]
    .split("#")[0]
    .trim();
  return inner || undefined;
}

/** The leading signed integer of "+5 (STR)", or undefined when there is none. */
function leadingBonus(hit: unknown): number | undefined {
  if (typeof hit !== "string") return undefined;
  const m = hit.match(/^\s*([+-]?)\s*(\d+)/);
  if (!m) return undefined;
  const value = parseInt(m[2], 10);
  return m[1] === "-" ? -value : value;
}

/** The circle a spell action is cast at; 0 for a cantrip. */
function circleOf(action: ModelledAction): number {
  return "circle" in action ? action.circle : 0;
}

/** A spell fence's circle label ("1st-Circle", "Cantrip") as a number, or undefined. */
function circleOfLabel(label: unknown): number | undefined {
  if (typeof label === "number" && Number.isFinite(label)) return label;
  if (typeof label !== "string") return undefined;
  if (/cantrip/i.test(label)) return 0;
  const m = label.match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}

/** The abilities of a sheet as the combat actor carries them, each with a modifier and save. */
function abilitiesOf(sheet: CharacterSheet, ref: string): Record<AbilityKey, AbilityStat> {
  const out = {} as Record<AbilityKey, AbilityStat>;
  for (const key of ABILITY_KEYS) {
    const found = sheet.abilities.find((a) => abilityKeyOf(a.ability) === key);
    if (!found || found.modifier === undefined) {
      throw new Error(`Cannot load PC "${ref}": the sheet has no ${key.toUpperCase()} modifier.`);
    }
    out[key] = {
      ...(found.score !== undefined ? { score: found.score } : {}),
      modifier: found.modifier,
      saveModifier: found.save ?? found.modifier,
    };
  }
  return out;
}

/** The weapon attacks of a sheet, with a parseable hit bonus and damage, in the sheet's order. */
function weaponAttacksOf(sheet: CharacterSheet): ModelledAction[] {
  const out: ModelledAction[] = [];
  for (const raw of sheet.actions as SheetAction[]) {
    if (raw.origin !== "weapon" || typeof raw.name !== "string") continue;
    const hitBonus = leadingBonus(raw.hit);
    const damage = parseDamage(typeof raw.damage === "string" ? raw.damage : undefined);
    if (hitBonus === undefined || !damage || !isRollable(damage.dice)) continue;
    const weapon: WeaponAttackAction = {
      kind: "weapon",
      name: raw.name,
      hitBonus,
      damage: { expr: damage.dice, ...(damage.type ? { type: damage.type } : {}) },
    };
    const inflicts = inflictOfSheet(raw, weapon);
    out.push(inflicts ? { ...weapon, inflicts } : weapon);
  }
  // Two-Weapon Fighting: the off-hand swing comes with the main one, as a bonus action.
  const twoWeapon = (sheet.actions as SheetAction[]).some((a) => a.name === "Two-Weapon Fighting");
  if (twoWeapon) {
    for (const offHand of out.filter((a) => a.kind === "weapon" && / \(Off-hand\)$/i.test(a.name))) {
      const main = out.find((a) => a.kind === "weapon" && a.name === offHand.name.replace(/ \(Off-hand\)$/i, "")) as
        | WeaponAttackAction
        | undefined;
      if (main)
        out.push({
          kind: "multiattack",
          name: `${main.name} and off-hand`,
          swings: [main, offHand as WeaponAttackAction],
        });
    }
  }
  return out;
}

/** The note's `rpg character.spells` fence: each caster source with its cantrips and prepared spells. */
function spellListsOf(ctx: Ctx, notePath: string, ref: string): Map<string, ListedSpell[]> {
  const out = new Map<string, ListedSpell[]>();
  const body = codeBlocksOf(ctx.vault.readSync(ctx.note(notePath))).get("character.spells")?.[0];
  if (body === undefined) return out;
  let fence: unknown;
  try {
    fence = parse(splitFenceBody(body).yaml);
  } catch (err) {
    throw new Error(
      `Cannot load PC "${ref}": its character.spells block is not valid YAML (${err instanceof Error ? err.message : String(err)}).`
    );
  }
  // An empty fence parses to nothing: the PC casts nothing.
  if (!isRecord(fence) || !isRecord(fence.casters)) return out;
  for (const [source, entry] of Object.entries(fence.casters)) {
    if (!isRecord(entry)) continue;
    const listed: ListedSpell[] = [];
    const cantrips = Array.isArray(entry.cantrips) ? entry.cantrips : [];
    for (const link of cantrips) {
      const target = linkTarget(link);
      if (target) listed.push({ link: target, circle: 0 });
    }
    // Only `cantrips` and `prepared`: rituals are cast without a slot and sit under their own key.
    if (isRecord(entry.prepared)) {
      for (const [circleKey, links] of Object.entries(entry.prepared)) {
        const circle = parseInt(circleKey, 10);
        if (!Number.isFinite(circle) || circle < 1 || !Array.isArray(links)) continue;
        for (const link of links) {
          const target = linkTarget(link);
          if (target) listed.push({ link: target, circle });
        }
      }
    }
    out.set(source, listed);
  }
  return out;
}

/** The spell note's `rpg spell` fence as the resolver reads it, or an error naming the note. */
export function readSpell(
  ctx: Ctx,
  link: string,
  listedCircle: number,
  owner: string,
  source: string
): SpellOptionInput {
  let file;
  try {
    file = ctx.note(link);
  } catch (err) {
    throw new Error(
      `Cannot load PC "${owner}": spell note "${link}" (${source}) does not resolve: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const body = fencesOf(ctx.vault.readSync(file), "spell")[0];
  if (body === undefined) {
    throw new Error(`Cannot load PC "${owner}": spell note ${file.path} (${source}) has no rpg spell block.`);
  }
  const { yaml, text } = splitFenceBody(body);
  let fence: unknown;
  try {
    fence = parse(yaml);
  } catch (err) {
    throw new Error(
      `Cannot load PC "${owner}": the rpg spell block of ${file.path} is not valid YAML (${err instanceof Error ? err.message : String(err)}).`
    );
  }
  const data = isRecord(fence) ? fence : {};
  return {
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : file.basename,
    ...(isRecord(data.roll) ? { roll: data.roll } : {}),
    ...(typeof data.summary === "string" ? { summary: data.summary } : {}),
    ...(text !== undefined ? { text } : {}),
    circle: circleOfLabel(data.circle) ?? listedCircle,
    ...(typeof data.casting === "string" ? { casting: data.casting } : {}),
    ...(typeof data.range === "string" ? { range: data.range } : {}),
    ...(typeof data.duration === "string" ? { duration: data.duration } : {}),
  };
}

/** Resolve one PC note into its actor and fidelity records. */
async function loadActor(ctx: Ctx, ref: string): Promise<{ actor: CombatActor; fidelity: FidelityRecord[] }> {
  let sheet: CharacterSheet;
  try {
    sheet = await characterSheet(ctx, ref);
  } catch (err) {
    throw new Error(`Cannot load PC "${ref}": ${err instanceof Error ? err.message : String(err)}`);
  }
  if (sheet.hitPoints?.max === undefined) throw new Error(`Cannot load PC "${ref}": the sheet has no max hit points.`);
  if (sheet.armorClass === undefined) throw new Error(`Cannot load PC "${ref}": the sheet has no armor class.`);
  if (sheet.level === undefined) throw new Error(`Cannot load PC "${ref}": the sheet has no level.`);
  if (sheet.proficiencyBonus === undefined) {
    throw new Error(`Cannot load PC "${ref}": the sheet has no proficiency bonus.`);
  }
  if (sheet.initiative === undefined) throw new Error(`Cannot load PC "${ref}": the sheet has no initiative.`);
  const abilities = abilitiesOf(sheet, ref);
  const name = sheet.name;
  const { level, proficiencyBonus } = sheet;

  const fidelity: FidelityRecord[] = [];
  const weapons = weaponAttacksOf(sheet);
  for (const weapon of weapons) fidelity.push({ name: weapon.name, owner: name, status: "modelled" });

  const slotted: ModelledAction[] = [];
  const cantrips: ModelledAction[] = [];
  const slots: number[] = [];
  for (const [source, spells] of spellListsOf(ctx, sheet.note, ref)) {
    const entry = sheet.casters.find((c) => c.source === source);
    const key = abilityKeyOf(entry?.ability);
    const modifier = key ? abilities[key].modifier : undefined;
    const numbers: SpellNumbers | undefined =
      entry && modifier !== undefined
        ? { proficiencyBonus, castingModifier: modifier, characterLevel: level }
        : undefined;
    if (numbers && entry) {
      entry.slots.forEach((count, index) => {
        slots[index] = (slots[index] ?? 0) + count;
      });
    }
    for (const spell of spells) {
      const input = readSpell(ctx, spell.link, spell.circle, name, source);
      const result = resolveSpellOption(input, numbers, name);
      if (result.needsCastingModifier) {
        throw new Error(
          `Cannot load PC "${ref}": spell "${input.name}" needs a casting modifier but caster "${source}" has no usable casting ability on the sheet.`
        );
      }
      // A control spell with no damage the sheet gives a condition for (Entangle: restrained on a failed STR
      // save) is a save action that deals nothing and hinders.
      const control = !result.action ? controlSpell(sheet, input.name, input.circle ?? 0) : undefined;
      if (control) {
        slotted.push(control);
        fidelity.push({ name: input.name, owner: name, status: "modelled" });
        continue;
      }
      fidelity.push(result.fidelity);
      // The note's own circle decides both the action and its bucket (an upcast listing is cast at its base circle).
      if (result.action) {
        const raw = (sheet.actions as SheetAction[]).find((a) => a.name === input.name);
        const inflicts =
          raw && result.action.kind !== "heal" && result.action.kind !== "multiattack"
            ? inflictOfSheet(raw, result.action)
            : undefined;
        const action = inflicts ? ({ ...result.action, inflicts } as ModelledAction) : result.action;
        (circleOf(action) === 0 ? cantrips : slotted).push(action);
      }
    }
  }

  const actions = [...weapons, ...slotted, ...cantrips];
  const mods = Object.fromEntries(ABILITY_KEYS.map((k) => [k, abilities[k].modifier])) as Record<AbilityKey, number>;
  const featureText = (name: string) =>
    (sheet.features ?? []).flatMap((s) => s.features ?? []).find((f) => f.name === name)?.text ?? "";
  const riders = (sheet.actions as SheetAction[]).flatMap((a) => {
    const rider = riderOfSheet(a, featureText(String(a.name ?? "")), proficiencyBonus, mods);
    if (rider) fidelity.push({ name: rider.name, owner: name, status: "modelled" });
    return rider ? [rider] : [];
  });
  if (!actions.some(isDamaging)) {
    fidelity.push({ name, owner: name, status: "skipped", reason: "no-damaging-action" });
  }

  return {
    actor: {
      key: sheet.note,
      name,
      side: "party",
      level,
      proficiencyBonus,
      armorClass: sheet.armorClass,
      maxHp: sheet.hitPoints.max,
      initiativeModifier: sheet.initiative,
      abilities,
      slots,
      actions,
      ...(riders.length ? { riders } : {}),
    },
    fidelity,
  };
}

/**
 * Load the party from PC notes, in the order given. Fails naming the note when
 * one is missing, unmapped or lacks max HP or AC, or when a spell it lists
 * cannot be resolved. Trials start at full slots, whatever the note has spent.
 */
export async function loadParty(ctx: Ctx, refs: string[]): Promise<LoadedParty> {
  const actors: CombatActor[] = [];
  const fidelity: Record<string, FidelityRecord[]> = {};
  for (const ref of refs) {
    const loaded = await loadActor(ctx, ref);
    if (actors.some((a) => a.name === loaded.actor.name)) {
      throw new UsageError(`--pc: two party members are named "${loaded.actor.name}" ("${ref}"); name each PC once.`);
    }
    actors.push(loaded.actor);
    fidelity[loaded.actor.name] = loaded.fidelity;
  }
  return { actors, fidelity };
}
