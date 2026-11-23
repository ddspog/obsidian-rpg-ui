/**
 * A spell's `roll:` aspect read from its prose, for the spell notes that have
 * none (most of a compendium imported from books). It covers what the rolls
 * block and the encounter simulator use: a spell attack or a save, its damage
 * and type, half on a success, a condition a failed save brings (as `effects`
 * and `notes`, which the system turns into the sheet's `inflicts`), healing,
 * cantrip damage by character level (`leveled`) and damage by circle
 * (`upcast`). A spell its words do not fit (a buff, a utility, a summoning)
 * gets none, and the reason. Pure: no Obsidian and no I/O.
 */

import type { DamageSpec, RollAspect, RollOverride } from "lib/domains/features/roll";

export const ROLL_DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
];

/** The conditions a derived roll may name in its `effects`. */
export const ROLL_CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "frightened",
  "grappled",
  "incapacitated",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
];

const ABILITY = "(STR|DEX|CON|INT|WIS|CHA|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)";

/** What the derivation reads of a spell note. */
export interface SpellProse {
  /** The fence's body after its `---` (the spell's description). */
  text: string;
  /** The fence's `circle:` ("Cantrip", "1st-Circle", 3). */
  circle?: unknown;
  range?: string;
  duration?: string;
}

export type DerivedRoll = { roll: RollAspect } | { skip: string };

/** "Cantrip" is 0, "3rd-Circle" 3, a number itself. */
export function circleNumber(circle: unknown): number | undefined {
  if (typeof circle === "number" && Number.isFinite(circle)) return circle;
  const text = String(circle ?? "").toLowerCase();
  if (/cantrip/.test(text)) return 0;
  const m = text.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : undefined;
}

const abilityAbbrev = (word: string) => word.slice(0, 3).toUpperCase();

/** The first damage roll with a damage type: "takes 3d6 fire damage", "or take 1d8 radiant damage". */
function damageOf(text: string): DamageSpec | undefined {
  for (const m of text.matchAll(
    /\b(?:takes?|taking|deals?|dealing) (?:an extra )?(\d+d\d+)(?:\s*\+\s*\d+)? (\w+) damage/gi
  )) {
    const type = m[2].toLowerCase();
    if (ROLL_DAMAGE_TYPES.includes(type)) return { roll: m[1], type };
  }
  // "taking 2d8 damage of the type you chose": the first type the spell offers.
  const untyped = text.match(/\b(?:takes?|taking) (\d+d\d+) damage of the type/i);
  if (untyped) {
    const offered = ROLL_DAMAGE_TYPES.find((t) => new RegExp(`\\b${t}\\b`, "i").test(text));
    if (offered) return { roll: untyped[1], type: offered };
  }
  return undefined;
}

/** "increases by 1d10 when you reach 5th level (2d10), 11th level (3d10)…": the cantrip's dice by level. */
function leveledOf(text: string, base: DamageSpec): RollAspect["leveled"] | undefined {
  const at: Record<number, RollOverride> = {};
  for (const m of text.matchAll(/(\d+)(?:st|nd|rd|th) level \((\d+d\d+)\)/gi)) {
    at[parseInt(m[1], 10)] = { damage: { roll: m[2], type: base.type } };
  }
  return Object.keys(at).length ? { at } : undefined;
}

/** "the damage increases by 1d6 for each slot above 2nd": the dice at each higher circle, to the 9th. */
function upcastOf(text: string, base: DamageSpec, circle: number): RollAspect["upcast"] | undefined {
  const m = text.match(
    /(?:damage|healing)[^.]*?increases by (\d+)d(\d+),? for each (?:slot|circle) (?:level )?above (\d+)/i
  );
  const plain = base.roll.match(/^(\d+)d(\d+)$/);
  if (!m || !plain || m[2] !== plain[2]) return undefined;
  const step = parseInt(m[1], 10);
  const from = parseInt(m[3], 10);
  if (from !== circle) return undefined;
  const out: Record<number, RollOverride> = {};
  for (let c = circle + 1; c <= 9; c++) {
    out[c] = { damage: { roll: `${parseInt(plain[1], 10) + step * (c - circle)}d${plain[2]}`, type: base.type } };
  }
  return out;
}

/** The sentence a phrase is in, trimmed to read as a short note. */
function sentenceWith(text: string, index: number): string {
  const dot = text.lastIndexOf(". ", index);
  const start = dot < 0 ? 0 : dot + 2;
  const end = text.indexOf(".", index);
  return text.slice(start, end < 0 ? undefined : end).trim();
}

/** A spell's roll from its words, or why it has none. */
export function deriveSpellRoll(spell: SpellProse): DerivedRoll {
  const text = spell.text.replace(/[*_]+/g, "").replace(/\s+/g, " ").trim();
  const circle = circleNumber(spell.circle);
  if (circle === undefined) return { skip: "no circle" };
  const range = spell.range?.trim();
  const base = { circle, ...(range ? { range } : {}) };

  const heal = text.match(/regains?\s+(?:a number of\s+)?hit points equal to\s+(\d*d\d+)/i);
  if (heal && !/\bspell attack\b|saving throw|\bsave\b/i.test(text)) {
    const damage: DamageSpec = { roll: heal[1], type: "healing" };
    const upcast = upcastOf(text, damage, circle);
    return { roll: { form: "healing", ...base, damage, ...(upcast ? { upcast } : {}) } };
  }

  const damage = damageOf(text);
  const scaled = (roll: RollAspect): RollAspect => {
    if (!damage) return roll;
    const leveled = circle === 0 ? leveledOf(text, damage) : undefined;
    const upcast = circle > 0 ? upcastOf(text, damage, circle) : undefined;
    return { ...roll, ...(leveled ? { leveled } : {}), ...(upcast ? { upcast } : {}) };
  };

  const attack = text.match(/\bmake an? (ranged|melee) spell attack\b/i);
  const save = text.match(new RegExp(`(?:must (?:make|succeed on)|makes?) an? ${ABILITY} sav(?:e|ing throw)`, "i"));
  const condition = text.match(
    new RegExp(
      `\\b(?:or be|or become|is|are|be|becomes?|becoming|falls?|fall) (?:either |also )?(?:knocked )?(${ROLL_CONDITIONS.join("|")})\\b`,
      "i"
    )
  );
  const effects = condition ? [condition[1].toLowerCase()] : undefined;
  const notes = condition ? sentenceWith(text, condition.index ?? 0) : undefined;
  const lasting = /minute|hour|concentration/i.test(spell.duration ?? "") ? ` (${spell.duration})` : "";

  if (attack && damage) {
    return {
      roll: scaled({
        form: "spell",
        ...base,
        damage,
        ...(save && effects
          ? {
              save: { ability: abilityAbbrev(save[1]), on_success: `negates ${effects[0]}` },
              effects,
              notes: `${notes}${lasting}`,
            }
          : {}),
      }),
    };
  }
  if (save && (damage || effects)) {
    const half = /half (?:as much|the) damage|half as much/i.test(text);
    const on_success = damage ? (half ? "half damage" : "no damage") : `negates ${effects![0]}`;
    return {
      roll: scaled({
        form: "save",
        ...base,
        save: { ability: abilityAbbrev(save[1]), on_success },
        ...(damage ? { damage } : {}),
        ...(effects ? { effects, notes: `${notes}${lasting}` } : {}),
      }),
    };
  }
  // A smite or a weapon's extra damage ("the attack deals an extra 2d6 radiant damage"): a rider on hits.
  const extra = text.match(/\b(?:deals?|dealing) an? (?:extra|additional) (\d+d\d+) (\w+) damage/i);
  if (extra && ROLL_DAMAGE_TYPES.includes(extra[2].toLowerCase()) && !save) {
    const damage: DamageSpec = { roll: extra[1], type: extra[2].toLowerCase() };
    const upcast = circle > 0 ? upcastOf(text, damage, circle) : undefined;
    return { roll: { form: "rider", ...base, damage, ...(upcast ? { upcast } : {}) } };
  }
  if (attack) return { skip: "a spell attack with no damage it names" };
  if (save) return { skip: "a save with no damage or condition the simulator knows" };
  return { skip: "no attack, save or healing in its words" };
}
