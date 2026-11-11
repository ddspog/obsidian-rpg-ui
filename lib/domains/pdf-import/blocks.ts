/**
 * Lines in reading order typed into blocks: headings, paragraphs, lists,
 * tables and sidebars. Paragraphs run on across columns and pages.
 */

import { lineSpans, lineText, segText } from "./layout";
import { FACT_LINE, opensEntity } from "./patterns";
import { captionParts, titleCase } from "./structure";
import { family, styleKey, type StyleBook } from "./styles";
import type { Block, Box, Element, Line, Seg, Span } from "./types";

const BULLET = /^\s*([•●▪■◦‣○❖✦♦◆➤▶·∙]|\d{1,2}[.)](?=\s))\s*/;
const ENDS = /[.!?:;"”’)\]]$/;

/** A soft hyphen marks a word broken across lines, to be settled once the book's words are known. */
export const SOFT = "­";

const plain = (spans: Span[]) => spans.map((s) => s.text).join("");

function pushSpans(into: Span[], more: Span[]): void {
  for (const s of more) {
    const last = into[into.length - 1];
    if (last && last.bold === s.bold && last.italic === s.italic) last.text += s.text;
    else into.push({ ...s });
  }
}

/** Adds a line's text to a paragraph's, with a space, or mending a word broken at the line's end. */
function appendLine(into: Span[], spans: Span[]): void {
  const last = into[into.length - 1];
  const first = spans[0];
  if (!last || !first) return pushSpans(into, spans);
  if (/[A-Za-zÀ-ÿ]-$/.test(last.text) && /^[a-zà-ÿ]/.test(first.text)) {
    last.text = last.text.slice(0, -1) + SOFT;
  } else if (!/\s$/.test(last.text)) {
    last.text += " ";
  }
  pushSpans(into, spans);
}

interface Column {
  x0: number;
  x1: number;
}

/** A table's columns: the strips of the box that (nearly) every row leaves empty lie between them. */
function tableColumns(lines: Line[], x: number, w: number): Column[] {
  const width = Math.ceil(w) + 2;
  const cover = new Array<number>(width + 1).fill(0);
  const rows = lines.filter((l) => !(l.cells.length === 1 && l.cells[0].w > 0.6 * w));
  for (const line of rows) {
    for (const c of line.cells) {
      const a = Math.max(0, Math.floor(c.x - x));
      const b = Math.min(width, Math.ceil(c.x + c.w - x));
      for (let i = a; i <= b; i++) cover[i]++;
    }
  }
  const limit = Math.floor(0.1 * rows.length);
  const cols: Column[] = [];
  let start = -1;
  let gap = 0;
  for (let i = 0; i <= width + 1; i++) {
    const inked = i <= width && cover[i] > limit;
    if (inked) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap >= 3 || i > width) {
        cols.push({ x0: x + start, x1: x + i - gap + 1 });
        start = -1;
        gap = 0;
      }
    }
  }
  return cols;
}

const cellMd = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Rows of a table whose numbers are set against the middle of cells of several lines: each line
 * belongs to the number nearest it. Null for any other table (numbers on a row's first line, or none).
 */
function centredRows(body: Line[], place: (line: Line) => string[], headBottom?: number): string[][] | null {
  const inHead = (l: Line) => headBottom !== undefined && l.base - l.size / 3 <= headBottom + 1;
  const placed = body.map((line) => ({ line, cells: place(line), head: inHead(line) }));
  let rest = placed.filter((p) => !p.head);
  const head = placed.filter((p) => p.head);
  // Without a header strip, a first line of labels is the header.
  if (!head.length && rest[0] && !rollRange(rest[0].cells[0]) && rest[0].cells.filter(Boolean).length >= 2) {
    head.push(rest[0]);
    rest = rest.slice(1);
  }
  const anchors = rest.filter((p) => rollRange(p.cells[0]));
  if (anchors.length < 3) return null;
  // Text above the first number, close to it, is what tells such a table from one set top to top.
  // (A wrapped line at the foot of a row set top to top also has a number under it, but sits
  // nearer the line above it than that number.)
  const above = rest.filter((p, i) => {
    const next = rest[i + 1];
    const prev = rest[i - 1];
    if (p.cells[0] || !next || !rollRange(next.cells[0])) return false;
    const down = next.line.base - p.line.base;
    return down <= 1.7 * p.line.size && (!prev || p.line.base - prev.line.base > down + 1);
  });
  if (!above.length) return null;
  const merge = (lines: typeof placed): string[] => {
    const out: string[] = [];
    for (const { cells } of [...lines].sort((a, b) => a.line.base - b.line.base))
      cells.forEach((c, i) => {
        if (!c) return;
        out[i] = out[i] ? (out[i].endsWith("-") ? out[i].slice(0, -1) + c : `${out[i]} ${c}`) : c;
      });
    return Array.from({ length: lines[0]?.cells.length ?? 0 }, (_, i) => out[i] ?? "");
  };
  // Column by column: lines a leading apart are one cell, and a cell is the row's whose number
  // stands nearest its middle (rows differ in height, so a line alone cannot be told by its place).
  const width = rest[0].cells.length;
  const rows = anchors.map((a) => Array.from({ length: width }, (_, i) => (i === 0 ? a.cells[0] : "")));
  const join = (a: string, b: string) => (a ? (a.endsWith("-") ? a.slice(0, -1) + b : `${a} ${b}`) : b);
  for (let col = 1; col < width; col++) {
    const lines = rest.filter((p) => p.cells[col]).sort((a, b) => a.line.base - b.line.base);
    const gaps = lines.slice(1).map((p, i) => p.line.base - lines[i].line.base);
    const leading = Math.min(...gaps.filter((g) => g > 2), 1.5 * (lines[0]?.line.size ?? 9));
    let cell: typeof lines = [];
    const close = () => {
      if (!cell.length) return;
      const mid = (cell[0].line.base + cell[cell.length - 1].line.base) / 2;
      let best = 0;
      anchors.forEach((a, i) => {
        if (Math.abs(a.line.base - mid) < Math.abs(anchors[best].line.base - mid)) best = i;
      });
      for (const p of cell) rows[best][col] = join(rows[best][col], p.cells[col]);
      cell = [];
    };
    lines.forEach((p, i) => {
      if (i && gaps[i - 1] > 1.2 * leading + 0.5) close();
      cell.push(p);
    });
    close();
  }
  return head.length ? [merge(head), ...rows] : rows;
}

/** Rows of cells from a table's lines; a line that only carries on the row above is folded into it. */
export function tableRows(
  lines: Line[],
  x: number,
  w: number,
  headBottom?: number
): { rows: string[][]; title?: string } {
  let title: string | undefined;
  let body = lines;
  const first = body[0];
  // A lone first line in the header strip is the top of a two-line header, not the table's title.
  const inHeadStrip = first && headBottom !== undefined && first.base - first.size / 3 <= headBottom + 1;
  if (
    first &&
    !inHeadStrip &&
    first.cells.length === 1 &&
    body.length > 2 &&
    body[1].cells.length > 1 &&
    first.cells[0].w < 0.9 * w
  ) {
    const text = lineText(first);
    if (text.length <= 70 && !ENDS.test(text.replace(/[)"”’]$/, "x"))) {
      title = text;
      body = body.slice(1);
    }
  }
  const cols = tableColumns(body, x, w);
  if (cols.length < 2) return { rows: body.map((l) => [lineText(l)]), title };
  const placeRaw = (line: Line): string[] => {
    const out = cols.map(() => "");
    for (const cell of line.cells) {
      const mid = cell.x + Math.min(cell.w / 2, 12);
      let idx = cols.findIndex((c) => mid >= c.x0 - 2 && mid <= c.x1 + 2);
      if (idx < 0) {
        // Between two columns: the nearer one.
        idx = cols.reduce((best, c, i) => (Math.abs(c.x0 - cell.x) < Math.abs(cols[best].x0 - cell.x) ? i : best), 0);
      }
      out[idx] = out[idx] ? `${out[idx]} ${segText(cell)}` : segText(cell);
    }
    return out;
  };
  // A range broken in a narrow first column (`45-` over `50`) is one number, on its second line.
  const placed = new Map(body.map((l) => [l, placeRaw(l)]));
  for (let i = 0; i + 1 < body.length; i++) {
    const cells = placed.get(body[i]) as string[];
    if (!/^\d{1,4}\s*[-–—]$/.test(cells[0])) continue;
    const under = body.slice(i + 1, i + 3).find((l) => /^\d{1,4}$/.test((placed.get(l) as string[])[0]));
    if (!under || under.base - body[i].base > 2.4 * under.size) continue;
    (placed.get(under) as string[])[0] = `${cells[0].replace(/\s+/g, "")}${(placed.get(under) as string[])[0]}`;
    cells[0] = "";
  }
  body = body.filter((l) => (placed.get(l) as string[]).some(Boolean));
  const place = (line: Line): string[] => placed.get(line) ?? placeRaw(line);
  const gaps: number[] = [];
  for (let i = 1; i < body.length; i++) gaps.push(body[i].base - body[i - 1].base);
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0;
  const centred = centredRows(body, place, headBottom);
  if (centred) return { rows: centred.map((r) => r.map(cellMd)), title };
  const rows: string[][] = [];
  let headDone = headBottom === undefined;
  let prev: Line | undefined;
  // A row that opened with a wrapped cell's first line, its number still to come on the line below
  // (the number is set against the middle of a cell of two or three lines).
  let awaiting = false;
  const numbered = body.filter((l) => rollRange(place(l)[0])).length >= 0.4 * body.length;
  for (const line of body) {
    const cells = place(line);
    if (awaiting && prev && cells[0] && line.base - prev.base <= 1.3 * line.size) {
      const row = rows[rows.length - 1];
      cells.forEach((c, i) => {
        if (c) row[i] = row[i] ? (row[i].endsWith("-") ? row[i].slice(0, -1) + c : `${row[i]} ${c}`) : c;
      });
      awaiting = false;
      prev = line;
      continue;
    }
    const inHead = headBottom !== undefined && line.base - line.size / 3 <= headBottom + 1;
    const dy = prev ? line.base - prev.base : Infinity;
    const filled = cells.filter(Boolean).length;
    const tight = dy < 0.85 * median || dy <= 1.3 * line.size;
    let carries = false;
    if (rows.length && inHead && !headDone) carries = true;
    else if (rows.length && headDone && prev && !(headBottom !== undefined && rows.length === 1)) {
      if (!cells[0] && tight) carries = true;
      else if (filled < Math.ceil(cols.length / 2) && dy < 0.85 * median) carries = true;
    }
    if (!inHead) headDone = true;
    if (carries) {
      const row = rows[rows.length - 1];
      cells.forEach((c, i) => {
        if (!c) return;
        row[i] = row[i] ? (row[i].endsWith("-") ? row[i].slice(0, -1) + c : `${row[i]} ${c}`) : c;
      });
    } else {
      rows.push(cells);
      awaiting = numbered && headDone && !inHead && !cells[0];
    }
    prev = line;
  }
  return { rows: rows.map((r) => r.map(cellMd)), title };
}

interface ParaState {
  spans: Span[];
  lines: Line[];
  page: number;
}

export interface BlockOptions {
  styles: StyleBook;
  /** Where a picture's file is, by its key; pictures without one are left out. */
  headings?: boolean;
}

/** Whether `cur` starts a new paragraph after `prev`, the last line of a paragraph of `count` lines. */
function breaksPara(prev: Line, cur: Line, count: number, styles: StyleBook, first: Line = prev): boolean {
  const prevText = lineText(prev);
  const jumped = cur.page !== prev.page || cur.base < prev.base - 1 || Math.abs(cur.colL - prev.colL) > 12;
  if (Math.abs(cur.size - prev.size) > 0.8) return true;
  // A fact of a stat block or a spell, and the line that opens an entity's facts, each stand alone.
  const curText = lineText(cur);
  if (FACT_LINE.test(curText) || opensEntity(curText) || opensEntity(prevText)) return true;
  if (FACT_LINE.test(prevText) && prev.r < prev.colL + 0.75 * (prev.colR - prev.colL) && /^[A-ZÀ-Ý]/.test(curText))
    return true;
  if (jumped) {
    if (cur.x - cur.colL > 2.5) return true;
    // A column that opens with a run-in name (`Echolocation.`) opens a paragraph.
    const lead = cur.cells[0].spans[0];
    if (lead && (lead.bold || lead.italic) && /[.:]\s*$/.test(lead.text) && cur.cells[0].spans.length > 1) return true;
    return ENDS.test(prevText) && !/^[a-zà-ÿ]/.test(lineText(cur));
  }
  const dy = cur.base - prev.base;
  const lead = styles.leading * (cur.size / styles.bodySize);
  // OCR's baselines and edges waver: only a clear gap or indent counts there.
  const loose = cur.font.startsWith("ocr");
  const nudge = loose ? 6 : 2.5;
  if (dy > lead * (loose ? 1.45 : 1.13)) return true;
  const allItalic = (l: Line) => l.cells.every((c) => c.spans.every((s) => s.italic));
  if (allItalic(prev) !== allItalic(cur) && (ENDS.test(prevText) || allItalic(prev))) return true;
  const firstSpan = cur.cells[0].spans[0];
  if (
    (firstSpan?.bold || firstSpan?.italic) &&
    /[.:]\s*$/.test(firstSpan.text) &&
    ENDS.test(prevText) &&
    cur.cells[0].spans.length > 1
  )
    return true;
  // A line that opens with a bold label (`Range:`) after a line that stopped short: a list of facts.
  if (
    firstSpan?.bold &&
    /:\s*$/.test(firstSpan.text) &&
    cur.cells[0].spans.length > 1 &&
    cur.x <= prev.x + 0.5 &&
    prev.r < prev.colR - 0.2 * (prev.colR - prev.colL)
  )
    return true;
  // Facts under one another (`Armor:`, `Weapons:`, `Tools:`): a line that opens with a label at the
  // margin, in a paragraph that itself opened with one there, is the next fact.
  const opener = first.cells[0].spans[0];
  if (
    firstSpan?.bold &&
    /:\s*$/.test(firstSpan.text) &&
    cur.cells[0].spans.length > 1 &&
    opener?.bold &&
    /:\s*$/.test(opener.text) &&
    Math.abs(cur.x - first.x) <= 0.6 &&
    cur.page === first.page
  )
    return true;
  const ended = ENDS.test(prevText) && prev.r < prev.colR - 0.25 * (prev.colR - prev.colL);
  // A line set in from the one before opens a paragraph when that one closed its sentence; if it
  // did not, the line hangs under it (a fact that wraps). A line set back out carries on a
  // paragraph that opened with an indent, and ends one whose lines were hanging.
  if (cur.x > prev.x + nudge) return ENDS.test(prevText) || ended;
  if (cur.x < prev.x - nudge) return count >= 2 && ENDS.test(prevText);
  const short = prev.r < prev.colL + 0.6 * (prev.colR - prev.colL);
  // A short line that opened with a label (`Duration: 24 hours`) is a fact; the sentence under it is text.
  const label = prev.cells[0].spans[0];
  if (short && count === 1 && label?.bold && /:\s*$/.test(label.text) && /^[A-ZÀ-Ý]/.test(lineText(cur))) return true;
  return ENDS.test(prevText) && short;
}

type TableBlock = Extract<Block, { type: "table" }>;
type HeadingBlock = Extract<Block, { type: "heading" }>;

/** The first and last number a row is rolled on (`7`, `01-05`, `96–00`), or null when its first cell is not one. */
export function rollRange(cell: string | undefined): [number, number] | null {
  const hit = (cell ?? "").trim().match(/^(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?$/);
  if (!hit) return null;
  const num = (t: string) => (/^0+$/.test(t) ? 10 ** t.length : Number(t));
  const lo = num(hit[1]);
  return [lo, hit[2] ? num(hit[2]) : lo];
}

/** True when `rows` carry on where `prev` stopped: its numbers go on counting from the last row's. */
function carriesOn(prev: TableBlock, rows: string[][]): boolean {
  const last = rollRange(prev.rows[prev.rows.length - 1]?.[0]);
  if (!last) return false;
  const first = rollRange(rows[0]?.[0]) ?? rollRange(rows[1]?.[0]);
  return !!first && first[0] === last[1] + 1;
}

/** `Table 2-4: Eldritch God Names continued` → `2-4`; empty for a caption that does not say it carries on. */
function continuedNumber(text: string | undefined): string {
  if (!text || !/\(?\bcont(inued|['’]?d|\.)\)?\s*$/i.test(text)) return "";
  return captionParts(text)?.number ?? "";
}

/**
 * Adds a table's rows to the blocks: onto the table before it when it is that table going on in
 * the next column or page (its header repeated, its caption saying `continued`, or its numbers
 * counting on), else as a table of its own, named by the caption set above it.
 */
function pushTable(out: Block[], table: TableBlock): void {
  const { rows } = table;
  if (!rows.length) return;
  // A row cut by the page's end: its last words open the next page, above the rest of the table.
  const tail = out[out.length - 1];
  const before = out[out.length - 2];
  if (tail?.type === "para" && before?.type === "table" && tail.page === table.page && before.page < table.page) {
    const text = tail.spans
      .map((sp) => sp.text)
      .join("")
      .trim();
    const last = before.rows[before.rows.length - 1];
    const cell = last[last.length - 1] ?? "";
    if (/^[a-zà-ÿ(]/.test(text) && text.length <= 140 && cell && !/[.!?]$/.test(cell) && carriesOn(before, rows)) {
      last[last.length - 1] = `${cell} ${text}`;
      out.pop();
    }
  }
  const prev = out[out.length - 1];
  const again = continuedNumber(table.caption);
  if (prev?.type === "table" && prev.rows[0]?.length === rows[0]?.length) {
    const sameHead = rows[0].join("|") === prev.rows[0].join("|");
    const named = !!table.caption && !again && table.caption !== prev.caption;
    if (!named && (sameHead || again || carriesOn(prev, rows))) {
      prev.rows.push(...rows.slice(sameHead ? 1 : 0));
      return;
    }
  }
  if (again) {
    // The table's first part lies further back (a picture or a note between): found by its number.
    for (let k = out.length - 1; k >= Math.max(0, out.length - 12); k--) {
      const b = out[k];
      if (b.type !== "table" || captionParts(b.caption ?? "")?.number !== again) continue;
      const sameHead = rows[0].join("|") === b.rows[0].join("|");
      if (b.rows[0].length === rows[0].length) {
        b.rows.push(...rows.slice(sameHead ? 1 : 0));
        return;
      }
      break;
    }
    table.caption = table.caption?.replace(/[\s,(]*\bcont(inued|['’]?d|\.)\)?\s*$/i, "");
  }
  const over = out[out.length - 1];
  if (
    !table.caption &&
    over?.type === "heading" &&
    !over.caption &&
    over.page === table.page &&
    over.text.length <= 60
  ) {
    // A table set straight under a heading is what the heading names.
    table.caption = titleCase(over.text);
  }
  if (!table.caption) {
    // The caption set above the table, with a few lines of how to use it between the two.
    for (let k = out.length - 1; k >= Math.max(0, out.length - 8); k--) {
      const b = out[k];
      if (b.type === "table" || b.type === "side" || (b.type === "heading" && !b.caption)) break;
      if (b.type !== "heading") continue;
      if (!(b as HeadingBlock & { used?: boolean }).used) {
        table.caption = b.text;
        (b as HeadingBlock & { used?: boolean }).used = true;
      }
      break;
    }
  }
  out.push(table);
}

/** Blocks from one stretch of the book (a chapter's pages, or the inside of a box). */
export function toBlocks(elements: Element[], opts: BlockOptions): Block[] {
  const { styles } = opts;
  const out: Block[] = [];
  const lines = elements.map((el) => (el.kind === "line" ? el.line : undefined));
  let para: ParaState | null = null;
  let list: { block: Extract<Block, { type: "list" }>; bulletX: number; last: Line } | null = null;
  let pendingImages: Block[] = [];
  let lastHeading: { line: Line; block: Extract<Block, { type: "heading" }> } | null = null;
  let lastParaLine: Line | null = null;

  const flushPara = () => {
    if (para) {
      // A lone capital is a divider in an alphabetical list (or a drop cap's shadow): not text.
      if (plain(para.spans).trim().length > 1) out.push({ type: "para", spans: para.spans, page: para.page });
      lastParaLine = para.lines.length === 1 ? para.lines[0] : null;
      para = null;
    }
    if (pendingImages.length) {
      out.push(...pendingImages);
      pendingImages = [];
    }
  };
  const flushList = () => {
    list = null;
  };
  const flush = () => {
    flushPara();
    flushList();
  };

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.kind === "image") {
      const image = el.image;
      if (!image.file) continue;
      const block: Block = {
        type: "image",
        file: image.file,
        page: el.page,
        wide: image.w > 1.25 * el.colW || image.w > 380,
        pxW: image.pxW,
        pxH: image.pxH,
      };
      if (para || list) pendingImages.push(block);
      else out.push(block);
      continue;
    }
    if (el.kind === "box") {
      const box = el.box as Box & { tabular?: boolean };
      // A paragraph may run on under the box; it is closed here and picked up again after.
      const open = para;
      if (box.tabular) {
        const { rows, title } = tableRows(box.lines, box.x, box.w, box.headBottom);
        let caption = title;
        const above = open && open.lines.length === 1 ? open.lines[0] : !open ? lastParaLine : null;
        if (!caption && above && above.page === box.page) {
          const text = lineText(above);
          const near = box.y - above.base < 24 && box.y - above.base > -4;
          const looks =
            text.length <= 70 &&
            !/[.;,]$/.test(text) &&
            (above.size < styles.bodySize * 0.98 ||
              text === text.toUpperCase() ||
              above.cells[0].spans.every((s) => s.bold));
          if (near && looks) {
            caption = text;
            if (open) para = null;
            else if (out[out.length - 1]?.type === "para") out.pop();
          }
        }
        flush();
        pushTable(out, { type: "table", caption, rows, page: box.page });
      } else {
        flush();
        const inner = sideBlocks(box, styles);
        const letters = inner.blocks.reduce(
          (n, b) => n + (b.type === "para" ? plain(b.spans).length : b.type === "list" ? 40 : 40),
          0
        );
        // A box with next to nothing in it is a form's field or a label on a diagram.
        if (letters >= 40) out.push({ type: "side", title: inner.title, blocks: inner.blocks, page: box.page });
      }
      lastHeading = null;
      lastParaLine = null;
      continue;
    }

    const line = el.line;
    const prevLine = lines[i - 1];
    const nextLine = lines[i + 1];
    let level = opts.headings === false ? 0 : styles.headingLevel(line, prevLine, nextLine);
    // A table's caption (`Table 2-3: Creator Deity Epithet`), set bold on a line of its own.
    const captioned =
      opts.headings !== false &&
      line.cells.length === 1 &&
      !!captionParts(lineText(line)) &&
      lineText(line).length <= 110 &&
      (level > 0 || line.cells[0].spans.every((sp) => sp.bold));
    if (captioned && !level) level = 9;
    if (level) {
      flush();
      const text = lineText(line);
      const key = styleKey(line);
      if (
        lastHeading &&
        lastHeading.block.style === key &&
        line.page === lastHeading.line.page &&
        line.base - lastHeading.line.base < 1.6 * line.size &&
        line.base > lastHeading.line.base &&
        out[out.length - 1] === lastHeading.block
      ) {
        lastHeading.block.text += " " + text;
        lastHeading.line = line;
      } else {
        const block: Extract<Block, { type: "heading" }> = {
          type: "heading",
          level,
          text,
          page: line.page,
          style: key,
        };
        if (captioned) block.caption = true;
        out.push(block);
        lastHeading = { line, block };
      }
      continue;
    }
    lastHeading = null;

    // Rows of cells without shading behind them: a plain table.
    if (line.cells.length >= 2 && !BULLET.test(lineText(line))) {
      let j = i;
      const run: Line[] = [];
      while (j < elements.length) {
        const l = lines[j];
        if (!l || l.page !== line.page || Math.abs(l.colL - line.colL) > 12) break;
        if (run.length && l.base - run[run.length - 1].base > 2.6 * l.size) break;
        if (l.cells.length < 2 && !(run.length && (lines[j + 1]?.cells.length ?? 0) >= 2 && l.x > line.x + 4)) break;
        if (styles.headingLevel(l, lines[j - 1], lines[j + 1])) break;
        run.push(l);
        j++;
      }
      // (Facts of a stat block or a spell under one another are not a table, however their words are spaced.)
      if (run.filter((l) => l.cells.length >= 2).length >= 3 && !run.some((l) => FACT_LINE.test(lineText(l)))) {
        flush();
        const x = Math.min(...run.map((l) => l.x));
        const r = Math.max(...run.map((l) => l.r));
        const { rows } = tableRows(run, x, r - x);
        if (rows[0]?.length >= 2) {
          pushTable(out, { type: "table", rows, page: line.page });
          i = j - 1;
          lastParaLine = null;
          continue;
        }
      }
    }

    const text = lineText(line);
    const bullet = text.match(BULLET);
    if (bullet) {
      flushPara();
      const spans = lineSpans(line);
      // Drop the bullet itself from the item's text.
      let strip = bullet[0].length;
      while (strip > 0 && spans.length) {
        const take = Math.min(strip, spans[0].text.length);
        spans[0].text = spans[0].text.slice(take);
        strip -= take;
        if (!spans[0].text) spans.shift();
      }
      if (spans[0]) spans[0].text = spans[0].text.replace(/^\s+/, "");
      const ordered = /\d/.test(bullet[1]);
      if (!list || list.block.ordered !== ordered || out[out.length - 1] !== list.block) {
        const block: Extract<Block, { type: "list" }> = { type: "list", ordered, items: [], page: line.page };
        out.push(block);
        list = { block, bulletX: line.x, last: line };
      }
      list.block.items.push(spans);
      list.bulletX = line.x;
      list.last = line;
      continue;
    }
    if (list) {
      const jumped =
        line.page !== list.last.page || line.base < list.last.base - 1 || Math.abs(line.colL - list.last.colL) > 12;
      const hangs = jumped
        ? !ENDS.test(lineText(list.last)) && line.x - line.colL > 2.5
        : line.x > list.bulletX + 2.5 && line.base - list.last.base < 1.7 * line.size;
      if (hangs) {
        appendLine(list.block.items[list.block.items.length - 1], lineSpans(line));
        list.last = line;
        continue;
      }
      flushList();
    }

    // The line above an entity's opening line is its name: a paragraph of its own.
    const named = !!nextLine && opensEntity(lineText(nextLine)) && text.length <= 70 && !ENDS.test(text);
    if (
      para &&
      (named || breaksPara(para.lines[para.lines.length - 1], line, para.lines.length, styles, para.lines[0]))
    )
      flushPara();
    if (!para) {
      para = { spans: [], lines: [], page: line.page };
      pushSpans(para.spans, lineSpans(line));
    } else appendLine(para.spans, lineSpans(line));
    para.lines.push(line);
  }
  flush();
  return out;
}

/** A sidebar's title and text. Lines set apart from its body text by their look are its headings. */
function sideBlocks(box: Box, styles: StyleBook): { title?: string; blocks: Block[] } {
  const lines = box.lines;
  if (!lines.length) return { blocks: [] };
  const chars = new Map<string, number>();
  for (const l of lines) {
    const key = `${family(l.font)}|${Math.round(l.size * 2) / 2}`;
    chars.set(key, (chars.get(key) ?? 0) + lineText(l).length);
  }
  const [fam, sizeText] = ([...chars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "|10").split("|");
  const size = Number(sizeText);
  const gaps = new Map<number, number>();
  for (let i = 1; i < lines.length; i++) {
    const dy = Math.round((lines[i].base - lines[i - 1].base) * 2) / 2;
    if (dy > 0.8 * size && dy < 2.2 * size) gaps.set(dy, (gaps.get(dy) ?? 0) + 1);
  }
  const leading = [...gaps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? size * 1.25;
  const isHead = (l: Line) => {
    const text = lineText(l);
    if (l.cells.length !== 1 || text.length > 70 || /[.,;]$/.test(text)) return false;
    return l.size >= size * 1.1 || (family(l.font) !== fam && l.size >= size * 0.97);
  };
  const inner: StyleBook = {
    bodySize: size,
    bodyFamily: fam,
    leading,
    ranks: [],
    headingLevel: (l) => (isHead(l) ? 4 : 0),
  };
  const blocks = toBlocks(
    lines.map((line) => ({ kind: "line", line }) as Element),
    { styles: inner }
  );
  let title: string | undefined;
  if (blocks[0]?.type === "heading") {
    title = blocks[0].text;
    blocks.shift();
  }
  void styles;
  return { title, blocks };
}

export type { Seg };
