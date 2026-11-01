/**
 * A table row that sends you to another table ("Roll on Table 5-21", "Refer to
 * Table 7-28: Hill Theme Monster") is rolled through: each link to a table in
 * the rolled result is replaced by that table's own rolled row, and so on down
 * the chain. The GM reads one result instead of following links by hand.
 *
 * The follow-up rolls are seeded by the roll that led to them, so the same die
 * reads the same chain every time the Log is drawn; rerolling the die rolls the
 * chain anew. Pure: the caller supplies how a link finds its table.
 */

import { splitResultPicker } from "../session-log/choice";
import type { TableDef } from "../tables/types";
import { resolveTableRoll } from "./steps";

/** The tables a `[[target#heading]]` link points at, read from `fromFile`; undefined when it points at none. */
export type LinkedTableLookup = (
  fromFile: string,
  target: string,
  heading: string
) => { tables: TableDef[]; file: string } | undefined;

/** A wikilink to a heading: target (may be empty: this file), heading, alias. A `\|` alias works too. */
const HEADING_LINK = /\[\[([^\][#|]*)#([^\]|\\]+?)(?:\\?\|([^\]]*))?\]\]/g;

/** A section with more tables than this is a chapter, not a roll: its link stays a link. */
const MAX_SECTION_TABLES = 5;

/** How deep a chain is followed: a row that leads to a row that leads to a row. */
const MAX_DEPTH = 3;

/** A heading as Obsidian matches it in a link: case, spaces and punctuation don't count. */
export function headingKey(heading: string): string {
  return heading.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** A whole number in `1..sides` from a string: the same string, the same number. */
export function seededRoll(seed: string, sides: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // One step of mulberry32 spreads the hash over the range.
  let t = (h + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.floor(r * sides) + 1;
}

/** The dice a table is rolled with, from its header (`d20`, `3d6`), as the Log reads it; undefined when it has none. */
export function tableDice(table: TableDef): { count: number; sides: number } | undefined {
  const m = (table.columnLabels?.[0] ?? "").trim().match(/^(\d*)d(\d+)\*?$/i);
  if (!m) return undefined;
  return { count: m[1] ? Number(m[1]) : 1, sides: Number(m[2]) };
}

/**
 * `text` with every link to a table rolled: the link (and the "Refer to" that sent you there) leaves
 * the text, and each table it reached follows on its own line, `↳ <table>: <row> (d<n> <roll>)`,
 * the row itself rolled through the same way (its own lines indented under it). A rolled row of
 * alternatives takes one of them. A link that isn't to a table, or to a table already on the chain
 * (no loops), reads as its words: a result is plain text.
 */
export function rollLinkedTables(
  text: string,
  fromFile: string,
  lookup: LinkedTableLookup,
  seed: string,
  depth = 0,
  chain: ReadonlySet<string> = new Set()
): string {
  if (!text.includes("[[")) return text;
  if (depth >= MAX_DEPTH) return linkText(text);
  let nth = 0;
  const lines: string[] = [];
  const out = text.replace(HEADING_LINK, (whole, target: string, heading: string, alias: string | undefined) => {
    const hit = lookup(fromFile, target.trim(), heading.trim());
    if (!hit) return whole;
    const rolled: string[] = [];
    for (const table of hit.tables) {
      const key = `${hit.file}#${table.name}`;
      const dice = tableDice(table);
      if (chain.has(key) || !dice) continue;
      const at = nth++;
      let roll = 0;
      for (let d = 0; d < dice.count; d++) roll += seededRoll(`${seed}|${key}|${at}|${d}`, dice.sides);
      const raw = resolveTableRoll(`x d100=${roll} ->`, table)
        .match(/->\s*(\S.*)$/)?.[1]
        ?.trim();
      if (!raw) continue;
      const row = settlePicker(raw, `${seed}|${key}|${at}|pick`);
      const inner = rollLinkedTables(row, hit.file, lookup, `${seed}|${key}`, depth + 1, new Set([...chain, key]));
      // Each result is named by its table: "Hill Theme Fey: Many talking plants (d8 7)"; what it
      // rolled in turn sits indented under it.
      const name = hit.tables.length > 1 ? tableTitle(table) : linkName([alias, heading], table);
      const [first, ...more] = inner.split("\n");
      const die = `(${dice.count > 1 ? dice.count : ""}d${dice.sides} ${roll})`;
      rolled.push([`${LINE}${name}: ${first.replace(/\.\s*$/, "")} ${die}`, ...more.map((l) => `  ${l}`)].join("\n"));
    }
    if (rolled.length === 0) return whole;
    lines.push(...rolled);
    return ROLLED;
  });
  if (lines.length === 0) return linkText(out);
  // The instruction that sent you there ("Refer to", "Roll on", "See") has been done, and the words
  // that tied the links together ("and", a comma) have nothing left to tie: they go.
  const words = linkText(
    dropInstructionSentence(out.replace(INSTRUCTION, (m) => (m ? INSTRUCTED : "")))
      .replace(/(?:\s*(?:,|\band\b|&|\+)\s*)*\uE001(?:\s*(?:,|\band\b|&|\+)\s*(?=\uE001))*/gi, ROLLED)
      .replace(/\(\s*\uE001\s*\)|\[\s*\uE001\s*\]/g, "")
      .replace(/\uE001[\s.;:,]*$/, "")
      .replace(/\uE001/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s+([.,;:)])/g, "$1")
  )
    .replace(/[\s:]+$/, "")
    .replace(/^Tables?\s+\d+-\d+\s*:\s*/i, "")
    .trim();
  return [words, ...lines].filter(Boolean).join("\n");
}

/** Marks where an instruction ("Refer to") began, so its whole sentence can go. */
const INSTRUCTED = "\uE004";

/**
 * "Refer to Tables 7-24: … and 7-25: …." or "Roll on the Default Benefits … Table." is an
 * instruction, done once its tables are rolled: the whole sentence goes.
 */
function dropInstructionSentence(text: string): string {
  // Each sentence that held a rolled link and tells you to go somewhere ("Refer to …", "Roll on
  // the … Table.", "You can use …") has been done: it goes whole, the names around its links too.
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .filter((s) => !(s.includes(ROLLED) && (s.includes(INSTRUCTED) || GO_TO.test(s))))
    .join(" ")
    .replace(new RegExp(INSTRUCTED, "g"), "");
}

/** Words that send you to another table. */
const GO_TO = /\b(?:refer to|roll (?:once |twice |again )?on|see|go to|consult|use)\b/i;

/** How a table rolled through a link starts its line. */
const LINE = "↳ ";

/** Marks where a link was rolled, so the instruction in front of it can go. */
const ROLLED = "\uE001";

/** "Refer to", "Roll once on", "See", "go to" (and a "Table" or *Nomicon* after them) right before a rolled link. */
const INSTRUCTION =
  /(?:\b(?:refer to|roll (?:once |twice )?on(?: either column of)?|see|go to|consult)\s+(?:the\s+)?(?:\*?Nomicon\*?\s+)?)?(?:\bTables?\s+)?(?=\uE001)/gi;

/** A rolled table's name from its link: "Table 7-26: Hill Theme Fey" → Hill Theme Fey; for a bare "Table 5-21", the heading's words, else its caption. */
function linkName(texts: Array<string | undefined>, table: TableDef): string {
  for (const text of texts) {
    const name = (text ?? "")
      .trim()
      .replace(/^Tables?\s+[\d.-]+\s*[:,\-–]?\s*/i, "")
      .replace(/^\d+[:.]?\s+/, "")
      .trim();
    if (/\p{L}/u.test(name)) return name;
  }
  return tableTitle(table);
}

/** A rolled row of alternatives (`{a/b/c - }`) inside a chain: one of them, rolled, as the chain has no picker of its own. */
function settlePicker(row: string, seed: string): string {
  const { before, after, picker } = splitResultPicker(row);
  if (!picker) return row;
  const word = picker.selected || picker.options[seededRoll(seed, picker.options.length) - 1];
  return [before, word, after].filter(Boolean).join(" ");
}

/** Where a dropped link was, so the space before it goes too (a private-use character no row has). */
const DROPPED = "\uE000";

/** The links a chain did not follow, as the words they show: the alias, else the heading; a bare 🔗 goes. */
function linkText(text: string): string {
  return (
    text
      .replace(HEADING_LINK, (_whole, _target: string, heading: string, alias: string | undefined) => {
        const shown = (alias ?? heading.replace(/^\^\S*$/, "")).trim();
        return /^[\p{L}\p{N}]/u.test(shown) ? shown : DROPPED;
      })
      .replace(/[ \t]*\uE000/g, "")
      // A link to a whole note reads as its words too: its alias, else the note's name.
      .replace(/\[\[([^\][|#]+)(?:\\?\|([^\]]*))?\]\]/g, (_w, target: string, alias: string | undefined) =>
        (alias ?? target.split("/").pop() ?? target).trim()
      )
      .trim()
  );
}

/** What a table is called: its caption without the book's number, else its block name. */
function tableTitle(table: TableDef): string {
  const caption = table.caption?.replace(/^Table\s+[\d.-]+\s*[:\-–]?\s*/i, "").trim();
  return caption || table.name;
}

/**
 * Index a note's tables by heading, for `rollLinkedTables`' lookup: each heading → the tables under
 * it, its own and its sub-headings' (a table's own heading, or a section such as "Beasts" with a few
 * tables). A section that opens with its own table, named as the section is, gives that table
 * alone; any other with more than five tables, or none, is left out.
 */
export function tableHeadings(contents: string): Record<string, string[]> {
  const heads: Array<{ at: number; level: number; text: string }> = [];
  const tables: Array<{ at: number; name: string }> = [];
  let fence = false;
  contents.split("\n").forEach((line, at) => {
    const tick = line.match(/^(`{3,})(.*)$/);
    if (tick) {
      const m = !fence && tick[2].match(/^rpg\s+table\.(\S+)/);
      if (m) tables.push({ at, name: m[1] });
      fence = !fence;
      return;
    }
    const h = !fence && line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (h) heads.push({ at, level: h[1].length, text: h[2] });
  });
  // The heading right above a table names it ("Table 11-48: To Explain a Sleeping God").
  const ownHeading = (t: { at: number }) => [...heads].reverse().find((h) => h.at < t.at);
  const out: Record<string, string[]> = {};
  heads.forEach((h, i) => {
    const end = heads.slice(i + 1).find((n) => n.level <= h.level)?.at ?? Infinity;
    const inside = tables.filter((t) => t.at > h.at && t.at < end);
    const key = headingKey(h.text);
    if (inside.length === 0 || out[key]) return;
    // A section that opens with its own table (named as the section is) rolls that one: the
    // tables after it are what that one leads to, not more to roll now.
    const first = ownHeading(inside[0]);
    const named = first && first !== h && headingKey(first.text).replace(/^tables?\d+/, "") === key;
    if (named && inside.length > 1) out[key] = [inside[0].name];
    else if (inside.length <= MAX_SECTION_TABLES) out[key] = inside.map((t) => t.name);
  });
  return out;
}

/** The `[[target#heading]]` links in a table's cells: each target ('' for the table's own note). */
export function linkTargets(table: TableDef): string[] {
  const out = new Set<string>();
  for (const row of table.rows)
    for (const cell of row.cells) for (const m of cell.value.matchAll(HEADING_LINK)) out.add(m[1].trim());
  return [...out];
}
