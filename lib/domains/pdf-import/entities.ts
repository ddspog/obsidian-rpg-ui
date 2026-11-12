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

import { reviewLine, type BlockReview } from "../review/block-review";
import { PLAIN_RUN_IN } from "./patterns";
import type { Block, OutFile, Section, Span } from "./types";

export type EntityKind =
  | "spell"
  | "creature"
  | "vehicle"
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
  /** Look for this kind alone. */
  only?: EntityKind;
  /** The section's text was read by OCR: emphasis is patchy, so names are also read from the words. */
  scanned?: boolean;
  /** Heading depth the section's own heading has in its note. */
  depth: number;
  md(spans: Span[]): string;
  render(blocks: Block[], near: string): string[];
  /** A section's usual rendering: its heading, text and subsections. */
  inline(section: Section, depth: number): string[];
  /** Where a creature's traits note goes (from the vault's root, no `.md`), when not beside the creature. */
  traitsAt?(name: string): string;
  /**
   * Keeps a creature's trait or action in a note shared by its creature type, and gives the ref to
   * it. Absent: each creature has a traits note of its own.
   */
  shareTrait?(type: string, creature: string, feature: { name: string; type: string; body: string[] }): string;
  /** What a price list of the book says of this name (a mounts or vehicles table): its cost and other columns. */
  priceOf?(name: string): { list: string; fields: Array<[string, string]> } | undefined;
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
  /** What decides the entity's folder: a spell's circle, an item's kind. */
  info?: { circle?: string; type?: string; steed?: boolean; tags?: string; cr?: string };
  /** The picture set with the entity, written as its `image`: the host may keep it with others of its kind. */
  portrait?: string;
  /** The note the entity was written to when entities are kept in folders of their own (from the vault's root). */
  placed?: string;
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
export function fenced(kind: string, yaml: string[], body: string[]): string[] {
  while (body[0] === "") body = body.slice(1);
  const fence = fenceFor(body);
  return [`${fence}rpg ${kind}`, ...yaml, ...(body.length ? ["---", ...body] : []), fence];
}

/** True when none of the blocks carries bold or italic: text from a scan, where names must be read from the words. */
const unmarked = (blocks: Block[]): boolean =>
  !blocks.some((b) => b.type === "para" && b.spans.some((sp) => (sp.bold || sp.italic) && sp.text.trim()));

/**
 * A paragraph's run-in name and the rest of it: `**Bite.** Melee Weapon Attack…`.
 * With `loose`, the name is read from the words alone (`Bite. Melee Weapon…`).
 */
function leadName(block: Block, loose: boolean, boldOnly = false): { name: string; rest: Span[] } | null {
  if (block.type !== "para") return null;
  const lead = block.spans[0];
  if (
    lead &&
    (lead.bold || (!boldOnly && lead.italic)) &&
    /[.:]\s*$/.test(lead.text) &&
    block.spans.length > 1 &&
    lead.text.length < 60
  )
    return { name: lead.text.replace(/[.:]\s*$/, "").trim(), rest: block.spans.slice(1) };
  if (!loose) return null;
  const text = block.spans.map((sp) => sp.text).join("");
  const hit = text.match(PLAIN_RUN_IN);
  if (!hit) return null;
  return { name: hit[1], rest: [{ text: text.slice(hit[0].length), bold: false, italic: false }] };
}

/** Takes the first picture out of an entity's text: it is the entity's portrait, shown by its block. */
function takePortrait(blocks: Block[]): string {
  const at = blocks.findIndex((b) => b.type === "image");
  return at >= 0 ? (blocks.splice(at, 1)[0] as Extract<Block, { type: "image" }>).file : "";
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
  // A scan may read the circle's digit as a letter (`sth-Circle`): put it back.
  const digit: Record<string, string> = { s: "5", l: "1", i: "1", z: "2", o: "0", b: "6", g: "9" };
  const head = plain(section.blocks[0]).replace(
    /^([a-z])(?=(?:st|nd|rd|th)[- ]?(?:circle|level))/i,
    (c) => digit[c.toLowerCase()] ?? c
  );
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
  if (facts.size < 1) return null;
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
  const rest = section.blocks.slice(i);
  const picture = takePortrait(rest);
  if (picture) {
    yaml.push(`image: ${q(`![[${picture}|384]]`)}`);
    out.portrait = picture;
  }
  out.lines = fenced("spell", yaml, env.render(rest, section.title));
  out.info = { circle };
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
  if (!match || plain(section.blocks[0]).length > 160) return null;
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
  const text = section.blocks.slice(1);
  const picture = takePortrait(text);
  if (picture) {
    yaml.push(`image: ${q(`![[${picture}|384]]`)}`);
    out.portrait = picture;
  }
  out.lines = fenced("item.magic", yaml, env.render(text, section.title));
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
  [/^Initiative\s+(.+)$/i, "initiative"],
  [/^Cargo(?: Capacity)?\s+(.+)$/i, "cargo"],
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
  // A description under the thing's name, then its stat block under the same name again (a vehicle):
  // one entity, the description its text.
  const twin = section.children.length === 1 ? section.children[0] : undefined;
  const opening: Block[] = [];
  if (
    twin &&
    twin.title.toLowerCase() === section.title.toLowerCase() &&
    !section.blocks.some((b) => /^Armor Class\s+\d/i.test(plain(b)))
  ) {
    opening.push(...section.blocks);
    section = { ...twin, title: section.title, tag: section.tag ?? twin.tag };
  }
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

  const loose = !!env.scanned || unmarked(seq.filter((b): b is Block => b.type !== "label"));
  const stats: Array<[string, string]> = [];
  const lore: Block[] = [...opening];
  const features: Feature[] = [];
  let type = "";
  let cr = rating;
  let abilities: number[] | null = null;
  let sawAbilities = false;
  let group = "trait";
  let seenStats = false;
  for (let i = 0; i < seq.length; i++) {
    const item = seq[i];
    if (item.type === "label") {
      group = groupOf(item.text) ?? group;
      continue;
    }
    let block = item as Block;
    let text = texts[i];
    // The abilities set as a small table: STR DEX CON INT WIS CHA over their values.
    if (block.type === "table" && !abilities && /^str$/i.test(block.rows[0]?.[0]?.trim() ?? "")) {
      const values = (block.rows[1] ?? []).join(" ");
      const inBrackets = [...values.matchAll(/\(([+−–-]\d+)\)/g)].map((m) => signed(m[1]));
      const bare = values.match(/[+−–-]\d+/g)?.map(signed) ?? [];
      const got = inBrackets.length === 6 ? inBrackets : bare.length === 6 ? bare : null;
      if (got) {
        abilities = got;
        continue;
      }
    }
    // A group's label run into its first entry (`ACTIONS Beak. Melee…`), as a scan reads a bar and the line under it.
    const led =
      block.type === "para" ? text.match(/^(BONUS ACTIONS|LEGENDARY ACTIONS|REACTIONS|ACTIONS)\s+(?=[A-Z])/) : null;
    if (led && block.type === "para") {
      group = groupOf(led[1]) ?? group;
      text = text.slice(led[0].length);
      block = { ...block, spans: [{ text, bold: false, italic: false }] };
    }
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
      const crew = text.match(/^Crew\s+(\S+)\s+Passengers\s+(\S+)$/i);
      if (crew) {
        stats.push(["crew", crew[1]], ["passengers", crew[2]]);
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
      const header = text.match(/^STR\.?\s+DEX\.?\s+CON\.?\s+INT\.?\s+WIS\.?\s+CHA\.?\s*/i);
      if (header) {
        // On a scan the values, and what follows them, may have run into the header's line.
        const after = text.slice(header[0].length);
        const values = after.match(/^(?:\(?[+−–-]\s?\d+\)?\s*)+/)?.[0] ?? "";
        const read = values.match(/[+−–-]\s?\d+/g)?.map((v) => signed(v.replace(/\s/g, ""))) ?? [];
        if (read.length >= 3 && !abilities) abilities = [...read, 0, 0, 0].slice(0, 6);
        sawAbilities = true;
        continue;
      }
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
      const named = seenStats ? leadName(block, loose, true) : null;
      if (named) {
        features.push({ name: named.name, type: group, blocks: [{ ...block, spans: named.rest }] });
        continue;
      }
    }
    if (seenStats && features.length) features[features.length - 1].blocks.push(block);
    else lore.push(block);
  }
  // What a person should check in the stat block, written at its top.
  const reviews: BlockReview[] = [];
  if (!abilities) {
    // A scan may lose the numbers: the block is still a creature's, with its abilities left to fill in.
    if (!(loose && (sawAbilities || stats.length >= 3))) return null;
    abilities = [0, 0, 0, 0, 0, 0];
    reviews.push({
      severity: "fix",
      kind: "entity-incomplete",
      off: [],
      message: `Ability scores not read (p. ${section.page}); they are 0. What to do: fill them in from the book.`,
    });
  }
  if (env.scanned)
    reviews.push({
      severity: "check",
      kind: "ocr-page",
      off: [],
      message: `Read by OCR (p. ${section.page}). What to do: check its numbers and names against the book.`,
    });

  const name = section.title.trim();
  // `Large Beast`, `Medium humanoid (any race), any alignment`, `Large Land Vehicle (10 ft. by 5 ft.)`.
  const typed = type.match(/^(tiny|small|medium|large|huge|gargantuan)\s+([^(,]+?)\s*(?:\(([^)]*)\))?\s*(?:,.*)?$/i);
  const kindWord = (typed?.[2] ?? "").trim();
  const isVehicle = /vehicle/i.test(type);
  const price = env.priceOf?.(name);
  const out = blank(isVehicle ? "vehicle" : "creature");
  // A picture set with the block is the entity's portrait, not part of its text.
  const portrait = lore.findIndex((b) => b.type === "image");
  const picture = portrait >= 0 ? (lore.splice(portrait, 1)[0] as Extract<Block, { type: "image" }>).file : "";
  const yaml = [`name: ${q(name)}`];
  if (picture) yaml.push(`image: ${q(`![[${picture}|384]]`)}`);
  if (isVehicle) {
    if (typed) yaml.push(`size: ${typed[1].charAt(0).toUpperCase()}${typed[1].slice(1).toLowerCase()}`);
    yaml.push(`type: ${q(kindWord || type)}`);
    if (typed?.[3]) yaml.push(`dimensions: ${q(typed[3])}`);
  } else {
    yaml.push(`type: ${q(type)}`);
    if (cr) yaml.push(`cr: ${q(cr)}`);
  }
  // What a mounts or vehicles table says of it: what it costs to buy or hire, and the like.
  for (const [k, v] of price?.fields ?? []) yaml.push(`${k}: ${q(v)}`);
  yaml.push("stats:", ...stats.map(([k, v]) => `  ${k}: ${/^pas_/.test(k) ? v : q(v)}`));
  yaml.push(
    "abilities:",
    ...["str", "dex", "con", "int", "wis", "cha"].map((k, i) => `  ${k}: ${abilities?.[i] ?? 0}`)
  );
  if (features.length) {
    yaml.push("features:");
    const share = env.shareTrait;
    if (share) {
      const group = isVehicle ? "Vehicle" : kindWord.replace(/\b\w/g, (c) => c.toUpperCase()) || "Creature";
      for (const f of features)
        yaml.push(
          `  - ref: ${q(share(group, name, { name: f.name, type: f.type, body: env.render(f.blocks, name) }))}`
        );
    } else {
      const dir = env.notePath.includes("/") ? env.notePath.slice(0, env.notePath.lastIndexOf("/")) : "";
      const cleanName = `${name.replace(/[\\/:|#^[\]]/g, " ")} Traits`;
      const placedAt = env.traitsAt?.(cleanName);
      const traitsDir = placedAt
        ? placedAt.slice(0, placedAt.lastIndexOf("/"))
        : dir
          ? `${dir}/Creature Traits`
          : "Creature Traits";
      const traitsName = env.unique(traitsDir, cleanName);
      const traitsRef = placedAt ? `${traitsDir}/${traitsName}` : `${env.book}/${traitsDir}/${traitsName}`;
      const taken = new Set<string>();
      const traitLines = ["---", "cssclasses:", "  - note-feature", "---", `# ${traitsName}`];
      for (const f of features) {
        let fname = f.name;
        for (let n = 2; taken.has(fname.toLowerCase()); n++) fname = `${f.name} (${n})`;
        taken.add(fname.toLowerCase());
        yaml.push(`  - ref: ${q(`@[[${traitsRef}]]#${fname}`)}`);
        traitLines.push(
          ...fenced(
            "feature.details",
            [`name: ${q(fname)}`, `type: ${f.type}`, "heading: p"],
            env.render(f.blocks, name)
          )
        );
      }
      out.files.push({
        path: `${traitsDir}/${traitsName}.md`,
        text: traitLines.join("\n") + "\n",
        outside: !!placedAt,
      });
    }
  }
  out.lines = isVehicle
    ? fenced("stat.vehicle", [...reviews.map(reviewLine), ...yaml], env.render(lore, name))
    : [...fenced("stat.monster", [...reviews.map(reviewLine), ...yaml], []), ...env.render(lore, name)];
  out.fields = [cssclass("note-statblock")];
  out.info = {
    type: isVehicle ? type : kindWord,
    steed: !!price && /mount|steed/i.test(price.list),
    tags: typed?.[3] ?? "",
    cr,
  };
  if (picture) out.portrait = picture;
  out.consumed = true;
  return out;
}

// ── Classes, subclasses, lineages, heritages, backgrounds, talents ────────

const LEVEL_NOTE = /^(\d+)(?:st|nd|rd|th)\b.*\bfeature$/i;

const ORDINAL = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
const bareName = (text: string) =>
  text
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "");

/** The level a feature's own text says it comes at: "Starting at 3rd level", "When you reach 7th level". */
function levelInText(section: Section): number | undefined {
  const text = section.blocks.slice(0, 2).map(plain).join(" ");
  const hit = text.match(
    /\b(?:at|starting at|beginning at|when you reach|once you reach|upon reaching|by|starting when you choose this \w+ at)\s+(\d+)(?:st|nd|rd|th)[- ]level\b/i
  );
  return hit ? Number(hit[1]) : undefined;
}

/**
 * The level each feature first comes at, read from the class's own table (the
 * one with a Level column and a Features column), by the feature's bare name.
 */
function levelsFromTable(sections: Section[]): Map<string, number> {
  const out = new Map<string, number>();
  const tables: Array<Extract<Block, { type: "table" }>> = [];
  const gather = (s: Section, depth: number) => {
    for (const b of s.blocks) if (b.type === "table") tables.push(b);
    if (depth < 4) s.children.forEach((c) => gather(c, depth + 1));
  };
  sections.forEach((s) => gather(s, 0));
  for (const table of tables) {
    const head = table.rows[0].map((h) => h.toLowerCase());
    const level = head.findIndex((h) => /level/.test(h));
    const features = head.findIndex((h) => /features?/.test(h));
    if (level < 0 || features < 0) continue;
    for (const row of table.rows.slice(1)) {
      const n = Number((row[level] ?? "").match(/\d+/)?.[0]);
      if (!n) continue;
      for (const name of (row[features] ?? "").split(/,\s*(?![^(]*\))/)) {
        const key = bareName(name);
        if (key && !out.has(key)) out.set(key, n);
      }
    }
  }
  return out;
}

interface FeatureInfo {
  /** The class or subclass the feature is of, for its subtitle. */
  owner?: string;
  levels?: Map<string, number>;
}

/** A section as one `feature.details` block: its name, the level it comes at when the book says, and its text. */
function featureBlock(section: Section, env: EntityEnv, info: FeatureInfo = {}): string[] {
  const yaml = [`name: ${q(section.title)}`];
  let blocks = section.blocks;
  const first = plain(blocks[0]);
  const stated = first.match(LEVEL_NOTE);
  if (stated && first.length < 90) {
    // The book says it on a line of its own: "3rd-Level Barbarian Feature".
    yaml.push(`subtitle: ${q(first)}`, `level: ${stated[1]}`);
    blocks = blocks.slice(1);
  } else if (/^prerequisites?\s*:/i.test(first) && first.length < 120) {
    yaml.push(`subtitle: ${q(first)}`);
    blocks = blocks.slice(1);
  } else {
    // Else the class's table knows, or the feature's first sentence does.
    const basic = /^(hit points|proficiencies|(starting )?equipment)$/i.test(section.title.trim());
    const level = basic ? undefined : (info.levels?.get(bareName(section.title)) ?? levelInText(section));
    if (level) {
      if (info.owner) yaml.push(`subtitle: ${q(`${ORDINAL(level)}-Level ${info.owner} Feature`)}`);
      yaml.push(`level: ${level}`);
    }
  }
  const body = env.render(blocks, section.title);
  for (const child of section.children) body.push(...env.inline(child, Math.min(6, env.depth + 2)));
  return fenced("feature.details", yaml, body);
}

/** Text first, then each subsection as a feature; a subsection that only groups others keeps its heading. */
function featureList(sections: Section[], env: EntityEnv, depth: number, info: FeatureInfo = {}): string[] {
  const out: string[] = [];
  for (const s of sections) {
    const looksFeature = s.blocks.length > 0 || !s.children.length;
    if (looksFeature) out.push(...featureBlock(s, env, info));
    else out.push(`${"#".repeat(Math.min(6, depth))} ${s.title}`, ...featureList(s.children, env, depth + 1, info));
  }
  return out;
}

/** How many of a section's parts say the level they come at, by a line of their own or in their first sentence. */
const leveledParts = (section: Section): number =>
  section.children.filter((c) => LEVEL_NOTE.test(plain(c.blocks[0])) || levelInText(c) !== undefined).length;

/** A section most of whose parts come at stated levels: a subclass's features. */
const isSubclassLike = (s: Section): boolean => s.children.length >= 2 && leveledParts(s) >= s.children.length / 2;

function klass(section: Section, env: EntityEnv): EntityOut | null {
  const container = section.children.find((c) => /^class features$/i.test(c.title));
  if (!container) return null;
  // A class's features open with its hit points and proficiencies, or come at stated levels; a rules
  // section that merely has a "Class Features" heading has neither.
  const basics = ["hit points", "proficiencies"].every((t) =>
    container.children.some((c) => c.title.toLowerCase() === t)
  );
  const stated = container.children.filter((c) => LEVEL_NOTE.test(plain(c.blocks[0]))).length;
  if (!basics && stated < 2) return null;
  const out = blank("class");
  const h = "#".repeat(Math.min(6, env.depth + 1));
  const info: FeatureInfo = { owner: section.title, levels: levelsFromTable([section]) };
  const sub = (s: Section) =>
    out.childNotes.push({
      section: s,
      fields: [[".SUBCLASS", `\n  parent_class: ${section.title}`], cssclass("note-feature")],
    });
  out.lines = env.render(section.blocks, section.title);
  let subclasses = false;
  for (const child of section.children) {
    if (subclasses) sub(child);
    else if (child === container) {
      out.lines.push(`${h} ${child.title}`, ...env.render(child.blocks, child.title));
      const features: Section[] = [];
      for (const part of child.children) {
        // A part the class's table does not list, whose own parts come at levels, is a subclass
        // set among the features (the SRD's "Path of the Berserker").
        const listed = info.levels?.has(bareName(part.title));
        // (Only where features do not state their level on a line of their own: there, a feature's parts do.)
        if (stated < 2 && !listed && isSubclassLike(part)) sub(part);
        else features.push(part);
      }
      out.lines.push(...featureList(features, env, env.depth + 2, info));
    } else if (/subclass(es)?$/i.test(child.title)) {
      out.lines.push(`${h} ${child.title}`, ...env.render(child.blocks, child.title));
      child.children.forEach(sub);
      subclasses = true;
    } else if (child.children.some(isSubclassLike)) {
      // A section after the features that holds the subclasses under a name of the class's own
      // ("Martial Archetypes", "Sacred Oaths").
      out.lines.push(`${h} ${child.title}`, ...env.render(child.blocks, child.title));
      for (const part of child.children) {
        if (isSubclassLike(part)) sub(part);
        else out.lines.push(...env.inline(part, env.depth + 2));
      }
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
  out.lines = [
    ...env.render(section.blocks, section.title),
    ...featureList(section.children, env, env.depth + 1, { owner: section.title }),
  ];
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
  // "Beastkin Lineage Traits", or the 5e "Dwarf Traits" under "Dwarf".
  const traits = section.children.find(
    (c) => /lineage traits$/i.test(c.title) || c.title.toLowerCase() === `${section.title.toLowerCase()} traits`
  );
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
  const loose = !!env.scanned || unmarked(section.blocks);
  const at = section.blocks.findIndex((b) => runIn(b) || (loose && !!leadName(b, true)));
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
  // A chapter can only be a class (a book that gives each class a chapter).
  if (!section.level) return klass(section, env);
  if (env.only === "creature") return creature(section, env);
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
  /** The folder for the table's items, or where each goes by its kind (then from the vault's root). */
  dir: string | ((kind: string, name: string) => string),
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
  let kind = table.caption ?? table.rows[0][0];
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
    const clean = name
      .replace(/[\\/:|#^[\]<>?*"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const placedAt = typeof dir === "function" ? dir(kind, clean) : undefined;
    const folder = placedAt ? placedAt.slice(0, placedAt.lastIndexOf("/")) : (dir as string);
    const file = unique(folder, clean);
    files.push({
      outside: !!placedAt,
      path: `${folder}/${file}.md`,
      text: ["---", "cssclasses:", "  - note-item", "---", `# ${name}`, ...fenced("item.element", yaml, []), ""].join(
        "\n"
      ),
    });
  }
  return files;
}

const tokens = (name: string) =>
  (name.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((w) => w !== "or" && w !== "and")
    .sort()
    .join(" ");

/** A name as a price list is looked up by: its words, in any order (`Horse, Riding` is `Riding horse`). */
export const priceKey = tokens;

/**
 * A table that prices things which are not carried (mounts, vehicles): a Cost
 * column and no Weight, Damage or Armor Class. Its rows are a summary of
 * stat blocks found elsewhere in the book, so each row's cost and other
 * columns are kept by name, to be written into the stat block they belong to.
 */
export function priceList(
  table: Extract<Block, { type: "table" }>
): Map<string, { list: string; fields: Array<[string, string]> }> {
  const out = new Map<string, { list: string; fields: Array<[string, string]> }>();
  const head = table.rows[0].map((h) => h.toLowerCase().trim());
  const cost = head.findIndex((h) => /^cost$|^price$/.test(h));
  const subject = `${table.caption ?? ""} ${head[0]}`;
  if (cost < 1 || !/mount|steed|vehicle|ship|companion|hireling/i.test(subject)) return out;
  if (head.some((h) => /^weight$|^damage$|armor class|^ac$/.test(h))) return out;
  for (const row of table.rows.slice(1)) {
    const name = (row[0] ?? "").trim();
    if (!name || !COIN.test(row[cost] ?? "")) continue;
    const fields: Array<[string, string]> = [["cost", row[cost]]];
    row.forEach((cell, i) => {
      if (i === 0 || i === cost || !cell.trim() || /^[—–-]$/.test(cell.trim()) || !head[i]) return;
      const key = head[i]
        .replace(/\(.*?\)/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      if (key) fields.push([key, cell]);
    });
    // `Donkey or mule` prices both.
    for (const part of name.split(/\s+or\s+/i)) out.set(tokens(part), { list: subject, fields });
  }
  return out;
}
