/**
 * A creature template as data: what a `rpg stat.template` block holds, and how
 * it is applied to a `stat.monster` block's data.
 *
 * - {@link templateBlockOf} turns a parsed template note (monster-template.ts)
 *   into a {@link TemplateBlock}: each Statistics line read into a change
 *   (`{ stat: hp, percent: -10 }`), or kept as a note for a person.
 * - {@link applyTemplateBlock} applies a block to a creature: its changes, its
 *   features as refs with their formulas worked out, and what is left by hand.
 * - {@link describeChange} words a change for the template sheet.
 *
 * Pure: no Obsidian and no I/O. The plugin's template sheet ("Try on"), the
 * CLI's `rpg sim homebrew --template` and `rpg sim templates --write` all use it.
 */

import {
  CONDITIONS,
  CREATURE_TYPES,
  DAMAGE_TYPES,
  evaluateFormula,
  plainText,
  templateFeatureId,
  type FormulaContext,
  type MonsterTemplate,
  type TemplateApplies,
  type TemplateChoice,
  type TemplateFeatureType,
} from "./monster-template";

export type DefenceKey = "resistant" | "immune" | "vulnerable";

/** One change a template makes to a creature's statistics. */
export type TemplateChange =
  | { stat: "type"; to: string }
  | { stat: "tag"; add?: string; remove?: string }
  | { stat: "hp"; percent?: number; flat?: number; upToCr?: number }
  | { stat: "ac"; plus?: number; natural?: number; dex?: boolean }
  | { stat: "cr"; plus: number; max?: number }
  | {
      stat: DefenceKey;
      damage?: string[];
      conditions?: string[];
      /** The damage the choice names, or the other one of its option. */
      choice?: "chosen" | "other";
      /** A vulnerability that takes the place of a resistance or immunity to the same damage. */
      replaces?: boolean;
    }
  | { stat: "senses"; add?: string; range?: number; rename?: { from: string; to: string }; atLeast?: boolean }
  | {
      stat: "languages";
      /** "understands what it knew but can't speak". */
      mute?: boolean;
      set?: string;
      knows?: string;
      telepathy?: number;
      /** Telepathy only when it understands a language. */
      ifSpeaks?: boolean;
    }
  | { stat: "abilities"; atLeast?: Record<string, number>; atMost?: Record<string, number> }
  | { stat: "speed"; delta: number; only?: string; floor?: number; ifChoice?: string }
  | { stat: "stealth" | "perception"; plusPb: true }
  | { stat: "note"; label: string; text: string };

/** A feature the template gives, as a ref into the template features note. */
export interface TemplateBlockFeature {
  /** The id in the features note ("Zombie: Undead Fortitude"). */
  id: string;
  name: string;
  type: TemplateFeatureType;
  /** The book's words for each of its numbers (`f1`…). */
  formulas?: Record<string, string>;
  optional?: boolean;
  choice?: string;
  /** Its text, the creature named `{{ self.name() }}` (not written in the block: the features note has it). */
  text?: string;
  /** A "… Resilience" trait is named on the defence line it grants, as the book's statblocks do. */
  defence?: "immune" | "resistant";
}

export interface TemplateBlock {
  name: string;
  appliesText: string;
  applies: TemplateApplies;
  choose?: TemplateChoice[];
  chooseText?: string;
  changes: TemplateChange[];
  features: TemplateBlockFeature[];
  /** Features of the creature it changes ("Bite: if the dragon dealt…"). */
  alters?: Array<{ name: string; text: string }>;
  /** Rules of play that are not features. */
  rules?: string[];
  /** What the creature loses (the introduction's words). */
  loses?: string;
  /** The features note the refs point to (a link path, without `.md`). */
  featureNote: string;
}

/** A defence line ("fire, cold | charmed | Undead Resilience") in its three parts. */
export interface Defences {
  damage: string[];
  conditions: string[];
  other: string[];
}

/** The proficiency bonus of a CR. */
export function pbOfCr(cr: number): number {
  return cr < 5 ? 2 : cr < 9 ? 3 : cr < 13 ? 4 : cr < 17 ? 5 : cr < 21 ? 6 : cr < 25 ? 7 : cr < 29 ? 8 : 9;
}

export function parseDefences(line: unknown): Defences {
  const out: Defences = { damage: [], conditions: [], other: [] };
  const text = String(line ?? "").trim();
  if (!text || text === "—" || text === "-") return out;
  for (const part of text.split("|")) {
    for (const raw of part.split(/,\s*(?![^()]*\))/)) {
      const item = raw.trim().replace(/^and\s+/, "");
      if (!item) continue;
      const low = item.toLowerCase();
      if ((DAMAGE_TYPES as readonly string[]).includes(low) || /damage from nonmagical/.test(low)) out.damage.push(low);
      else if ((CONDITIONS as readonly string[]).includes(low)) out.conditions.push(low);
      else out.other.push(item);
    }
  }
  return out;
}

export function formatDefences(d: Defences): string {
  const parts = [d.damage, d.conditions, d.other].filter((p) => p.length).map((p) => [...new Set(p)].join(", "));
  return parts.join(" | ");
}

/** Damage types and conditions a clause names ("cold, fire, and lightning damage and the charmed condition"). */
function defenceWords(clause: string): Defences {
  const low = clause.toLowerCase();
  const out: Defences = { damage: [], conditions: [], other: [] };
  const nonmagical = low.match(/((?:(?:bludgeoning|piercing|slashing),? (?:and )?)+damage from nonmagical attacks)/);
  if (nonmagical) out.damage.push(nonmagical[1].replace(/,? and /g, ", "));
  const rest = nonmagical ? low.replace(nonmagical[1], "") : low;
  for (const d of DAMAGE_TYPES) if (new RegExp(`\\b${d}\\b`).test(rest)) out.damage.push(d);
  for (const c of CONDITIONS) if (new RegExp(`\\b${c}\\b`).test(rest)) out.conditions.push(c);
  return out;
}

/** The creature's type line with its type changed: "Large [[Beast]]" → "Large [[Undead]]". */
export function withType(line: string, type: string): string {
  const re = new RegExp(`(\\[\\[)?\\b(${CREATURE_TYPES.join("|")})\\b(\\]\\])?`, "i");
  if (!re.test(line)) return `${line} ${type}`.trim();
  return line.replace(re, (_, open?: string, _t?: string, close?: string) => (open && close ? `[[${type}]]` : type));
}

/** A tag added to (or taken from) the type line's parentheses. */
export function withTag(line: string, tag: string, remove = false): string {
  const m = line.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const tags = m
    ? m[2]
        .split(/,\s*/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const bare = (t: string) => t.replace(/^\[\[|\]\]$/g, "").toLowerCase();
  const kept = remove ? tags.filter((t) => bare(t) !== tag.toLowerCase()) : tags;
  if (!remove && !kept.some((t) => bare(t) === tag.toLowerCase())) kept.push(tag);
  const head = m ? m[1] : line;
  return kept.length ? `${head} (${kept.join(", ")})` : head;
}

/** Speeds moved: every one by `delta`, or only `only` ("fly"); never under `floor`. */
export function withSpeeds(line: string, delta: number, only?: string, floor = 10): string {
  return line.replace(/(\b[a-z]+ )?(\d+) ft\./gi, (all, mode: string | undefined, n: string) => {
    const kind = (mode ?? "").trim().toLowerCase();
    if (only && kind !== only) return all;
    const v = Number(n);
    if (v === 0) return all;
    const next = delta < 0 ? Math.max(Math.min(v, floor), v + delta) : v + delta;
    return `${mode ?? ""}${next} ft.`;
  });
}

// ---------------------------------------------------------------------------
// Prose → changes

/** The changes one Statistics line makes; a line it cannot read is a note. */
export function changesOfLine(label: string, rawText: string): TemplateChange[] {
  const lab = plainText(label).toLowerCase();
  const text = plainText(rawText);
  const low = text.toLowerCase();
  const out: TemplateChange[] = [];
  const note = (): TemplateChange[] => [{ stat: "note", label, text }];

  if (/type/.test(lab)) {
    const to = text.match(/type changes to ([A-Z][a-z]+)/);
    if (to) out.push({ stat: "type", to: to[1] });
    for (const tag of text.matchAll(/gains the ([A-Z][a-z]+) tag/g)) out.push({ stat: "tag", add: tag[1] });
    if (/\bsize\b/.test(lab)) out.push({ stat: "note", label: "Size", text });
    return out.length ? out : note();
  }
  if (lab === "tag") {
    for (const tag of text.matchAll(/gains the ([A-Z][a-z]+) tag/g)) out.push({ stat: "tag", add: tag[1] });
    const lose = text.match(/If it has the ([A-Z][a-z]+) tag, it loses that tag/);
    if (lose) out.push({ stat: "tag", remove: lose[1] });
    if (/home plane/.test(low)) out.push({ stat: "note", label, text });
    return out.length ? out : note();
  }
  if (lab === "hit points") {
    const cap = low.match(/if the creature's cr is (\d+) or lower/);
    const pct = low.match(/(reduced|increased) by (\d+) percent/);
    const flat = low.match(/increased by (\d+)(?! percent)\b/);
    if (pct)
      return [
        {
          stat: "hp",
          percent: (pct[1] === "reduced" ? -1 : 1) * Number(pct[2]),
          ...(cap ? { upToCr: Number(cap[1]) } : {}),
        },
      ];
    if (flat) return [{ stat: "hp", flat: Number(flat[1]) }];
    return note();
  }
  if (lab === "armor class") {
    const plus = low.match(/increases by (\d+)/);
    const nat = low.match(/natural armor class of (\d+) \+ dex modifier/);
    if (plus) return [{ stat: "ac", plus: Number(plus[1]) }];
    if (nat) return [{ stat: "ac", natural: Number(nat[1]) }];
    if (/dex reduces/.test(low)) return [{ stat: "ac", dex: true }];
    return note();
  }
  if (lab === "cr") {
    const m = low.match(/increases by (\d+)(?:, up to cr (\d+))?/);
    return m ? [{ stat: "cr", plus: Number(m[1]), ...(m[2] ? { max: Number(m[2]) } : {}) }] : note();
  }
  if (/resist|immune|vulnerab/.test(lab)) {
    let unread = false;
    for (const clause of text.split(/,? and it is |\. In addition, it is |\.\s+/)) {
      const m = clause.match(/\b(resistant|immune|vulnerable) to (.*)$/i);
      if (!m) continue;
      const key = m[1].toLowerCase() as DefenceKey;
      if (/you didn't choose/.test(m[2])) out.push({ stat: key, choice: "other" });
      else if (/you chose|associated with/.test(m[2])) {
        const conditions = defenceWords(m[2]).conditions;
        out.push({ stat: key, choice: "chosen", ...(conditions.length ? { conditions } : {}) });
      } else {
        const w = defenceWords(m[2]);
        if (!w.damage.length && !w.conditions.length) {
          unread = true;
          continue;
        }
        out.push({
          stat: key,
          ...(w.damage.length ? { damage: w.damage } : {}),
          ...(w.conditions.length ? { conditions: w.conditions } : {}),
          ...(key === "vulnerable" && /replaces that with this vulnerability/.test(low) ? { replaces: true } : {}),
        });
      }
    }
    return out.length && !unread ? out : [...out, ...note()];
  }
  if (lab === "senses") {
    const dark = low.match(
      /has (darkvision|tremorsense|blindsight|truesight|keensense) (?:out )?to (?:a range of )?(\d+) feet/
    );
    if (dark) out.push({ stat: "senses", add: dark[1], range: Number(dark[2]) });
    if (/darkvision changes to truesight/.test(low))
      out.push({ stat: "senses", rename: { from: "darkvision", to: "truesight" } });
    for (const r of low.matchAll(
      /(darkvision|keensense|truesight|tremorsense|blindsight) range increases to (\d+) feet/g
    ))
      out.push({ stat: "senses", add: r[1], range: Number(r[2]), atLeast: true });
    return out.length ? out : note();
  }
  if (lab === "languages") {
    if (/learns one language|chosen humanoid|choose one/.test(low)) return note();
    if (/understands (?:all )?(?:the )?languages it knew in life/.test(low) && /can't speak/.test(low))
      out.push({ stat: "languages", mute: true });
    else if (/understands the languages of its creator but can't speak/.test(low))
      out.push({ stat: "languages", set: "understands the languages of its creator but can't speak" });
    else {
      const knows = text.match(/knows ([A-Z][\w ]+?), but it can't speak the language unless/);
      if (knows) out.push({ stat: "languages", knows: knows[1] });
    }
    const tele = low.match(/telepathy to a range of (\d+) feet/);
    if (tele)
      out.push({ stat: "languages", telepathy: Number(tele[1]), ...(/^if /.test(low) ? { ifSpeaks: true } : {}) });
    if (/understands sylvan|understands [a-z]+ but can't speak/.test(low) && !out.length) {
      const m = text.match(/understands ([A-Z]\w+) but can't speak/);
      if (m) out.push({ stat: "languages", set: `understands ${m[1]} but can't speak` });
    }
    return out.length ? out : note();
  }
  if (lab === "abilities") {
    const head = text.split(/\.\s+If /)[0];
    const atLeast = /already higher|is higher than/.test(low);
    const atMost = /already lower/.test(low);
    if (atLeast === atMost || /chosen humanoid/.test(low)) return note();
    const values: Record<string, number> = {};
    for (const m of head.matchAll(/\b(STR|DEX|CON|INT|WIS|CHA) (?:to )?([+-]\d+)/g))
      values[m[1].toLowerCase()] = Number(m[2]);
    const single = head.match(/existing (STR|DEX|CON|INT|WIS|CHA) modifier with ([+-]\d+)/);
    if (single) values[single[1].toLowerCase()] = Number(single[2]);
    if (!Object.keys(values).length) return note();
    return [{ stat: "abilities", ...(atLeast ? { atLeast: values } : { atMost: values }) }];
  }
  if (lab === "speed") {
    const cond = low.match(/^if the [a-z' -]+?'s season is (\w+), increase all its movement speeds by (\d+) feet/);
    const all = low.match(/all (?:the [a-z' -]+?'s |its )?movement speeds (increase|are reduced) by (\d+) feet/);
    const fly = low.match(/if the creature has a flying speed, that speed increases by (\d+) feet/);
    if (cond) return [{ stat: "speed", delta: Number(cond[2]), ifChoice: cond[1] }];
    if (all) {
      const floor = low.match(/never reduces a movement speed below (\d+)/);
      return [
        {
          stat: "speed",
          delta: (all[1] === "increase" ? 1 : -1) * Number(all[2]),
          ...(floor ? { floor: Number(floor[1]) } : {}),
        },
      ];
    }
    if (fly) return [{ stat: "speed", delta: Number(fly[1]), only: "fly" }];
    return note();
  }
  if ((lab === "stealth" || lab === "perception") && /increases by an amount equal to its pb/.test(low)) {
    return [{ stat: lab, plusPb: true }];
  }
  return note();
}

/** A parsed template note as the data a `stat.template` block holds. */
export function templateBlockOf(template: MonsterTemplate, featureNote: string): TemplateBlock {
  const changes = template.stats.flatMap((s) => changesOfLine(s.label, s.text));
  const given = template.features.filter((f) => !f.alters);
  return {
    name: template.name,
    appliesText: template.appliesText,
    applies: template.appliesTo,
    ...(template.choices.length ? { choose: template.choices } : {}),
    ...(template.choiceText ? { chooseText: template.choiceText } : {}),
    changes,
    features: given.map((f) => ({
      id: templateFeatureId(template.name, f),
      name: f.key,
      type: f.type,
      ...(Object.keys(f.formulas).length ? { formulas: f.formulas } : {}),
      ...(f.optional ? { optional: true } : {}),
      ...(f.choice ? { choice: f.choice } : {}),
      ...(/resilience$/i.test(f.key) ? { defence: /\bis immune\b/i.test(f.text) ? "immune" : "resistant" } : {}),
      text: f.text,
    })),
    ...(template.features.some((f) => f.alters)
      ? { alters: template.features.filter((f) => f.alters).map((f) => ({ name: f.key, text: f.text })) }
      : {}),
    ...(template.rules.length ? { rules: template.rules } : {}),
    ...(template.losesText ? { loses: template.losesText } : {}),
    featureNote,
  };
}

/** A block's YAML read back (fields it does not know are ignored). */
export function parseTemplateBlock(raw: Record<string, unknown>): TemplateBlock {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const applies = (raw.applies as TemplateApplies | undefined) ?? { types: [], other: [] };
  return {
    name: String(raw.name ?? ""),
    appliesText: String(raw.appliesText ?? ""),
    applies: { ...applies, types: arr<string>(applies.types), other: arr<string>(applies.other) },
    ...(Array.isArray(raw.choose) ? { choose: raw.choose as TemplateChoice[] } : {}),
    ...(typeof raw.chooseText === "string" ? { chooseText: raw.chooseText } : {}),
    changes: arr<TemplateChange>(raw.changes).filter((c) => c && typeof c === "object" && "stat" in c),
    features: arr<TemplateBlockFeature>(raw.features).filter((f) => f && typeof f.id === "string"),
    ...(Array.isArray(raw.alters) ? { alters: raw.alters as Array<{ name: string; text: string }> } : {}),
    ...(Array.isArray(raw.rules) ? { rules: (raw.rules as unknown[]).map(String) } : {}),
    ...(typeof raw.loses === "string" ? { loses: raw.loses } : {}),
    featureNote: String(raw.featureNote ?? ""),
  };
}

/** The block as it is written in a note: the features without their text (the features note has it). */
export function templateBlockData(block: TemplateBlock): Record<string, unknown> {
  return {
    ...block,
    features: block.features.map((f) => {
      const rest = { ...f };
      delete rest.text;
      return rest;
    }),
  };
}

// ---------------------------------------------------------------------------
// Changes in words (the template sheet)

export interface ChangeWords {
  label: string;
  text: string;
  /** Up: the creature gains; down: it loses; same: neither (a new type). */
  tone: "up" | "down" | "same";
  note?: string;
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`.replace("-", "−"));

/** A change as the template sheet shows it. */
export function describeChange(c: TemplateChange): ChangeWords {
  switch (c.stat) {
    case "type":
      return { label: "Type", text: `becomes ${c.to}`, tone: "same" };
    case "tag":
      return c.add
        ? { label: "Tag", text: `+ ${c.add}`, tone: "same" }
        : { label: "Tag", text: `loses ${c.remove}`, tone: "same" };
    case "hp":
      return c.percent !== undefined
        ? {
            label: "Hit Points",
            text: `${sign(c.percent)}%`,
            tone: c.percent < 0 ? "down" : "up",
            note: c.upToCr !== undefined ? `rounded up; only up to CR ${c.upToCr}` : "rounded up",
          }
        : { label: "Hit Points", text: `+${c.flat}`, tone: "up" };
    case "ac":
      return c.plus !== undefined
        ? { label: "Armor Class", text: `+${c.plus}`, tone: "up" }
        : c.natural !== undefined
          ? { label: "Armor Class", text: `${c.natural} + DEX`, tone: "up", note: "natural armor, if higher" }
          : { label: "Armor Class", text: "falls with DEX", tone: "down" };
    case "cr":
      return { label: "Challenge", text: `+${c.plus}`, tone: "up", ...(c.max ? { note: `up to CR ${c.max}` } : {}) };
    case "resistant":
    case "immune":
    case "vulnerable": {
      const label = c.stat === "resistant" ? "Resistant" : c.stat === "immune" ? "Immune" : "Vulnerable";
      const what =
        c.choice === "chosen"
          ? ["the damage you choose", ...(c.conditions ?? [])]
          : c.choice === "other"
            ? ["the other damage of your choice"]
            : [...(c.damage ?? []), ...(c.conditions ?? [])];
      return {
        label,
        text: `+ ${what.join(", ")}`,
        tone: c.stat === "vulnerable" ? "down" : "up",
        ...(c.replaces ? { note: "replaces a resistance or immunity to it" } : {}),
      };
    }
    case "senses":
      if (c.rename) return { label: "Senses", text: `${c.rename.from} → ${c.rename.to}`, tone: "up" };
      return {
        label: "Senses",
        text: `${c.add} ${c.range} ft.`,
        tone: "up",
        note: c.atLeast ? "at least" : "if it has none",
      };
    case "languages":
      if (c.mute) return { label: "Languages", text: "understands what it knew, can't speak", tone: "down" };
      if (c.set) return { label: "Languages", text: c.set, tone: "same" };
      if (c.knows) return { label: "Languages", text: `understands ${c.knows}`, tone: "up" };
      return {
        label: "Languages",
        text: `telepathy ${c.telepathy} ft.`,
        tone: "up",
        ...(c.ifSpeaks ? { note: "if it understands a language" } : {}),
      };
    case "abilities": {
      const map = c.atLeast ?? c.atMost ?? {};
      const op = c.atLeast ? "≥" : "≤";
      return {
        label: "Abilities",
        text: Object.entries(map)
          .map(([k, v]) => `${k.toUpperCase()} ${op} ${sign(v)}`)
          .join(", "),
        tone: c.atLeast ? "up" : "down",
      };
    }
    case "speed":
      return {
        label: "Speed",
        text: `${c.only ? `${c.only} ` : "each "}${sign(c.delta)} ft.`,
        tone: c.delta < 0 ? "down" : "up",
        ...(c.floor ? { note: `never below ${c.floor}` } : c.ifChoice ? { note: `if ${c.ifChoice}` } : {}),
      };
    case "stealth":
    case "perception":
      return { label: c.stat === "stealth" ? "Stealth" : "Perception", text: "+ PB", tone: "up" };
    case "note":
      return { label: c.label, text: c.text, tone: "same", note: "by hand" };
  }
}

// ---------------------------------------------------------------------------
// Applying a block

export interface ApplyTemplateOptions {
  /** The option chosen ("fire", "summer", "air:thunder", a damage type). */
  choice?: string;
  /** Features to choose (the list ones: "Stench", "Spider Climb"). */
  picks?: string[];
  /** The creature's own feature names and texts (for DCs, and what it may lose). */
  baseFeatures: Array<{ name: string; text: string }>;
  /** Its CR as a number. */
  cr: number;
}

export interface ApplyTemplateResult {
  data: Record<string, unknown>;
  /** What was changed, in words. */
  applied: string[];
  /** What is left to a person. */
  manual: string[];
  /** The features added. */
  added: string[];
  /** The option it was made with. */
  choice?: { key: string; damage: string };
  /** The stats whose values changed (for marking them on a sheet). */
  changed: string[];
}

type Abilities = Record<string, number>;

export function pickChoice(
  choices: TemplateChoice[] | undefined,
  choice?: string
): { key: string; damage: string; option: TemplateChoice } | undefined {
  if (!choice || !choices?.length) return undefined;
  const [a, b] = choice
    .toLowerCase()
    .split(":")
    .map((s) => s.trim());
  const byKey = choices.find((c) => c.key === a || c.key.startsWith(a));
  if (byKey) {
    const damage = b && byKey.damage.includes(b) ? b : byKey.damage[0];
    return { key: byKey.key, damage, option: byKey };
  }
  const byDamage = choices.find((c) => c.damage.includes(a));
  return byDamage ? { key: byDamage.key, damage: a, option: byDamage } : undefined;
}

export function applyTemplateBlock(
  input: Record<string, unknown>,
  block: TemplateBlock,
  options: ApplyTemplateOptions
): ApplyTemplateResult {
  const data: Record<string, unknown> = { ...input };
  const stats: Record<string, unknown> = { ...((input.stats as Record<string, unknown>) ?? {}) };
  const abilities: Abilities = { ...((input.abilities as Abilities) ?? {}) };
  const applied: string[] = [];
  const manual: string[] = [];
  const added: string[] = [];
  let type = String(data.type ?? "");
  let cr = options.cr;
  const chosen = pickChoice(block.choose, options.choice);
  if (block.choose?.length && !chosen) {
    manual.push(
      `Choose with --choose: ${block.choose.map((c) => `${c.key} (${c.damage.join(" or ")})`).join(", ")}${options.choice ? ` ("${options.choice}" is none of them)` : ""}.`
    );
  } else if (block.chooseText && !block.choose?.length) {
    manual.push(block.chooseText);
  }

  const defence = (key: DefenceKey) => parseDefences(stats[key]);
  const setDefence = (key: DefenceKey, d: Defences) => {
    const text = formatDefences(d);
    if (text) stats[key] = text;
    else delete stats[key];
  };
  const addDefence = (key: DefenceKey, words: Defences) => {
    const d = defence(key);
    d.damage.push(...words.damage);
    d.conditions.push(...words.conditions);
    d.other.push(...words.other);
    setDefence(key, d);
  };
  const dexBefore = abilities.dex ?? 0;
  let acFromDex = false;
  let naturalAc: number | undefined;
  const byHand = (label: string, text: string) => manual.push(`${label}: ${text}`);

  for (const c of block.changes) {
    switch (c.stat) {
      case "type":
        type = withType(type, c.to);
        applied.push(`type: ${c.to}`);
        break;
      case "tag":
        if (c.add) {
          type = withTag(type, c.add);
          applied.push(`tag: ${c.add}`);
        }
        if (c.remove) type = withTag(type, c.remove, true);
        break;
      case "hp": {
        const hp = parseInt(String(stats.hp ?? ""), 10);
        if (!Number.isFinite(hp)) {
          byHand("Hit Points", describeChange(c).text);
        } else if (c.upToCr !== undefined && cr > c.upToCr) {
          applied.push(`HP unchanged (CR above ${c.upToCr})`);
        } else if (c.percent !== undefined) {
          const change = Math.ceil((hp * Math.abs(c.percent)) / 100);
          const next = c.percent < 0 ? Math.max(1, hp - change) : hp + change;
          stats.hp = String(next);
          applied.push(`HP ${hp} → ${next} (${c.percent < 0 ? "reduced" : "increased"} by ${Math.abs(c.percent)}%)`);
        } else if (c.flat !== undefined) {
          stats.hp = String(hp + c.flat);
          applied.push(`HP ${hp} → ${hp + c.flat}`);
        }
        break;
      }
      case "ac":
        if (c.plus !== undefined) {
          stats.ac = withLeadingNumber(stats.ac, (n) => n + (c.plus ?? 0));
          applied.push(`AC +${c.plus}`);
        } else if (c.natural !== undefined) naturalAc = c.natural;
        else if (c.dex) acFromDex = true;
        break;
      case "cr":
        cr = Math.min(c.max ?? 30, cr + c.plus);
        data.cr = String(cr);
        applied.push(`CR ${options.cr} → ${cr}`);
        break;
      case "resistant":
      case "immune":
      case "vulnerable": {
        let words: Defences;
        if (c.choice) {
          if (!chosen) {
            byHand(describeChange(c).label, describeChange(c).text);
            break;
          }
          words = {
            damage: c.choice === "chosen" ? [chosen.damage] : chosen.option.damage.filter((d) => d !== chosen.damage),
            conditions: c.conditions ?? [],
            other: [],
          };
        } else words = { damage: c.damage ?? [], conditions: c.conditions ?? [], other: [] };
        addDefence(c.stat, words);
        applied.push(`${c.stat}: ${formatDefences(words)}`);
        if (c.replaces) {
          for (const k of ["resistant", "immune"] as const) {
            const d = defence(k);
            d.damage = d.damage.filter((x) => !words.damage.includes(x));
            setDefence(k, d);
          }
        }
        break;
      }
      case "senses": {
        let senses = String(stats.senses ?? "").trim();
        if (senses === "—" || senses === "-") senses = "";
        if (c.rename) {
          senses = senses.replace(new RegExp(c.rename.from), c.rename.to);
          applied.push(`${c.rename.from} → ${c.rename.to}`);
        } else if (c.add && c.range !== undefined) {
          const re = new RegExp(`${c.add} (\\d+) ft\\.`);
          const had = senses.match(re);
          if (had && c.atLeast) senses = senses.replace(re, `${c.add} ${Math.max(Number(had[1]), c.range)} ft.`);
          else if (!had) {
            senses = c.atLeast
              ? [senses, `${c.add} ${c.range} ft.`].filter(Boolean).join(", ")
              : [`${c.add} ${c.range} ft.`, senses].filter(Boolean).join(", ");
            applied.push(`${c.add} ${c.range} ft.`);
          }
        }
        stats.senses = senses || "—";
        break;
      }
      case "languages": {
        const had = String(stats.languages ?? "").trim();
        const none = !had || had === "—" || had === "-";
        if (c.mute)
          stats.languages = none ? "—" : /can['’]t speak/i.test(had) ? had : `understands ${had} but can't speak`;
        else if (c.set) stats.languages = c.set;
        else if (c.knows) stats.languages = none ? `understands ${c.knows} but can't speak` : `${had}, ${c.knows}`;
        else if (c.telepathy !== undefined && !(c.ifSpeaks && none)) {
          stats.languages = [String(stats.languages ?? ""), `telepathy ${c.telepathy} ft.`]
            .filter((s) => s && s !== "—")
            .join(", ");
        }
        applied.push(`languages: ${String(stats.languages)}`);
        break;
      }
      case "abilities": {
        const atLeast = !!c.atLeast;
        for (const [k, v] of Object.entries(c.atLeast ?? c.atMost ?? {})) {
          const was = abilities[k] ?? 0;
          abilities[k] = atLeast ? Math.max(was, v) : Math.min(was, v);
          if (abilities[k] !== was) applied.push(`${k.toUpperCase()} ${fmt(was)} → ${fmt(abilities[k])}`);
        }
        break;
      }
      case "speed": {
        if (c.ifChoice) {
          if (!chosen) break;
          if (chosen.key !== c.ifChoice) break;
        }
        const speed = String(stats.speed ?? "");
        stats.speed = withSpeeds(speed, c.delta, c.only, c.floor ?? 10);
        if (stats.speed !== speed) applied.push(`${c.only ?? "speeds"} ${c.delta > 0 ? "+" : ""}${c.delta} ft.`);
        break;
      }
      case "stealth":
      case "perception": {
        const key = c.stat === "stealth" ? "pas_stealth" : "pas_perception";
        const n = Number(stats[key]);
        if (Number.isFinite(n) && stats[key] !== undefined) {
          stats[key] = n + pbOfCr(cr);
          applied.push(`${c.stat} ${n} → ${n + pbOfCr(cr)}`);
        } else byHand(c.stat, "+ PB");
        break;
      }
      case "note":
        byHand(c.label, c.text);
        break;
    }
  }

  // Perception and Stealth follow WIS and DEX.
  const wisBefore = Number((input.abilities as Abilities | undefined)?.wis ?? 0);
  for (const [key, delta] of [
    ["pas_perception", (abilities.wis ?? 0) - wisBefore],
    ["pas_stealth", (abilities.dex ?? 0) - dexBefore],
  ] as const) {
    const n = Number(stats[key]);
    if (delta !== 0 && Number.isFinite(n) && stats[key] !== undefined) stats[key] = n + delta;
  }

  // AC follows the abilities: a lower DEX lowers it; a natural armor floor raises it.
  const dexNow = abilities.dex ?? 0;
  if (acFromDex && dexNow !== dexBefore) {
    stats.ac = withLeadingNumber(stats.ac, (n) => n + (dexNow - dexBefore));
    applied.push(`AC ${fmt(dexNow - dexBefore)} (DEX)`);
  }
  if (naturalAc !== undefined) {
    const floor = naturalAc + dexNow;
    const ac = parseInt(String(stats.ac ?? ""), 10);
    if (!Number.isFinite(ac) || ac < floor) {
      stats.ac = `${floor} (natural armor)`;
      applied.push(`AC ${floor} (natural armor)`);
    }
  }

  // Features: refs to the features note, with their numbers for this creature.
  const picks = (options.picks ?? []).map((p) => p.toLowerCase());
  const dcs = options.baseFeatures.flatMap((f) => [...f.text.matchAll(/\bDC (\d+)/g)].map((m) => Number(m[1])));
  const ctx: FormulaContext = {
    cr,
    pb: pbOfCr(cr),
    hp: parseInt(String(stats.hp ?? ""), 10) || 0,
    abilities,
    dcs,
    dcOf: (word) => {
      const f = options.baseFeatures.find((x) => new RegExp(word, "i").test(x.name));
      const m = f?.text.match(/\bDC (\d+)/);
      return m ? Number(m[1]) : undefined;
    },
    perception: Number.isFinite(Number(stats.pas_perception)) ? Number(stats.pas_perception) : undefined,
  };
  const optional = block.features.filter((f) => f.optional);
  for (const p of picks) {
    if (!optional.some((f) => f.name.toLowerCase() === p))
      manual.push(
        `No feature "${p}" to choose${optional.length ? ` (${optional.map((f) => f.name).join(", ")})` : ""}.`
      );
  }
  const refs: Array<Record<string, unknown>> = [];
  const baseNames = new Set(options.baseFeatures.map((f) => f.name.toLowerCase()));
  for (const f of block.features) {
    if (f.optional && !picks.includes(f.name.toLowerCase())) continue;
    if (f.choice && (!chosen || chosen.key !== f.choice)) continue;
    if (baseNames.has(f.name.toLowerCase())) {
      applied.push(`${f.name}: it has it already`);
      continue;
    }
    const params: Record<string, unknown> = {};
    for (const [k, formula] of Object.entries(f.formulas ?? {})) {
      const v = evaluateFormula(formula, ctx);
      if (v !== undefined) params[k] = v;
      else manual.push(`${f.name}: fill in "${formula}" (the ref's ${k}).`);
    }
    refs.push({ ref: `@[[${block.featureNote}]]#${f.id}`, ...params });
    added.push(f.name);
    // A Resilience trait is named on the defence line it grants, as the book's statblocks do.
    if (f.defence) addDefence(f.defence, { damage: [], conditions: [], other: [f.name] });
  }
  if (optional.length && picks.length === 0) {
    manual.push(`Choose features with --trait: ${optional.map((f) => f.name).join(", ")}.`);
  }
  for (const a of block.alters ?? []) {
    manual.push(`${a.name} (changes a feature it has): ${a.text.replace(/\{\{ self\.name\(\) \}\}/g, "creature")}`);
  }
  // The rules that only say which choice gives which feature are carried out when a choice is made.
  const gated = block.features.filter((f) => f.choice).map((f) => f.name);
  for (const rule of block.rules ?? []) {
    if (chosen && gated.some((k) => rule.includes(k))) continue;
    manual.push(rule);
  }

  // What it may lose (the book's "loses all traits and actions that assume it has a living body…").
  const loses = (block.loses ?? "").toLowerCase();
  const lose = options.baseFeatures
    .map((f) => f.name)
    .filter(
      (n) =>
        (/living body/.test(loses) && /^amphibious\b/i.test(n)) ||
        (/fleshy body/.test(loses) && /^heightened\b/i.test(n)) ||
        (/complex knowledge|spellcasting/.test(loses) && /spellcasting/i.test(n)) ||
        (/change its shape|shape/.test(loses) && /^(change shape|shapechanger)\b/i.test(n)) ||
        (/breath weapons? it has|loses any breath/.test(loses) && /breath/i.test(n)) ||
        (/related to its breath/.test(loses) && /\b(scales|chill|breath)\b/i.test(n) && !/^.*breath \(/i.test(n)) ||
        (/shed light/.test(loses) && /illumination|light/i.test(n))
    );
  if (lose.length) manual.push(`It loses ${[...new Set(lose)].join(", ")} (${block.loses}): remove them by hand.`);

  const before = (input.stats as Record<string, unknown>) ?? {};
  const changed = [
    ...Object.keys({ ...before, ...stats }).filter((k) => String(before[k] ?? "") !== String(stats[k] ?? "")),
    ...(type !== String(input.type ?? "") ? ["type"] : []),
    ...Object.keys(abilities)
      .filter((k) => abilities[k] !== ((input.abilities as Abilities | undefined)?.[k] ?? 0))
      .map((k) => `abilities.${k}`),
  ];
  data.type = type;
  data.stats = Object.fromEntries(Object.entries(stats).sort(([a], [b]) => statOrder(a) - statOrder(b)));
  data.abilities = abilities;
  data.features = [...((input.features as unknown[]) ?? []), ...refs];
  return {
    data,
    applied,
    manual,
    added,
    changed,
    ...(chosen ? { choice: { key: chosen.key, damage: chosen.damage } } : {}),
  };
}

const STAT_ORDER = [
  "ac",
  "hp",
  "speed",
  "pas_perception",
  "pas_stealth",
  "vulnerable",
  "resistant",
  "immune",
  "senses",
  "languages",
];
const statOrder = (k: string) => (STAT_ORDER.includes(k) ? STAT_ORDER.indexOf(k) : STAT_ORDER.length);

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function withLeadingNumber(line: unknown, f: (n: number) => number): string {
  const text = String(line ?? "");
  const m = text.match(/^\s*(\d+)/);
  return m ? text.replace(/^\s*\d+/, String(f(Number(m[1])))) : text;
}
