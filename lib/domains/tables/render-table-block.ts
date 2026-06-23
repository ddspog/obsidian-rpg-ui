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
import type { FooterCell, FooterRow, TableDef } from "./types";
import type { PaginationConfig, PaginationState } from "./pagination";
import { totalPages } from "./pagination";
import type { RenderCell, RowRange } from "./row-merge";
import { resolveRenderRows } from "./row-merge";
import { parseAxisCell } from "./parse-table-block";
import { formatRollOutcome, rollCell, rollOnce } from "./roll";
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

/**
 * Grid column indices flagged by cells carrying one of `tokens` (a `-col` /
 * `-cross` scope). Scanned from the parsed (pre-merge) header + body + footer
 * rows, where every row's cells sit at stable column positions.
 */
function collectScopedCols(def: TableDef, tokens: string[]): Set<number> {
  const cols = new Set<number>();
  for (const row of [...def.headerRows, ...def.rows, ...def.footerCells]) {
    let pos = 0;
    for (const cell of row.cells) {
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
  table: HTMLTableElement
): { remark: () => void; dispose: () => void } | null {
  const axisCell = table.querySelector(".rpg-table-axis-cell") as HTMLElement | null;
  if (!axisCell) return null;
  const up = axisCell.classList.contains("rpg-table-axis-cell--up");

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

  remark();
  table.addEventListener("mouseover", onOver);
  table.addEventListener("mouseleave", onLeave);
  const dispose = (): void => {
    table.removeEventListener("mouseover", onOver);
    table.removeEventListener("mouseleave", onLeave);
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
const CELL_EMPHASIS_RE =
  /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(?!\s)(.+?)(?<!\s)\*|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g;

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
    result.textContent = values?.[rollIdx] ?? "";
    root.appendChild(result);
    rollIdx++;
  }
}

function hasRollSegment(cell: FooterCell): boolean {
  return cell.segments.some((s) => s.kind === "roll");
}

/**
 * Emit one footer row as a `.el-p` div wrapping a `<p>` with one or more
 * `.dice-roller` cell spans. Cells without any `{{ roll }}` are rendered
 * as plain text (no button affordance). Clicking an interactive cell
 * re-rolls every expression in that cell atomically, writes through to
 * the store, and re-renders the segments in place.
 */
function renderFooterRow(
  doc: Document,
  def: TableDef,
  row: FooterRow,
  rowIdx: number,
  filePath: string
): { element: HTMLElement; disposers: Array<() => void> } {
  const wrap = doc.createElement("div");
  wrap.classList.add("el-p", "rpg-table-footer-row");

  const p = doc.createElement("p");
  wrap.appendChild(p);

  const disposers: Array<() => void> = [];

  row.cells.forEach((cell, cellIdx) => {
    const key = rollStoreKey(filePath, def.name, rowIdx, cellIdx);
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

    // Auto-roll on first render so the cell surfaces a result immediately
    // (no empty/collapsed state before the user clicks). Persistence kicks
    // in on subsequent remounts — next scroll-in finds the stored value
    // and paints it directly instead of re-rolling.
    if (interactive && getRollResult(key) === undefined) {
      setRollResult(key, rollCell(def, cell));
    }
    paint();

    if (interactive) {
      const roll = () => {
        const values = rollCell(def, cell);
        setRollResult(key, values);
      };
      span.addEventListener("click", roll);
      span.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          roll();
        }
      });
      disposers.push(subscribeRollResult(key, paint));
    }

    p.appendChild(span);
  });

  return { element: wrap, disposers };
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

  const colCount = def.columns.length || 1;
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

  let state: PaginationState = { page: 0, visiblePages: 1 };

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
    const rendered = resolveRenderRows(allRows, def.columns.length, computeRange(), {
      colStart: needsColStart,
    });
    for (const rr of rendered) {
      const tr = doc.createElement("tr");
      if (rr.category) {
        tr.setAttribute("data-category", "true");
        const td = doc.createElement("td");
        td.colSpan = def.columns.length || 1;
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

  // Build a shared <tfoot> for custom footer cells + roll footers + pagination
  if (def.footerRows.length > 0 || paginationConfig || def.footerCells.length > 0) {
    const tfoot = doc.createElement("tfoot");
    tfoot.classList.add("rpg-table-tfoot");

    // Match thead background as the tfoot border-bottom color
    requestAnimationFrame(() => {
      const theadTh = table.querySelector("thead th") as HTMLElement | null;
      if (theadTh) {
        const bg = getComputedStyle(theadTh).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)") {
          tfoot.style.borderBottom = `3px solid ${bg}`;
        }
      }
    });

    // Custom footer-cell rows (authored after the 2nd `|---|`) sit above the
    // roll and pagination rows and are never paginated. They honour cell
    // `@modifier`s, axis cells, and math just like body cells.
    def.footerCells.forEach((row) => {
      const tr = doc.createElement("tr");
      tr.classList.add("rpg-table-tfoot__cell-row");
      if (cellsRequestAny(row.cells, HL_ROW)) tr.classList.add("rpg-table-row-highlight");
      if (cellsRequestAny(row.cells, MID_ROW)) tr.classList.add("rpg-table-row-middle");
      let pos = 0;
      for (const cell of row.cells) {
        const span = cell.colspan && cell.colspan > 1 ? cell.colspan : 1;
        const td = doc.createElement("td");
        if (span > 1) td.colSpan = span;
        if (cell.indent) td.setAttribute("data-indent", String(cell.indent));
        applyCellMods(td, { value: cell.value, colspan: cell.colspan, mods: cell.mods, colStart: pos }, highlightCols, middleCols);
        renderCellValue(td, cell.value);
        tr.appendChild(td);
        pos += span;
      }
      tfoot.appendChild(tr);
    });

    // Roll footer rows
    def.footerRows.forEach((row, rowIdx) => {
      const tr = doc.createElement("tr");
      tr.classList.add("rpg-table-tfoot__roll-row");
      const td = doc.createElement("td");
      td.colSpan = colCount;

      const flexWrap = doc.createElement("span");
      flexWrap.classList.add("rpg-table-tfoot__roll-cell");

      row.cells.forEach((cell, cellIdx) => {
        const key = rollStoreKey(filePath, def.name, rowIdx, cellIdx);
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
          const roll = () => {
            const values = rollCell(def, cell);
            setRollResult(key, values);
          };
          span.addEventListener("click", roll);
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
    });

    // Pagination row
    if (paginationConfig) {
      const tr = doc.createElement("tr");
      tr.classList.add("rpg-table-tfoot__pagination-row");
      const td = doc.createElement("td");
      td.colSpan = colCount;

      const cell = doc.createElement("span");
      cell.classList.add("rpg-table-pagination__cell");
      td.appendChild(cell);
      tr.appendChild(td);
      tfoot.appendChild(tr);

      function makeBtn(cls: string, text: string): HTMLButtonElement {
        const btn = doc.createElement("button");
        btn.classList.add(cls);
        btn.textContent = text;
        btn.style.background = "none";
        btn.style.backgroundColor = "transparent";
        btn.style.border = "none";
        btn.style.boxShadow = "none";
        btn.style.outline = "none";
        return btn;
      }

      function updateControls(): void {
        cell.innerHTML = "";
        const pages = totalPages(allRows.length, paginationConfig!.size);
        const isShowMore = paginationConfig!.controls === "show-more";

        if (!isShowMore) {
          const prev = makeBtn("rpg-table-pagination__arrow", "‹");
          prev.disabled = state.page === 0;
          prev.addEventListener("click", () => {
            if (state.page > 0) { state.page--; renderRows(); updateControls(); }
          });
          cell.appendChild(prev);
        }

        const middle = doc.createElement("span");
        middle.classList.add("rpg-table-pagination__middle");

        if (paginationConfig!.controls === "show-more") {
          const allVisible = paginationConfig!.size * state.visiblePages >= allRows.length;
          if (!allVisible) {
            const remaining = allRows.length - paginationConfig!.size * state.visiblePages;
            const btn = makeBtn("rpg-table-pagination__page", `Show More (+${remaining})`);
            btn.addEventListener("click", () => {
              state.visiblePages++; renderRows(); updateControls();
            });
            middle.appendChild(btn);
          } else {
            const btn = makeBtn("rpg-table-pagination__page", "Collapse");
            btn.addEventListener("click", () => {
              state.visiblePages = 1; renderRows(); updateControls();
            });
            middle.appendChild(btn);
          }
        } else {
          for (let i = 0; i < pages; i++) {
            const btn = makeBtn("rpg-table-pagination__page", String(i + 1));
            if (i === state.page) btn.classList.add("rpg-table-pagination__page--active");
            btn.addEventListener("click", () => {
              state.page = i; renderRows(); updateControls();
            });
            middle.appendChild(btn);
          }
        }

        cell.appendChild(middle);

        if (!isShowMore) {
          const next = makeBtn("rpg-table-pagination__arrow", "›");
          next.disabled = state.page >= pages - 1;
          next.addEventListener("click", () => {
            if (state.page < pages - 1) { state.page++; renderRows(); updateControls(); }
          });
          cell.appendChild(next);
        }
      }

      updateControls();
    }

    table.appendChild(tfoot);
  }

  // Typeset any queued `$…$` / `$$…$$` cells once MathJax has loaded.
  flushMathQueue();

  // Axis crosshair: tag data cells + bind row/column hover highlight. The
  // axis cell may live in the tfoot, so this runs after the whole table is
  // built. `remark` re-tags data cells whenever the body re-renders.
  const crosshair = wireAxisCrosshair(table);
  if (crosshair) {
    remarkAxisData = crosshair.remark;
    crosshair.remark();
    disposers.push(crosshair.dispose);
  }

  return disposers;
}
