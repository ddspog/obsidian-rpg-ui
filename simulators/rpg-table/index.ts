/**
 * The `rpg table` block: edit a block's text and see it render, with its key column, pagination,
 * caption and roll footer. Any table in the vault can be loaded to see how it reads.
 */
import { parseTableBlock } from "lib/domains/tables/parse-table-block";
import { renderTableBlock } from "lib/domains/tables/render-table-block";
import { mountShell, samplesList, textEditor } from "../core/shell";
import { defineSimulator, type Sample } from "../core/types";

const STARTER = `@paginate 10 pages
|d20*|Name|Trait|
|---|---|---|
|1|Aldric|Wary|
|2|Brenna|Bold|
|3|Corwin|Curious|
|4|Dara|Dour|
|5|Edric|Eager|
|6|Fenna|Fierce|
|7|Garrick|Gruff|
|8|Hilda|Hardy|
|9|Ingvar|Idle|
|10|Jorun|Jolly|
|11|Kestrel|Keen|
|12|Lilja|Lazy|
|---|---|---|
|= {{ roll }} =|
[Wanderers]`;

interface Found {
  path: string;
  name: string;
  body: string;
}

/** Every `rpg table` block in the vault. */
function findTables(notes: Record<string, string>): Found[] {
  const out: Found[] = [];
  for (const [path, text] of Object.entries(notes)) {
    for (const m of text.matchAll(/^```rpg table\.([\w-]+)\n([\s\S]*?)^```/gm)) {
      out.push({ path, name: m[1], body: m[2].replace(/\n$/, "") });
    }
  }
  return out;
}

export default defineSimulator({
  start(ctx) {
    const tables = findTables(ctx.notes);
    let name = ctx.store.get("name") || "wanderers";
    let body = ctx.store.get("body") || STARTER;
    let disposers: Array<() => void> = [];
    let out!: HTMLElement;
    let editor!: ReturnType<typeof textEditor>;

    function render(): void {
      for (const d of disposers.splice(0)) d();
      out.replaceChildren();
      const el = document.createElement("div");
      out.appendChild(el);
      try {
        disposers = renderTableBlock(el, parseTableBlock(name, body), { filePath: "Simulator/Table.md" });
      } catch (e) {
        el.innerHTML = `<div class="sim-error"></div>`;
        el.firstElementChild!.textContent = `This block does not read as a table: ${(e as Error).message}`;
      }
    }

    function load(next: { name: string; body: string }, show = true): void {
      name = next.name;
      body = next.body;
      ctx.store.set("name", name);
      ctx.store.set("body", body);
      editor.set(body);
      render();
      if (show) shell.show("table");
    }

    const shell = mountShell(ctx, [
      {
        id: "table",
        label: "Table",
        note: `A <code>rpg table.&lt;name&gt;</code> block, drawn by the plugin's own renderer. Tap the footer to roll, page through long tables.`,
        build(el) {
          el.innerHTML = `<div class="workspace-leaf-content" data-type="markdown"><div class="view-content"><div class="markdown-reading-view"><div class="markdown-preview-view markdown-rendered is-readable-line-width"><div class="markdown-preview-sizer markdown-preview-section"><div class="el-pre"><div class="sim-table"></div></div></div></div></div></div></div>`;
          out = el.querySelector(".sim-table")!;
        },
      },
      {
        id: "block",
        label: "Block",
        note: "The text between the fences (first line may be <code>@paginate 10 pages</code>). Change it and press <b>Apply</b>.",
        build(el) {
          editor = textEditor(ctx, el, {
            onApply: (text) => load({ name, body: text }),
            onReset: () => load({ name: "wanderers", body: STARTER }),
          });
        },
        onShow: () => editor.set(body),
      },
      {
        id: "vault",
        label: `Vault (${tables.length})`,
        note: "Every <code>rpg table</code> block in the vault copy. Search by note or table name, then load one.",
        build(el) {
          const q = document.createElement("input");
          q.className = "sim-search";
          q.placeholder = "Search tables, e.g. arabish";
          const list = document.createElement("div");
          el.append(q, list);
          const show = () => {
            const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
            const hits = tables
              .filter((t) => words.every((w) => `${t.path} ${t.name}`.toLowerCase().includes(w)))
              .slice(0, 40);
            list.replaceChildren();
            samplesList(
              ctx,
              list,
              hits.map<Sample>((t) => ({ title: t.name, about: t.path, text: t.body })),
              (s) => load({ name: s.title, body: s.text })
            );
          };
          q.addEventListener("input", show);
          show();
        },
      },
    ]);
    render();
  },
});
