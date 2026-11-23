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
  type Inflict,
  MODELLED_CONDITIONS,
  type ModelledCondition,
  type SkipReason,
  type UseLimit,
  type WeaponAttackAction,
} from "./types";

export type ParsedMultiattack = MultiattackSpec;

export interface MonsterFeatureInput {
  name: string;
  type?: string;
  text: string;
}

/** A legendary action: what it does (an action of its own, or one of the monster's attacks by name) and its cost. */
export interface LegendaryFeature {
  cost: number;
  action?: ModelledAction;
  /** "The dragon makes a Tail attack.": the monster's attack it uses. */
  attackRef?: string;
}

export interface MonsterFeatureClass {
  action?: ModelledAction;
  /** A reaction that raises its own AC against a hit. */
  reaction?: { ac: number; untilTurn: boolean };
  /** "Legendary Resistance (3/Day)": its uses. */
  legendaryResistance?: number;
  legendary?: LegendaryFeature;
  multiattack?: ParsedMultiattack;
  /** A Spellcasting action: the spells it casts, to be resolved against the vault's spell notes. */
  spellcasting?: MonsterSpellcasting;
  skip?: SkipReason;
}

/** "casts one of the following spells, using CHA … (spell save DC 17)": the ability, the DC and the lists. */
export interface MonsterSpellcasting {
  ability?: AbilityKey;
  dc?: number;
  attack?: number;
  /** Each list with its uses a day (absent: at will). */
  lists: Array<{ perDay?: number; spells: string[] }>;
}

/**
 * A monster's spell list from its Spellcasting prose: "At will: *dancing lights, minor illusion*", "3/day each:
 * *hold person*, *invisibility* (self only)", "1/day: *slow*". Names lower-cased as written, a parenthesis dropped.
 */
export function parseMonsterSpellcasting(text: string): MonsterSpellcasting | undefined {
  const flat = text.replace(/!\[\[[^\]]*\]\]/g, " ");
  const ability = flat.match(
    /using (STR|DEX|CON|INT|WIS|CHA|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b/i
  );
  const dc = flat.match(/spell save DC\s*(\d+)/i);
  const attack = flat.match(/([+-]\d+) to hit with spell attacks/i);
  const lists: MonsterSpellcasting["lists"] = [];
  for (const m of flat.matchAll(/(At will|(\d+)\s*\/\s*day(?: each)?)\s*:\s*([^\n]+)/gi)) {
    const spells = m[3]
      .replace(/\([^)]*\)/g, "")
      .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_m, target: string, shown?: string) => shown ?? target)
      .replace(/[*_]/g, "")
      .split(/,/)
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean);
    if (spells.length) lists.push({ ...(m[2] ? { perDay: parseInt(m[2], 10) } : {}), spells });
  }
  if (!lists.length) return undefined;
  return {
    ...(ability ? { ability: abilityKey(ability[1]) ?? undefined } : {}),
    ...(dc ? { dc: parseInt(dc[1], 10) } : {}),
    ...(attack ? { attack: parseInt(attack[1], 10) } : {}),
    lists,
  };
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

const CONDITION = `(${MODELLED_CONDITIONS.join("|")})`;

/** How long a condition from prose lasts: its own words, else prone until it stands, restrained the fight. */
function lastsOf(condition: ModelledCondition, text: string): Inflict["lasts"] {
  if (/until the end of (?:its|the target'?s?|the creature'?s?) next turn/i.test(text)) return "end";
  if (/\b(?:for )?1 minute\b/i.test(text)) return "fight";
  if (condition === "prone") return "start";
  return condition === "restrained" ? "fight" : "end";
}

/**
 * The condition a hit's prose puts on the target: "must succeed on a DC 13 Strength saving throw or be knocked
 * prone" (a save of its own), "the target is poisoned until the end of its next turn" (on the hit). A save to
 * end it each turn ("repeat the saving throw at the end of each of its turns", "escape DC 13") is kept.
 */
export function inflictOfHit(text: string): Inflict | undefined {
  const saved = text.match(
    new RegExp(
      `DC\\s*(\\d+)\\s+(\\w+)\\s+sav(?:e|ing throw)\\b[^.]*?\\bor (?:be |become )?(?:knocked )?${CONDITION}\\b`,
      "i"
    )
  );
  if (saved) {
    const ability = abilityKey(saved[2]);
    const condition = saved[3].toLowerCase() as ModelledCondition;
    if (ability) return { condition, save: { ability, dc: parseInt(saved[1], 10) }, lasts: lastsOf(condition, text) };
  }
  const plainHit = text.match(new RegExp(`\\b(?:target|it) is (?:also )?(?:knocked )?${CONDITION}\\b`, "i"));
  if (!plainHit) return undefined;
  const condition = plainHit[1].toLowerCase() as ModelledCondition;
  const escape = text.match(/escape DC\s*(\d+)/i);
  return {
    condition,
    lasts: lastsOf(condition, text),
    ...(escape ? { save: { ability: "str" as AbilityKey, dc: parseInt(escape[1], 10) } } : {}),
  };
}

/** The condition a failed save brings: "On a failed save, a creature takes 7 (2d6) damage and is knocked prone". */
export function inflictOfSave(text: string): Inflict | undefined {
  const m = text.match(
    new RegExp(`\\b(?:and is|and be|is|be|becomes?|becoming) (?:also )?(?:knocked )?${CONDITION}\\b`, "i")
  );
  if (!m) return undefined;
  const condition = m[1].toLowerCase() as ModelledCondition;
  return { condition, lasts: lastsOf(condition, text) };
}

function attackFrom(name: string, text: string): WeaponAttackAction | null {
  const hit = text.match(/([+-]?\d+)\s+to hit/i);
  if (!hit) return null;
  const afterHit = text.match(/\bHit:\s*(.*)$/i)?.[1];
  if (afterHit === undefined) return null;
  const damage = damageFrom(afterHit);
  if (!damage) return null;
  const inflicts = inflictOfHit(afterHit);
  return { kind: "weapon", name, hitBonus: parseInt(hit[1], 10), damage, ...(inflicts ? { inflicts } : {}) };
}

function saveFrom(name: string, text: string): SaveAction | null {
  // "a DC 16 Dexterity saving throw" or, the Monster Vault's way, "a DC 23 DEX save".
  const save = text.match(/DC\s*(\d+)\s+(\w+)\s+sav(?:e|ing throw)\b/i);
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
    onSuccess: /half (?:as much|the) damage/i.test(text) ? "half" : "none",
    area: /\b(?:each|all|every) creatures?\b/i.test(text),
    ...areaTargets(text),
    circle: 0,
    ...((): { inflicts?: Inflict } => {
      const inflicts = inflictOfSave(text);
      return inflicts ? { inflicts } : {};
    })(),
  };
}

/** The creatures an area catches, by its size (the usual targets-in-area table); none when it gives no size. */
export function areaTargets(text: string): { targets?: number } {
  const m = text.match(
    /(\d+)[- ](?:foot|feet|ft\.?)(?:-radius)?\s+(cone|cube|square|line|sphere|cylinder|radius|emanation|burst)/i
  );
  if (!m) return {};
  const size = parseInt(m[1], 10);
  const shape = m[2].toLowerCase();
  const per = shape === "cone" ? 10 : shape === "line" ? 30 : 5;
  return { targets: Math.max(1, Math.ceil(size / per)) };
}

/** "(Recharge 5-6)", "(Recharge 6)", "(2/Day)" in a feature's name or its first words. */
export function useLimitOf(name: string, text: string): UseLimit | undefined {
  const where = `${name} ${text.slice(0, 40)}`;
  const recharge = where.match(/\(Recharge (\d)(?:\s*[-\u2013]\s*\d)?\)/i);
  if (recharge) return { recharge: parseInt(recharge[1], 10) };
  const perDay = where.match(/\((\d+)\/Day\)/i);
  if (perDay) return { perDay: parseInt(perDay[1], 10) };
  return undefined;
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
    const spellcasting = parseMonsterSpellcasting(feature.text);
    return spellcasting ? { spellcasting, skip: "monster-spellcasting" } : { skip: "monster-spellcasting" };
  }
  const lr = name.match(/^Legendary Resistance \((\d+)\/Day\)/i);
  if (lr) return { legendaryResistance: parseInt(lr[1], 10), skip: "unsupported-feature" };
  if (feature.type?.trim().toLowerCase() === "reaction") {
    const reaction = acReactionOf(text);
    return reaction ? { reaction, skip: "unsupported-feature" } : UNSUPPORTED;
  }
  if (feature.type?.trim().toLowerCase() === "legendary") {
    const cost = parseInt(name.match(/\(Costs (\d+) Actions?\)/i)?.[1] ?? "1", 10);
    const ref = text.match(/\bmakes (?:an?|one) (.+?) attack\b/i);
    if (ref) return { legendary: { cost, attackRef: ref[1].trim() }, skip: "unsupported-feature" };
    const own = attackFrom(name, text) ?? saveFrom(name, text);
    return own ? { legendary: { cost, action: own } } : UNSUPPORTED;
  }
  if (feature.type?.trim().toLowerCase() !== "action") return UNSUPPORTED;
  if (/multiattack/i.test(name)) {
    const multiattack = parseMultiattack(text);
    return multiattack ? { multiattack } : UNSUPPORTED;
  }
  // "Two kobolds within 5 feet of each other can combine their actions": it needs a partner the engine does not pair.
  if (/\bcombine their actions\b/i.test(text)) return UNSUPPORTED;
  const limit = useLimitOf(name, text);
  const attack = attackFrom(name, text);
  if (attack) return { action: limit ? { ...attack, limit } : attack };
  const save = saveFrom(name, text);
  if (save) return { action: limit ? { ...save, limit } : save };
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

/**
 * A reaction that raises the creature's own AC against a hit: "adds 2 to its AC against one melee attack that
 * would hit it", "increasing its AC by 2 until the start of its next turn". One that shields another creature
 * (a guard's, a unicorn's) is not this.
 */
export function acReactionOf(text: string): { ac: number; untilTurn: boolean } | undefined {
  const flat = text.replace(/[*_]+/g, "").replace(/\s+/g, " ");
  const m = flat.match(/\b(?:adds?|add) (\d+) to its AC\b|\bincreasing its AC by (\d+)\b/i);
  if (!m) return undefined;
  if (!/\b(?:attacks? it|would hit it|is hit by an attack|hit by an attack)\b/i.test(flat)) return undefined;
  if (/\bfriendly creature\b|\bcreature within \d+ feet of (?:it|the)\b/i.test(flat)) return undefined;
  return { ac: parseInt(m[1] ?? m[2], 10), untilTurn: /until the start of its next turn/i.test(flat) };
}
