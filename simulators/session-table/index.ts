/**
 * One session at a table in a browser. The plugin's own Log runs on the session's note, with the
 * party's sheets and cards (the vault's system comes bundled in the page). What the player does is
 * kept in the page; **Hand over** sends it to the Game Master: the changed notes go to the page's
 * database, and the Claude session running the GM is told. When the GM has played, the notes come
 * back through the database and the Log is drawn again.
 *
 *   table/state   { rev, files: { path: text }, gm, at }     what the GM last left (written by the GM)
 *   table/turn    { rev, files: { path: text }, message, at } the player's turn on top of `rev`
 */
import type { App, MarkdownPostProcessorContext } from "obsidian";
import { MarkdownRenderer } from "obsidian";
import { SystemRegistry } from "lib/systems/registry";
import { SessionLogView } from "lib/views/SessionLogView";
import { systemFolders } from "../core/ts-loader-prebuilt";
import { defineSimulator } from "../core/types";

interface TableState {
  rev: number;
  files?: Record<string, string>;
  gm?: string;
  at?: string;
}
interface Turn {
  rev: number;
  files: Record<string, string>;
  message: string;
  at: string;
}

interface Doc {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<void>;
  onSnapshot(
    next: (snap: { exists: boolean; data(): Record<string, unknown> | undefined }) => void,
    error?: (e: { code: string; message: string }) => void
  ): () => void;
}
interface Db {
  doc(path: string): Doc;
}
interface Mcp {
  callTool(server: string, tool: string, input: Record<string, unknown>): Promise<unknown>;
}
type Claude = { use(name: string): Promise<unknown> };

const blocksOf = (note: string) => [...note.matchAll(/^```rpg log[^\n]*\n([\s\S]*?)\n?```\s*$/gm)].map((m) => m[1]);
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export default defineSimulator({
  async start(ctx) {
    const session: string = ctx.session ?? "";
    if (!session) throw new Error("Built without a session: node simulators/build.mjs session-table --session <note>");
    const name = session.split("/").pop()!.replace(/\.md$/, "");

    // The vault's systems, so sheets, saves and the party's cards are the real ones.
    const registry = SystemRegistry.getInstance();
    registry.initialize(ctx.vault as never);
    const folders = systemFolders();
    registry.setFolderMappings(new Map(folders.map((f) => [f.replace(/\/config$/, ""), f])));
    for (const f of folders) await registry.loadSystemAsync(f);

    // ---- the frame ----
    ctx.root.innerHTML = `
      <div class="sim table">
        <header class="sim-bar table-bar">
          <div class="table-name"></div>
          <span class="table-status" role="status"></span>
          <button class="table-hand mod-cta" type="button">Hand over to the GM</button>
        </header>
        <section class="table-gm" hidden>
          <div class="table-gm-label">Game Master</div>
          <div class="table-gm-text"></div>
        </section>
        <main class="table-main">
          <div class="workspace-leaf-content" data-type="markdown"><div class="view-content"><div class="markdown-reading-view"><div class="markdown-preview-view markdown-rendered is-readable-line-width"><div class="markdown-preview-sizer markdown-preview-section"><div class="el-pre"><div class="block-language-rpg table-log"></div></div></div></div></div></div></div>
        </main>
        <dialog class="table-sheet table-send">
          <h2>Hand over to the Game Master</h2>
          <p class="table-summary"></p>
          <label for="table-say">Anything to tell the GM: what the party means to do, a question, a roll you made at the table.</label>
          <textarea id="table-say" rows="4" placeholder="We follow the tracks uphill, weapons out."></textarea>
          <div class="table-actions">
            <button type="button" data-do="cancel">Not yet</button>
            <button type="button" data-do="send" class="mod-cta">Send my turn</button>
          </div>
          <p class="table-fallback" hidden></p>
        </dialog>
        <dialog class="table-sheet table-note">
          <div class="table-note-head"><h2></h2><button type="button" data-do="close" aria-label="Close">Close</button></div>
          <div class="table-note-body markdown-rendered"></div>
        </dialog>
        <div class="sim-toasts"></div>
      </div>`;
    const $ = <T extends HTMLElement>(q: string) => ctx.root.querySelector<T>(q)!;
    $(".table-name").textContent = name;
    const status = $(".table-status");
    const hand = $<HTMLButtonElement>(".table-hand");
    const host = $(".table-log");
    const send = $<HTMLDialogElement>(".table-send");
    const reader = $<HTMLDialogElement>(".table-note");

    // ---- what the page knows ----
    /** The notes as the GM last left them (the build's copy, then what the database says). */
    const base = new Map<string, string>([[session, ctx.vault.peek(session)]]);
    const changed = new Set<string>();
    let rev = 0;
    let waiting = false;
    let child: { unload(): void } | null = null;
    const draftKey = () => `draft:${session}`;

    function mount(): void {
      child?.unload();
      host.replaceChildren();
      const block = blocksOf(ctx.vault.peek(session))[0];
      if (block === undefined) {
        host.textContent = "This note has no rpg log block.";
        return;
      }
      const into = el("div");
      host.appendChild(into);
      const pctx = {
        sourcePath: session,
        docId: ctx.id,
        getSectionInfo: () => null,
        addChild: (c: { load(): void; unload(): void }) => {
          child = c;
          c.load();
        },
      };
      new SessionLogView(ctx.app as App, ctx.kv).render(block, into, pctx as unknown as MarkdownPostProcessorContext);
    }

    const newLines = () => {
      const was = new Set((base.get(session) ?? "").split("\n"));
      return ctx.vault
        .peek(session)
        .split("\n")
        .filter((l) => l.trim() && !was.has(l));
    };

    function paint(): void {
      const mine = newLines().length;
      status.textContent = waiting
        ? "With the Game Master"
        : mine
          ? `Your turn · ${mine} new line${mine === 1 ? "" : "s"}`
          : "Your turn";
      status.dataset.state = waiting ? "gm" : "player";
      hand.disabled = waiting;
      hand.textContent = waiting ? "Waiting for the GM…" : "Hand over to the GM";
    }

    function keepDraft(): void {
      const files = Object.fromEntries([...changed].map((p) => [p, ctx.vault.peek(p)]));
      ctx.store.set(draftKey(), JSON.stringify({ rev, files }));
    }

    /** The notes as the GM left them, put in the vault copy; the player's unsent work on an older turn goes. */
    function take(state: TableState): void {
      for (const [path, text] of Object.entries(state.files ?? {})) {
        base.set(path, text);
        ctx.vault.put(path, text);
      }
      rev = state.rev;
      changed.clear();
      const gm = $(".table-gm");
      gm.hidden = !state.gm;
      if (state.gm) void MarkdownRenderer.render(ctx.app, state.gm, $(".table-gm-text"), session, null as never);
      mount();
    }

    // A card's lines, a pick or Save write the note; Obsidian would draw the block again, so do the same.
    ctx.vault.onWrite = (file) => {
      if (ctx.vault.peek(file.path) === base.get(file.path)) changed.delete(file.path);
      else changed.add(file.path);
      keepDraft();
      paint();
      if (file.path === session) window.setTimeout(mount, 60);
    };

    // ---- links open the note, here ----
    function openNote(link: string, from = session): void {
      const file = ctx.app.metadataCache.getFirstLinkpathDest(link.split("|")[0], from);
      const head = reader.querySelector("h2")!;
      const body = reader.querySelector<HTMLElement>(".table-note-body")!;
      body.replaceChildren();
      if (!file) {
        head.textContent = link.split("|")[0].split("/").pop() ?? link;
        body.textContent = "This note is not in the page (books and pictures are left out to keep it small).";
      } else {
        head.textContent = file.basename;
        const text = ctx.vault.peek(file.path).replace(/^---\n[\s\S]*?\n---\n?/, "");
        // Prose as Markdown; an rpg block as what it holds.
        for (const part of text.split(/^(`{3,}rpg [^\n]*\n[\s\S]*?\n`{3,})\s*$/m)) {
          const fence = part.match(/^`{3,}rpg ([^\n]*)\n([\s\S]*?)\n`{3,}$/);
          if (fence) {
            const box = el("details", "table-block");
            box.appendChild(el("summary", "", fence[1].trim()));
            box.appendChild(el("pre", "", fence[2]));
            box.open = /statblock|item|spell|feature/.test(fence[1]);
            body.appendChild(box);
          } else if (part.trim()) {
            const prose = el("div");
            // The stand-in renderer knows no headings: they are set here.
            for (const piece of part.trim().split(/^(#{1,6} .+)$/m)) {
              const h = piece.match(/^(#{1,6}) (.+)$/);
              if (h) prose.appendChild(el(`h${Math.min(6, h[1].length + 1)}` as "h2", "", h[2]));
              else if (piece.trim()) {
                const p = el("div");
                void MarkdownRenderer.render(ctx.app, piece.trim(), p, file.path, null as never);
                prose.appendChild(p);
              }
            }
            body.appendChild(prose);
          }
        }
        reader.dataset.path = file.path;
      }
      if (!reader.open) reader.showModal();
      body.scrollTop = 0;
    }
    (ctx.app.workspace as unknown as { openLinkText: (l: string, from?: string) => Promise<void> }).openLinkText =
      async (link, from) => openNote(link, from || session);
    ctx.root.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("a.internal-link");
      const href = a?.dataset.href ?? a?.getAttribute("href");
      if (!a || !href) return;
      e.preventDefault();
      e.stopPropagation();
      openNote(href, reader.contains(a) ? (reader.dataset.path ?? session) : session);
    });
    reader.querySelector('[data-do="close"]')!.addEventListener("click", () => reader.close());

    // ---- the database, and telling the GM ----
    const claude = (window as unknown as { claude?: Claude }).claude;
    let db: Db | null = null;
    let mcp: Mcp | null = null;
    void claude?.use("db").then((d) => {
      db = d as Db | null;
      if (!db) return;
      db.doc("table/state").onSnapshot(
        (snap) => {
          const state = snap.exists ? (snap.data() as unknown as TableState) : null;
          if (state && state.rev > rev) {
            waiting = false;
            take(state);
            ctx.store.set(draftKey(), "");
            ctx.toast("The Game Master has played");
          }
          paint();
        },
        () => ctx.toast("The table's database can't be reached: turns can still be copied")
      );
      db.doc("table/turn").onSnapshot((snap) => {
        const turn = snap.exists ? (snap.data() as unknown as Turn) : null;
        // A turn sent on top of the state shown is with the GM until a newer state comes.
        waiting = !!turn && turn.rev === rev;
        paint();
      });
    });
    void claude?.use("mcp").then((m) => (mcp = m as Mcp | null));

    hand.addEventListener("click", () => {
      const lines = newLines();
      $(".table-summary").textContent = lines.length
        ? `${lines.length} new line${lines.length === 1 ? "" : "s"} in the log${changed.size > 1 ? `, and ${changed.size - 1} other note${changed.size === 2 ? "" : "s"} changed` : ""}.`
        : "Nothing new in the log: say below what the party does.";
      $(".table-fallback").hidden = true;
      send.showModal();
    });
    send.querySelector('[data-do="cancel"]')!.addEventListener("click", () => send.close());
    send.querySelector('[data-do="send"]')!.addEventListener("click", () => {
      void (async () => {
        const message = $<HTMLTextAreaElement>("#table-say").value.trim();
        const files = Object.fromEntries([...changed].map((p) => [p, ctx.vault.peek(p)]));
        if (!message && Object.keys(files).length === 0) {
          ctx.toast("Play a card, or say what the party does");
          return;
        }
        const turn: Turn = { rev, files, message, at: new Date().toISOString() };
        const word = `The player's turn is in for "${name}" (on top of rev ${rev}). Read it from the session table's database (table/turn) and take over as Game Master.`;
        const fallback = $(".table-fallback");
        try {
          if (!db) throw new Error("no database");
          await db.doc("table/turn").set(turn as unknown as Record<string, unknown>);
        } catch {
          // No database here (a preview, signed out): the turn itself is what gets copied.
          fallback.hidden = false;
          fallback.textContent = "This page can't reach its database here. The turn was copied: paste it to Claude.";
          await ctx.copy(`${word}\n\n${JSON.stringify(turn)}`);
          return;
        }
        waiting = true;
        paint();
        $<HTMLTextAreaElement>("#table-say").value = "";
        let told = false;
        if (mcp && ctx.notify) {
          try {
            await mcp.callTool("Claude Code Remote", "send_message", { session_id: ctx.notify, message: word });
            told = true;
          } catch {
            told = false;
          }
        }
        if (told) {
          send.close();
          ctx.toast("Sent. The GM is on it");
        } else {
          fallback.hidden = false;
          fallback.textContent = "Your turn is saved. Tell Claude it is in (the message was copied): “my turn is in”.";
          await ctx.copy("My turn is in.");
        }
      })();
    });

    // ---- start: the player's unsent work, if it was on this same turn ----
    try {
      const draft = JSON.parse(ctx.store.get(draftKey()) || "null") as {
        rev: number;
        files: Record<string, string>;
      } | null;
      if (draft && draft.rev === rev)
        for (const [path, text] of Object.entries(draft.files)) {
          ctx.vault.put(path, text);
          changed.add(path);
        }
    } catch {
      /* an unreadable draft is no draft */
    }
    mount();
    paint();
  },
});
