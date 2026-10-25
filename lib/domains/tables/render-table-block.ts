/**
 * Plain-DOM renderer for a parsed `TableDef`. No React — the output is a
 * static `<table>` plus (optionally) sibling `.el-p > p > .dice-roller`
 * footer rows matching the Ribbons theme's dice-roller convention.
 *
 * Called from the plugin's `rpg` code-block dispatcher when it sees a fence
 * with the info string `rpg table.<name>`. The `filePath` argument keys the
 * in-memory roll store so results survive Obsidian's markdown-preview
 * virtualization across scroll.
 *
 * DOM shape:
 *
 *   <div class="el-table rpg-table-wrapper">
 *     <table class="rpg-table">…</table>
 *   </div>
 *   <div class="el-p rpg-table-footer-row">
 *     <p>
 *       <span class="dice-roller rpg-table-roll-cell" role="button" tabindex="0">
 *         <span class="dice-roller-result">…rolled value…</span>
 *       </span>
 *       …more cells…
 *     </p>
 *   </div>
 */

import { finishRenderMath, loadMathJax, renderMath } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { FormulaView } from "lib/components/session-log/formula";
import { parseFormula } from "lib/domains/session-log/formula";
import type { FooterCell, TableCell, TableDef } from "./types";
import type { PaginationState } from "./pagination";
import { totalPages } from "./pagination";
import type { RenderCell, RowRange } from "./row-merge";
import { resolveRenderRows } from "./row-merge";
import { parseAxisCell } from "./parse-table-block";
import { rollCell } from "./roll";
import { interpretOracle, parseOracleThresholds, rollDice } from "./oracle";
import { getRollResult, rollStoreKey, setRollResult, subscribeRollResult } from "./roll-store";

/**
 * Math segments queued by `appendMath` during a (synchronous) table build.
 * MathJax is lazy-loaded in Obsidian and may not be ready when our cells
 * render — and a table whose only math lives in our code block never triggers
 * Obsidian's own load. So we render each segment as a raw-source placeholder,
 * then after the table is built `loadMathJax()` → `renderMath()` →
 * `finishRenderMath()` swaps in the typeset output (see `flushMathQueue`).
 * Module-level is safe: the build runs start-to-finish before the async flush,
 * and the flush captures the queue into a local before this is reset.
 */
let mathQueue: Array<{ el: HTMLElement; tex: string; display: boolean }> = [];

/** Modifier token groups for the scoped (col / row / cross) families. */
const HL_COL = ["highlight-col", "highlight-cross"];
const HL_ROW = ["highlight-row", "highlight-cross"];
const MID_COL = ["middle-col", "middle-cross"];
const MID_ROW = ["middle-row", "middle-cross"];

/** True when a cell carries any of `tokens` in its mods. */
function hasMod(mods: string[] | undefined, tokens: string[]): boolean {
  return !!mods && tokens.some((t) => mods.includes(t));
}

/** True when any cell in the row requests one of `tokens` (e.g. a `-row` /
 *  `-cross` scope). Works on parsed or rendered cells. */
function cellsRequestAny(cells: ReadonlyArray<{ mods?: string[] }>, tokens: string[]): boolean {
  return cells.some((c) => hasMod(c.mods, tokens));
}

/** The cell arrays of every grid row (header + body + footer cell-rows) —
 *  used by the scans below; footer `expr`/`divider` rows have no grid cells. */
function gridCellRows(def: TableDef): TableCell[][] {
  return [
    ...def.headerRows.map((r) => r.cells),
    ...def.rows.map((r) => r.cells),
    ...def.footer.flatMap((it) => (it.kind === "cells" ? [it.cells] : [])),
  ];
}

/**
 * Grid column indices flagged by cells carrying one of `tokens` (a `-col` /
 * `-cross` scope). Scanned from the parsed (pre-merge) header + body + footer
 * rows, where every row's cells sit at stable column positions.
 */
function collectScopedCols(def: TableDef, tokens: string[]): Set<number> {
  const cols = new Set<number>();
  for (const cells of gridCellRows(def)) {
    let pos = 0;
    for (const cell of cells) {
      const span = cell.colspan ?? 1;
      if (hasMod(cell.mods, tokens)) {
        for (let i = 0; i < span; i++) cols.add(pos + i);
      }
      pos += span;
    }
  }
  return cols;
}

/** Whether a cell's column (`cols`) is flagged, accounting for its colspan. */
function cellInCols(cell: RenderCell, cols: Set<number>): boolean {
  if (cols.size === 0 || cell.colStart == null) return false;
  const span = cell.colspan ?? 1;
  for (let i = 0; i < span; i++) if (cols.has(cell.colStart + i)) return true;
  return false;
}

/**
 * Effective grid column count = the widest row across header + body + footer
 * (sum of colspans). Needed because a header-less table (one that starts with
 * `|---|`) has no derived `columns`, yet full-width footer rows (`|= … =|`,
 * pagination) and category dividers must still span every column.
 */
function gridColumnCount(def: TableDef): number {
  let max = def.columns.length;
  for (const cells of gridCellRows(def)) {
    let n = 0;
    for (const cell of cells) n += cell.colspan ?? 1;
    if (n > max) max = n;
  }
  return max || 1;
}

/**
 * Apply per-cell modifier classes: `@compact`, `@header`, column-band
 * highlight, and vertical centering (`@middle` / `@middle-col` / via the
 * `-cross` scopes). `@header` takes precedence over `@highlight-*` ON THIS
 * CELL — the col-highlight class is skipped and a CSS override neutralises the
 * row-highlight inherited from the `<tr>`. Vertical centering is independent of
 * `@header` (both can apply). Other cells in the same column/row are
 * unaffected.
 */
function applyCellMods(el: HTMLElement, cell: RenderCell, highlightCols: Set<number>, middleCols: Set<number>): void {
  const mods = cell.mods ?? [];
  const isHeader = mods.includes("header");
  if (mods.includes("compact")) el.classList.add("rpg-table-cell--compact");
  if (isHeader) el.classList.add("rpg-table-cell--header");
  if (!isHeader && cellInCols(cell, highlightCols)) el.classList.add("rpg-table-col-highlight");
  if (mods.includes("middle") || cellInCols(cell, middleCols)) el.classList.add("rpg-table-cell--middle");
}

/**
 * Build the table's grid model: map every `<td>`/`<th>` to its `{ row, col }`
 * grid coordinates, accounting for both colspan and rowspan (the standard
 * "occupied slots" walk over `table.rows`). Used by the axis crosshair so
 * coordinates stay correct even with merged header cells.
 */
function buildGridCoords(table: HTMLTableElement): Map<HTMLTableCellElement, { row: number; col: number }> {
  const coords = new Map<HTMLTableCellElement, { row: number; col: number }>();
  const occupied: boolean[][] = [];
  const rows = Array.from(table.rows);
  rows.forEach((tr, r) => {
    let c = 0;
    for (const cell of Array.from(tr.cells)) {
      while (occupied[r]?.[c]) c++;
      coords.set(cell, { row: r, col: c });
      const colspan = cell.colSpan || 1;
      const rowspan = cell.rowSpan || 1;
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          (occupied[r + dr] ??= [])[c + dc] = true;
        }
      }
      c += colspan;
    }
  });
  return coords;
}

/**
 * Axis crosshair: in a table with an `{{ axis }}` cell, the "data" cells are
 * the quadrant the diagonal points into — `/` (up) ⇒ rows above + columns
 * right of the axis (top-right); `\` (down) ⇒ rows below + columns right
 * (bottom-right). Hovering a data cell highlights its full row and column
 * (so the row/column axis labels at the ends light up too).
 *
 * Returns `null` when the table has no axis cell. Otherwise returns a
 * `remark()` (re-tag data cells after the body re-renders, e.g. pagination)
 * and a `dispose()` (drop the hover listeners). The hover listener is bound
 * to the table once and reads `data-rpg-row` / `data-rpg-col` set by remark.
 */
function wireAxisCrosshair(
  table: HTMLTableElement,
  selKey: string
): { remark: () => void; dispose: () => void } | null {
  const axisCell = table.querySelector(".rpg-table-axis-cell") as HTMLElement | null;
  if (!axisCell) return null;
  const up = axisCell.classList.contains("rpg-table-axis-cell--up");

  // Re-apply the persistent "selected odds cell" marker from the store (the
  // selection survives body re-renders / virtualization).
  const applySelection = (): void => {
    for (const el of Array.from(table.querySelectorAll(".rpg-table-axis-selected"))) {
      el.classList.remove("rpg-table-axis-selected");
    }
    const sel = getRollResult(selKey);
    if (sel && sel.length >= 2) {
      const cell = table.querySelector(`[data-rpg-row="${sel[0]}"][data-rpg-col="${sel[1]}"]`);
      if (cell) cell.classList.add("rpg-table-axis-selected");
    }
  };

  const remark = (): void => {
    const coords = buildGridCoords(table);
    const axis = coords.get(axisCell as HTMLTableCellElement);
    if (!axis) return;
    for (const [cell, c] of coords) {
      cell.setAttribute("data-rpg-row", String(c.row));
      cell.setAttribute("data-rpg-col", String(c.col));
      const isData = c.col > axis.col && (up ? c.row < axis.row : c.row > axis.row);
      cell.classList.toggle("rpg-table-axis-data", isData);
    }
    applySelection();
  };

  // The hover highlight is painted INLINE with `!important` priority — that
  // beats every stylesheet rule (Obsidian's column-zebra AND our own
  // `@highlight-*` band, which both out-specify a plain crosshair class), so
  // the crosshair always wins on body, header, AND footer cells. Colours come
  // from `--rpg-axis-cross-*` vars (defined in CSS, themeable).
  let lit: HTMLElement[] = [];
  const clear = (): void => {
    for (const el of lit) el.style.removeProperty("background-color");
    lit = [];
  };

  let last: HTMLElement | null = null;
  const onOver = (ev: Event): void => {
    const cell = (ev.target as HTMLElement).closest("td, th") as HTMLElement | null;
    if (cell === last) return;
    last = cell;
    clear();
    if (!cell || !cell.classList.contains("rpg-table-axis-data")) return;
    const row = cell.getAttribute("data-rpg-row");
    const col = cell.getAttribute("data-rpg-col");
    if (row == null || col == null) return;
    const cells = new Set<HTMLElement>();
    for (const el of Array.from(table.querySelectorAll(`[data-rpg-row="${row}"]`))) cells.add(el as HTMLElement);
    for (const el of Array.from(table.querySelectorAll(`[data-rpg-col="${col}"]`))) cells.add(el as HTMLElement);
    for (const el of cells) {
      el.style.setProperty("background-color", "var(--rpg-axis-cross-bg)", "important");
      lit.push(el);
    }
    // Focal cell (row ∩ col) gets the stronger tint, overriding the line tint.
    cell.style.setProperty("background-color", "var(--rpg-axis-cross-focal-bg)", "important");
  };
  const onLeave = (): void => {
    last = null;
    clear();
  };

  // Click a data cell to select it as the active odds (toggle). The `{{ oracle }}`
  // footer reads this selection when rolled.
  const onClick = (ev: Event): void => {
    const cell = (ev.target as HTMLElement).closest("td, th") as HTMLElement | null;
    if (!cell || !cell.classList.contains("rpg-table-axis-data")) return;
    const row = cell.getAttribute("data-rpg-row");
    const col = cell.getAttribute("data-rpg-col");
    if (row == null || col == null) return;
    const cur = getRollResult(selKey);
    if (cur && cur[0] === row && cur[1] === col) setRollResult(selKey, []);
    else setRollResult(selKey, [row, col]);
  };

  remark();
  table.addEventListener("mouseover", onOver);
  table.addEventListener("mouseleave", onLeave);
  table.addEventListener("click", onClick);
  const subSel = subscribeRollResult(selKey, applySelection);
  const dispose = (): void => {
    table.removeEventListener("mouseover", onOver);
    table.removeEventListener("mouseleave", onLeave);
    table.removeEventListener("click", onClick);
    subSel();
  };
  return { remark, dispose };
}

/**
 * After the table builds, load MathJax (idempotent) and replace each queued
 * placeholder with its typeset output. Leaves the raw-source placeholder in
 * place if MathJax fails or a segment errors.
 */
function flushMathQueue(): void {
  const queued = mathQueue;
  mathQueue = [];
  if (queued.length === 0 || typeof loadMathJax !== "function" || typeof renderMath !== "function") return;
  loadMathJax()
    .then(() => {
      for (const { el, tex, display } of queued) {
        try {
          const rendered = renderMath(tex, display);
          el.textContent = "";
          el.appendChild(rendered);
        } catch {
          /* leave the raw-source placeholder */
        }
      }
      if (typeof finishRenderMath === "function") return finishRenderMath();
    })
    .catch(() => {
      /* MathJax failed to load — placeholders keep the raw source */
    });
}

/**
 * Render an axis (diagonal corner) cell: a full-cell diagonal line with the
 * column label (`axis.col`) hugging the top and the row label (`axis.row`)
 * hugging the bottom. `axis.dir` picks the diagonal: `"down"` (`\`, ↘) or
 * `"up"` (`/`, ↗). The SVG line stretches corner-to-corner via
 * `preserveAspectRatio="none"`.
 */
function renderAxisCell(el: HTMLElement, axis: { col: string; row: string; dir: "up" | "down" }): void {
  const doc = el.ownerDocument;
  el.classList.add("rpg-table-axis-cell");
  if (axis.dir === "up") el.classList.add("rpg-table-axis-cell--up");
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(svgNS, "svg");
  svg.classList.add("rpg-table-axis-cell__line");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const line = doc.createElementNS(svgNS, "line");
  // `\` (down): top-left → bottom-right. `/` (up): bottom-left → top-right.
  const [y1, y2] = axis.dir === "up" ? ["100", "0"] : ["0", "100"];
  line.setAttribute("x1", "0");
  line.setAttribute("y1", y1);
  line.setAttribute("x2", "100");
  line.setAttribute("y2", y2);
  svg.appendChild(line);
  el.appendChild(svg);

  const colEl = doc.createElement("span");
  colEl.classList.add("rpg-table-axis-cell__col");
  colEl.textContent = axis.col;
  el.appendChild(colEl);

  const rowEl = doc.createElement("span");
  rowEl.classList.add("rpg-table-axis-cell__row");
  rowEl.textContent = axis.row;
  el.appendChild(rowEl);
}

/** Append a `$…$` (inline) or `$$…$$` (display) math segment as a span. The
 *  span starts as a raw-source placeholder and is queued for typesetting once
 *  MathJax has loaded (see `flushMathQueue`). */
function appendMath(el: HTMLElement, tex: string, display: boolean): void {
  const doc = el.ownerDocument;
  const span = doc.createElement("span");
  span.classList.add("rpg-table-math");
  if (display) span.classList.add("rpg-table-math--display");
  // Placeholder until MathJax loads; also the graceful fallback if it never does.
  span.textContent = display ? `$$${tex}$$` : `$${tex}$`;
  el.appendChild(span);
  mathQueue.push({ el: span, tex, display });
}

/** Append plain text, turning `[[Wikilink]]` into `a.internal-link` anchors
 *  and unescaping `\$` → `$`. `[[…]]` inside an `@[[File]].path` reference is
 *  left untouched (the post-processor owns those). */
function appendTextWithLinks(el: HTMLElement, text: string): void {
  const doc = el.ownerDocument;
  const unescape = (s: string) => s.replace(/\\\$/g, "$");
  const re = /\[\[([^\]\n]+)\]\]/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > 0 && text[m.index - 1] === "@") continue;
    if (m.index > cursor) {
      el.appendChild(doc.createTextNode(unescape(text.slice(cursor, m.index))));
    }
    const inner = m[1];
    const pipe = inner.indexOf("|");
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
    const a = doc.createElement("a");
    a.className = "internal-link";
    a.setAttribute("href", target);
    a.setAttribute("data-href", target);
    a.textContent = label;
    el.appendChild(a);
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    el.appendChild(doc.createTextNode(unescape(text.slice(cursor))));
  }
}

/**
 * Inline emphasis inside a cell: `***both***` (bold+italic), `**bold**`,
 * `*italic*`, `_italic_`. Each run is wrapped in `<strong>`/`<em>` and still
 * resolves `[[wikilinks]]` inside. Guards avoid false positives: the `*`
 * forms require non-space content edges (so a lone `*`, a footnote marker, or
 * `2 * 3` stays literal), and `_` must sit on word boundaries (so `snake_case`
 * isn't italicised). Unmatched delimiters stay literal.
 */
const CELL_EMPHASIS_RE = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(?!\s)(.+?)(?<!\s)\*|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g;

function appendEmphasis(el: HTMLElement, text: string): void {
  const doc = el.ownerDocument;
  CELL_EMPHASIS_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = CELL_EMPHASIS_RE.exec(text)) !== null) {
    if (m.index > last) appendTextWithLinks(el, text.slice(last, m.index));
    if (m[1] !== undefined) {
      // ***bold italic*** → <strong><em>…</em></strong>
      const strong = doc.createElement("strong");
      const em = doc.createElement("em");
      appendTextWithLinks(em, m[1]);
      strong.appendChild(em);
      el.appendChild(strong);
    } else if (m[2] !== undefined) {
      const strong = doc.createElement("strong");
      appendTextWithLinks(strong, m[2]);
      el.appendChild(strong);
    } else {
      const em = doc.createElement("em");
      appendTextWithLinks(em, (m[3] ?? m[4]) as string);
      el.appendChild(em);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) appendTextWithLinks(el, text.slice(last));
}

/**
 * Math delimiters: `$$…$$` (display) or `$…$` (inline). The inline form
 * follows Obsidian's heuristic — the opening `$` isn't escaped and isn't
 * followed by whitespace, and the closing `$` isn't preceded by whitespace —
 * so prose dollars like "5 gp $ 10" don't trigger math. Escape a literal
 * dollar inside a cell with `\$`.
 */
const CELL_MATH_RE = /\$\$([^$]+?)\$\$|(?<!\\)\$(?!\s)((?:\\\$|[^$])+?)(?<!\s)\$/g;

/** Append a cell's text with math, emphasis, wikilinks, and plain text interleaved. */
function appendRichText(el: HTMLElement, text: string): void {
  CELL_MATH_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = CELL_MATH_RE.exec(text)) !== null) {
    if (m.index > last) appendEmphasis(el, text.slice(last, m.index));
    const display = m[1] !== undefined;
    const tex = (m[1] ?? m[2]).replace(/\\\$/g, "$");
    appendMath(el, tex, display);
    last = m.index + m[0].length;
  }
  if (last < text.length) appendEmphasis(el, text.slice(last));
}

/**
 * Populate a cell with a light mix of markdown-ish features so tables
 * authored in the tx idiom don't lose fidelity:
 *
 *   - `{{ axis Col / Row }}` — a diagonal corner cell (see `renderAxisCell`).
 *   - `` `@[[File]].path` `` wrappers — backticks around a pure
 *     reference get stripped so the post-processor's text-node pass
 *     doesn't leave literal backticks orphaned around the resolved value.
 *   - `$…$` / `$$…$$` — inline / display math via MathJax (`appendMath`).
 *   - `**bold**` / `*italic*` / `_italic_` / `***both***` — emphasis
 *     (`appendEmphasis`).
 *   - `[[Wikilink]]` — turned into `a.internal-link` anchors so Obsidian
 *     recognises them as clickable targets (same treatment as inventory
 *     notes).
 *   - Everything else stays as plain text; `code` spans are out of scope
 *     (cells are short labels, not prose).
 */
function renderCellValue(el: HTMLElement, raw: string): void {
  // Axis (diagonal corner) cell — consumes the whole cell.
  const axis = parseAxisCell(raw);
  if (axis) {
    renderAxisCell(el, axis);
    return;
  }

  // Strip backtick-wrapped refs so `@[[File]].path` inside a cell reads
  // as a plain reference to the post-processor.
  const cleaned = raw.replace(/`\s*(@\[\[[^\]\n]+\]\](?:\.[A-Za-z_][\w-]*|\[[^\]\n]+\])+)\s*`/g, "$1");

  // Backtick-wrapped call tokens (with parens) → <code> so the call
  // processor can detect and resolve them after the table renders.
  const CALL_CODE_RE = /`\s*(@\[\[[^\]\n]+\]\](?:\.[A-Za-z_][\w-]*\([^)\n]*\))+)\s*`/g;
  const callMatch = CALL_CODE_RE.exec(cleaned);
  if (callMatch) {
    const doc = el.ownerDocument;
    if (callMatch.index > 0) {
      el.appendChild(doc.createTextNode(cleaned.slice(0, callMatch.index)));
    }
    const code = doc.createElement("code");
    code.textContent = callMatch[1];
    el.appendChild(code);
    const after = callMatch.index + callMatch[0].length;
    if (after < cleaned.length) {
      el.appendChild(doc.createTextNode(cleaned.slice(after)));
    }
    return;
  }

  // General path: math (`$…$` / `$$…$$`) + wikilinks + plain text.
  appendRichText(el, cleaned);
  if (el.childNodes.length === 0) el.textContent = cleaned;
}

/**
 * Render a footer cell's segments into a span, interleaving plain text
 * with `.dice-roller-result` spans for rolled values. If there are no
 * rolled values yet (first render, never clicked), the result spans are
 * emitted empty so the cell visually reserves the space and reveals the
 * roll inline once clicked.
 */
function renderCellContents(doc: Document, cell: FooterCell, root: HTMLElement, values: string[] | undefined): void {
  root.innerHTML = "";
  let rollIdx = 0;
  for (const seg of cell.segments) {
    if (seg.kind === "text") {
      root.appendChild(doc.createTextNode(seg.text));
      continue;
    }
    const result = doc.createElement("span");
    result.classList.add("dice-roller-result");
    // A rolled row keeps its links, emphasis and math, as the cell it came from does.
    appendRichText(result, values?.[rollIdx] ?? "");
    root.appendChild(result);
    rollIdx++;
  }
}

function hasRollSegment(cell: FooterCell): boolean {
  return cell.segments.some((s) => s.kind === "roll");
}

/**
 * The React tree for an oracle footer cell. With a fresh result for the current
 * selection it renders a `FormulaView` (`d100=14 → Answer`), reusing the log
 * blocks' dice UI (the `lonelog-die` silhouette + `→ result`). Otherwise it's a
 * dimmed prompt — "ask" when a cell is selected, "select odds" when none is.
 * The stored result `[answer, roll, dice, selRow, selCol]` only counts as fresh
 * while its selRow/selCol still match `selKey`.
 */
function oracleTree(key: string, selKey: string): React.ReactElement {
  const stored = getRollResult(key);
  const sel = getRollResult(selKey);
  const hasSel = !!sel && sel.length >= 2;
  const fresh = !!stored && stored.length >= 5 && hasSel && stored[3] === sel![0] && stored[4] === sel![1];
  if (fresh) {
    const formula = parseFormula(`${stored![2]}=${stored![1]} → ${stored![0]}`);
    if (formula) return React.createElement(FormulaView, { formula });
    // Spec didn't parse as a formula — fall back to plain "answer · dice=roll".
    return React.createElement(
      "span",
      { className: "rpg-table-oracle-result" },
      `${stored![0]} · ${stored![2]}=${stored![1]}`
    );
  }
  return React.createElement(
    "span",
    { className: "rpg-table-oracle-result rpg-table-oracle-result--prompt" },
    hasSel ? "ask" : "select odds"
  );
}

export interface RenderTableOptions {
  /** Path of the note the table lives in — keys the in-memory roll store. */
  filePath?: string;
}

/**
 * Return value: an array of dispose functions. Callers that embed this
 * render inside a managed lifecycle (Obsidian's `MarkdownRenderChild`)
 * should invoke them on unmount to drop the roll-store subscriptions.
 */
export function renderTableBlock(
  container: HTMLElement,
  def: TableDef,
  opts: RenderTableOptions = {}
): Array<() => void> {
  container.empty?.();
  container.innerHTML = "";
  mathQueue = [];

  const doc = container.ownerDocument;
  const wrapper = doc.createElement("div");
  wrapper.classList.add("el-table", "rpg-table-wrapper");
  if (def.wide) wrapper.classList.add("rpg-table-wrapper--wide");

  const table = doc.createElement("table");
  table.classList.add("rpg-table");

  if (def.caption) {
    const cap = doc.createElement("caption");
    if (def.captionTitle) cap.classList.add("rpg-table-caption--title");
    cap.textContent = def.caption;
    table.appendChild(cap);
  }

  const colCount = gridColumnCount(def);
  const highlightCols = collectScopedCols(def, HL_COL);
  const middleCols = collectScopedCols(def, MID_COL);
  const needsColStart = highlightCols.size > 0 || middleCols.size > 0;

  if (def.headerRows.length > 0) {
    const thead = doc.createElement("thead");
    // Resolve vertical-merge markers (`^`/`^^`/`^v`/`^-`) in the header just
    // like the body, but with category detection off — a full-width header
    // cell is a column-group title, not a section band.
    const headerRendered = resolveRenderRows(def.headerRows, colCount, undefined, {
      categories: false,
      colStart: needsColStart,
    });
    for (const rr of headerRendered) {
      const tr = doc.createElement("tr");
      if (cellsRequestAny(rr.cells, HL_ROW)) tr.classList.add("rpg-table-row-highlight");
      if (cellsRequestAny(rr.cells, MID_ROW)) tr.classList.add("rpg-table-row-middle");
      for (const cell of rr.cells) {
        const th = doc.createElement("th");
        if (cell.colspan && cell.colspan > 1) th.colSpan = cell.colspan;
        if (cell.rowspan && cell.rowspan > 1) {
          th.rowSpan = cell.rowspan;
          if (cell.valign) th.setAttribute("data-valign", cell.valign);
        }
        if (cell.indent) th.setAttribute("data-indent", String(cell.indent));
        applyCellMods(th, cell, highlightCols, middleCols);
        renderCellValue(th, cell.value);
        tr.appendChild(th);
      }
      thead.appendChild(tr);
    }
    table.appendChild(thead);
  }

  const tbody = doc.createElement("tbody");
  const allRows = def.rows;
  const paginationConfig = def.pagination;

  const state: PaginationState = { page: 0, visiblePages: 1 };

  // Visible window of body rows, mirroring `sliceRows` semantics. Spans are
  // resolved over this window so a `^` orphaned at a page top re-anchors.
  function computeRange(): RowRange {
    if (!paginationConfig) return { start: 0, end: allRows.length };
    if (paginationConfig.controls === "show-more") {
      return { start: 0, end: Math.min(allRows.length, paginationConfig.size * state.visiblePages) };
    }
    const start = paginationConfig.size * state.page;
    return { start, end: Math.min(allRows.length, start + paginationConfig.size) };
  }

  // Set by `wireAxisCrosshair` (only when the table has an axis cell) so the
  // body re-render below re-tags data cells after pagination.
  let remarkAxisData: (() => void) | null = null;

  function renderRows(): void {
    tbody.innerHTML = "";
    const rendered = resolveRenderRows(allRows, colCount, computeRange(), {
      colStart: needsColStart,
    });
    for (const rr of rendered) {
      const tr = doc.createElement("tr");
      if (rr.category) {
        tr.setAttribute("data-category", "true");
        const td = doc.createElement("td");
        td.colSpan = colCount;
        td.textContent = rr.categoryLabel ?? "";
        tr.appendChild(td);
      } else {
        if (cellsRequestAny(rr.cells, HL_ROW)) tr.classList.add("rpg-table-row-highlight");
        if (cellsRequestAny(rr.cells, MID_ROW)) tr.classList.add("rpg-table-row-middle");
        for (const cell of rr.cells) {
          // `@header` styles the cell like a header (background, weight, etc.)
          // via class — the element stays a `<td>` so it doesn't accidentally
          // change semantic role mid-body.
          const td = doc.createElement("td");
          if (cell.colspan && cell.colspan > 1) td.colSpan = cell.colspan;
          if (cell.rowspan && cell.rowspan > 1) {
            td.rowSpan = cell.rowspan;
            if (cell.valign) td.setAttribute("data-valign", cell.valign);
          }
          if (cell.indent) td.setAttribute("data-indent", String(cell.indent));
          if (cell.carried) td.setAttribute("data-merge-carried", "true");
          // Stash the raw cell source so a selected odds cell's thresholds can
          // be re-parsed by the `{{ oracle }}` footer (the rendered DOM has the
          // typeset math, not the `^{a} b ^{c}` source).
          td.setAttribute("data-rpg-cell-raw", cell.value);
          applyCellMods(td, cell, highlightCols, middleCols);
          renderCellValue(td, cell.value);
          tr.appendChild(td);
        }
      }
      tbody.appendChild(tr);
    }
    remarkAxisData?.();
  }

  renderRows();
  table.appendChild(tbody);

  // Emit hidden anchors for each footer class so any CSS rule keyed on
  // `:has(a[href="#<class>"])` (theme- or plugin-provided) matches.
  for (const cls of def.classes) {
    const a = doc.createElement("a");
    a.setAttribute("href", `#${cls}`);
    a.hidden = true;
    table.appendChild(a);
  }

  wrapper.appendChild(table);
  container.appendChild(wrapper);

  const disposers: Array<() => void> = [];
  const filePath = opts.filePath ?? "";
  // Store slot for the currently-selected odds cell (one per table), read by
  // `{{ oracle }}`. Row/cell -1 can't collide with real roll/oracle cell keys.
  const selKey = rollStoreKey(filePath, def.name, -1, -1);

  // Build a shared <tfoot> from the footer items, in source order.
  if (def.footer.length > 0) {
    const tfoot = doc.createElement("tfoot");
    tfoot.classList.add("rpg-table-tfoot");

    // Match thead background as the tfoot border-bottom color — and paint the
    // internal group dividers with the same colour so they read as the same
    // structural line that closes the table.
    requestAnimationFrame(() => {
      const theadTh = table.querySelector("thead th") as HTMLElement | null;
      if (theadTh) {
        const bg = getComputedStyle(theadTh).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)") {
          tfoot.style.borderBottom = `3px solid ${bg}`;
          tfoot.querySelectorAll<HTMLElement>(".rpg-table-tfoot__divider td").forEach((td) => {
            td.style.borderTop = `3px solid ${bg}`;
          });
        }
      }
    });

    // Build the pagination controls into `cell` (reused by a paginate expr).
    const renderPaginationControls = (cell: HTMLElement): void => {
      if (!paginationConfig) return;
      const makeBtn = (cls: string, text: string): HTMLButtonElement => {
        const btn = doc.createElement("button");
        btn.classList.add(cls);
        btn.textContent = text;
        btn.style.background = "none";
        btn.style.backgroundColor = "transparent";
        btn.style.border = "none";
        btn.style.boxShadow = "none";
        btn.style.outline = "none";
        return btn;
      };
      const updateControls = (): void => {
        cell.innerHTML = "";
        const pages = totalPages(allRows.length, paginationConfig.size);
        const isShowMore = paginationConfig.controls === "show-more";
        if (!isShowMore) {
          const prev = makeBtn("rpg-table-pagination__arrow", "‹");
          prev.disabled = state.page === 0;
          prev.addEventListener("click", () => {
            if (state.page > 0) {
              state.page--;
              renderRows();
              updateControls();
            }
          });
          cell.appendChild(prev);
        }
        const middle = doc.createElement("span");
        middle.classList.add("rpg-table-pagination__middle");
        if (isShowMore) {
          const allVisible = paginationConfig.size * state.visiblePages >= allRows.length;
          if (!allVisible) {
            const remaining = allRows.length - paginationConfig.size * state.visiblePages;
            const btn = makeBtn("rpg-table-pagination__page", `Show More (+${remaining})`);
            btn.addEventListener("click", () => {
              state.visiblePages++;
              renderRows();
              updateControls();
            });
            middle.appendChild(btn);
          } else {
            const btn = makeBtn("rpg-table-pagination__page", "Collapse");
            btn.addEventListener("click", () => {
              state.visiblePages = 1;
              renderRows();
              updateControls();
            });
            middle.appendChild(btn);
          }
        } else {
          for (let i = 0; i < pages; i++) {
            const btn = makeBtn("rpg-table-pagination__page", String(i + 1));
            if (i === state.page) btn.classList.add("rpg-table-pagination__page--active");
            btn.addEventListener("click", () => {
              state.page = i;
              renderRows();
              updateControls();
            });
            middle.appendChild(btn);
          }
        }
        cell.appendChild(middle);
        if (!isShowMore) {
          const next = makeBtn("rpg-table-pagination__arrow", "›");
          next.disabled = state.page >= pages - 1;
          next.addEventListener("click", () => {
            if (state.page < pages - 1) {
              state.page++;
              renderRows();
              updateControls();
            }
          });
          cell.appendChild(next);
        }
      };
      updateControls();
    };

    // Render a multi-column cell row (e.g. the axis row).
    const renderCellsRow = (cells: TableCell[]): void => {
      const tr = doc.createElement("tr");
      tr.classList.add("rpg-table-tfoot__cell-row");
      if (cellsRequestAny(cells, HL_ROW)) tr.classList.add("rpg-table-row-highlight");
      if (cellsRequestAny(cells, MID_ROW)) tr.classList.add("rpg-table-row-middle");
      let pos = 0;
      for (const cell of cells) {
        const span = cell.colspan && cell.colspan > 1 ? cell.colspan : 1;
        const td = doc.createElement("td");
        if (span > 1) td.colSpan = span;
        if (cell.indent) td.setAttribute("data-indent", String(cell.indent));
        applyCellMods(
          td,
          { value: cell.value, colspan: cell.colspan, mods: cell.mods, colStart: pos },
          highlightCols,
          middleCols
        );
        renderCellValue(td, cell.value);
        tr.appendChild(td);
        pos += span;
      }
      tfoot.appendChild(tr);
    };

    // Render a full-width `|= … =|` expression row (roll / oracle / paginate).
    const renderExprRow = (cells: FooterCell[], rowIdx: number): void => {
      const tr = doc.createElement("tr");
      tr.classList.add("rpg-table-tfoot__expr-row");
      const td = doc.createElement("td");
      td.colSpan = colCount;
      const flexWrap = doc.createElement("span");
      flexWrap.classList.add("rpg-table-tfoot__roll-cell");

      cells.forEach((cell, cellIdx) => {
        const key = rollStoreKey(filePath, def.name, rowIdx, cellIdx);

        // Pagination controls — positioned wherever the {{ paginate }} sits.
        if (cell.segments.some((s) => s.kind === "paginate")) {
          const span = doc.createElement("span");
          span.classList.add("rpg-table-pagination__cell");
          renderPaginationControls(span);
          flexWrap.appendChild(span);
          return;
        }

        // Oracle cell: clicking rolls the configured die and interprets it
        // against the table's currently-selected odds cell.
        const oracleSeg = cell.segments.find(
          (s): s is { kind: "oracle"; dice: string; answers: string[] } => s.kind === "oracle"
        );
        if (oracleSeg) {
          const span = doc.createElement("span");
          span.classList.add("dice-roller", "rpg-table-roll-cell", "rpg-table-oracle-cell");
          span.setAttribute("role", "button");
          span.setAttribute("tabindex", "0");
          // Render the result with the log blocks' dice UI (FormulaView).
          const root = ReactDOM.createRoot(span);
          const paint = () => root.render(oracleTree(key, selKey));
          paint();
          const ask = () => {
            const sel = getRollResult(selKey);
            if (!sel || sel.length < 2) return; // nothing selected — no-op
            const selCell = table.querySelector(`[data-rpg-row="${sel[0]}"][data-rpg-col="${sel[1]}"]`);
            const raw = selCell?.getAttribute("data-rpg-cell-raw") ?? "";
            const rolled = rollDice(oracleSeg.dice);
            const answer = interpretOracle(rolled, parseOracleThresholds(raw), oracleSeg.answers);
            setRollResult(key, [answer, String(rolled), oracleSeg.dice, sel[0], sel[1]]);
          };
          span.addEventListener("click", ask);
          span.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              ask();
            }
          });
          disposers.push(subscribeRollResult(key, paint));
          disposers.push(subscribeRollResult(selKey, paint));
          disposers.push(() => root.unmount());
          flexWrap.appendChild(span);
          return;
        }

        const interactive = hasRollSegment(cell);
        const span = doc.createElement("span");
        span.classList.add("dice-roller", "rpg-table-roll-cell");
        if (interactive) {
          span.setAttribute("role", "button");
          span.setAttribute("tabindex", "0");
        } else {
          span.classList.add("rpg-table-roll-cell-static");
        }
        const paint = () => {
          renderCellContents(doc, cell, span, getRollResult(key));
        };
        if (interactive && getRollResult(key) === undefined) {
          setRollResult(key, rollCell(def, cell));
        }
        paint();
        if (interactive) {
          const roll = () => setRollResult(key, rollCell(def, cell));
          // A link in the result is followed, not a reason to roll again.
          span.addEventListener("click", (ev) => {
            if ((ev.target as HTMLElement | null)?.closest?.("a")) return;
            roll();
          });
          span.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              roll();
            }
          });
          disposers.push(subscribeRollResult(key, paint));
        }
        flexWrap.appendChild(span);
      });

      td.appendChild(flexWrap);
      tr.appendChild(td);
      tfoot.appendChild(tr);
    };

    let exprRowIdx = 0;
    for (const item of def.footer) {
      if (item.kind === "divider") {
        const tr = doc.createElement("tr");
        tr.classList.add("rpg-table-tfoot__divider");
        const td = doc.createElement("td");
        td.colSpan = colCount;
        tr.appendChild(td);
        tfoot.appendChild(tr);
      } else if (item.kind === "cells") {
        renderCellsRow(item.cells);
      } else {
        renderExprRow(item.cells, exprRowIdx++);
      }
    }

    table.appendChild(tfoot);
  }

  // Typeset any queued `$…$` / `$$…$$` cells once MathJax has loaded.
  flushMathQueue();

  // Axis crosshair: tag data cells + bind row/column hover highlight. The
  // axis cell may live in the tfoot, so this runs after the whole table is
  // built. `remark` re-tags data cells whenever the body re-renders.
  const crosshair = wireAxisCrosshair(table, selKey);
  if (crosshair) {
    remarkAxisData = crosshair.remark;
    crosshair.remark();
    disposers.push(crosshair.dispose);
  }

  return disposers;
}
