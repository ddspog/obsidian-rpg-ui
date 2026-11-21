/**
 * Monster feature prose, read into the actions the simulator can model.
 *
 * A Monster Vault feature is prose (`*Melee Weapon Attack:* +3 to hit, ...
 * *Hit:* 5 (1d8 + 1) slashing damage`), so the attack, the area effect and the
 * Multiattack are recognised from it. Pure: no Obsidian and no I/O.
 */

import { parseMultiattack, type MultiattackSpec } from "lib/domains/session-log/multiattack";
import { parseDamage } from "lib/domains/session-log/session-actions";

import { averageOf, isRollable } from "./rng";
import {
  ABILITY_KEYS,
  type AbilityKey,
  type DamageSpec,
  type ModelledAction,
  type MultiattackAction,
  type SaveAction,
  type SkipReason,
  type WeaponAttackAction,
} from "./types";

export type ParsedMultiattack = MultiattackSpec;

export interface MonsterFeatureInput {
  name: string;
  type?: string;
  text: string;
}

export interface MonsterFeatureClass {
  action?: ModelledAction;
  multiattack?: ParsedMultiattack;
  skip?: SkipReason;
}

const UNSUPPORTED: MonsterFeatureClass = { skip: "unsupported-feature" };

/** Markdown emphasis dropped and whitespace collapsed, so one regex fits every spelling. */
function plain(text: string): string {
  return text.replace(/[*_]+/g, "").replace(/−/g, "-").replace(/\s+/g, " ").trim();
}

/** The first-listed damage of a prose fragment: dice through `parseDamage`, else a flat amount. */
function damageFrom(fragment: string): DamageSpec | null {
  // "1 piercing damage plus 3 (1d6) ..." is flat: parseDamage would skip to the later dice.
  const flat = fragment.match(/^\s*(\d+)\s+(?:([a-z]+)\s+)?damage/i);
  if (flat) {
    const type = flat[2]?.toLowerCase();
    return { expr: String(parseInt(flat[1], 10)), ...(type ? { type } : {}) };
  }
  const parsed = parseDamage(fragment);
  if (!parsed) return null;
  // Damage the engine cannot roll leaves the feature unsupported rather than failing a run mid-trial.
  if (!isRollable(parsed.dice)) return null;
  return { expr: parsed.dice, ...(parsed.type ? { type: parsed.type } : {}) };
}

function abilityKey(word: string): AbilityKey | null {
  const key = word.slice(0, 3).toLowerCase();
  return (ABILITY_KEYS as readonly string[]).includes(key) ? (key as AbilityKey) : null;
}

function attackFrom(name: string, text: string): WeaponAttackAction | null {
  const hit = text.match(/([+-]?\d+)\s+to hit/i);
  if (!hit) return null;
  const afterHit = text.match(/\bHit:\s*(.*)$/i)?.[1];
  if (afterHit === undefined) return null;
  const damage = damageFrom(afterHit);
  if (!damage) return null;
  return { kind: "weapon", name, hitBonus: parseInt(hit[1], 10), damage };
}

function saveFrom(name: string, text: string): SaveAction | null {
  const save = text.match(/DC\s*(\d+)\s+(\w+)\s+saving throw/i);
  if (!save) return null;
  const ability = abilityKey(save[2]);
  if (!ability) return null;
  const damage = damageFrom(text.slice(save.index! + save[0].length));
  if (!damage) return null;
  return {
    kind: "save",
    name,
    dc: parseInt(save[1], 10),
    ability,
    damage,
    onSuccess: /half as much damage/i.test(text) ? "half" : "none",
    area: /\b(?:each|all|every) creatures?\b/i.test(text),
    circle: 0,
  };
}

/**
 * What one feature of a monster is to the simulator, in precedence order:
 * spellcasting (skipped), a non-action type (skipped), a Multiattack, an
 * attack, an area save with damage, otherwise skipped as unsupported.
 */
export function classifyMonsterFeature(feature: MonsterFeatureInput): MonsterFeatureClass {
  const name = feature.name.trim();
  const text = plain(feature.text);
  if (/^(innate )?spellcasting$/i.test(name) || /casts one of the following spells/i.test(text)) {
    return { skip: "monster-spellcasting" };
  }
  if (feature.type?.trim().toLowerCase() !== "action") return UNSUPPORTED;
  if (/multiattack/i.test(name)) {
    const multiattack = parseMultiattack(text);
    return multiattack ? { multiattack } : UNSUPPORTED;
  }
  const attack = attackFrom(name, text);
  if (attack) return { action: attack };
  const save = saveFrom(name, text);
  if (save) return { action: save };
  return UNSUPPORTED;
}

/** An attack's name without a trailing "(Recharge 5-6)" style note, lower-cased. */
function nameKey(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase();
}

/**
 * A Multiattack bound to the monster's own attacks: `count` swings, each the
 * named alternative with the highest average damage (ties to the first listed).
 * Without a single named attack the monster has, it is unsupported.
 */
export function bindMultiattack(
  parsed: ParsedMultiattack,
  attacksByName: Map<string, WeaponAttackAction> | Record<string, WeaponAttackAction>,
  name = "Multiattack"
): MultiattackAction | { skip: "unsupported-feature" } {
  const attacks = attacksByName instanceof Map ? [...attacksByName.values()] : Object.values(attacksByName);
  const bound: WeaponAttackAction[] = [];
  for (const wanted of parsed.attacks) {
    const found = attacks.find((a) => nameKey(a.name) === nameKey(wanted));
    if (found) bound.push(found);
  }
  if (bound.length === 0 || parsed.count < 1) return { skip: "unsupported-feature" };
  let best = bound[0];
  for (const candidate of bound.slice(1)) {
    if (averageOf(candidate.damage.expr) > averageOf(best.damage.expr)) best = candidate;
  }
  return { kind: "multiattack", name, swings: Array.from({ length: parsed.count }, () => best) };
}
