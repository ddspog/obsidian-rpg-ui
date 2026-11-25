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
  type BonusMove,
  type Reach,
  type Reaction,
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
  /** A reaction besides an AC one: a counterattack (its attack named in `attackRef`), damage back, and the like. */
  otherReaction?: ParsedReaction;
  /** A bonus action: an attack or save it makes with it, or the moves it gives (Nimble Escape). */
  bonus?: ModelledAction;
  bonusMoves?: BonusMove[];
  skip?: SkipReason;
}

/** The moves a bonus action gives: "takes the Disengage or Hide action", Cunning Action's "Dash, Disengage, or Hide". */
export function bonusMovesOf(text: string): BonusMove[] {
  const flat = text.replace(/[*_]+/g, "");
  if (!/\btakes? the\b|\bDash\b|\bDisengage\b|\bHide\b/.test(flat)) return [];
  const moves: BonusMove[] = [];
  if (/\bDash\b/.test(flat)) moves.push("dash");
  if (/\bDisengage\b/.test(flat)) moves.push("disengage");
  if (/\bHide\b/.test(flat)) moves.push("hide");
  return moves;
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

/**
 * The other damage groups a hit carries after the first one: "5 (1d6 + 2) piercing damage plus 7 (2d6)
 * poison damage", "11 (2d8 + 2) slashing damage plus 3 fire damage". Each keeps its own type. Only a
 * "plus" group with a readable roll counts (a conditional one, "if it is a fiend", is read plain).
 */
export function extraDamagesOf(afterHit: string): DamageSpec[] {
  const out: DamageSpec[] = [];
  for (const m of afterHit.matchAll(/(?:^|,\s*|\s+)plus\s+(?:(\d+)\s+\(([^)]+)\)|(\d+))\s+([a-z]+)\s+damage/gi)) {
    const expr = m[2] ?? m[3] ?? m[1];
    if (m[2] && !isRollable(m[2])) continue;
    out.push({ expr, type: m[4].toLowerCase() });
  }
  return out;
}

function attackFrom(name: string, text: string): WeaponAttackAction | null {
  const hit = text.match(/([+-]?\d+)\s+to hit/i);
  if (!hit) return null;
  const afterHit = text.match(/\bHit:\s*(.*)$/i)?.[1];
  if (afterHit === undefined) return null;
  const damage = damageFrom(afterHit);
  if (!damage) return null;
  const inflicts = inflictOfHit(afterHit);
  const reach = attackReach(text);
  const extra = extraDamagesOf(afterHit);
  return {
    kind: "weapon",
    name,
    hitBonus: parseInt(hit[1], 10),
    damage,
    ...(extra.length ? { extra } : {}),
    ...(inflicts ? { inflicts } : {}),
    ...(reach ? { reach } : {}),
  };
}

/**
 * Where an attack reaches: "Melee Weapon Attack: … reach 10 ft." is melee 10, "Ranged …: range 80/320 ft." range
 * 80 (its normal range), "Melee or Ranged …: reach 5 ft. or range 20/60 ft." melee 5 (it closes in). None when the
 * text says neither.
 */
export function attackReach(text: string): Reach | undefined {
  const flat = text.replace(/[*_]+/g, "");
  const reach = flat.match(/\breach (\d+) (?:ft|feet)/i);
  if (/\bMelee\b[^:]*:/i.test(flat) || reach) return { melee: reach ? parseInt(reach[1], 10) : 5 };
  const range = flat.match(/\brange (\d+)(?:\/\d+)? (?:ft|feet)/i);
  if (range) return { range: parseInt(range[1], 10) };
  return undefined;
}

/**
 * How far a save effect reaches from its user: "a point it can see within 120 feet" 120, "each creature within
 * 10 feet of it" 10, "exhales fire in a 30-foot cone" 30 (a cone or line starts at it). None when it says neither.
 */
export function saveReach(text: string): Reach | undefined {
  const flat = text.replace(/[*_]+/g, "");
  const within = flat.match(/\bwithin (\d+) (?:feet|ft\.?)/i);
  if (within) return { range: parseInt(within[1], 10) };
  const shape = flat.match(/(\d+)[- ](?:foot|feet|ft\.?)[- ](cone|line)\b/i);
  if (shape) return { range: parseInt(shape[1], 10) };
  return undefined;
}

function saveFrom(name: string, text: string): SaveAction | null {
  // "a DC 16 Dexterity saving throw" or, the Monster Vault's way, "a DC 23 DEX save".
  const save = text.match(/DC\s*(\d+)\s+(\w+)\s+sav(?:e|ing throw)\b/i);
  if (!save) return null;
  const ability = abilityKey(save[2]);
  if (!ability) return null;
  const damage = damageFrom(text.slice(save.index! + save[0].length));
  if (!damage) return null;
  const shaped = areaTargets(text);
  return {
    kind: "save",
    name,
    dc: parseInt(save[1], 10),
    ability,
    damage,
    onSuccess: /half (?:as much|the) damage/i.test(text) ? "half" : "none",
    // An area is named by its creatures or by its shape ("in a 30-foot cone"), not only by "each/all/every
    // creature": a breath worded "a creature in the cone" still catches the cone's share.
    area:
      /\b(?:each|all|every) creatures?\b/i.test(text) || (/\bcreatures?\b/i.test(text) && shaped.targets !== undefined),
    ...shaped,
    ...((): { reach?: Reach } => {
      const reach = saveReach(text);
      return reach ? { reach } : {};
    })(),
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
    if (reaction) return { reaction, skip: "unsupported-feature" };
    const other = reactionFrom(name, text);
    return other ? { otherReaction: other } : UNSUPPORTED;
  }
  if (feature.type?.trim().toLowerCase() === "legendary") {
    const cost = parseInt(name.match(/\(Costs (\d+) Actions?\)/i)?.[1] ?? "1", 10);
    const ref = text.match(/\bmakes (?:an?|one) (.+?) attack\b/i);
    if (ref) return { legendary: { cost, attackRef: ref[1].trim() }, skip: "unsupported-feature" };
    const own = attackFrom(name, text) ?? saveFrom(name, text);
    return own ? { legendary: { cost, action: own } } : UNSUPPORTED;
  }
  if (feature.type?.trim().toLowerCase() === "bonus") {
    const bonusMoves = bonusMovesOf(text);
    if (bonusMoves.length) return { bonusMoves };
    const limit = useLimitOf(name, text);
    const own = attackFrom(name, text) ?? saveFrom(name, text);
    return own ? { bonus: limit ? { ...own, limit } : own } : UNSUPPORTED;
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
 * A feature body holding several definitions of its own, as one feature each, so every part classifies
 * on its own ("***Multiattack***. The orc warlord makes two Longsword attacks and one Skull Club attack,
 * or it makes three Longbow attacks. ***Longsword***. *Melee Weapon Attack:* … ***Skull Club***. …" is
 * the Orc Warlord's whole melee — one body; lycanthropes write two form-locked attacks the same way).
 * Split at the `***Name***.` headings; the text before the first one takes the feature's own name. A
 * part without an action's words (the "As the orc." lead-in) is dropped; fewer than two with them is no
 * split at all. Every part is returned as an `action`, whatever the body claimed.
 */
export function splitAttackBodies(
  name: string,
  text: string
): Array<{ name: string; type: string; text: string }> | undefined {
  // A sub-heading is written "***Longsword***." or "***Hand Crossbow (Humanoid or Hybrid Form Only).***".
  const marks = [...text.matchAll(/\*\*\*([^*]+?)\.?\*\*\*\.?\s*/g)];
  if (marks.length === 0) return undefined;
  const segments: Array<{ name: string; text: string }> = [];
  const lead = text.slice(0, marks[0].index).trim();
  if (lead) segments.push({ name, text: lead });
  marks.forEach((mark, i) => {
    segments.push({
      name: mark[1].replace(/\.$/, "").trim(),
      text: text.slice(mark.index! + mark[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim(),
    });
  });
  const actsOn = (t: string) => /Weapon Attack:|saving throw|\bmakes\b[^.]{0,80}\battacks?\b/i.test(t);
  const acting = segments.filter((s) => actsOn(s.text));
  if (acting.length < 2) return undefined;
  return acting.map((s) => ({ ...s, type: "action" }));
}

/**
 * A Multiattack bound to the monster's own attacks: the fixed mix when the wording counts each attack
 * ("two Spiked Club attacks and one Shield Smash attack"), else `count` swings of the named alternative
 * with the highest average damage (ties to the first listed). Without a single named attack the monster
 * has, it is unsupported.
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
  // The written mix, kept when every counted attack resolves.
  if (parsed.picks) {
    const swings: WeaponAttackAction[] = [];
    for (const pick of parsed.picks) {
      const found = attacks.find((a) => nameKey(a.name) === nameKey(pick.name));
      if (!found) return { skip: "unsupported-feature" };
      for (let i = 0; i < pick.count; i++) swings.push(found);
    }
    return { kind: "multiattack", name, swings };
  }
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

/**
 * A lair's actions from its note's "Lair Actions" section: each "- **Collapse.** …" item an attack or a save
 * (one that only hinders, "or be knocked prone", deals nothing and hinders). Items the engine cannot play are
 * left out.
 */
export function parseLairActions(note: string): ModelledAction[] {
  const lines = note.split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{2,6}\s+Lair Actions\b/i.test(l));
  if (start < 0) return [];
  const level = lines[start].match(/^#+/)![0].length;
  const items: Array<{ name: string; text: string }> = [];
  for (let i = start + 1; i < lines.length; i++) {
    const heading = lines[i].match(/^(#+)\s/);
    if (heading && heading[1].length <= level) break;
    const item = lines[i].match(/^\s*[-*]\s+\*\*([^*]+?)\.?\*\*\.?\s*(.*)$/);
    if (item) items.push({ name: item[1].trim(), text: item[2] });
    else if (items.length && lines[i].trim() && !/^!\[\[/.test(lines[i]) && !heading)
      items[items.length - 1].text += ` ${lines[i].trim()}`;
  }
  const out: ModelledAction[] = [];
  for (const { name, text } of items) {
    const flat = plain(text);
    const own = attackFrom(name, flat) ?? saveFrom(name, flat) ?? hinderingSave(name, flat);
    if (own) out.push(own);
  }
  return out;
}

/** A save that deals nothing and hinders: "must succeed on a DC 15 DEX save or be knocked prone". */
function hinderingSave(name: string, text: string): SaveAction | null {
  const save = text.match(/DC\s*(\d+)\s+(\w+)\s+sav(?:e|ing throw)\b/i);
  const ability = save ? abilityKey(save[2]) : undefined;
  const inflicts = inflictOfSave(text);
  if (!save || !ability || !inflicts) return null;
  const reach = saveReach(text);
  return {
    kind: "save",
    name,
    dc: parseInt(save[1], 10),
    ability,
    damage: { expr: "0" },
    onSuccess: "none",
    area: /\b(?:each|all|every) creatures?\b/i.test(text),
    ...areaTargets(text),
    ...(reach ? { reach } : {}),
    circle: 0,
    inflicts,
  };
}

const DAMAGE_WORDS = [
  "acid",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "poison",
  "psychic",
  "radiant",
  "thunder",
];

/** A reaction as read from a statblock: a counterattack names its attack (`attackRef`), bound by the loader. */
export type ParsedReaction = Reaction & { attackRef?: string };

/**
 * A reaction besides an AC one, read from its words (Monster Vault and Game Master's Guide phrasing):
 * - "can counter the spell", "countering it": counterspell (of the "Nth circle or lower" it says, else 3rd);
 * - "can make one Battle Axe attack against the attacker": counter (`attackRef`: the attack, or none for "one
 *   melee or ranged attack");
 * - "halves the attack's damage": halve; "the attacker has disadvantage on the attack roll": disadvantage;
 * - "the attacker takes 5 (1d10) fire damage", "must succeed on a DC 13 DEX save or take …": retaliate.
 * A reaction that protects another creature, or moves, is left out.
 */
export function reactionFrom(name: string, text: string): ParsedReaction | undefined {
  const flat = text.replace(/[*_]+/g, "").replace(/\s+/g, " ");
  const limit = useLimitOf(name, flat);
  const trigger = flat.split(/(?<=\.)\s/)[0] ?? flat;
  const within = trigger.match(/\bwithin (\d+) (?:feet|ft)/i);
  const base = {
    name,
    ...(limit ? { limit } : {}),
    ...(within ? { within: parseInt(within[1], 10) } : {}),
    ...(/\bmelee attack\b/i.test(trigger) ? { meleeOnly: true } : {}),
  };
  if (/\bcounter(?:s|ing)? (?:the|that|it|its)\b|interrupting the casting/i.test(flat) && /\bspell\b/i.test(trigger)) {
    const upTo = flat.match(/(\d)(?:st|nd|rd|th) (?:circle|level) or lower/i);
    return { kind: "counterspell", ...base, upTo: upTo ? parseInt(upTo[1], 10) : 3 };
  }
  // Protecting an ally next to it: its AC against the attack, or disadvantage on it.
  if (
    /\b(?:friendly creature|an ally|another creature|creature within \d+ feet of (?:it|the \w+))\b/i.test(trigger) &&
    /\b(?:target of an attack|is hit|is attacked|targeted)\b/i.test(trigger)
  ) {
    const plus = flat.match(/\badds? (\d+) to (?:its|their|the (?:target|creature)[\u2019']s) AC\b/i);
    const around = trigger.match(/\bwithin (\d+) (?:feet|ft)/i);
    const near = { name, ...(limit ? { limit } : {}), within: around ? parseInt(around[1], 10) : 5 };
    if (plus) return { kind: "protect", ...near, ac: parseInt(plus[1], 10) };
    if (/\bdisadvantage on the attack\b/i.test(flat)) return { kind: "protect", ...near };
    return undefined;
  }
  if (/\bfriendly creature\b|\ban ally\b|\bwilling creature\b/i.test(flat)) return undefined;
  // Moving: away when missed, attacked or damaged (Nimble Dodge, Rescue Step), toward one that came near.
  const move = flat.match(
    /\b(?:move|moves) up to (half )?its speed|\bmove up to (\d+) feet|\bteleports?(?:,? along with [^,]+,)? (?:up to )?(\d+) feet|\bteleports?\b[^.]*?within (\d+) feet/i
  );
  if (move && !/\badd \d+ to its AC\b/i.test(flat) && !/\bward\b/i.test(trigger)) {
    const feet = move[2] ?? move[3] ?? move[4];
    const toward = /\btoward (?:the|that|a|one) (?:creature|hostile)/i.test(flat) && !/\baway\b/i.test(flat);
    // What sets it off is something done to it, or an enemy coming near; nothing else ("reduces a creature to 0 HP").
    const self = "(?:it|him|her|the [\\w\u2019'-]+(?: [\\w\u2019'-]+)?|[A-Z][\\w\u2019'-]+(?: [A-Z][\\w\u2019'-]+)?)";
    const trigger_ = new RegExp(`\\bmisses ${self}\\b`).test(trigger)
      ? "missed"
      : toward && /\b(?:moves?|enters?)\b[^.]*\bwithin\b|\bmoves\b/i.test(trigger)
        ? "approached"
        : new RegExp(`\\b${self} takes damage\\b|\\bdeals damage to ${self}\\b|\\bdamages ${self}\\b`).test(trigger)
          ? "damaged"
          : new RegExp(`\\bhits ${self}\\b|\\b${self} is hit\\b`).test(trigger)
            ? "hit"
            : new RegExp(`\\b(?:attacks|targets) ${self}\\b|\\b${self} is (?:attacked|targeted)\\b`).test(trigger)
              ? "attacked"
              : undefined;
    if (trigger_)
      return {
        kind: "move",
        ...base,
        trigger: trigger_,
        ...(feet ? { feet: parseInt(feet, 10) } : move[1] ? {} : {}),
        ...(toward ? { toward: true } : {}),
      };
  }
  const hitTrigger = /\b(?:hits?|is hit|attacks?|damages?|deals damage to|misses?)\b/i.test(trigger);
  if (!hitTrigger) return undefined;
  const counter = flat.match(
    /\bmakes? (?:one|a|an) (.+?) attack (?:roll )?against (?:the attacker|that creature|the creature|it\b)/i
  );
  if (counter) {
    const ref = counter[1].replace(/^(?:single|melee or ranged|melee|ranged|weapon)\s*/i, "").trim();
    return { kind: "counter", ...base, ...(ref && !/^(?:weapon|melee|ranged)$/i.test(ref) ? { attackRef: ref } : {}) };
  }
  // Halving every hit's damage; one that halves only some types ("takes acid, cold … damage") is left out.
  const typed = new RegExp(`\\b(?:${DAMAGE_WORDS.join("|")})\\b`, "i").test(trigger);
  if (
    !typed &&
    /\bhalves? the (?:attack[\u2019']s )?damage\b|\b(?:it|the \w+) takes only half (?:the )?damage\b/i.test(flat)
  )
    return { kind: "halve", ...base };
  if (
    /\b(?:attacker|creature) has disadvantage on (?:the|that) attack|imposes? disadvantage on the attack roll/i.test(
      flat
    )
  )
    return { kind: "disadvantage", ...base };
  const save = saveFrom(name, flat);
  if (save && !save.area)
    return {
      kind: "retaliate",
      ...base,
      damage: save.damage,
      save: { ability: save.ability, dc: save.dc },
      onSuccess: save.onSuccess,
      ...(save.inflicts ? { inflicts: save.inflicts } : {}),
    };
  const plainDamage = flat.match(
    /\b(?:attacker|creature|it) takes \d+ \((\d+d\d+(?:\s*[+\u2212-]\s*\d+)?)\) (\w+) damage/i
  );
  if (plainDamage)
    return {
      kind: "retaliate",
      ...base,
      damage: { expr: plainDamage[1].replace(/\s+/g, "").replace("\u2212", "-"), type: plainDamage[2].toLowerCase() },
    };
  const hinder = hinderingSave(name, flat);
  if (hinder && !hinder.area)
    return {
      kind: "retaliate",
      ...base,
      save: { ability: hinder.ability, dc: hinder.dc },
      onSuccess: "none",
      ...(hinder.inflicts ? { inflicts: hinder.inflicts } : {}),
    };
  return undefined;
}
