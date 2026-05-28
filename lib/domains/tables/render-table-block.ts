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
import type { PaginationConfig, PaginationState } from "./pagination";
import { sliceRows, totalPages } from "./pagination";
import { formatRollOutcome, rollCell, rollOnce } from "./roll";
import { getRollResult, rollStoreKey, setRollResult, subscribeRollResult } from "./roll-store";

function appendRow(tr: HTMLTableRowElement, row: TableRow, cellTag: "td" | "th"): void {
  for (const cell of row.cells) {
    const el = tr.ownerDocument.createElement(cellTag);
    if (cell.colspan && cell.colspan > 1) el.colSpan = cell.colspan;
    if (cell.indent) el.setAttribute("data-indent", String(cell.indent));
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

  const doc = container.ownerDocument;
  const wrapper = doc.createElement("div");
  wrapper.classList.add("el-table", "rpg-table-wrapper");
  if (def.wide) wrapper.classList.add("rpg-table-wrapper--wide");

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
  const allRows = def.rows;
  const paginationConfig = def.pagination;

  let state: PaginationState = { page: 0, visiblePages: 1 };

  function renderRows(): void {
    tbody.innerHTML = "";
    const visibleRows = paginationConfig
      ? sliceRows(allRows, paginationConfig, state)
      : allRows;
    for (const row of visibleRows) {
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
  const colCount = def.columns.length || 1;

  // Build a shared <tfoot> for roll footers + pagination
  if (def.footerRows.length > 0 || paginationConfig) {
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

  return disposers;
}
