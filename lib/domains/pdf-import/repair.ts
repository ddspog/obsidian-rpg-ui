/**
 * A second look at a chapter's tables once all of its pages are read. A table that is cut across
 * columns and pages leaves pieces the page-by-page reading could not join: its rest further on, its
 * first part further back, rows read as paragraphs or a sidebar, lines of a wrapped cell read as rows
 * of their own. With the whole chapter at hand, the numbers of a table rolled on a die say what
 * belongs to it: the pieces whose numbers carry its count on are put back, and a number the book
 * itself skips is covered by the row before it, so that every roll lands on a row.
 */

import { rollRange } from "./blocks";
import { captionParts } from "./structure";
import type { Block, Span } from "./types";

type TableBlock = Extract<Block, { type: "table" }>;

const DICE = [2, 3, 4, 6, 8, 10, 12, 20, 30, 100, 1000];

/** How far on (or back) a table's other pieces may lie. */
const REACH_BLOCKS = 40;
const REACH_PAGES = 3;

export interface RepairReport {
  /** Pieces of tables put back: tables joined, and rows read as text. */
  joined: number;
  /** Lines of a wrapped cell that had been read as rows of their own. */
  folded: number;
  /** Rows widened over a number the book skips. */
  widened: number;
}

const plain = (spans: Span[]) => spans.map((s) => s.text).join("");

/** The rows of a table after its header, and whether most of them carry a roll's number. */
function numbered(table: TableBlock): boolean {
  const body = table.rows.slice(1);
  return body.length >= 2 && body.filter((r) => rollRange(r[0])).length >= 0.6 * body.length;
}

function firstNumber(table: TableBlock): number {
  for (const row of table.rows.slice(1)) {
    const r = rollRange(row[0]);
    if (r) return r[0];
  }
  return 0;
}

function lastNumber(table: TableBlock): number {
  for (let i = table.rows.length - 1; i > 0; i--) {
    const r = rollRange(table.rows[i][0]);
    if (r) return r[1];
  }
  return 0;
}

/** The die the table is rolled on: the one its header names, else the smallest that its numbers fit. */
export function dieFor(table: TableBlock): number {
  const named = table.rows[0].join(" ").match(/\b1?d(\d{1,4}|%)\b/i);
  const top = lastNumber(table);
  if (named) {
    const n = named[1] === "%" ? 100 : Number(named[1]);
    if (DICE.includes(n) && n >= top) return n;
  }
  return DICE.find((d) => d >= top) ?? top;
}

const isTableCaption = (caption: string | undefined) => !!captionParts(caption ?? "");

/** True when `piece` may be part of `table`: no caption of a table of its own (or the same one). */
function mayJoin(table: TableBlock, piece: TableBlock): boolean {
  if (piece.rows[0].length !== table.rows[0].length) return false;
  if (!isTableCaption(piece.caption)) return true;
  const a = captionParts(table.caption ?? "")?.number;
  return !!a && a === captionParts(piece.caption ?? "")?.number;
}

/** A piece's rows without a header: its first row, when it is not numbered, is a header (repeated or its own). */
function bodyOf(piece: TableBlock): string[][] {
  return rollRange(piece.rows[0][0]) ? piece.rows : piece.rows.slice(1);
}

const join = (a: string, b: string) => (!a ? b : !b ? a : a.endsWith("-") ? a.slice(0, -1) + b : `${a} ${b}`);

/** Lines of a wrapped cell read as rows of their own (no number) go back into the row above. */
function foldBlankRows(table: TableBlock): number {
  if (!numbered(table)) return 0;
  let folded = 0;
  const out: string[][] = [table.rows[0]];
  for (const row of table.rows.slice(1)) {
    const prev = out[out.length - 1];
    if (!row[0]?.trim() && out.length > 1 && rollRange(prev[0])) {
      row.forEach((cell, i) => {
        if (i) prev[i] = join(prev[i] ?? "", cell.trim());
      });
      folded++;
    } else out.push(row);
  }
  table.rows = out;
  return folded;
}

/**
 * Rows read as a paragraph: `**4** A cult of the deity…`, or `It was driven here **5** just now.`
 * when the number was set against the middle of its cell. Null unless the text holds the numbers
 * that carry the count on from `next`, one after another, and nothing else that looks like one.
 */
export function rowsFromText(text: string, next: number): string[][] | null {
  // (A number that names another table, `Tables 7-32 and 7-33:`, or a page, is not a row's.)
  const marks = [...text.matchAll(/(^|\s)\**(\d{1,4}(?:\s*[-–]\s*\d{1,4})?)\**(?=\s|$)/g)].filter((m) => {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 14), m.index ?? 0);
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 2);
    return !/(tables?|and|or|pages?|p\.|chapter|,)\s*$/i.test(before) && !/^[:,]/.test(after);
  });
  if (!marks.length) return null;
  const rows: string[][] = [];
  let expect = next;
  const found: Array<{ at: number; end: number; cell: string }> = [];
  for (const m of marks) {
    const r = rollRange(m[2]);
    if (!r || r[0] !== expect) return null;
    expect = r[1] + 1;
    const at = (m.index ?? 0) + m[1].length;
    found.push({ at, end: (m.index ?? 0) + m[0].length, cell: m[2].replace(/\s+/g, "") });
  }
  const before = text.slice(0, found[0].at).trim();
  if (found.length === 1) {
    rows.push([found[0].cell, `${before} ${text.slice(found[0].end).trim()}`.trim()]);
  } else {
    // With several, only rows whose number opens them can be told apart.
    if (before.replace(/\*/g, "").trim()) return null;
    found.forEach((f, i) => {
      const end = i + 1 < found.length ? found[i + 1].at : text.length;
      rows.push([f.cell, text.slice(f.end, end).trim()]);
    });
  }
  return rows.every((r) => r[1].replace(/\*/g, "").trim()) ? rows : null;
}

/** The paragraphs a block holds as text, for rows read as text. */
function texts(block: Block): string[] | null {
  if (block.type === "para") return [plain(block.spans)];
  if (block.type === "side" && block.blocks.every((b) => b.type === "para"))
    return block.blocks.map((b) => plain((b as Extract<Block, { type: "para" }>).spans));
  return null;
}

/** A table's rest, found further on in the chapter: tables, and text, whose numbers carry its count on. */
function joinOnwards(blocks: Block[], at: number): number {
  const table = blocks[at] as TableBlock;
  let joined = 0;
  let page = table.page;
  const die = dieFor(table);
  for (let k = at + 1; k < blocks.length && k <= at + REACH_BLOCKS; k++) {
    const next = lastNumber(table) + 1;
    if (!next || next > die) break;
    const b = blocks[k];
    if (b.page > page + REACH_PAGES) break;
    if (b.type === "table") {
      if (!mayJoin(table, b)) {
        // Another numbered table of its own stands in the way only once it is past this one's rest.
        if (isTableCaption(b.caption) && numbered(b)) break;
        continue;
      }
      const body = bodyOf(b);
      const first = rollRange(body[0]?.[0]);
      if (!first || first[0] !== next) continue;
      table.rows.push(...body);
      blocks.splice(k, 1);
      k--;
      page = b.page;
      joined++;
      continue;
    }
    // Rows read as text: only straight after the table, or after a piece of it just put back.
    const lines = texts(b);
    if (!lines || table.rows[0].length !== 2) continue;
    const rows: string[][] = [];
    let expect = next;
    for (const line of lines) {
      const got = rowsFromText(line, expect);
      if (!got) break;
      rows.push(...got);
      expect = (rollRange(got[got.length - 1][0]) as [number, number])[1] + 1;
    }
    if (!rows.length || rows.length < lines.length) continue;
    table.rows.push(...rows);
    blocks.splice(k, 1);
    k--;
    page = b.page;
    joined++;
  }
  return joined;
}

/**
 * A table's rest read before it (two halves side by side, the right one first): a table without a
 * caption a little way back on the same page, whose numbers carry this one's count on.
 */
function joinBehind(blocks: Block[], at: number): number {
  const table = blocks[at] as TableBlock;
  let joined = 0;
  for (let k = at - 1; k >= 0 && k >= at - 8; k--) {
    const b = blocks[k];
    if (b.page !== table.page) break;
    if (b.type !== "table" || isTableCaption(b.caption) || !mayJoin(table, b)) continue;
    const body = bodyOf(b);
    const first = rollRange(body[0]?.[0]);
    if (!first || first[0] !== lastNumber(table) + 1) continue;
    table.rows.push(...body);
    blocks.splice(k, 1);
    at--;
    joined++;
  }
  return joined;
}

/**
 * A table that starts past 1 whose first rows were read as short lines just above it (`1 Goblin` as
 * a heading, `2 Kobold` as a paragraph): they are read back into it, and the caption above them,
 * which those lines had kept from it, names it.
 */
function recoverHead(blocks: Block[], at: number): number {
  const table = blocks[at] as TableBlock;
  const first = firstNumber(table);
  if (first <= 1 || table.rows[0].length !== 2) return 0;
  const lines: Array<{ k: number; text: string }> = [];
  for (let k = at - 1; k >= 0 && k >= at - 8; k--) {
    const b = blocks[k];
    if (b.page !== table.page && b.page !== table.page - 1) break;
    const text = b.type === "heading" && !b.caption ? b.text : b.type === "para" ? plain(b.spans) : null;
    if (text === null || text.length > 160) break;
    lines.unshift({ k, text });
  }
  // The lines that count from 1 up to the table's first number, in order, at the end of those found.
  for (let start = 0; start < lines.length; start++) {
    const rows: string[][] = [];
    let expect = 1;
    let ok = true;
    for (const line of lines.slice(start)) {
      const got = rowsFromText(line.text, expect);
      if (!got) {
        ok = false;
        break;
      }
      rows.push(...got);
      expect = (rollRange(got[got.length - 1][0]) as [number, number])[1] + 1;
    }
    if (!ok || !rows.length || expect !== first) continue;
    const gone = lines.slice(start).map((l) => l.k);
    table.rows.splice(1, 0, ...rows);
    // The caption just above them (the header's labels may stand between) now names the table.
    const caption = [blocks[gone[0] - 1], blocks[gone[0] - 2]].find((b) => b?.type === "heading" && b.caption);
    if (caption?.type === "heading" && !isTableCaption(table.caption)) table.caption = caption.text;
    for (const k of gone.reverse()) blocks.splice(k, 1);
    return gone.length;
  }
  return 0;
}

/** A captioned table that starts past 1: its first part, a table without a caption a little way back. */
function joinBackwards(blocks: Block[], at: number): number {
  const table = blocks[at] as TableBlock;
  const first = firstNumber(table);
  if (first <= 1 || !isTableCaption(table.caption)) return 0;
  for (let k = at - 1; k >= 0 && k >= at - REACH_BLOCKS; k--) {
    const b = blocks[k];
    if (table.page - b.page > REACH_PAGES) break;
    if (b.type !== "table" || isTableCaption(b.caption) || b.rows[0].length !== table.rows[0].length) continue;
    if (firstNumber(b) !== 1 || lastNumber(b) + 1 !== first) continue;
    const head = rollRange(b.rows[0][0]) ? table.rows[0] : b.rows[0];
    table.rows = [head, ...bodyOf(b), ...table.rows.slice(1)];
    blocks.splice(k, 1);
    return 1;
  }
  return 0;
}

/**
 * A number the book skips (`5` then `7`, or `01-05` then `07-10`): the row before the gap is widened
 * over it, so the table can still be rolled. Only for a table whose count runs from 1 to its die's top.
 */
function widenGaps(table: TableBlock, strays: Set<number>): number {
  if (!numbered(table) || firstNumber(table) !== 1 || lastNumber(table) !== dieFor(table)) return 0;
  let widened = 0;
  let prev: { row: string[]; range: [number, number] } | null = null;
  for (const row of table.rows.slice(1)) {
    const r = rollRange(row[0]);
    if (!r) continue;
    // (A missing number found as stray text nearby is a row the reading lost, not one the book skips.)
    const lost =
      prev &&
      Array.from({ length: r[0] - prev.range[1] - 1 }, (_, i) => prev!.range[1] + 1 + i).some((n) => strays.has(n));
    if (prev && r[0] > prev.range[1] + 1 && !lost) {
      const width = String(row[0]).match(/^0\d/) ? 2 : 1;
      const pad = (n: number) => (n === 100 && width === 2 ? "00" : String(n).padStart(width, "0"));
      prev.row[0] = `${pad(prev.range[0])}-${pad(r[0] - 1)}`;
      widened++;
    }
    prev = { row, range: r };
  }
  return widened;
}

/** The chapter's tables, mended in place; what was done, for the book's notes. */
export function repairTables(blocks: Block[]): RepairReport {
  const report: RepairReport = { joined: 0, folded: 0, widened: 0 };
  for (const b of blocks) if (b.type === "table") report.folded += foldBlankRows(b);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== "table" || !numbered(b)) continue;
    const head = recoverHead(blocks, i);
    if (head) {
      report.joined += 1;
      i -= head;
    }
    const back = joinBackwards(blocks, i);
    if (back) {
      report.joined += back;
      i -= back;
    }
    const behind = isTableCaption(b.caption) && firstNumber(b) === 1 ? joinBehind(blocks, i) : 0;
    i -= behind;
    report.joined += behind + joinOnwards(blocks, i);
  }
  blocks.forEach((b, i) => {
    if (b.type !== "table") return;
    // Numbers standing alone in the text around the table.
    const strays = new Set<number>();
    for (const near of blocks.slice(Math.max(0, i - 6), i + 7)) {
      for (const text of near.type === "heading" ? [near.text] : (texts(near) ?? []))
        for (const m of text.matchAll(/(?:^|\s)\**(\d{1,3})(?:\s*[-–]\s*\d{1,3})?\**(?=\s|$)/g))
          strays.add(Number(m[1]));
    }
    report.widened += widenGaps(b, strays);
  });
  return report;
}
