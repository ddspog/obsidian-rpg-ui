/**
 * Plain-DOM renderer for a parsed `TableDef`. No React — the output is a
 * static `<table>` built once from the table definition, so we avoid the
 * overhead and ceremony of mounting a React tree for read-only markup.
 *
 * Called from the plugin's `rpg` code-block dispatcher when it sees a fence
 * with the info string `rpg table.<name>`.
 *
 * DOM shape (designed to inherit the active theme's table styling with no
 * per-theme CSS on our side):
 *
 *   <div class="el-table rpg-table-wrapper">            ← matches `.el-table > table`
 *     <table class="rpg-table">
 *       <caption>…</caption>
 *       <thead>…</thead>
 *       <tbody>…</tbody>
 *       <a href="#css/tx/table" hidden></a>            ← footer classes → hidden
 *       <a href="#css/tx/s/wide" hidden></a>             anchor children so
 *                                                         `table:has(a[href=…])`
 *                                                         variant rules match
 *     </table>
 *   </div>
 *
 * The tx-style `[CAPTION #css/tx/table #css/tx/s/wide]` footer becomes hidden
 * `<a>` children inside the `<table>` — the same DOM contract the tx plugin
 * publishes, so themes that already ship tx variant rules pick them up here.
 */

import type { TableDef, TableRow } from "./types";

function appendRow(tr: HTMLTableRowElement, row: TableRow, cellTag: "td" | "th"): void {
  for (const cell of row.cells) {
    const el = tr.ownerDocument.createElement(cellTag);
    if (cell.colspan && cell.colspan > 1) el.colSpan = cell.colspan;
    el.textContent = cell.value;
    tr.appendChild(el);
  }
}

export function renderTableBlock(container: HTMLElement, def: TableDef): void {
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
    appendRow(tr, row, "td");
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
}
