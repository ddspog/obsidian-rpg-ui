/**
 * A hex map block's text, drawn: parsed, its tiles picked from the vault's
 * packs, measured and laid out. Shared by the map block and the session log's
 * travel pane.
 */

import { measureEm } from "lib/components/hexmap/measure-text";
import { farLayout, resolveFar } from "lib/domains/hexmap/far";
import { mergeImports, type PlacedImport } from "lib/domains/hexmap/imports";
import {
  FLAT_PACK,
  type HexLayout,
  type ImageSize,
  layoutHexMap,
  resolveHexMap,
  terrainAround,
} from "lib/domains/hexmap/layout";
import type { HexPack } from "lib/domains/hexmap/packs";
import { type HexMapError, parseHexMap, type ParsedHexMap } from "lib/domains/hexmap/parse-hex-map";
import { hexPackIndex } from "lib/services/hex-pack-index";

export interface Drawn {
  source: string;
  layout: HexLayout;
  errors: HexMapError[];
  pack?: HexPack;
}

/** The text drawn, with other maps' lines merged in at their places (`import:`; faint ones dimmed). */
export async function drawHexMap(source: string, imports: PlacedImport[] = []): Promise<Drawn> {
  const parsed = mergeImports(parseHexMap(source), imports);
  const packs = await hexPackIndex.getPacks();
  const resolved = resolveHexMap(parsed, packs, hexPackIndex.defaultPack());
  const sizes = new Map<string, ImageSize>();
  await Promise.all(
    resolved.urls.map(async (url) => {
      const size = await hexPackIndex.measure(url);
      if (size) sizes.set(url, size);
    })
  );
  const packName = parsed.pack ?? hexPackIndex.defaultPack();
  return {
    source,
    layout: layoutHexMap(resolved, sizes, undefined, measureEm),
    // Imported lines' problems belong to their own notes.
    errors: resolved.errors.filter((e) => e.line > 0),
    pack: packName === FLAT_PACK ? undefined : packs.get(packName),
  };
}

/**
 * The level below a drawn map, as that map shows it (design §13.10): the fine
 * level's text (with what other notes bring into it) laid out flat, its hexes
 * with far art drawn as that, the rest shrunk, all sitting on `coarse`'s faces.
 * In the fine level's units: draw it scaled down by six. Null when it has no hexes.
 */
export async function drawFar(
  fineSource: string,
  imports: PlacedImport[],
  coarse: { map: ParsedHexMap; layout: HexLayout }
): Promise<HexLayout | null> {
  const merged = mergeImports(parseHexMap(fineSource), imports);
  if (merged.cells.length === 0) return null;
  // Flat: each fine hex sits on its coarse hex's face, which is lifted already.
  const flat: ParsedHexMap = {
    ...merged,
    cells: merged.cells.map((c) => (c.height ? { ...c, height: 0 } : c)),
    labels: [],
    markers: [],
  };
  const packs = await hexPackIndex.getPacks();
  const packName = flat.pack ?? hexPackIndex.defaultPack();
  const pack = packName === FLAT_PACK ? undefined : packs.get(packName);
  const resolved = resolveHexMap(flat, packs, hexPackIndex.defaultPack());
  const picks = resolveFar(flat, pack, terrainAround(flat, pack).around);
  const sizes = new Map<string, ImageSize>();
  await Promise.all(
    [...resolved.urls, ...picks.map((p) => p.file.url)].map(async (url) => {
      const size = await hexPackIndex.measure(url);
      if (size) sizes.set(url, size);
    })
  );
  const layout = layoutHexMap(resolved, sizes, coarse.layout.R, measureEm);
  return farLayout({ map: flat, layout }, picks, coarse, pack, sizes);
}
