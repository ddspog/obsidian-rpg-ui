/**
 * Give each table Obsidian's own wrapper, `<div class="el-table">`. A page's
 * tables get it from the reader; a fragment rendered with MarkdownRenderer
 * (an import, a card's text) doesn't, so a theme styling `.el-table > table`
 * left them bare — no header colour, no table font.
 */
export function wrapBareTables(container: HTMLElement): void {
  for (const table of Array.from(container.querySelectorAll("table"))) {
    const parent = table.parentElement;
    if (!parent || parent.classList.contains("el-table")) continue;
    // A code block's own table (`tx`, dataview) — its theme rules read `.block-language-x > table`.
    if (Array.from(parent.classList).some((c) => c.startsWith("block-language-"))) continue;
    // Our own tables (a `rpg table.*` block) are styled as they are.
    if (table.closest(".rpg-table-wrapper, .block-language-rpg .block-language-rpg")) continue;
    const wrap = table.ownerDocument.createElement("div");
    wrap.className = "el-table";
    parent.insertBefore(wrap, table);
    wrap.appendChild(table);
  }
}
