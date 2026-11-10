/**
 * Sections that are game entities, recognised by the way rulebooks of the
 * 5e family write them, and written as the blocks the plugin reads them from:
 * a spell as `rpg spell`, a creature as `rpg stat.monster` with its traits and
 * actions as `rpg feature.details`, a magic item as `rpg item.magic`, a row of
 * a weapons or armor table as `rpg item.element`, and a class, subclass,
 * lineage, heritage, background or talent as a note of `rpg feature.details`.
 *
 * Only what the page states is filled in (a spell's range, a creature's hit
 * points). What takes reading the rules text (what a feature grants, how a
 * spell rolls) is left as text in the block's body, for a later pass.
 */

import type { Block, OutFile, Section, Span } from "./types";

export type EntityKind =
  | "spell"
  | "creature"
  | "magic item"
  | "item"
  | "class"
  | "subclass"
  | "lineage"
  | "heritage"
  | "background"
  | "talent";

export interface EntityEnv {
  /** The book's folder name, the root of paths in refs. */
  book: string;
  /** The note the section is written in, below the book's folder, without `.md`. */
  notePath: string;
  /** Titles of the sections above this one, outermost first. */
  trail: string[];
  /** What the section is already known to be, from where it was found (a class's subclass). */
  hint?: EntityKind;
  /** Heading depth the section's own heading has in its note. */
  depth: number;
  md(spans: Span[]): string;
  render(blocks: Block[], near: string): string[];
  /** A section's usual rendering: its heading, text and subsections. */
  inline(section: Section, depth: number): string[];
  /** A name no other note in `dir` has taken. */
  unique(dir: string, name: string): string;
}

export interface EntityOut {
  kind: EntityKind;
  /** The note's text below its heading. */
  lines: string[];
  /** Frontmatter the note gains when the section is a note of its own. */
  fields: Array<[string, string]>;
  /** Further notes (a creature's traits), paths below the book's folder. */
  files: OutFile[];
  /** Subsections to write as notes of their own in the note's folder (a class's subclasses). */
  childNotes: Array<{ section: Section; fields: Array<[string, string]> }>;
  /** True when the section's subsections are already in `lines`. */
  consumed: boolean;
}

const q = (text: string): string => JSON.stringify(text.replace(/\s+/g, " ").trim());
const plain = (b: Block | undefined): string =>
  (b?.type === "para" ? b.spans.map((s) => s.text).join("") : "").replace(/­/g, "").trim();
const allItalic = (b: Block | undefined): boolean =>
  b?.type === "para" && b.spans.filter((s) => s.text.trim()).every((s) => s.italic);
const cssclass = (name: string): [string, string] => ["cssclasses", `\n  - ${name}`];

function fenceFor(lines: string[]): string {
  let longest = 2;
  for (const line of lines) {
    const m = line.match(/^(`{3,})/);
    if (m) longest = Math.max(longest, m[1].length);
  }
  return "`".repeat(longest + 1);
}

/** A fenced rpg block: YAML above `---`, text below. */
function fenced(kind: string, yaml: string[], body: string[]): string[] {
  while (body[0] === "") body = body.slice(1);
  const fence = fenceFor(body);
  return [`${fence}rpg ${kind}`, ...yaml, ...(body.length ? ["---", ...body] : []), fence];
}

const blank = (kind: EntityKind): EntityOut => ({
  kind,
  lines: [],
  fields: [],
  files: [],
  childNotes: [],
  consumed: false,
});

// ── Spells ────────────────────────────────────────────────────────────────

interface SpellHead {
  circle?: string;
  source?: string;
  school: string;
  ritual?: boolean;
}

/** Reads the line under a spell's name; each pattern says which of its groups is which. */
const SPELL_HEAD: Array<[RegExp, (m: RegExpMatchArray) => SpellHead]> = [
  // Tales of the Valiant: "8th-Circle Primordial (Transmutation)", "Arcane Cantrip (Conjuration)"
  [
    /^(\d+(?:st|nd|rd|th))[- ]circle\s+(.+?)\s*\(([A-Za-z]+)\)\s*(\(?ritual\)?)?$/i,
    (m) => ({ circle: m[1], source: m[2], school: m[3], ritual: !!m[4] }),
  ],
  [/^(.+?)\s+cantrip\s*\(([A-Za-z]+)\)$/i, (m) => ({ source: m[1], school: m[2] })],
  // 5e: "3rd-level evocation (ritual)", "Evocation cantrip"
  [
    /^(\d+(?:st|nd|rd|th))[- ]level\s+([A-Za-z]+)\s*(\(ritual\))?$/i,
    (m) => ({ circle: m[1], school: m[2], ritual: !!m[3] }),
  ],
  [/^([A-Za-z]+)\s+cantrip$/i, (m) => ({ school: m[1] })],
];
const SPELL_FACT = /^(Casting Time|Range|Components?|Duration)\s*:\s*(.+)$/i;

function spell(section: Section, env: EntityEnv): EntityOut | null {
  const head = plain(section.blocks[0]);
  let g: SpellHead | null = null;
  for (const [re, read] of SPELL_HEAD) {
    const m = head.match(re);
    if (m) {
      g = read(m);
      break;
    }
  }
  if (!g) return null;
  const facts = new Map<string, string>();
  let i = 1;
  for (; i < section.blocks.length; i++) {
    // A fact's value may have wrapped into a paragraph holding several facts.
    const text = plain(section.blocks[i]);
    const parts = text.split(/\s+(?=(?:Casting Time|Range|Components?|Duration)\s*:)/i);
    const hits = parts.map((p) => p.match(SPELL_FACT));
    if (!hits.every(Boolean)) break;
    for (const hit of hits) if (hit) facts.set(hit[1].toLowerCase().replace(/s$/, ""), hit[2].trim());
  }
  if (facts.size < 2) return null;
  const ritual = !!g.ritual || env.trail.some((t) => /ritual/i.test(t));
  const circle = g.circle ? `${g.circle}-Circle${ritual ? " Ritual" : ""}` : "Cantrip";
  const yaml = [`circle: ${circle}`];
  const sources = (g.source ?? "")
    .split(/\s*,\s*|\s+and\s+|\s+or\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sources.length) yaml.push("source:", ...sources.map((s) => `  - "[[${s}]]"`));
  yaml.push(`school: ${g.school.charAt(0).toUpperCase()}${g.school.slice(1).toLowerCase()}`);
  if (facts.has("casting time")) yaml.push(`casting: ${q(facts.get("casting time") ?? "")}`);
  if (facts.has("range")) yaml.push(`range: ${q(facts.get("range") ?? "")}`);
  const components = (facts.get("component") ?? "").split(/,\s*(?![^(]*\))/).filter(Boolean);
  if (components.length) yaml.push("components:", ...components.map((c) => `  - ${q(c)}`));
  if (facts.has("duration")) yaml.push(`duration: ${q(facts.get("duration") ?? "")}`);
  if (allItalic(section.blocks[i])) yaml.push(`summary: ${q(plain(section.blocks[i++]))}`);
  const out = blank("spell");
  out.lines = fenced("spell", yaml, env.render(section.blocks.slice(i), section.title));
  out.fields = [cssclass("note-spell")];
  return out;
}

// ── Magic items ───────────────────────────────────────────────────────────

const MAGIC_HEAD =
  /^((?:Armor|Weapon|Wondrous Item|Potion|Ring|Rod|Staff|Wand|Scroll|Ammunition|Shield)s?\b(?:\s*\([^)]*\))?[^,]*),\s*(.*(?:Common|Uncommon|Rare|Legendary|Fabled|Artifact|Varies).*)$/i;
const MAGIC_KIND: Array<[RegExp, string]> = [
  [/^armor/i, "armor"],
  [/^weapon/i, "weapon"],
  [/^shield/i, "shield"],
  [/^ammunition/i, "ammunition"],
  [/^potion/i, "potion"],
  [/^staff/i, "staff"],
  [/^scroll/i, "scroll"],
];

function magicItem(section: Section, env: EntityEnv): EntityOut | null {
  const match = plain(section.blocks[0]).match(MAGIC_HEAD);
  if (!match || !allItalic(section.blocks[0])) return null;
  const [, type, rest] = match;
  const rarity = rest.match(/Very Rare|Uncommon|Common|Rare|Legendary|Fabled|Artifact|Rarity Varies/i)?.[0];
  const cost = rest.match(/[\d,]+\s*(?:cp|sp|ep|gp|pp)(?:\s*\+[^()]*)?/i)?.[0].trim();
  const attune = rest.match(/requires attunement([^)]*)/i);
  const kind = MAGIC_KIND.find(([re]) => re.test(type))?.[1] ?? "wondrous";
  const yaml = [`name: ${q(section.title)}`, `type: ${q(type)}`];
  if (rarity) yaml.push(`rarity: ${rarity.replace(/\b\w/g, (c) => c.toUpperCase())}`);
  if (cost) yaml.push(`cost: ${q(cost)}`);
  yaml.push(`attunement: ${attune ? "true" : "false"}`);
  if (attune?.[1]?.trim()) yaml.push(`attunement_by: ${q(attune[1])}`);
  yaml.push("applies_to:", `  kinds: [${kind}]`);
  const out = blank("magic item");
  out.lines = fenced("item.magic", yaml, env.render(section.blocks.slice(1), section.title));
  out.fields = [cssclass("note-item")];
  if (section.children.length) {
    // Variants and the like set under headings of their own stay with the item.
    for (const child of section.children) out.lines.push(...env.inline(child, env.depth + 1));
    out.consumed = true;
  }
  return out;
}

// ── Creatures ─────────────────────────────────────────────────────────────

const STAT_KEYS: Array<[RegExp, string]> = [
  [/^Armor Class\s+(.+)$/i, "ac"],
  [/^Hit Points\s+(.+)$/i, "hp"],
  [/^Speed\s+(.+)$/i, "speed"],
  [/^Vulnerable\s+(.+)$/i, "vulnerable"],
  [/^Resistant\s+(.+)$/i, "resistant"],
  [/^Immune\s+(.+)$/i, "immune"],
  [/^Damage Vulnerabilities\s+(.+)$/i, "vulnerable"],
  [/^Damage Resistances\s+(.+)$/i, "resistant"],
  [/^Damage Immunities\s+(.+)$/i, "immune"],
  [/^Condition Immunities\s+(.+)$/i, "condition_immune"],
  [/^Saving Throws\s+(.+)$/i, "saves"],
  [/^Skills\s+(.+)$/i, "skills"],
  [/^Senses\s+(.+)$/i, "senses"],
  [/^Languages\s+(.+)$/i, "languages"],
];
const FEATURE_GROUP: Array<[RegExp, string]> = [
  [/^bonus actions?$/i, "bonus"],
  [/^reactions?$/i, "reaction"],
  [/^legendary actions?$/i, "legendary"],
  [/^actions?$/i, "action"],
  [/^traits?$/i, "trait"],
];
const groupOf = (text: string) => FEATURE_GROUP.find(([re]) => re.test(text.trim()))?.[1];
const signed = (text: string) => Number(text.replace(/[−–—]/g, "-").replace("+", ""));

interface Feature {
  name: string;
  type: string;
  blocks: Block[];
}

function creature(section: Section, env: EntityEnv): EntityOut | null {
  const rating = section.tag?.match(/^CR\s+(.+)$/i)?.[1] ?? "";
  // The block's own first lines must be a stat block's: a section that merely holds one further down is not a creature.
  const own = section.blocks.slice(0, 10).map(plain);
  if (!own.some((t) => /^Armor Class\s+\d/i.test(t))) return null;
  // The stat block's lines, with the headings inside it (ACTIONS) as markers.
  const seq: Array<Block | { type: "label"; text: string }> = [...section.blocks];
  const flatten = (s: Section) => {
    seq.push({ type: "label", text: s.title });
    seq.push(...s.blocks);
    s.children.forEach(flatten);
  };
  section.children.forEach(flatten);
  const texts = seq.map((b) => (b.type === "label" ? "" : plain(b as Block)));
  if (!texts.some((t) => /^Armor Class\s+\d/i.test(t)) || !texts.some((t) => /^Hit Points\s+\d/i.test(t))) return null;

  const stats: Array<[string, string]> = [];
  const lore: Block[] = [];
  const features: Feature[] = [];
  let type = "";
  let cr = rating;
  let abilities: number[] | null = null;
  let group = "trait";
  let seenStats = false;
  for (let i = 0; i < seq.length; i++) {
    const item = seq[i];
    if (item.type === "label") {
      group = groupOf(item.text) ?? group;
      continue;
    }
    const block = item as Block;
    const text = texts[i];
    if (block.type === "para") {
      if (groupOf(text)) {
        group = groupOf(text) ?? group;
        continue;
      }
      const both = text.match(/^Perception\s+(\d+)\s+Stealth\s+(\d+)$/i);
      if (both) {
        stats.push(["pas_perception", both[1]], ["pas_stealth", both[2]]);
        seenStats = true;
        continue;
      }
      const challenge = text.match(/^Challenge\s+(\d+(?:\/\d+)?)/i);
      if (challenge) {
        cr = challenge[1];
        continue;
      }
      const stat = STAT_KEYS.map(([re, key]) => [text.match(re), key] as const).find(([m]) => m);
      if (stat?.[0]) {
        stats.push([stat[1], stat[0][1]]);
        seenStats = true;
        continue;
      }
      if (/^STR\s+DEX\s+CON\s+INT\s+WIS\s+CHA$/i.test(text)) continue;
      const mods = text.match(/^(?:[+−–-]\d+\s*){6}$/);
      const scores = [...text.matchAll(/\d+\s*\(([+−–-]\d+)\)/g)];
      if (!abilities && (mods || scores.length === 6)) {
        abilities = mods ? text.trim().split(/\s+/).map(signed) : scores.map((m) => signed(m[1]));
        continue;
      }
      if (!seenStats && !type && text.length < 80 && !/[.!?]$/.test(text)) {
        type = text;
        continue;
      }
      const lead = block.spans[0];
      const named = lead && lead.bold && /[.:]\s*$/.test(lead.text) && block.spans.length > 1;
      if (seenStats && named) {
        features.push({
          name: lead.text.replace(/[.:]\s*$/, "").trim(),
          type: group,
          blocks: [{ ...block, spans: block.spans.slice(1) }],
        });
        continue;
      }
    }
    if (seenStats && features.length) features[features.length - 1].blocks.push(block);
    else lore.push(block);
  }
  if (!abilities) return null;

  const name = section.title.trim();
  const dir = env.notePath.includes("/") ? env.notePath.slice(0, env.notePath.lastIndexOf("/")) : "";
  const traitsDir = dir ? `${dir}/Creature Traits` : "Creature Traits";
  const traitsName = env.unique(traitsDir, `${name.replace(/[\\/:|#^[\]]/g, " ")} Traits`);
  const yaml = [`name: ${q(name)}`, `type: ${q(type)}`];
  if (cr) yaml.push(`cr: ${q(cr)}`);
  yaml.push("stats:", ...stats.map(([k, v]) => `  ${k}: ${/^pas_/.test(k) ? v : q(v)}`));
  yaml.push(
    "abilities:",
    ...["str", "dex", "con", "int", "wis", "cha"].map((k, i) => `  ${k}: ${abilities?.[i] ?? 0}`)
  );
  const out = blank("creature");
  if (features.length) {
    const taken = new Set<string>();
    const traitLines = ["---", "cssclasses:", "  - note-feature", "---", `# ${traitsName}`];
    yaml.push("features:");
    for (const f of features) {
      let fname = f.name;
      for (let n = 2; taken.has(fname.toLowerCase()); n++) fname = `${f.name} (${n})`;
      taken.add(fname.toLowerCase());
      yaml.push(`  - ref: ${q(`@[[${env.book}/${traitsDir}/${traitsName}]]#${fname}`)}`);
      traitLines.push(
        ...fenced("feature.details", [`name: ${q(fname)}`, `type: ${f.type}`, "heading: p"], env.render(f.blocks, name))
      );
    }
    out.files.push({ path: `${traitsDir}/${traitsName}.md`, text: traitLines.join("\n") + "\n" });
  }
  out.lines = [...fenced("stat.monster", yaml, []), ...env.render(lore, name)];
  out.fields = [cssclass("note-statblock")];
  out.consumed = true;
  return out;
}

// ── Classes, subclasses, lineages, heritages, backgrounds, talents ────────

const LEVEL_NOTE = /^(\d+)(?:st|nd|rd|th)\b.*\bfeature$/i;

/** A section as one `feature.details` block: its name, the level it comes at when stated, and its text. */
function featureBlock(section: Section, env: EntityEnv, extra: string[] = []): string[] {
  const yaml = [`name: ${q(section.title)}`, ...extra];
  let blocks = section.blocks;
  const first = plain(blocks[0]);
  const level = first.match(LEVEL_NOTE);
  if (level && allItalic(blocks[0])) {
    yaml.push(`subtitle: ${q(first)}`, `level: ${level[1]}`);
    blocks = blocks.slice(1);
  } else if (/^prerequisites?\s*:/i.test(first) && allItalic(blocks[0])) {
    yaml.push(`subtitle: ${q(first)}`);
    blocks = blocks.slice(1);
  }
  const body = env.render(blocks, section.title);
  for (const child of section.children) body.push(...env.inline(child, Math.min(6, env.depth + 2)));
  return fenced("feature.details", yaml, body);
}

/** Text first, then each subsection as a feature; a subsection that only groups others keeps its heading. */
function featureList(sections: Section[], env: EntityEnv, depth: number): string[] {
  const out: string[] = [];
  for (const s of sections) {
    const looksFeature = s.blocks.length > 0 || !s.children.length;
    if (looksFeature) out.push(...featureBlock(s, env));
    else out.push(`${"#".repeat(Math.min(6, depth))} ${s.title}`, ...featureList(s.children, env, depth + 1));
  }
  return out;
}

function klass(section: Section, env: EntityEnv): EntityOut | null {
  const featuresAt = section.children.findIndex((c) => /^class features$/i.test(c.title));
  if (featuresAt < 0) return null;
  // A class's features come at stated levels; a rules section that merely has a "Class Features" heading does not.
  const leveled = section.children[featuresAt].children.filter((c) => LEVEL_NOTE.test(plain(c.blocks[0]))).length;
  if (leveled < 2) return null;
  const out = blank("class");
  const h = "#".repeat(Math.min(6, env.depth + 1));
  out.lines = env.render(section.blocks, section.title);
  let subclasses = false;
  for (const child of section.children) {
    if (subclasses) {
      out.childNotes.push({
        section: child,
        fields: [[".SUBCLASS", `\n  parent_class: ${section.title}`], cssclass("note-feature")],
      });
    } else if (/^class features$/i.test(child.title)) {
      out.lines.push(
        `${h} ${child.title}`,
        ...env.render(child.blocks, child.title),
        ...featureList(child.children, env, env.depth + 2)
      );
    } else if (/subclass(es)?$/i.test(child.title)) {
      out.lines.push(`${h} ${child.title}`, ...env.render(child.blocks, child.title));
      for (const sub of child.children)
        out.childNotes.push({
          section: sub,
          fields: [[".SUBCLASS", `\n  parent_class: ${section.title}`], cssclass("note-feature")],
        });
      subclasses = true;
    } else out.lines.push(...env.inline(child, env.depth + 1));
  }
  out.fields = [cssclass("note-feature")];
  out.consumed = true;
  return out;
}

function subclass(section: Section, env: EntityEnv): EntityOut | null {
  const parent = env.trail[env.trail.length - 1] ?? "";
  const underClass = /subclass(es)?$/i.test(parent);
  const leveled = section.children.filter((c) => LEVEL_NOTE.test(plain(c.blocks[0]))).length;
  if (env.hint !== "subclass" && !underClass && !(leveled >= 2 && leveled >= section.children.length / 2)) return null;
  if (!section.children.length) return null;
  const out = blank("subclass");
  out.lines = [...env.render(section.blocks, section.title), ...featureList(section.children, env, env.depth + 1)];
  out.fields = [cssclass("note-feature")];
  out.consumed = true;
  return out;
}

/** True for a paragraph that opens with a run-in name: `Age.`, `Skill Proficiencies:`. */
const runIn = (b: Block): boolean => {
  if (b.type !== "para" || b.spans.length < 2) return false;
  const lead = b.spans[0];
  return (lead.bold || lead.italic) && /[.:]\s*$/.test(lead.text) && lead.text.length < 60;
};

function lineage(section: Section, env: EntityEnv): EntityOut | null {
  const traits = section.children.find((c) => /lineage traits$/i.test(c.title));
  if (!traits) return null;
  const out = blank("lineage");
  out.lines = env.render(section.blocks, section.title);
  for (const child of section.children) {
    if (child === traits) out.lines.push(...featureBlock(child, env));
    else out.lines.push(...env.inline(child, env.depth + 1));
  }
  out.fields = [cssclass("note-feature")];
  out.consumed = true;
  return out;
}

/** Flavour text, then the run-in traits as one feature block. */
function traitNote(
  kind: EntityKind,
  section: Section,
  env: EntityEnv,
  name: string,
  extra: string[] = []
): EntityOut | null {
  const at = section.blocks.findIndex(runIn);
  if (at < 0) return null;
  const out = blank(kind);
  out.lines = [
    ...env.render(section.blocks.slice(0, at), section.title),
    ...fenced("feature.details", [`name: ${q(name)}`, ...extra], env.render(section.blocks.slice(at), section.title)),
  ];
  for (const child of section.children) out.lines.push(...env.inline(child, env.depth + 1));
  out.fields = [cssclass("note-feature")];
  out.consumed = true;
  return out;
}

function heritage(section: Section, env: EntityEnv): EntityOut | null {
  if (!/\bheritage$/i.test(section.title) || !env.trail.some((t) => /heritage/i.test(t))) return null;
  const name = section.title.replace(/\s+heritage$/i, "");
  return traitNote("heritage", section, env, `${name} Features`, ['view: "No Title"']);
}

function background(section: Section, env: EntityEnv): EntityOut | null {
  if (!env.trail.some((t) => /^backgrounds?$/i.test(t.trim()))) return null;
  if (!section.blocks.some((b) => /^skill proficienc/i.test(plain(b)))) return null;
  return traitNote("background", section, env, `${section.title} Background`);
}

function talent(section: Section, env: EntityEnv): EntityOut | null {
  const parent = env.trail[env.trail.length - 1] ?? "";
  if (!/talents$/i.test(parent) || section.children.length || !section.blocks.length) return null;
  const out = blank("talent");
  // The heading above already names the talent; the block keeps its name only when it has nothing else to say.
  const block = featureBlock({ ...section, children: [] }, env);
  out.lines = block.some((l) => /^subtitle: /.test(l)) ? block.filter((l) => !/^name: /.test(l)) : block;
  out.fields = [cssclass("note-feature")];
  out.consumed = true;
  return out;
}

const RECOGNISERS = [spell, creature, magicItem, klass, subclass, lineage, heritage, background, talent];

export function recogniseEntity(section: Section, env: EntityEnv): EntityOut | null {
  if (!section.level) return null;
  for (const recognise of RECOGNISERS) {
    const out = recognise(section, env);
    if (out) return out;
  }
  return null;
}

// ── Items from equipment tables ───────────────────────────────────────────

const COIN = /\d\s*(cp|sp|ep|gp|pp)\b/i;

/**
 * A table of things with a cost (weapons, armor, gear) as one `item.element`
 * note a row. A row with nothing but its first cell names the kind of the
 * rows under it (`Simple Melee Weapons`, `Light Armor`).
 */
export function itemsFromTable(
  table: Extract<Block, { type: "table" }>,
  dir: string,
  unique: (dir: string, name: string) => string
): OutFile[] {
  const head = table.rows[0].map((h) => h.toLowerCase().trim());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const cost = col(/^cost$|^price$/);
  if (cost < 1 || table.rows.length < 4) return [];
  const priced = table.rows.slice(1).filter((r) => COIN.test(r[cost] ?? ""));
  if (priced.length < 3) return [];
  const damage = col(/^damage$/);
  const ac = col(/armor class|^ac$/);
  const weight = col(/^weight$/);
  // Things you carry have a weight, a damage or an armor class; a price list of services or rarities has none.
  if (damage < 0 && ac < 0 && weight < 0) return [];
  const props = col(/^propert/);
  const options = col(/option/);
  const known = new Set([0, cost, damage, ac, weight, props, options]);
  const list = (text: string) =>
    text
      .split(/,\s*(?![^(]*\))/)
      .map((s) => s.trim())
      .filter((s) => s && !/^[—–-]$/.test(s));
  const files: OutFile[] = [];
  let kind = table.caption ?? head[0];
  for (const row of table.rows.slice(1)) {
    const name = (row[0] ?? "").trim();
    if (!name) continue;
    if (row.slice(1).every((c) => !c.trim() || c.trim() === "*")) {
      kind = name;
      continue;
    }
    if (!COIN.test(row[cost] ?? "")) continue;
    const yaml = [`name: ${q(name)}`, `type: ${q(kind)}`, `cost: ${q(row[cost])}`];
    if (weight >= 0 && row[weight]?.trim() && !/^[—–-]$/.test(row[weight].trim()))
      yaml.push(`weight: ${q(row[weight])}`);
    if (damage >= 0) {
      yaml.push("weapon:", `  damage: ${q(row[damage] ?? "")}`);
      const p = props >= 0 ? list(row[props] ?? "") : [];
      if (p.length) yaml.push("  properties:", ...p.map((x) => `    - ${q(x)}`));
      const o = options >= 0 ? list(row[options] ?? "") : [];
      if (o.length) yaml.push("  options:", ...o.map((x) => `    - ${q(x)}`));
    } else if (ac >= 0) {
      yaml.push("armor:", `  ac: ${q(row[ac] ?? "")}`, `  category: ${q(kind.replace(/\s+armor$/i, ""))}`);
      const p = props >= 0 ? list(row[props] ?? "") : [];
      if (p.length) yaml.push("  properties:", ...p.map((x) => `    - ${q(x)}`));
    }
    row.forEach((cell, i) => {
      if (known.has(i) || !cell.trim() || /^[—–-]$/.test(cell.trim()) || !head[i]) return;
      yaml.push(`${head[i].replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}: ${q(cell)}`);
    });
    const file = unique(
      dir,
      name
        .replace(/[\\/:|#^[\]<>?*"]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
    files.push({
      path: `${dir}/${file}.md`,
      text: ["---", "cssclasses:", "  - note-item", "---", `# ${name}`, ...fenced("item.element", yaml, []), ""].join(
        "\n"
      ),
    });
  }
  return files;
}
