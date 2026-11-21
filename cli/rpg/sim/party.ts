/**
 * The simulator's party: PC notes resolved to combat actors. A PC's numbers
 * and weapon attacks come from `characterSheet` (so they equal `rpg character
 * --json`); its spells come from the note's `rpg character.spells` fence,
 * each spell note's `rpg spell` fence resolved through the pure spell resolver.
 */

import { parse } from "yaml";
import { isRollable } from "lib/domains/encounter-sim/rng";
import { resolveSpellOption, type SpellNumbers, type SpellOptionInput } from "lib/domains/encounter-sim/spell-actions";
import {
  ABILITY_KEYS,
  type AbilityKey,
  type AbilityStat,
  type CombatActor,
  type FidelityRecord,
  isDamaging,
  type ModelledAction,
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

/** What a sheet action carries that a weapon attack needs. */
interface SheetAction {
  name?: unknown;
  origin?: unknown;
  hit?: unknown;
  damage?: unknown;
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
    out.push({
      kind: "weapon",
      name: raw.name,
      hitBonus,
      damage: { expr: damage.dice, ...(damage.type ? { type: damage.type } : {}) },
    });
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
function readSpell(ctx: Ctx, link: string, listedCircle: number, owner: string, source: string): SpellOptionInput {
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
      fidelity.push(result.fidelity);
      // The note's own circle decides both the action and its bucket (an upcast listing is cast at its base circle).
      if (result.action) (circleOf(result.action) === 0 ? cantrips : slotted).push(result.action);
    }
  }

  const actions = [...weapons, ...slotted, ...cantrips];
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
