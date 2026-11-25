/**
 * `rpg encounter-catalog` (the board at the top of a catalog note) and
 * `rpg encounter` (each entry, as one line). The note is written by
 * `rpg sim catalog …`; the board reads it, and its actions write it back
 * through the same model (lib/domains/encounter-catalog/catalog.ts).
 */

import { App, MarkdownPostProcessorContext, Notice, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { EncounterBoard, EncounterRow } from "lib/components/encounter-catalog/encounter-board";
import { buildBoard, cardOf } from "lib/domains/encounter-catalog/board";
import {
  confirmed,
  parseCatalog,
  parseEntryBlock,
  proseZonesOf,
  serializeCatalog,
  updateEntry,
  type Catalog,
} from "lib/domains/encounter-catalog/catalog";
import { normaliseTags } from "lib/domains/encounter-catalog/words";
import {
  appendToLog,
  catalogRefOf,
  foesText,
  formatEncounterTag,
  preparedEncounters,
  removePrepared,
} from "lib/domains/session-log/prepared-encounter";
import { BaseView } from "lib/views/BaseView";
import { ReactMarkdown } from "lib/views/ReactMarkdown";

const openIn = (app: App, sourcePath: string) => (path: string) => {
  void app.workspace.openLinkText(path.replace(/\.md$/i, ""), sourcePath, false);
};

/**
 * The party's latest session note: a note in the party's system folder with an
 * `rpg log` and `pcs` that are all the catalog's PCs (as `rpg sim catalog session`
 * counts them), the last by path (session notes are numbered).
 */
async function latestSession(app: App, catalog: Catalog): Promise<TFile | null> {
  const party = new Set(catalog.party.pcs);
  const system = catalog.party.pcs[0]?.split("/")[0] ?? "";
  const found: TFile[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    if (system && !file.path.startsWith(`${system}/`)) continue;
    const pcs = app.metadataCache.getFileCache(file)?.frontmatter?.pcs;
    if (!Array.isArray(pcs) || pcs.length === 0) continue;
    const all = pcs.every((raw) => {
      const name = String(raw)
        .replace(/^\[\[|\]\]$/g, "")
        .split("|")[0];
      const dest = app.metadataCache.getFirstLinkpathDest(name, file.path);
      return !!dest && party.has(dest.path);
    });
    if (!all) continue;
    if (/^`{3,}\s*rpg\s+log\b/m.test(await app.vault.cachedRead(file))) found.push(file);
  }
  found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return found[found.length - 1] ?? null;
}

/** The link to a catalog entry from another note: its block, shown by its title. */
const entryLink = (catalogPath: string, id: string, title: string) =>
  `[[${catalogPath.replace(/\.md$/i, "")}#^${id}|${title.replace(/[[\]|]/g, "")}]]`;

function BoardHost({ app, sourcePath }: { app: App; sourcePath: string }) {
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lowerTiers, setLowerTiers] = React.useState(false);
  // Where Prepare writes, and what is prepared there (entry id → the session note's name).
  const [session, setSession] = React.useState<TFile | null>(null);
  const [prepared, setPrepared] = React.useState<Map<string, string>>(new Map());

  const load = React.useCallback(async () => {
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) return;
    try {
      const next = parseCatalog(await app.vault.cachedRead(file));
      setCatalog(next);
      setError(null);
      const latest = await latestSession(app, next);
      setSession(latest);
      const ids = new Map<string, string>();
      if (latest) {
        const self = sourcePath.replace(/\.md$/i, "");
        for (const p of preparedEncounters(await app.vault.cachedRead(latest))) {
          const ref = catalogRefOf(p.target);
          if (!p.fought && ref && ref.note === self) ids.set(ref.id, latest.basename);
        }
      }
      setPrepared(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [app, sourcePath]);

  React.useEffect(() => {
    void load();
    // The board's own block never changes, so Obsidian does not re-render it when an entry does; a
    // session note changing may prepare or fight one of its encounters.
    const ref = app.vault.on("modify", (f) => {
      if (f.path === sourcePath || f.path === session?.path) void load();
    });
    return () => app.vault.offref(ref);
  }, [app, sourcePath, load, session?.path]);

  /** Writes the session note's text through `change`; false when it could not. */
  const writeSession = React.useCallback(
    async (change: (text: string) => string | null): Promise<boolean> => {
      if (!session) return false;
      let ok = false;
      await app.vault.process(session, (text) => {
        const next = change(text);
        ok = next !== null;
        return next ?? text;
      });
      return ok;
    },
    [app, session]
  );

  /** Writes a change to the note; `undo`, when given, is offered on the notice that says it was done. */
  const write = React.useCallback(
    async (change: (c: Catalog) => Catalog, done: string, undo?: (c: Catalog) => Catalog) => {
      const file = app.vault.getAbstractFileByPath(sourcePath);
      if (!(file instanceof TFile)) return;
      try {
        await app.vault.process(file, (text) => serializeCatalog(change(parseCatalog(text)), proseZonesOf(text)));
        if (!undo) {
          new Notice(done);
          return;
        }
        const message = document.createDocumentFragment();
        message.appendText(`${done} `);
        const button = message.createEl("button", { text: "Undo", cls: "rpg-enc-undo" });
        const notice = new Notice(message, 8000);
        button.addEventListener("click", () => {
          notice.hide();
          void app.vault.process(file, (text) => serializeCatalog(undo(parseCatalog(text)), proseZonesOf(text)));
        });
      } catch (e) {
        new Notice(`Encounter catalog: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [app, sourcePath]
  );

  if (error) return <div className="notice">Encounter catalog: {error}</div>;
  if (!catalog) return <div className="rpg-enc-board is-loading">Reading the catalog…</div>;
  const board = buildBoard(catalog, { tiers: lowerTiers ? "lower" : "same" });
  return (
    <EncounterBoard
      board={board}
      openNote={openIn(app, sourcePath)}
      lowerTiers={lowerTiers}
      onLowerTiers={setLowerTiers}
      onConfirm={(id) => void write((c) => updateEntry(c, id, confirmed), "Encounter confirmed")}
      prepared={prepared}
      sessionName={session?.basename}
      onPrepare={(id) =>
        void (async () => {
          const entry = catalog.entries.find((e) => e.id === id);
          const card = board.cards.find((c) => c.id === id);
          if (!entry || !session) {
            new Notice("Encounter catalog: no session note of this party to prepare it in.");
            return;
          }
          const monsters = entry.monsters.map((m) => {
            const f = app.vault.getAbstractFileByPath(m.note);
            const link = f instanceof TFile ? app.metadataCache.fileToLinktext(f, session.path, true) : m.note;
            return { link, count: m.count };
          });
          const target = `${sourcePath.replace(/\.md$/i, "")}#^${id}`;
          const line = formatEncounterTag({
            link: entryLink(sourcePath, id, card?.title ?? entry.name),
            foes: foesText(monsters),
            state: "prepared",
          });
          if (!(await writeSession((text) => appendToLog(text, line)))) {
            new Notice(`Encounter catalog: ${session.basename} has no rpg log to prepare it in.`);
            return;
          }
          const message = document.createDocumentFragment();
          message.appendText(`Prepared in ${session.basename}: Start Combat will offer it. `);
          const button = message.createEl("button", { text: "Undo", cls: "rpg-enc-undo" });
          const notice = new Notice(message, 8000);
          button.addEventListener("click", () => {
            notice.hide();
            void writeSession((text) => removePrepared(text, target));
          });
        })()
      }
      onUnprepare={(id) =>
        void (async () => {
          const target = `${sourcePath.replace(/\.md$/i, "")}#^${id}`;
          if (await writeSession((text) => removePrepared(text, target))) {
            new Notice(`Taken out of ${session?.basename ?? "the session"}.`);
          }
        })()
      }
      onCopy={(text) => {
        navigator.clipboard.writeText(text).then(
          () => new Notice(`Copied: ${text}`),
          () => new Notice(`Could not copy; the command is: ${text}`)
        );
      }}
      onTags={(id, tags) =>
        void write((c) => updateEntry(c, id, (e) => ({ ...e, tags: normaliseTags(tags) })), "Tags saved")
      }
    />
  );
}

/**
 * Whether a block's body is an entry rather than the board. Reading view can name a block by the
 * nearest `rpg` fence above it, which for the entries folded in the callout is the board's own: the
 * body decides.
 */
const isEntryBody = (source: string): boolean => /^\s*monsters\s*:/m.test(source);

export class EncounterCatalogView extends BaseView {
  public codeblock = "encounter-catalog";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (isEntryBody(source)) ctx.addChild(new EntryMarkdown(el, this.app, source, ctx.sourcePath));
    else ctx.addChild(new BoardMarkdown(el, this.app, ctx.sourcePath));
  }
}

class BoardMarkdown extends ReactMarkdown {
  constructor(
    el: HTMLElement,
    private app: App,
    private sourcePath: string
  ) {
    super(el);
  }

  onload() {
    this.reactRoot = ReactDOM.createRoot(this.containerEl);
    this.reactRoot.render(<BoardHost app={this.app} sourcePath={this.sourcePath} />);
  }
}

/** The catalog's settings as the note's frontmatter has them, for judging a lone entry block. */
function catalogOf(app: App, sourcePath: string): Catalog | null {
  const file = app.vault.getAbstractFileByPath(sourcePath);
  if (!(file instanceof TFile)) return null;
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  if (!fm) return null;
  // The frontmatter alone, read by the same parser as the whole note (no entries).
  try {
    const lines = Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
    return parseCatalog(`---\n${lines.join("\n")}\n---\n`);
  } catch {
    return null;
  }
}

export class EncounterEntryView extends BaseView {
  public codeblock = "encounter";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (!isEntryBody(source) && /view\s*:\s*encounter-catalog/.test(source)) {
      ctx.addChild(new BoardMarkdown(el, this.app, ctx.sourcePath));
    } else ctx.addChild(new EntryMarkdown(el, this.app, source, ctx.sourcePath));
  }
}

class EntryMarkdown extends ReactMarkdown {
  constructor(
    el: HTMLElement,
    private app: App,
    private source: string,
    private sourcePath: string
  ) {
    super(el);
  }

  onload() {
    this.reactRoot = ReactDOM.createRoot(this.containerEl);
    try {
      const entry = parseEntryBlock(this.source);
      const catalog: Catalog = catalogOf(this.app, this.sourcePath) ?? {
        party: { name: "", pcs: [] },
        difficulty: "challenging",
        session: 0,
        recheckEverySessions: 0,
        reuseAfterSessions: 0,
        entries: [],
      };
      const card = cardOf(entry, catalog, "same");
      this.reactRoot.render(<EncounterRow card={card} openNote={openIn(this.app, this.sourcePath)} />);
    } catch (e) {
      this.reactRoot.render(<div className="notice">Encounter: {e instanceof Error ? e.message : String(e)}</div>);
    }
  }
}
