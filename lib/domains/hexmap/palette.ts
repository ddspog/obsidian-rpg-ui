/**
 * What paint mode can paint on each layer, from the pack: its catalog names
 * that resolve on that layer, its joined path families, and its folder tree
 * (the same folders the settings browser shows), each with the spec a map
 * line would use and a thumbnail.
 */

import { groundOf, type HexPack, type Layer, selectTile, type TileFile, type TileFolder } from "./packs";

export interface PaletteEntry {
  spec: string;
  /** What the button says. */
  name: string;
  /** A tile it can pick, for its thumbnail. */
  url?: string;
  /** How it was found. */
  kind: "catalog" | "family" | "folder" | "tile";
}

/** The spec of a folder (`forest[lush]`) or one tile in it (`forest[lush][conifer-0]`).
 *  Terrain's sections aren't named (`land/forest` is `forest`); a base sits in
 *  its layer folder and is named by itself (`rocky`). */
export function specOf(layer: Layer, path: string[], tile?: TileFile): string {
  let parts = path;
  if (layer === "terrain" && parts.length > 1 && groundOf(parts[0])) parts = parts.slice(1);
  if (parts.length === 0) return tile ? tile.name : "";
  const [base, ...rest] = parts;
  return base + rest.map((p) => `[${p}]`).join("") + (tile ? `[${tile.name}]` : "");
}

export function folderAt(root: TileFolder, path: string[]): TileFolder | null {
  let f: TileFolder | undefined = root;
  for (const part of path) {
    f = f?.folders.get(part);
    if (!f) return null;
  }
  return f ?? null;
}

/** The folder's first tile, deepest first-folder down: its thumbnail. */
export function firstTile(folder: TileFolder): TileFile | undefined {
  if (folder.files.length) return folder.files[0];
  for (const sub of folder.folders.values()) {
    const t = firstTile(sub);
    if (t) return t;
  }
  return undefined;
}

/** Catalog names that pick a tile on this layer, sorted. */
export function catalogEntries(pack: HexPack, layer: Layer): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  for (const id of Object.keys(pack.config.catalog).sort((a, b) => a.localeCompare(b))) {
    const picked = selectTile(pack, layer, id, `palette:${id}`);
    if (picked) out.push({ spec: id, name: id, url: picked.file.url, kind: "catalog" });
  }
  return out;
}

/** Path families that join up by themselves (`roads`, `rivers`). */
export function familyEntries(pack: HexPack): PaletteEntry[] {
  return Object.entries(pack.config.autotile).map(([name, family]) => {
    const first = Object.values(family.tiles)[0]?.[0];
    const url = first ? pack.byPath.path.get(first.toLowerCase())?.url : undefined;
    return { spec: name, name, url, kind: "family" as const };
  });
}

/** One folder's contents: its subfolders (each painting any tile under it) and its tiles. */
export function folderEntries(pack: HexPack, layer: Layer, path: string[]): PaletteEntry[] {
  const folder = folderAt(pack.layers[layer], path);
  if (!folder) return [];
  const out: PaletteEntry[] = [];
  for (const sub of folder.folders.values()) {
    const p = [...path, sub.name];
    // A terrain section (`land`, `water`) is a heading, not something to paint.
    const spec = layer === "terrain" && p.length === 1 && groundOf(sub.name) ? "" : specOf(layer, p);
    out.push({ spec, name: sub.name, url: firstTile(sub)?.url, kind: "folder" });
  }
  for (const tile of folder.files)
    out.push({ spec: specOf(layer, path, tile), name: tile.name, url: tile.url, kind: "tile" });
  // Lettering styles have no folder: they're named in `labels:` alone.
  if (layer === "label" && path.length === 0)
    for (const [name, tuning] of Object.entries(pack.config.labels))
      if (tuning.lettering) out.push({ spec: name, name, kind: "tile" });
  return out;
}

/** The layers this pack has anything to paint on, in drawing order. */
export function paintableLayers(pack: HexPack | undefined): Layer[] {
  const order: Layer[] = ["terrain", "base", "edge", "path", "stack", "marker", "label"];
  if (!pack) return ["terrain"];
  return order.filter((l) => pack.byPath[l].size > 0 || (l === "path" && Object.keys(pack.config.autotile).length));
}
