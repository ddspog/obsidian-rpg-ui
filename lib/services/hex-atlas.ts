/**
 * The vault's hex maps, by note: for a parent map, the detail maps that
 * name it (`of: "[[Parent]]"`, design §13.7), and for a detail map, the
 * parent's own block. Read once on first use from notes with an `rpg map`
 * block, then kept up to date note by note as notes change; open maps
 * subscribe and redraw.
 */

import { type App, TFile } from "obsidian";
import type { Axial } from "lib/domains/hexmap/axial";
import { firstHexMap } from "lib/domains/hexmap/detail";
import { parseHexMap } from "lib/domains/hexmap/parse-hex-map";

export interface DetailMapEntry {
  /** The detail map's note. */
  path: string;
  /** Its parent's note. */
  parent: string;
  at?: [number, number];
  scaleMetres?: number;
  /** Its hexes (its own coordinates). */
  hexes: Axial[];
}

class HexAtlas {
  private app: App | null = null;
  private entries: Promise<Map<string, DetailMapEntry>> | null = null;
  private listeners = new Set<() => void>();

  init(app: App): void {
    this.app = app;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private async read(file: TFile): Promise<DetailMapEntry | null> {
    const app = this.app;
    if (!app) return null;
    const text = await app.vault.cachedRead(file);
    if (!text.includes("rpg map") || !/\bof\s*:/.test(text)) return null;
    const body = firstHexMap(text);
    if (!body) return null;
    const map = parseHexMap(body);
    if (!map.of) return null;
    const parent = app.metadataCache.getFirstLinkpathDest(map.of.split("|")[0].split("#")[0], file.path);
    if (!parent) return null;
    return {
      path: file.path,
      parent: parent.path,
      at: map.at,
      scaleMetres: map.scaleMetres,
      hexes: map.cells.map((c) => ({ q: c.q, r: c.r })),
    };
  }

  private all(): Promise<Map<string, DetailMapEntry>> {
    if (!this.entries) {
      this.entries = (async () => {
        const out = new Map<string, DetailMapEntry>();
        for (const file of this.app?.vault.getMarkdownFiles() ?? []) {
          const entry = await this.read(file);
          if (entry) out.set(file.path, entry);
        }
        return out;
      })();
    }
    return this.entries;
  }

  /** The detail maps of a parent map's note. */
  async detailsOf(parentPath: string): Promise<DetailMapEntry[]> {
    return [...(await this.all()).values()].filter((e) => e.parent === parentPath);
  }

  /** A note changed, appeared, went or moved: its entry read again. */
  async update(file: TFile | null, oldPath?: string): Promise<void> {
    if (!this.entries) return;
    const entries = await this.entries;
    let changed = false;
    if (oldPath && entries.delete(oldPath)) changed = true;
    if (file && file.extension === "md") {
      const had = entries.has(file.path);
      const entry = await this.read(file);
      if (entry) entries.set(file.path, entry);
      else entries.delete(file.path);
      changed ||= had || !!entry;
    }
    // A parent renamed: its details' links resolve anew.
    if (oldPath) for (const e of entries.values()) if (e.parent === oldPath && file) e.parent = file.path;
    if (changed) this.listeners.forEach((fn) => fn());
  }

  /** The text of the first hex map in a note (a detail map's parent). */
  async mapIn(linktext: string, from: string): Promise<{ path: string; body: string } | null> {
    const app = this.app;
    const file = app?.metadataCache.getFirstLinkpathDest(linktext.split("|")[0].split("#")[0], from);
    if (!app || !(file instanceof TFile)) return null;
    const body = firstHexMap(await app.vault.cachedRead(file));
    return body ? { path: file.path, body } : null;
  }
}

export const hexAtlas = new HexAtlas();
