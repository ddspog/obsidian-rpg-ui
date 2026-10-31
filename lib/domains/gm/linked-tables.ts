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
const MAX_SECTION_TABLES = 4;

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
 * `text` with every link to a table replaced by `<link text> (d<n> <roll>: <row>)`, the row itself
 * rolled through the same way. Links that aren't to a table stay as they are, as does a table
 * already on the chain (no loops).
 */
export function rollLinkedTables(
  text: string,
  fromFile: string,
  lookup: LinkedTableLookup,
  seed: string,
  depth = 0,
  chain: ReadonlySet<string> = new Set()
): string {
  if (depth >= MAX_DEPTH || !text.includes("[[")) return text;
  let nth = 0;
  return text.replace(HEADING_LINK, (whole, target: string, heading: string, alias: string | undefined) => {
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
      const row = resolveTableRoll(`x d100=${roll} ->`, table)
        .match(/->\s*(\S.*)$/)?.[1]
        ?.trim();
      if (!row) continue;
      const inner = rollLinkedTables(row, hit.file, lookup, `${seed}|${key}`, depth + 1, new Set([...chain, key]));
      // Several tables under one heading each say which they are.
      const name = hit.tables.length > 1 ? `${tableTitle(table)} ` : "";
      rolled.push(`${name}${dice.count > 1 ? dice.count : ""}d${dice.sides} ${roll}: ${inner}`);
    }
    if (rolled.length === 0) return whole;
    return `${(alias ?? heading).trim()} (${rolled.join("; ")})`;
  });
}

/** What a table is called: its caption without the book's number, else its block name. */
function tableTitle(table: TableDef): string {
  const caption = table.caption?.replace(/^Table\s+[\d.-]+\s*[:\-–]?\s*/i, "").trim();
  return caption || table.name;
}

/**
 * Index a note's tables by heading, for `rollLinkedTables`' lookup: each heading → the tables under
 * it, its own and its sub-headings' (a table's own heading, or a section such as "Beasts" with a few
 * tables). A section with more than four tables, or none, is left out.
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
  const out: Record<string, string[]> = {};
  heads.forEach((h, i) => {
    const end = heads.slice(i + 1).find((n) => n.level <= h.level)?.at ?? Infinity;
    const under = tables.filter((t) => t.at > h.at && t.at < end).map((t) => t.name);
    const key = headingKey(h.text);
    if (under.length > 0 && under.length <= MAX_SECTION_TABLES && !out[key]) out[key] = under;
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
