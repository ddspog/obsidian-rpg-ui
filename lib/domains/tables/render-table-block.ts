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

import type { FooterCell, FooterRow, TableDef, TableRow } from "./types";
import { formatRollOutcome, rollOnce } from "./roll";
import {
  getRollResult,
  rollStoreKey,
  setRollResult,
  subscribeRollResult,
} from "./roll-store";

function appendRow(tr: HTMLTableRowElement, row: TableRow, cellTag: "td" | "th"): void {
  for (const cell of row.cells) {
    const el = tr.ownerDocument.createElement(cellTag);
    if (cell.colspan && cell.colspan > 1) el.colSpan = cell.colspan;
    renderCellValue(el, cell.value);
    tr.appendChild(el);
  }
}

/**
 * Populate a cell with a light mix of markdown-ish features so tables
 * authored in the tx idiom don't lose fidelity:
 *
 *   - `` `@[[File]].path` `` wrappers — backticks around a pure
 *     reference get stripped so the post-processor's text-node pass
 *     doesn't leave literal backticks orphaned around the resolved value.
 *   - `[[Wikilink]]` — turned into `a.internal-link` anchors so Obsidian
 *     recognises them as clickable targets (same treatment as inventory
 *     notes).
 *   - Everything else stays as plain text; bold / italic / code spans
 *     are out of scope (cells are short labels, not prose).
 */
function renderCellValue(el: HTMLElement, raw: string): void {
  // Strip backtick-wrapped refs so `@[[File]].path` inside a cell reads
  // as a plain reference to the post-processor.
  const cleaned = raw.replace(
    /`\s*(@\[\[[^\]\n]+\]\](?:\.[A-Za-z_][\w-]*|\[[^\]\n]+\])+)\s*`/g,
    "$1",
  );
  const doc = el.ownerDocument;
  const re = /\[\[([^\]\n]+)\]\]/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    // Don't rewrite the `[[…]]` inside an `@[[File]].path` reference —
    // the post-processor owns those.
    if (m.index > 0 && cleaned[m.index - 1] === "@") continue;
    if (m.index > cursor) {
      el.appendChild(doc.createTextNode(cleaned.slice(cursor, m.index)));
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
  if (cursor < cleaned.length) {
    el.appendChild(doc.createTextNode(cleaned.slice(cursor)));
  }
  if (el.childNodes.length === 0) {
    el.textContent = cleaned;
  }
}

/**
 * Detect a category-divider row — a single-cell row whose colspan
 * fills every column of the table. Authors write these the tx way
 * (`| Light Armor ||||||`) to split a long table into visually-grouped
 * sections; we tag them with `data-category="true"` so the stylesheet
 * can paint the band background without anyone needing to author a
 * `#css/row/category` class annotation.
 */
function isCategoryRow(row: TableRow, columnCount: number): boolean {
  if (row.cells.length !== 1) return false;
  const cell = row.cells[0];
  const span = cell.colspan ?? 1;
  return span >= columnCount && cell.value.trim().length > 0;
}

/** Strip the legacy `#css/row/...` annotation suffix that tx tables
 *  used to hint at row styling. Authors coming from tx can leave these
 *  in-place — the parser keeps the raw value, and the renderer drops
 *  the trailing hashtag so the label reads clean. */
function cleanCategoryLabel(raw: string): string {
  return raw.replace(/\s*#css\/row\/[^\s|]+\s*$/, "").trim();
}

/**
 * Compute (or re-compute) the roll results for one footer cell and commit
 * them to the in-memory store. Each `kind: "roll"` segment contributes one
 * entry; text segments are not rolled.
 */
function rollCell(def: TableDef, cell: FooterCell): string[] {
  const values: string[] = [];
  for (const seg of cell.segments) {
    if (seg.kind !== "roll") continue;
    const outcome = rollOnce(def, seg.targets, seg.by);
    values.push(formatRollOutcome(outcome));
  }
  return values;
}

/**
 * Render a footer cell's segments into a span, interleaving plain text
 * with `.dice-roller-result` spans for rolled values. If there are no
 * rolled values yet (first render, never clicked), the result spans are
 * emitted empty so the cell visually reserves the space and reveals the
 * roll inline once clicked.
 */
function renderCellContents(
  doc: Document,
  cell: FooterCell,
  root: HTMLElement,
  values: string[] | undefined,
): void {
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
  filePath: string,
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
  opts: RenderTableOptions = {},
): Array<() => void> {
  container.empty?.();
  container.innerHTML = "";

  const doc = container.ownerDocument;
  const wrapper = doc.createElement("div");
  wrapper.classList.add("el-table", "rpg-table-wrapper");

  const table = doc.createElement("table");
  table.classList.add("rpg-table");

  if (def.caption) {
    const cap = doc.createElement("caption");
    cap.textContent = def.caption;
    table.appendChild(cap);
  }

  if (def.headerRows.length > 0) {
    const thead = doc.createElement("thead");
    for (const row of def.headerRows) {
      const tr = doc.createElement("tr");
      appendRow(tr, row, "th");
      thead.appendChild(tr);
    }
    table.appendChild(thead);
  }

  const tbody = doc.createElement("tbody");
  for (const row of def.rows) {
    const tr = doc.createElement("tr");
    if (isCategoryRow(row, def.columns.length)) {
      tr.setAttribute("data-category", "true");
      const cell = row.cells[0];
      const td = doc.createElement("td");
      td.colSpan = def.columns.length;
      td.textContent = cleanCategoryLabel(cell.value);
      tr.appendChild(td);
    } else {
      appendRow(tr, row, "td");
    }
    tbody.appendChild(tr);
  }
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
  def.footerRows.forEach((row, rowIdx) => {
    const { element, disposers: cellDisposers } = renderFooterRow(doc, def, row, rowIdx, filePath);
    container.appendChild(element);
    disposers.push(...cellDisposers);
  });

  return disposers;
}
