/**
 * The hex map texture packs found in the vault, under the packs folder set in
 * settings: one subfolder per pack, with its tiles and `pack.yml`.
 *
 * Built lazily on first use and rebuilt after any vault change under the
 * folder (a tile added, `pack.yml` edited), or when the folder setting
 * changes; open hex maps subscribe and redraw. Also remembers each tile's
 * natural size, which placing a sprite needs.
 */

import { type App, TFile } from "obsidian";
import { buildPack, type HexPack, parsePackConfig } from "lib/domains/hexmap/packs";
import type { ImageSize } from "lib/domains/hexmap/layout";
import { settingsStore } from "lib/services/settings-store";
import type { DndUIToolkitSettings } from "settings";

/** Where packs come from — a change rebuilds the index. */
export function hexPacksKey(s: DndUIToolkitSettings): string {
  return JSON.stringify([s.hexPacksFolder, s.hexDefaultPack]);
}

/** All the hex map settings in one string, to tell when any of them changed. */
export function hexSettingsKey(s: DndUIToolkitSettings): string {
  return JSON.stringify([
    s.hexPacksFolder,
    s.hexDefaultPack,
    s.hexGridLines,
    s.hexCoords,
    s.hexLabelScale,
    s.hexMapMaxHeight,
  ]);
}

class HexPackIndex {
  private app: App | null = null;
  private packs: Promise<Map<string, HexPack>> | null = null;
  private builtFor = "";
  private listeners = new Set<() => void>();
  private sizes = new Map<string, Promise<ImageSize | null>>();

  /** Called once from the plugin's onload. */
  init(app: App): void {
    this.app = app;
  }

  folder(): string {
    return (settingsStore.getSettings()?.hexPacksFolder ?? "").replace(/^\/+|\/+$/g, "");
  }

  defaultPack(): string {
    return settingsStore.getSettings()?.hexDefaultPack || "basic";
  }

  /** Whether a vault path lies under the packs folder. */
  covers(path: string): boolean {
    const folder = this.folder();
    return !!folder && (path === folder || path.startsWith(folder + "/"));
  }

  getPacks(): Promise<Map<string, HexPack>> {
    const folder = this.folder();
    if (!this.packs || this.builtFor !== folder) {
      this.builtFor = folder;
      this.packs = this.build(folder);
    }
    return this.packs;
  }

  /** Drop the index (vault change, settings change) and tell open maps. */
  invalidate(): void {
    this.packs = null;
    this.listeners.forEach((fn) => fn());
  }

  /** Redraw open maps without rebuilding the index (a display setting changed). */
  notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** A tile's natural size, loaded once per URL. */
  measure(url: string): Promise<ImageSize | null> {
    let size = this.sizes.get(url);
    if (!size) {
      size = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
        img.onerror = () => resolve(null);
        img.src = url;
      });
      this.sizes.set(url, size);
    }
    return size;
  }

  private async build(folder: string): Promise<Map<string, HexPack>> {
    const packs = new Map<string, HexPack>();
    const app = this.app;
    if (!app || !folder) return packs;
    const prefix = folder + "/";
    const byPack = new Map<string, { files: Array<{ path: string; url: string }>; yml: TFile | null }>();
    for (const file of app.vault.getFiles()) {
      if (!file.path.startsWith(prefix)) continue;
      const rest = file.path.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash < 0) continue;
      const pack = rest.slice(0, slash);
      const inner = rest.slice(slash + 1);
      let entry = byPack.get(pack);
      if (!entry) {
        entry = { files: [], yml: null };
        byPack.set(pack, entry);
      }
      if (inner === "pack.yml") entry.yml = file;
      else entry.files.push({ path: inner, url: app.vault.getResourcePath(file) });
    }
    for (const [name, { files, yml }] of byPack) {
      const text = yml ? await app.vault.cachedRead(yml).catch(() => null) : null;
      packs.set(name, buildPack(name, files, parsePackConfig(text, name)));
    }
    return packs;
  }
}

export const hexPackIndex = new HexPackIndex();
