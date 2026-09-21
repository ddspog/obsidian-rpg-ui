/**
 * List sheet modal — the printed Mythic list page, rendered from live state.
 *
 * Clicking a list pill in the Log opens this: every section and slot, the paired
 * die ranges that address them, and the entries currently filling them. It makes
 * the draw legible ("a 3 then a 1 lands on slot 6") and shows weighting at a
 * glance — a name written twice occupies two slots.
 */

import { App, Modal } from "obsidian";
import { listSheet, type ListDecl } from "lib/domains/lonelog/list-ops";

export class ListSheetModal extends Modal {
  constructor(
    app: App,
    private decl: ListDecl,
    private entries: string[]
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    // `markdown-rendered` is what themes scope their table CSS to — without it a
    // modal's table falls back to unstyled browser defaults.
    contentEl.addClass("rpg-list-sheet-modal", "markdown-rendered");
    contentEl.createEl("h3", { text: `${this.decl.name} List` });

    const sections = listSheet(this.decl, this.entries);
    const hasSectionRoll = this.entries.length > (this.decl.section || 5);
    contentEl.createEl("p", {
      cls: "rpg-list-sheet-hint",
      text: hasSectionRoll
        ? `Roll the section die, then a d${(this.decl.section || 5) * 2} for the row. Both read in pairs.`
        : `One section so far — roll a d${(this.decl.section || 5) * 2} for the row. Both read in pairs.`,
    });

    // Wrap in `.el-table` + `.rpg-table` so the ACTIVE THEME styles it exactly
    // like every other table in the vault (borders, zebra, header bar); only the
    // section band and the muted number columns are added on top.
    const wrapper = contentEl.createDiv({ cls: "el-table" });
    const table = wrapper.createEl("table", { cls: "rpg-table rpg-list-sheet" });
    const head = table.createEl("thead").createEl("tr");
    // The entry header is tagged so it can stay left-aligned with its column
    // while every other column centres.
    for (const h of ["Die", "Section", "Row", "Entry", "#"]) {
      head.createEl("th", { text: h, cls: h === "Entry" ? "rpg-list-sheet-entry-head" : "" });
    }

    const body = table.createEl("tbody");
    for (const section of sections) {
      // A section's die + range span its rows, so they read as one block.
      section.rows.forEach((row, i) => {
        const tr = body.createEl("tr");
        if (i === 0) {
          const die = tr.createEl("td", { cls: "rpg-list-sheet-die", text: section.die ? `d${section.die}` : "—" });
          die.rowSpan = section.rows.length;
          const range = tr.createEl("td", { cls: "rpg-list-sheet-section", text: section.range });
          range.rowSpan = section.rows.length;
        }
        tr.createEl("td", { cls: "rpg-list-sheet-row", text: row.range });
        const entry = tr.createEl("td", { cls: "rpg-list-sheet-entry" });
        if (row.entry) entry.setText(row.entry);
        else entry.createEl("em", { text: "choose" });
        tr.createEl("td", { cls: "rpg-list-sheet-slot", text: String(row.slot) });
        if (!row.entry) tr.addClass("is-void");
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
