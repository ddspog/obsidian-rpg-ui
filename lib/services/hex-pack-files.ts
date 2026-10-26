/**
 * A hex pack's tile files, worked on from the pack browser: found from a
 * tile, converted to WebP (the vault's art is), renamed, and moved to another
 * layer — the pack's `pack.yml` following. The index rebuilds itself from the
 * vault's create / rename / delete events.
 */

import { type App, TFile, TFolder } from "obsidian";
import { applyPackEdits, type PackEdit } from "lib/domains/hexmap/pack-yml-edit";
import type { Layer, TileFile } from "lib/domains/hexmap/packs";
import { hexPackIndex } from "lib/services/hex-pack-index";

/** The pictures a browser converts: not SVG (drawn, not painted) and not WebP already. */
const CONVERTIBLE = /^(png|jpe?g)$/i;

/** Where a layer's files sit in the vault, with a trailing slash: `<pack>/<layer>/`, except
 *  terrain in a pack whose land and water sections sit at its top (no `terrain/` folder). */
export function layerDir(app: App, pack: string, layer: Layer): string {
  const base = `${hexPackIndex.folder()}/${pack}/`;
  if (layer === "terrain" && !app.vault.getAbstractFileByPath(`${base}terrain`)) return base;
  return `${base}${layer}/`;
}

/** A tile's file in the vault: the one under its layer with its path and URL. */
export function tileFileOf(app: App, pack: string, layer: Layer, tile: TileFile): TFile | null {
  const base = `${layerDir(app, pack, layer)}${tile.path}`;
  const candidates = app.vault
    .getFiles()
    .filter((f) => f.path.slice(0, f.path.length - f.extension.length - 1) === base);
  return candidates.find((f) => app.vault.getResourcePath(f) === tile.url) ?? candidates[0] ?? null;
}

export function canConvert(file: TFile): boolean {
  return CONVERTIBLE.test(file.extension);
}

/** A picture as WebP at the best quality the encoder gives, its size kept. */
async function encodeWebp(data: ArrayBuffer, mime: string): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(new Blob([data], { type: mime }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 1));
  if (!blob) throw new Error("Couldn't encode it as WebP.");
  return blob.arrayBuffer();
}

/**
 * A tile as WebP beside it, same name; the original to the trash. Refused when
 * a WebP of that name is there already (two files would claim the one tile).
 */
export async function convertToWebp(app: App, file: TFile): Promise<TFile> {
  if (!canConvert(file)) throw new Error(`${file.name} isn't a PNG or JPEG.`);
  const target = `${file.parent?.path ? `${file.parent.path}/` : ""}${file.basename}.webp`;
  if (app.vault.getAbstractFileByPath(target)) throw new Error(`${target} is there already.`);
  const mime = file.extension.toLowerCase() === "png" ? "image/png" : "image/jpeg";
  const webp = await encodeWebp(await app.vault.readBinary(file), mime);
  const made = await app.vault.createBinary(target, webp);
  await app.fileManager.trashFile(file);
  return made;
}

/** The pack's `pack.yml` with edits applied in order (a `.bak` kept the first time), when it has one. */
export async function editPackYml(app: App, pack: string, edits: PackEdit[]): Promise<void> {
  if (edits.length === 0) return;
  const path = `${hexPackIndex.folder()}/${pack}/pack.yml`;
  const yml = app.vault.getAbstractFileByPath(path);
  if (!(yml instanceof TFile)) return;
  const bak = `${path}.bak`;
  if (!app.vault.getAbstractFileByPath(bak)) await app.vault.create(bak, await app.vault.read(yml));
  await app.vault.process(yml, (text) => applyPackEdits(text, edits));
}

/** A name a file can take: no slashes, no characters the vault refuses. */
export function cleanTileName(name: string): string {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
}

/** A tile renamed in its folder, and `pack.yml` following it (tuning, autotile, its catalog names). */
export async function renameTile(app: App, pack: string, layer: Layer, tile: TileFile, name: string): Promise<void> {
  const file = tileFileOf(app, pack, layer, tile);
  if (!file) throw new Error(`Couldn't find ${tile.path}'s file.`);
  const clean = cleanTileName(name);
  if (!clean) throw new Error("Give it a name.");
  if (clean === file.basename) return;
  const dir = file.parent?.path ?? "";
  const to = `${dir}/${clean}.${file.extension}`;
  if (app.vault.getAbstractFileByPath(to)) throw new Error(`${to} is there already.`);
  await app.fileManager.renameFile(file, to);
  const folder = tile.path.includes("/") ? tile.path.slice(0, tile.path.lastIndexOf("/") + 1) : "";
  await editPackYml(app, pack, [{ kind: "tile-rename", layer, from: tile.path, to: folder + clean }]);
}

/**
 * Many tiles renamed at once (paths below the layer, as `planShapeRenames`
 * gives them), `pack.yml` following. Each goes to a temporary name first, so
 * swaps and chains (a → b, b → c) never collide. Whatever was renamed before a
 * failure is still written to `pack.yml`, so it never names a missing file.
 *
 * @returns how many tiles got their new name
 */
export async function renameTiles(
  app: App,
  pack: string,
  layer: Layer,
  renames: Array<{ from: string; to: string }>
): Promise<number> {
  const root = layerDir(app, pack, layer);
  const fileAt = (path: string) =>
    app.vault.getFiles().find((f) => f.path.slice(0, f.path.length - f.extension.length - 1) === root + path) ?? null;
  const followed: PackEdit[] = [];
  const parked: Array<{ file: TFile; temp: string; to: string }> = [];
  let done = 0;
  try {
    for (const [i, r] of renames.entries()) {
      const file = fileAt(r.from);
      if (!file) continue;
      const temp = `${r.from.slice(0, r.from.lastIndexOf("/") + 1)}_rpg-rename-${i}`;
      await app.fileManager.renameFile(file, `${root}${temp}.${file.extension}`);
      followed.push({ kind: "tile-rename", layer, from: r.from, to: temp });
      parked.push({ file, temp, to: r.to });
    }
    for (const p of parked) {
      // A new name may be in a folder that isn't there yet (markers sorted into styles).
      const dir = `${root}${p.to}`.slice(0, `${root}${p.to}`.lastIndexOf("/"));
      if (!app.vault.getAbstractFileByPath(dir)) await app.vault.createFolder(dir);
      await app.fileManager.renameFile(p.file, `${root}${p.to}.${p.file.extension}`);
      followed.push({ kind: "tile-rename", layer, from: p.temp, to: p.to });
      done++;
    }
  } finally {
    await editPackYml(app, pack, followed);
  }
  return done;
}

/**
 * A tile, or a folder and everything below it, moved to another layer,
 * `pack.yml` following. Bases sit in the base folder itself, so a move there
 * keeps only the file name (`terrain/basic/level` → `base/level`); a base moved
 * out goes into a `bases` folder (`terrain/bases/level`). Elsewhere the path is
 * kept. Refused before anything moves when a file is in the way or two would
 * land on one name; a folder left empty is removed.
 *
 * @returns how many files moved
 */
export async function moveTiles(
  app: App,
  pack: string,
  from: Layer,
  to: Layer,
  path: string,
  folder: boolean
): Promise<number> {
  if (from === to) return 0;
  const fromDir = layerDir(app, pack, from);
  const toDir = layerDir(app, pack, to);
  const source = `${fromDir}${path}`;
  const files = app.vault
    .getFiles()
    .filter((f) =>
      folder ? f.path.startsWith(`${source}/`) : f.path.slice(0, f.path.length - f.extension.length - 1) === source
    );
  if (files.length === 0) throw new Error(`Nothing at ${from}/${path}.`);
  const flat = to === "base";
  const moves = files.map((file) => {
    const rest = file.path.slice(fromDir.length);
    const below = flat ? file.name : rest.includes("/") ? rest : `bases/${rest}`;
    return { file, target: `${toDir}${below}` };
  });
  const taken = moves.find((m) => app.vault.getAbstractFileByPath(m.target));
  if (taken) throw new Error(`${taken.target} is there already.`);
  const twice = moves.find((m, i) => moves.findIndex((o) => o.target === m.target) !== i);
  if (twice) throw new Error(`Two files would both be ${twice.target}.`);
  let done = 0;
  try {
    for (const { file, target } of moves) {
      await ensureFolder(app, target.slice(0, target.lastIndexOf("/")));
      await app.fileManager.renameFile(file, target);
      done++;
    }
  } finally {
    // A base moved out (`level` → `bases/level`) is a rename below the layer, then a move.
    const out = from === "base" && !path.includes("/");
    const edits: PackEdit[] = out
      ? [
          { kind: "tile-rename", layer: from, from: path, to: `bases/${path}` },
          { kind: "tile-move", from, to, path: `bases/${path}`, folder },
        ]
      : [{ kind: "tile-move", from, to, path, folder, flat }];
    if (done) await editPackYml(app, pack, edits);
  }
  if (folder) await removeEmpty(app, source);
  return done;
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const parts = path.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const p = parts.slice(0, i).join("/");
    if (!app.vault.getAbstractFileByPath(p)) await app.vault.createFolder(p);
  }
}

/** A folder with nothing left in it (empty subfolders aside), gone. */
async function removeEmpty(app: App, path: string): Promise<void> {
  const node = app.vault.getAbstractFileByPath(path);
  const empty = (f: TFolder): boolean => f.children.every((c) => c instanceof TFolder && empty(c));
  if (node instanceof TFolder && empty(node)) await app.vault.delete(node, true);
}
