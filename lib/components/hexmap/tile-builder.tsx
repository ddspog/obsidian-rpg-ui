/**
 * The tile builder (design §13.3, after hexmapper's Stamp Creator): a window
 * with the full paint editor on a scratch map, where a custom tile is put
 * together from the pack's art — terrain, base, paths, stacks, markers, each
 * with its look — on one hex or a few around (0,0), then saved by name to the
 * pack's `pack.yml` (`custom:`). Opened from paint mode's palette or from the
 * settings' Hex maps tab.
 */

import { type App, Component, Modal, Notice } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import type { PackEdit } from "lib/domains/hexmap/pack-yml-edit";
import { HexMapBlock } from "lib/domains/hexmap/render-hex-map-block";
import { editPackYml } from "lib/services/hex-pack-files";

/** A custom tile's name as `pack.yml` and maps write it: lower case, dashes. */
export function customTileName(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The builder's map lines (below `---`), bare: what `custom:` keeps. */
export function builderLines(source: string): string[] {
  const lines = source.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  return lines
    .slice(sep + 1)
    .map((l) => l.replace(/^\s*(?:\*\s*)?/, "").trim())
    .filter(Boolean);
}

export interface TileBuilderOptions {
  pack: string;
  /** The custom tile to edit, or none for a new one. */
  name?: string;
  /** Its lines (or a selection's, to start a new one from). */
  lines?: string[];
}

class TileBuilderModal extends Modal {
  private root: ReactDOM.Root | null = null;
  private child = new Component();

  constructor(
    app: App,
    private opts: TileBuilderOptions
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("rpg-tile-builder-modal");
    this.titleEl.setText(this.opts.name ? `Custom tile: ${this.opts.name}` : "New custom tile");
    this.child.load();
    const { pack, name, lines = [] } = this.opts;
    const source = [`grid: hex`, `title: ${name ?? "Custom tile"}`, `pack: ${pack}`, "---", ...lines].join("\n");
    this.root = ReactDOM.createRoot(this.contentEl);
    this.root.render(
      <HexMapBlock
        source={source}
        app={this.app}
        sourcePath=""
        component={this.child}
        builder={{
          name,
          onClose: () => this.close(),
          onSave: async (wanted, text) => {
            const id = customTileName(wanted);
            const body = builderLines(text);
            if (!id) {
              new Notice("Give the custom tile a name.");
              return;
            }
            if (body.length === 0) {
              new Notice("Paint something first: the tile is empty.");
              return;
            }
            const edits: PackEdit[] = [{ kind: "stamp-set", name: id, lines: body }];
            // Saved under a new name: the old one goes.
            if (name && name !== id) edits.unshift({ kind: "stamp-set", name, lines: null });
            await editPackYml(this.app, pack, edits);
            new Notice(`Saved custom tile "${id}" in ${pack}.`);
            this.close();
          },
        }}
      />
    );
  }

  onClose(): void {
    this.root?.unmount();
    this.root = null;
    this.child.unload();
    this.contentEl.empty();
  }
}

export function openTileBuilder(app: App, opts: TileBuilderOptions): void {
  new TileBuilderModal(app, opts).open();
}
