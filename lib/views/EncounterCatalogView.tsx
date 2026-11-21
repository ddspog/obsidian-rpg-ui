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
  serializeCatalog,
  updateEntry,
  usedAt,
  type Catalog,
} from "lib/domains/encounter-catalog/catalog";
import { normaliseTags } from "lib/domains/encounter-catalog/words";
import { OUTCOME_PROFILES } from "lib/domains/encounter-sim/fit";
import { BaseView } from "lib/views/BaseView";
import { ReactMarkdown } from "lib/views/ReactMarkdown";

const openIn = (app: App, sourcePath: string) => (path: string) => {
  void app.workspace.openLinkText(path.replace(/\.md$/i, ""), sourcePath, false);
};

function BoardHost({ app, sourcePath }: { app: App; sourcePath: string }) {
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lowerTiers, setLowerTiers] = React.useState(false);

  const load = React.useCallback(async () => {
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) return;
    try {
      setCatalog(parseCatalog(await app.vault.cachedRead(file)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [app, sourcePath]);

  React.useEffect(() => {
    void load();
    // The board's own block never changes, so Obsidian does not re-render it when an entry does.
    const ref = app.vault.on("modify", (f) => {
      if (f.path === sourcePath) void load();
    });
    return () => app.vault.offref(ref);
  }, [app, sourcePath, load]);

  const write = React.useCallback(
    async (change: (c: Catalog) => Catalog, done: string) => {
      const file = app.vault.getAbstractFileByPath(sourcePath);
      if (!(file instanceof TFile)) return;
      try {
        await app.vault.process(file, (text) => serializeCatalog(change(parseCatalog(text))));
        new Notice(done);
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
      onUsed={(id) =>
        void write(
          (c) => updateEntry(c, id, usedAt(c.session)),
          `Marked as run in session ${catalog.session}; offered again in ${catalog.reuseAfterSessions} sessions`
        )
      }
      onTags={(id, tags) =>
        void write((c) => updateEntry(c, id, (e) => ({ ...e, tags: normaliseTags(tags) })), "Tags saved")
      }
    />
  );
}

export class EncounterCatalogView extends BaseView {
  public codeblock = "encounter-catalog";

  public render(_source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    ctx.addChild(new BoardMarkdown(el, this.app, ctx.sourcePath));
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
    ctx.addChild(new EntryMarkdown(el, this.app, source, ctx.sourcePath));
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
      this.reactRoot.render(
        <EncounterRow
          card={card}
          aim={OUTCOME_PROFILES[catalog.difficulty].toll}
          openNote={openIn(this.app, this.sourcePath)}
        />
      );
    } catch (e) {
      this.reactRoot.render(<div className="notice">Encounter: {e instanceof Error ? e.message : String(e)}</div>);
    }
  }
}
