/**
 * Creature templates (Game Master's Guide "Homebrewer's Toolbox", Monster Vault 2):
 * a template note read into what it changes. A template note has an introduction
 * ("This template can be applied to any Beast…") and sections, as `rpg rule.tab`
 * tabs or headings: Statistics (`**Hit Points.** … reduced by 13 percent`), and
 * Traits, Actions, Bonus Actions, Reactions and Legendary Actions, whose
 * `***Name.***` paragraphs are the features it gives (a `- **Name.**` list item is
 * one to choose). Book formulas in a feature (`DC # [10 + the creature's CON
 * modifier …]`) become parameters, worked out for each creature by
 * {@link evaluateFormula}. Pure: no Obsidian and no I/O.
 */

export type TemplateFeatureType = "trait" | "action" | "bonus" | "reaction" | "legendary";

export interface TemplateFeature {
  /** The name as the book writes it, a formula in it as `{{fN}}`. */
  name: string;
  /** The name without its formulas, for the feature's id ("Overdrive"). */
  key: string;
  type: TemplateFeatureType;
  /** The text, the template's own noun as `{{ self.name() }}`, formulas as `{{fN}}`. */
  text: string;
  /** Each `fN` and the book's words for it. */
  formulas: Record<string, string>;
  /** A list item: one of several to choose from. */
  optional?: boolean;
  /** Given only with this choice ("summer"): the rules name it so ("Summer fey champions gain…"). */
  choice?: string;
  /** It changes a feature the creature has ("Bite. If the dragon dealt…") rather than adding one. */
  alters?: boolean;
}

/** A "Statistics" line: its label and words. */
export interface TemplateStatLine {
  label: string;
  text: string;
}

export interface TemplateChoice {
  /** The option's name ("fire", "summer", "tainted nature magic"). */
  key: string;
  /** The damage types it goes with. */
  damage: string[];
}

export interface MonsterTemplate {
  name: string;
  /** The sentence saying what it applies to. */
  appliesText: string;
  appliesTo: TemplateApplies;
  /** The introduction's sentences on what the creature loses ("loses all traits … living body"). */
  losesText?: string;
  /** The Statistics section's first words when they ask for a choice ("Pick an element…"). */
  choiceText?: string;
  choices: TemplateChoice[];
  stats: TemplateStatLine[];
  features: TemplateFeature[];
  /** Rules in a feature section that are not a feature ("When the grim deals damage…, it can choose…"). */
  rules: string[];
}

export interface TemplateApplies {
  /** Creature types (lowercase); empty for any creature. */
  types: string[];
  /** Only true dragons; `ages` narrows it ("adult", "ancient"). */
  trueDragon?: boolean;
  ages?: string[];
  minInt?: number;
  minCr?: number;
  maxCr?: number;
  /** The largest size it allows ("small" for "Small or smaller"). */
  maxSize?: string;
  /** Conditions it cannot check ("that worships the Void"). */
  other: string[];
  /** Only an NPC written "Humanoid (Any Lineage)" (a lineage's NPC features). */
  anyLineage?: boolean;
}

export const CREATURE_TYPES = [
  "aberration",
  "beast",
  "celestial",
  "construct",
  "dragon",
  "elemental",
  "fey",
  "fiend",
  "giant",
  "humanoid",
  "monstrosity",
  "ooze",
  "plant",
  "undead",
] as const;

export const DAMAGE_TYPES = [
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
] as const;

export const CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
] as const;

const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;

/** A paragraph that goes on with the feature before it ("*Hit:* …", "The target must…"). */
const CONTINUES =
  /^(?:\*Hit:\*|[a-z]|The target\b|On a (?:failure|success|failed|successful)\b|A creature\b|If the target\b)/;

const SECTION_TYPE: Record<string, TemplateFeatureType> = {
  traits: "trait",
  actions: "action",
  "bonus actions": "bonus",
  reactions: "reaction",
  "legendary actions": "legendary",
};

/** Book typography to plain: curly quotes and the minus sign. */
export function plainText(s: string): string {
  return s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/−/g, "-");
}

interface Section {
  title: string;
  lines: string[];
}

/** The note's sections: each `rpg rule.tab` tab and each `##`/`###` heading inside or outside one. */
function sectionsOf(body: string): { intro: string[]; sections: Section[] } {
  const intro: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  let inTab = false;
  let inOther = false;
  let tabHeader = false;
  for (const line of body.split("\n")) {
    const fence = line.match(/^```+\s*(.*)$/);
    if (fence) {
      if (inOther) {
        inOther = false;
      } else if (inTab) {
        inTab = false;
        current = null;
      } else if (/^rpg\s+rule\.tab\b/.test(fence[1])) {
        inTab = true;
        tabHeader = true;
      } else {
        inOther = fence[1].trim() !== "";
      }
      continue;
    }
    if (inOther) continue;
    if (inTab && tabHeader) {
      if (line.trim() === "---") tabHeader = false;
      continue;
    }
    const heading = line.match(/^#{2,4}\s+(.+?)\s*$/);
    // The example monster closes the template: what follows is its statblock and side notes.
    if (heading && /^example monster\b/i.test(heading[1])) break;
    if (heading) {
      current = { title: heading[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else if (!inTab && !/^#\s/.test(line)) intro.push(line);
  }
  return { intro, sections };
}

/** Paragraphs of a section: blank-line separated, each list item its own. */
function paragraphsOf(lines: string[]): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) out.push(cur.join("\n").trim());
    cur = [];
  };
  for (const line of lines) {
    if (line.trim() === "") flush();
    else if (/^\s*[-*]\s+\*\*/.test(line)) {
      flush();
      cur.push(line);
      flush();
    } else cur.push(line);
  }
  flush();
  return out.filter((p) => p && !/^!\[\[[^\]]*\]\]$/.test(p));
}

/** The nouns a template's text calls the creature by ("the grim", "the dragon skeleton", "the creature"). */
export function templateNouns(name: string): string[] {
  const n = plainText(name).toLowerCase();
  const out = new Set<string>();
  const paren = n.match(/^(.+?)\s*\((.+)\)$/);
  if (paren) {
    out.add(`${paren[2]} ${paren[1]}`);
    out.add(paren[1]);
  } else {
    out.add(n);
    out.add(`${n} creature`);
    const words = n.split(/\s+/);
    if (words.length > 1) out.add(`${words[0]} creature`);
  }
  for (const w of ["creature", "dragon"]) out.add(w);
  return [...out].sort((a, b) => b.length - a.length);
}

const BOILERPLATE =
  /^(the (creature|dragon)('s)? gains (?:one of )?the following|make the following adjustments|the dragon gains the following|the greatwyrm's .*change in the following ways)/i;

/** Parse a template note. `name` is the note's name. */
export function parseMonsterTemplate(name: string, noteText: string): MonsterTemplate {
  const body = plainText(noteText.replace(/^---\n[\s\S]*?\n---\n/, ""));
  const { intro, sections } = sectionsOf(body);
  const introText = intro.join("\n");
  const appliesText = introText.match(/This template can be applied (?:only )?to [^.]*\./i)?.[0] ?? "";
  const nouns = templateNouns(name);

  const stats: TemplateStatLine[] = [];
  const features: TemplateFeature[] = [];
  const rules: string[] = [];
  let choiceText: string | undefined;
  let choices: TemplateChoice[] = [];
  for (const section of sections) {
    const title = section.title.toLowerCase();
    const paras = paragraphsOf(section.lines);
    if (title === "statistics") {
      for (const p of paras) {
        const m = p.match(/^\*\*([^*]+?)\.\*\*\s*([\s\S]*)$/);
        if (m) stats.push({ label: m[1].trim(), text: m[2].replace(/\s+/g, " ").trim() });
        else if (/\b(pick|choose|chose)\b/i.test(p)) {
          choiceText = p.replace(/\s+/g, " ");
          choices = choicesOf(choiceText);
        }
      }
      continue;
    }
    const type = SECTION_TYPE[title];
    if (!type) continue;
    let last: { feature: TemplateFeature; sub: (s: string) => string } | null = null;
    for (const p of paras) {
      const listItem = /^\s*[-*]\s+\*\*/.test(p);
      // A table, a sentence going on, or the list of ways a feature works ("one of the following ways").
      if (
        last &&
        (/^\|/.test(p) ||
          (!listItem && CONTINUES.test(p)) ||
          (listItem && /\bof the following\b/i.test(last.feature.text)))
      ) {
        last.feature.text += `\n\n${selfNamed(last.sub(p), nouns)}`;
        continue;
      }
      const m =
        p.match(/^\s*[-*]\s+\*\*([^*]+?)\.\*\*\s*([\s\S]*)$/) ?? p.match(/^\*{1,3}([^*]+?)\.\*{1,3}\s*([\s\S]*)$/);
      // A paragraph that is no feature, or a rule written as one ("gains two of the following", "should be limited").
      if (!m || /\b(?:gains|chooses) \w+ of the following\b|\bshould be\b/i.test(m[2])) {
        if (!BOILERPLATE.test(p)) rules.push(p.replace(/\s+/g, " "));
        last = null;
        continue;
      }
      const formulas: Record<string, string> = {};
      let formulaN = 0;
      const sub = (s: string) =>
        s
          .replace(/#\s*\[([^\][]+)\]/g, (_, f: string) => {
            const key = `f${++formulaN}`;
            formulas[key] = f.trim();
            return `{{${key}}}`;
          })
          .replace(/(?<!\[)\[([^\][]+)\](?![\](])/g, (_, f: string) => {
            const key = `f${++formulaN}`;
            formulas[key] = f.trim();
            return `{{${key}}}`;
          });
      const rawName = m[1].trim();
      const fname = sub(rawName);
      const key = rawName
        .replace(/\s*\([^)]*\[[^\]]*\][^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const text = selfNamed(sub(m[2].trim()), nouns);
      const optional = /^\s*[-*]\s+\*\*/.test(p);
      const alters =
        /^If (?:the [a-z' ]+?|it) (?:has (?:the|a|an)|dealt|deals damage with)\b/i.test(m[2].trim()) ||
        /^The [a-z' -]+?'s [A-Z][\w ]+ now\b/.test(m[2].trim());
      const feature: TemplateFeature = {
        name: fname,
        key,
        type,
        text,
        formulas,
        ...(optional ? { optional } : {}),
        ...(alters ? { alters } : {}),
      };
      features.push(feature);
      last = { feature, sub };
    }
  }
  // "Harvester's Brawn (autumn)", "Spring fey champions gain the Floral Renewal bonus action".
  const keys = choices.map((c) => c.key);
  for (const f of features) {
    const n = f.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const rule of rules) {
      const m =
        rule.match(new RegExp(`\\b${n} \\(([a-z ]+)\\)`, "i")) ??
        (keys.length ? rule.match(new RegExp(`\\b(${keys.join("|")}) [a-z' -]+? gains? the ${n}\\b`, "i")) : null);
      if (m && keys.includes(m[1].toLowerCase())) f.choice = m[1].toLowerCase();
    }
  }
  const losesText =
    introText
      .replace(/\s+/g, " ")
      .split(/(?<=\.)\s+/)
      .filter((x) => /\bloses?\b/.test(x) && !/^\*/.test(x))
      .join(" ") || undefined;
  return {
    name,
    appliesText,
    appliesTo: appliesOf(appliesText),
    ...(losesText ? { losesText } : {}),
    choiceText,
    choices,
    stats,
    features,
    rules,
  };
}

/** "the grim's" → "the {{ self.name() }}'s"; the template's own nouns only. */
function selfNamed(text: string, nouns: string[]): string {
  const alt = nouns.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return text.replace(
    new RegExp(`\\b([Tt])he (${alt})\\b(?! (?:lich|skeleton|zombie|that|who|controlling|it was)\\b)`, "g"),
    "$1he {{ self.name() }}"
  );
}

/** "air (lightning or thunder), earth (bludgeoning or poison)…" → the options. */
export function choicesOf(text: string): TemplateChoice[] {
  const out: TemplateChoice[] = [];
  const after = text.replace(/^[^:]*:\s*/, "");
  for (const m of after.matchAll(/([a-z][a-z' -]*?)\s*\(([^)]+)\)/gi)) {
    const key = m[1]
      .replace(/^(and|or)\s+/i, "")
      .trim()
      .toLowerCase();
    const damage = m[2]
      .toLowerCase()
      .split(/\s+or\s+|,\s*/)
      .map((d) => d.trim())
      .filter((d) => (DAMAGE_TYPES as readonly string[]).includes(d));
    if (key && damage.length) out.push({ key, damage });
  }
  return out;
}

/** What "This template can be applied to …" allows. */
export function appliesOf(text: string): TemplateApplies {
  const t = plainText(text).toLowerCase();
  const out: TemplateApplies = { types: [], other: [] };
  const full = t.replace(/^.*?applied (?:only )?to\s+/, "").replace(/\.$/, "");
  // "any creature, but a leader must be able to communicate with its allies": the condition is one.
  const but = full.match(/,\s*but\s+(.+)$/);
  const what = but ? full.slice(0, but.index) : full;
  if (/true dragon/.test(what)) {
    out.trueDragon = true;
    out.types = ["dragon"];
    const ages = what.match(/\b(wyrmling|young|adult|ancient)\b/g);
    if (ages) out.ages = [...new Set(ages)];
  } else if (!/^any creature\b/.test(what)) {
    const size = what.match(/\b(tiny|small|medium|large|huge|gargantuan) or smaller\b/);
    if (size) out.maxSize = size[1];
    const head = what.split(/\s+(?:that|with|except)\b/)[0];
    out.types = CREATURE_TYPES.filter((ty) =>
      new RegExp(`\\b(?:${ty}|${ty}s|${ty.replace(/y$/, "ies")})\\b`).test(head)
    );
  }
  const int = t.match(/int of (-?\d+) or higher/);
  if (int) out.minInt = Number(int[1]);
  const cr = t.match(/cr of (\d+) or higher/);
  if (cr) out.minCr = Number(cr[1]);
  const maxCr = t.match(/cr no higher than (\d+)/);
  if (maxCr) out.maxCr = Number(maxCr[1]);
  const rest = what
    .split(/,?\s+(?:and\s+)?(?=that |with |except )/)
    .slice(1)
    .map((s) => s.replace(/^(and\s+)/, "").trim())
    .filter((s) => !/int of|cr of|cr no higher/.test(s));
  out.other = but ? [...rest, but[1]] : rest;
  return out;
}

/** Whether a creature meets a template's terms; the unmet ones, and those it cannot check. */
export function templateFits(
  applies: TemplateApplies,
  creature: { type: string; name: string; cr: number; int: number }
): { fits: boolean; unmet: string[]; unchecked: string[] } {
  const type = plainText(creature.type).toLowerCase();
  const unmet: string[] = [];
  if (applies.anyLineage && !/any lineage/.test(type)) unmet.push("a Humanoid (Any Lineage) NPC");
  if (applies.types.length && !applies.types.some((ty) => new RegExp(`\\b${ty}\\b`).test(type))) {
    unmet.push(`a ${applies.types.join(", ")}`);
  }
  if (applies.ages?.length && !applies.ages.some((a) => new RegExp(`\\b${a}\\b`, "i").test(creature.name))) {
    unmet.push(`an ${applies.ages.join(" or ")} dragon`);
  }
  if (applies.minInt !== undefined && creature.int < applies.minInt) unmet.push(`INT ${applies.minInt} or higher`);
  if (applies.minCr !== undefined && creature.cr < applies.minCr) unmet.push(`CR ${applies.minCr} or higher`);
  if (applies.maxCr !== undefined && creature.cr > applies.maxCr) unmet.push(`CR ${applies.maxCr} or lower`);
  if (applies.maxSize) {
    const size = SIZES.findIndex((z) => new RegExp(`\\b${z}\\b`).test(type));
    if (size > SIZES.indexOf(applies.maxSize as (typeof SIZES)[number])) unmet.push(`${applies.maxSize} or smaller`);
  }
  return { fits: unmet.length === 0, unmet, unchecked: applies.other };
}

/** What a formula's numbers come from. */
export interface FormulaContext {
  cr: number;
  pb: number;
  hp: number;
  abilities: Record<string, number>;
  /** Save DCs the creature's features already use. */
  dcs: number[];
  /** The DC of a feature by a word in its name ("breath", "frightful"). */
  dcOf: (word: string) => number | undefined;
  perception?: number;
}

/** A book formula's value (a number, or dice such as "5 (2d4)"), or undefined for one that needs a person ("[Size]", "[Beast]"). */
export function evaluateFormula(formula: string, ctx: FormulaContext): number | string | undefined {
  const f = plainText(formula).toLowerCase();
  // "a number of d4s equal to one half the leader's CR, rounded down, minimum of 1"
  const dice = f.match(
    /number of d(\d+)s equal to (?:one )?half (?:the [a-z' ]+?'s )?cr, rounded down(?:, minimum of (\d+))?/
  );
  if (dice) {
    const n = Math.max(Number(dice[2] ?? 1), Math.floor(ctx.cr / 2));
    return `${Math.floor((n * (Number(dice[1]) + 1)) / 2)} (${n}d${dice[1]})`;
  }
  // "a number of d6s equal to the creature's PB", "… d8s equal to half the creature's PB, rounded up"
  const perPb = f.match(/number of d(\d+)s equal to (half )?(?:the [a-z' ]+?'s )?pb(?:, rounded (up|down))?/);
  if (perPb) {
    const raw = perPb[2] ? ctx.pb / 2 : ctx.pb;
    const n = Math.max(1, perPb[3] === "up" ? Math.ceil(raw) : Math.floor(raw));
    return `${Math.floor((n * (Number(perPb[1]) + 1)) / 2)} (${n}d${perPb[1]})`;
  }
  // "the creature's CR times 5, minimum of 5"
  const times = f.match(/cr times (\d+)(?:, minimum of (\d+))?/);
  if (times) return Math.max(Number(times[2] ?? 0), Math.round(ctx.cr * Number(times[1])));
  // Words the feature keeps as they are: "[damage of the attack's type]".
  if (/^damage of the attack's type$/.test(f)) return "damage of the attack's type";
  const mod = (k: string) => ctx.abilities[k] ?? 0;
  const pct = f.match(/(\d+) percent of (?:its |the [a-z' ]+?'s )?(hp maximum|cr)/);
  if (pct) {
    const base = pct[2] === "cr" ? ctx.cr : ctx.hp;
    const v = (Number(pct[1]) / 100) * base;
    return pct[2] === "cr" ? Math.max(0, Math.ceil(v)) : Math.round(v);
  }
  if (/half (?:the [a-z' ]+?'s )?cr/.test(f)) return Math.floor(ctx.cr / 2);
  const baseOff = f.match(/^base\s*([+-])\s*(\d+)$/);
  if (baseOff && ctx.perception !== undefined)
    return ctx.perception + (baseOff[1] === "+" ? 1 : -1) * Number(baseOff[2]);
  if (/save dc|same dc|dc as/.test(f) && /breath/.test(f)) return ctx.dcOf("breath") ?? highest(ctx);
  if (/frightful/.test(f)) return ctx.dcOf("frightful") ?? highest(ctx);
  const ten = f.match(/^10 \+ the [a-z' ]+?'s (str|dex|con|int|wis|cha) modifier/);
  if (ten) {
    const v = 10 + mod(ten[1]);
    return /whichever is higher/.test(f) ? Math.max(v, highest(ctx) ?? v) : v;
  }
  const pbPlus = f.match(/^pb \+ the [a-z' ]+?'s (str|dex|con|int|wis|cha)(?: or (str|dex|con|int|wis|cha))?/);
  if (pbPlus) return ctx.pb + Math.max(mod(pbPlus[1]), pbPlus[2] ? mod(pbPlus[2]) : -99);
  if (/^(?:the )?[a-z' ]*\bpb\b$/.test(f)) return ctx.pb;
  return undefined;
}

function highest(ctx: FormulaContext): number | undefined {
  return ctx.dcs.length ? Math.max(...ctx.dcs) : undefined;
}

/** The id a template feature has in the features note. */
export function templateFeatureId(template: string, feature: TemplateFeature): string {
  return `${template}: ${feature.key}`;
}

/** The note of every template's features, as `rpg feature.details` blocks the statblocks refer to. */
export function templateFeaturesNote(templates: MonsterTemplate[], source: string): string {
  const q = (s: string) => JSON.stringify(s);
  const out = [
    "---",
    "cssclasses:",
    "  - note-feature",
    `source: ${source}`,
    "---",
    "# Monster Template Traits",
    "The features the creature templates give (Game Master's Guide, Homebrewer's Toolbox; Monster Vault 2), read from the template notes in `worldbuilding/bestiary/templates/`. `rpg sim templates --write` writes this note again from them; `rpg sim homebrew <base> --template <name>` adds the features to a new statblock, with the numbers for that creature.",
  ];
  for (const t of templates) {
    const given = t.features.filter((f) => !f.alters);
    if (given.length === 0) continue;
    out.push(`## ${t.name}`);
    for (const f of given) {
      const tiers = Object.keys(f.formulas).length
        ? [
            "tiers:",
            `  default: { ${Object.entries(f.formulas)
              .map(([k, v]) => `${k}: ${q(`[${v}]`)}`)
              .join(", ")} }`,
          ]
        : [];
      out.push(
        "```rpg feature.details",
        `name: ${q(f.name)}`,
        `id: ${q(templateFeatureId(t.name, f))}`,
        `type: ${f.type}`,
        "example:",
        `  self: { name: ${q(t.name)} }`,
        "heading: p",
        ...tiers,
        "---",
        f.text,
        "```"
      );
    }
  }
  return `${out.join("\n")}\n`;
}
