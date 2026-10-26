/**
 * Bakes a far family's recipe (far-compose.ts) into its tiles: one WebP per
 * variation in `far/<family>/`, named by its shape (`straight-1.webp`), each
 * the recipe's canvas wide and tall with the hex's centre in the middle, at the
 * pack's hex width, so the far renderer draws it straight. Sprites are read
 * from the vault's files, drawn at their size on the map times their `s`.
 */

import { type App, TFile } from "obsidian";
import { type FarCompose, farVariations, spritesFor } from "lib/domains/hexmap/far-compose";
import { displayFor, type HexPack, type Layer, LAYERS, type TileFile } from "lib/domains/hexmap/packs";
import { shapeName } from "lib/domains/hexmap/path-shapes";
import { tileFileOf } from "lib/services/hex-pack-files";
import { hexPackIndex } from "lib/services/hex-pack-index";

/** The hex width (px) far art is baked at: the pack's own. */
export function bakeWidth(pack: HexPack): number {
  return pack.config.defaults.hexWidth ?? 477;
}

/** A sprite's `src` (`stack/foliage/Tree 3`) as its layer and tile, or null when the pack has none. */
export function spriteTile(pack: HexPack, src: string): { layer: Layer; tile: TileFile } | null {
  const at = src.indexOf("/");
  const layer = src.slice(0, at) as Layer;
  if (at < 0 || !LAYERS.includes(layer)) return null;
  const tile = pack.byPath[layer].get(src.slice(at + 1).toLowerCase());
  return tile ? { layer, tile } : null;
}

/** How wide a sprite of this many pixels is on the map, in hex widths (before its `s`). */
export function spriteUnits(pack: HexPack, layer: Layer, path: string, pixels: number): number {
  const d = displayFor(pack.config, layer, path);
  return (pixels / (d.hexWidth ?? pixels)) * d.zoom;
}

/**
 * Writes every variation's image and returns the tiles table they make
 * (`straight-1: forest/straight-1`). Sprites the pack doesn't have are skipped.
 */
export async function bakeFarFamily(
  app: App,
  pack: HexPack,
  family: string,
  compose: FarCompose
): Promise<Record<string, string>> {
  const W = bakeWidth(pack);
  const size = Math.round(compose.canvas * W);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas to draw on.");

  // Each sprite's picture, read once.
  const pictures = new Map<string, { img: ImageBitmap; units: number } | null>();
  const picture = async (src: string) => {
    if (pictures.has(src)) return pictures.get(src)!;
    const found = spriteTile(pack, src);
    const file = found ? tileFileOf(app, pack.name, found.layer, found.tile) : null;
    let out: { img: ImageBitmap; units: number } | null = null;
    if (found && file) {
      const img = await createImageBitmap(new Blob([await app.vault.readBinary(file)]));
      out = { img, units: spriteUnits(pack, found.layer, found.tile.path, img.width) };
    }
    pictures.set(src, out);
    return out;
  };

  const folder = `${hexPackIndex.folder()}/${pack.name}/far/${family}`;
  if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
  const tiles: Record<string, string> = {};
  for (const shape of farVariations()) {
    ctx.clearRect(0, 0, size, size);
    for (const s of spritesFor(compose, shape)) {
      const pic = await picture(s.src);
      if (!pic) continue;
      const w = pic.units * s.s * W;
      const h = (w * pic.img.height) / pic.img.width;
      const x = size / 2 + s.x * W;
      const y = size / 2 + s.y * W;
      ctx.save();
      ctx.translate(x, y);
      if (s.flip) ctx.scale(-1, 1);
      ctx.drawImage(pic.img, -w / 2, -h, w, h);
      ctx.restore();
    }
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.92));
    if (!blob) throw new Error("Couldn't encode the picture as WebP.");
    const name = shapeName(shape);
    const path = `${folder}/${name}.webp`;
    const bytes = await blob.arrayBuffer();
    const had = app.vault.getAbstractFileByPath(path);
    if (had instanceof TFile) await app.vault.modifyBinary(had, bytes);
    else await app.vault.createBinary(path, bytes);
    tiles[name] = `${family}/${name}`;
  }
  for (const p of pictures.values()) p?.img.close();
  return tiles;
}
