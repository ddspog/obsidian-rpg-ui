/**
 * Resolves one PC spell option for the encounter simulator from a spell note's
 * `roll:` block: a spell attack, a save effect or a heal when the roll has a
 * modelled form, otherwise a skipped option with a reason (R9, R10). Pure data
 * in, pure data out; no Obsidian and no I/O.
 */
import { deriveSpellRoll } from "lib/domains/spells/derive-roll";
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
        const sized = areaTargets(`${String(roll.range ?? spell.range ?? "")} ${text}`);
        const area = AREA_PATTERN.test(text) || (sized.targets ?? 0) > 1;
        const inflicts = inflictOfRoll(roll, spell.duration);
        return {
          action: {
            kind: "save",
            name,
            dc,
            ability,
            damage,
            onSuccess,
            area,
            ...(area ? sized : {}),
            circle,
            ...(inflicts ? { inflicts } : {}),
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
      // A spell attack whose hit also asks for a save brings its condition on a failed one (Luminous Bolt).
      const attackSave = isRecord(roll.save) ? abilityKeyOf(roll.save.ability) : undefined;
      const inflicts = attackSave
        ? inflictOfRoll(roll, spell.duration, {
            ability: attackSave,
            dc:
              plainNumber(roll.save && isRecord(roll.save) ? roll.save.dc : undefined) ??
              8 + numbers.proficiencyBonus + numbers.castingModifier,
          })
        : undefined;
      return {
        action: { kind: "spell-attack", name, hitBonus, damage, circle, ...(inflicts ? { inflicts } : {}) },
        fidelity: modelled,
      };
    }

    // No damage: a save that brings a condition the engine plays (Hold) is a save that deals nothing.
    const save = isRecord(roll.save) ? roll.save : undefined;
    const ability = abilityKeyOf(save?.ability);
    const inflicts = inflictOfRoll(roll, spell.duration);
    if (!damage && ability && inflicts) {
      if (!numbers) return { fidelity: { name, owner, status: "modelled" }, needsCastingModifier: true };
      const sized = areaTargets(`${String(roll.range ?? spell.range ?? "")} ${text}`);
      const area = AREA_PATTERN.test(text) || (sized.targets ?? 0) > 1;
      return {
        action: {
          kind: "save",
          name,
          dc: plainNumber(save?.dc) ?? 8 + numbers.proficiencyBonus + numbers.castingModifier,
          ability,
          damage: { expr: "0" },
          onSuccess: "none",
          area,
          ...(area ? sized : {}),
          circle,
          inflicts,
        },
        fidelity: { name, owner, status: "modelled" },
      };
    }
    // Otherwise a roll that imposes a save or an effect is a control spell the engine does not play.
    if (!damage && (roll.save !== undefined || (Array.isArray(roll.effects) && roll.effects.length > 0))) {
      return skipped(name, owner, "control-spell");
    }
  }

  // No `roll:`: the one its prose gives (lib/domains/spells/derive-roll.ts), resolved like a written one.
  if (!roll) {
    const derived = deriveSpellRoll({ text: spell.text ?? "", circle, range: spell.range, duration: spell.duration });
    if ("roll" in derived) {
      const result = resolveSpellOption(
        { ...spell, roll: derived.roll as unknown as Record<string, unknown> },
        numbers,
        owner
      );
      if (result.action || result.needsCastingModifier) return result;
    }
  }

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

/** The condition a roll's `effects` name, as the engine plays it, with how long it lasts. */
function inflictOfRoll(
  roll: Record<string, unknown>,
  duration: string | undefined,
  save?: { ability: AbilityKey; dc: number }
): Inflict | undefined {
  const effects = Array.isArray(roll.effects) ? roll.effects : [];
  const condition = effects
    .map((e) =>
      (typeof e === "string" ? e : isRecord(e) && typeof e.label === "string" ? e.label : "").trim().toLowerCase()
    )
    .find((e): e is ModelledCondition => (MODELLED_CONDITIONS as readonly string[]).includes(e));
  if (!condition) return undefined;
  const notes = typeof roll.notes === "string" ? roll.notes : "";
  const lasts: Inflict["lasts"] =
    condition === "prone"
      ? "start"
      : /minute|hour|concentration|for the duration/i.test(`${notes} ${duration ?? ""}`)
        ? "fight"
        : "end";
  return { condition, lasts, ...(save ? { save } : {}) };
}

/**
 * A spell read from its prose (no `roll:`): the roll `deriveSpellRoll` gives it, resolved like a written one.
 * Undefined when its words give none.
 */
export function spellFromText(
  spell: SpellOptionInput,
  numbers: SpellNumbers | undefined,
  owner: string
): SpellOptionResult | undefined {
  const derived = deriveSpellRoll({
    text: spell.text ?? "",
    circle: spell.circle,
    range: spell.range,
    duration: spell.duration,
  });
  if (!("roll" in derived)) return undefined;
  return resolveSpellOption({ ...spell, roll: derived.roll as unknown as Record<string, unknown> }, numbers, owner);
}
