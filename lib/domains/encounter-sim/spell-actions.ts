/**
 * Resolves one PC spell option for the encounter simulator from a spell note's
 * `roll:` block: a spell attack, a save effect or a heal when the roll has a
 * modelled form, otherwise a skipped option with a reason (R9, R10). Pure data
 * in, pure data out; no Obsidian and no I/O.
 */
import { areaTargets } from "./monster-actions";
import { isRollable } from "./rng";
import {
  ABILITY_KEYS,
  type AbilityKey,
  type DamageSpec,
  type FidelityRecord,
  type Inflict,
  MODELLED_CONDITIONS,
  type ModelledAction,
  type ModelledCondition,
  type SkipReason,
} from "./types";

/** What the resolver reads of a spell note's `rpg spell` fence. */
export interface SpellOptionInput {
  name: string;
  /** The fence's `roll:` object, when the note has one. */
  roll?: Record<string, unknown>;
  summary?: string;
  text?: string;
  /** 0 = cantrip. Falls back to `roll.circle`, then 0, when absent. */
  circle?: number;
  /** The fence's `casting:` ("1 bonus action"). */
  casting?: string;
  /** The fence's `range:` ("Self (15-foot cone)"), for an area's size. */
  range?: string;
  /** The fence's `duration:` ("Concentration, up to 1 minute"), for how long a condition lasts. */
  duration?: string;
}

/** The character numbers a modelled spell derives its bonus and DC from. */
export interface SpellNumbers {
  proficiencyBonus: number;
  castingModifier: number;
  characterLevel: number;
}

export interface SpellOptionResult {
  action?: ModelledAction;
  fidelity: FidelityRecord;
  /** True when the spell has a modelled form but `numbers` was not given. */
  needsCastingModifier?: boolean;
}

const AREA_PATTERN = /\b(each|all) creatures?\b/i;
const BUFF_PATTERN = /attack roll|saving throw|armor class|\bAC\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A finite number, or a string holding a plain integer; otherwise undefined. */
function plainNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\s*[+-]?\d+\s*$/.test(value)) return parseInt(value, 10);
  return undefined;
}

/** One damage object (or the first of a list) as a DamageSpec. */
function damageSpecOf(value: unknown): DamageSpec | undefined {
  const entry = Array.isArray(value) ? value[0] : value;
  if (!isRecord(entry)) return undefined;
  const rollValue = entry.roll;
  const expr =
    typeof rollValue === "string" ? rollValue.trim() : typeof rollValue === "number" ? String(rollValue) : "";
  // Damage the engine cannot roll is no damage: the spell is skipped instead of failing a run.
  if (!expr || !isRollable(expr)) return undefined;
  const type = typeof entry.type === "string" && entry.type.trim() ? entry.type.trim().toLowerCase() : undefined;
  return type ? { expr, type } : { expr };
}

/** The damage at `characterLevel`: `leveled.at` (highest key not above it) overrides `damage`. */
function damageAt(roll: Record<string, unknown>, characterLevel: number | undefined): DamageSpec | undefined {
  let damage = roll.damage;
  const leveled = roll.leveled;
  if (characterLevel !== undefined && isRecord(leveled) && isRecord(leveled.at)) {
    let best: number | undefined;
    let override: unknown;
    for (const [key, value] of Object.entries(leveled.at)) {
      const level = Number(key);
      if (!Number.isFinite(level) || level > characterLevel) continue;
      if (!isRecord(value) || value.damage === undefined) continue;
      if (best === undefined || level > best) {
        best = level;
        override = value.damage;
      }
    }
    if (best !== undefined) damage = override;
  }
  return damageSpecOf(damage);
}

/** "CON", "Constitution", "con" -> "con"; anything else undefined. */
function abilityKeyOf(value: unknown): AbilityKey | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().slice(0, 3).toLowerCase();
  return (ABILITY_KEYS as readonly string[]).includes(key) ? (key as AbilityKey) : undefined;
}

/** A heal roll gains the casting modifier unless it already carries a flat bonus. */
function healExpr(roll: string, castingModifier: number): string {
  const compact = roll.replace(/\s+/g, "").replace("−", "-");
  if (/[+-]\d+$/.test(compact) || castingModifier === 0) return compact;
  return castingModifier > 0 ? `${compact}+${castingModifier}` : `${compact}${castingModifier}`;
}

function skipped(name: string, owner: string, reason: SkipReason): SpellOptionResult {
  return { fidelity: { name, owner, status: "skipped", reason } };
}

/** Classify a roll-less (or non-modelled) spell by its text: a buff, else a utility. */
function skipFromText(name: string, owner: string, text: string): SpellOptionResult {
  return skipped(name, owner, BUFF_PATTERN.test(text) ? "buff" : "utility-spell");
}

type ModelledForm = { kind: "attack" } | { kind: "save" } | { kind: "heal" };

/** The modelled form of a roll with damage, or undefined when it is not one. */
function modelledFormOf(roll: Record<string, unknown>, damage: DamageSpec): ModelledForm | undefined {
  const form = typeof roll.form === "string" ? roll.form.trim().toLowerCase() : "";
  if (form === "healing" || damage.type === "healing") return { kind: "heal" };
  if (form === "melee" || form === "ranged" || form === "spell") return { kind: "attack" };
  if (form === "save") return { kind: "save" };
  return undefined;
}

/**
 * Resolve one spell into a modelled action or a skipped fidelity record.
 * Modelled forms need `numbers`; without them the result carries
 * `needsCastingModifier` and no action. Skipped classifications never do.
 */
export function resolveSpellOption(
  spell: SpellOptionInput,
  numbers: SpellNumbers | undefined,
  owner: string
): SpellOptionResult {
  const { name } = spell;
  const roll = spell.roll;
  const text = `${spell.summary ?? ""}\n${spell.text ?? ""}`;
  const circle = spell.circle ?? plainNumber(roll?.circle) ?? 0;

  if (roll && isRecord(roll)) {
    const rolled = damageAt(roll, numbers?.characterLevel);
    // A die of another kind ("penalty": Bane's, subtracted from attacks) is no damage.
    const damage =
      rolled && (!rolled.type || rolled.type === "healing" || DAMAGE_TYPE_WORDS.includes(rolled.type))
        ? rolled
        : undefined;
    const form = damage ? modelledFormOf(roll, damage) : undefined;

    if (damage && form) {
      const modelled: FidelityRecord = { name, owner, status: "modelled" };
      if (form.kind === "save") {
        const save = isRecord(roll.save) ? roll.save : undefined;
        const ability = abilityKeyOf(save?.ability);
        // A save the sim cannot attach to an ability is a save that imposes something it cannot model.
        if (!ability) return skipped(name, owner, "control-spell");
        if (!numbers) return { fidelity: modelled, needsCastingModifier: true };
        const dc = plainNumber(save?.dc) ?? 8 + numbers.proficiencyBonus + numbers.castingModifier;
        const onSuccess = typeof save?.on_success === "string" && /^\s*half/i.test(save.on_success) ? "half" : "none";
        return {
          action: {
            kind: "save",
            name,
            dc,
            ability,
            damage,
            onSuccess,
            area: AREA_PATTERN.test(text),
            circle,
          },
          fidelity: modelled,
        };
      }
      if (!numbers) return { fidelity: modelled, needsCastingModifier: true };
      if (form.kind === "heal") {
        return {
          action: {
            kind: "heal",
            name,
            expr: healExpr(damage.expr, numbers.castingModifier),
            circle,
            ...(isBonus(spell.casting) ? { bonus: true } : {}),
          },
          fidelity: modelled,
        };
      }
      const hitBonus = plainNumber(roll.to_hit) ?? numbers.proficiencyBonus + numbers.castingModifier;
      return {
        action: { kind: "spell-attack", name, hitBonus, damage, circle },
        fidelity: modelled,
      };
    }

    // No modelled damage: a roll that imposes a save or an effect is a control spell.
    if (!damage && (roll.save !== undefined || (Array.isArray(roll.effects) && roll.effects.length > 0))) {
      return skipped(name, owner, "control-spell");
    }
  }

  // A spell its prose describes well enough: an attack, a save with damage, a save with a condition.
  const fromText = spellFromText(spell, numbers, owner);
  if (fromText) return fromText;

  // A heal its text gives ("regains hit points equal to 1d4 + your spellcasting ability modifier").
  const heal = text.match(
    /regains?\s+(?:a number of\s+)?hit points equal to\s+(\d*d\d+)(\s*\+\s*your spellcasting ability modifier)?/i
  );
  if (heal && isRollable(heal[1])) {
    if (!numbers) return { fidelity: { name, owner, status: "modelled" }, needsCastingModifier: true };
    return {
      action: {
        kind: "heal",
        name,
        expr: heal[2] ? healExpr(heal[1], numbers.castingModifier) : heal[1],
        circle,
        ...(isBonus(spell.casting) ? { bonus: true } : {}),
      },
      fidelity: { name, owner, status: "modelled" },
    };
  }

  return skipFromText(name, owner, text);
}

const isBonus = (casting: string | undefined) => /\bbonus action\b/i.test(casting ?? "");

const DAMAGE_TYPE_WORDS = [
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

const ABILITY_WORD = "(STR|DEX|CON|INT|WIS|CHA|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)";
const CONDITION_WORD = `(${MODELLED_CONDITIONS.join("|")})`;

/** The dice at a character level from "increases by 1d8 when you reach 5th level (2d8), 11th level (3d8)…". */
function scaledDice(text: string, base: string, level: number | undefined): string {
  if (level === undefined) return base;
  let dice = base;
  for (const m of text.matchAll(/(\d+)(?:st|nd|rd|th) level \((\d+d\d+)\)/gi)) {
    if (parseInt(m[1], 10) <= level) dice = m[2];
  }
  return dice;
}

/**
 * A spell read from its prose, for the notes with no `roll:` (most of a compendium's): "Make a ranged spell
 * attack … takes 1d10 fire damage" (an attack), "must make a DEX save … takes 3d6 fire damage on a failed save,
 * or half as much" (a save, an area when "each creature in a 15-foot cone"), "must succeed on a WIS save or be
 * paralyzed" (a condition, with or without damage). Undefined when it reads as none of these.
 */
export function spellFromText(
  spell: SpellOptionInput,
  numbers: SpellNumbers | undefined,
  owner: string
): SpellOptionResult | undefined {
  const text = (spell.text ?? "").replace(/[*_]+/g, "").replace(/\s+/g, " ");
  const { name } = spell;
  const circle = spell.circle ?? 0;
  // A damage roll counts with a damage type ("takes 3d6 fire damage"), not a die a debuff subtracts (Bane).
  const damageMatch = [...text.matchAll(/takes? (\d+d\d+)(?: \+ \d+)? (\w+) damage/gi)].find((m) =>
    DAMAGE_TYPE_WORDS.includes(m[2].toLowerCase())
  );
  const level = numbers?.characterLevel;
  const damage: DamageSpec | undefined = damageMatch
    ? {
        expr: circle === 0 ? scaledDice(text, damageMatch[1], level) : damageMatch[1],
        type: damageMatch[2].toLowerCase(),
      }
    : undefined;
  const modelled: FidelityRecord = { name, owner, status: "modelled" };

  if (/\bmake an? (?:ranged|melee) spell attack\b/i.test(text) && damage) {
    if (!numbers) return { fidelity: modelled, needsCastingModifier: true };
    return {
      action: {
        kind: "spell-attack",
        name,
        hitBonus: numbers.proficiencyBonus + numbers.castingModifier,
        damage,
        circle,
      },
      fidelity: modelled,
    };
  }

  const save = text.match(
    new RegExp(`(?:must (?:make|succeed on)|makes?) an? ${ABILITY_WORD} sav(?:e|ing throw)`, "i")
  );
  if (!save) return undefined;
  const ability = abilityKeyOf(save[1]);
  if (!ability) return undefined;
  const condition = text.match(
    new RegExp(`\\b(?:or be|or become|is|are|be) (?:also )?(?:knocked )?${CONDITION_WORD}\\b`, "i")
  );
  const lasts: Inflict["lasts"] | undefined = condition
    ? condition[1].toLowerCase() === "prone"
      ? "start"
      : /minute|hour|concentration/i.test(spell.duration ?? "") || /\bfor (?:the duration|1 minute)\b/i.test(text)
        ? "fight"
        : "end"
    : undefined;
  if (!damage && !condition) return undefined;
  if (!numbers) return { fidelity: modelled, needsCastingModifier: true };
  const area = /\b(?:each|every|all) creatures?\b/i.test(text);
  const size = areaTargets(`${text} ${spell.range ?? ""}`);
  return {
    action: {
      kind: "save",
      name,
      dc: 8 + numbers.proficiencyBonus + numbers.castingModifier,
      ability,
      damage: damage ?? { expr: "0" },
      onSuccess: /half (?:as much|the) damage|half as much/i.test(text) ? "half" : "none",
      area,
      ...(area ? size : {}),
      circle,
      ...(condition && lasts
        ? { inflicts: { condition: condition[1].toLowerCase() as ModelledCondition, lasts } }
        : {}),
    },
    fidelity: modelled,
  };
}
