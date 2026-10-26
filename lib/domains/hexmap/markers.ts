/**
 * Markers: pins, flags, pedestals and icons that point at a spot on the map —
 * a special place, a note, where a character is. A pack's `marker/` layer
 * holds one folder per **style** (the holder: `pedestal-gold`, `here-red`,
 * `flag-2`, `party`) and one file per **mark** it shows (a symbol or a colour:
 * `tower`, `skull`, `red`, `blank`), so a marker is picked like any tile:
 * `pedestal-gold[tower]`. Symbols share one set of names across styles.
 *
 * A marker stands on its point: the image's anchor (bottom centre unless the
 * pack says otherwise) sits there, not its middle.
 */

import type { HexPack, MarkerTuning } from "./packs";

/** Symbols a marker can show, the same in every style. */
export const MARKER_SYMBOLS = [
  "blank",
  "cave",
  "coins",
  "house",
  "paw-round",
  "paw-sharp",
  "ruins",
  "skull",
  "star",
  "swords",
  "tent",
  "tower",
  "tower-2",
  "party-1",
  "party-2",
];

/** A symbol or colour as the standard writes it: `Paw Print Round` → `paw-round`, `Tower 2` → `tower-2`. */
export function markSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\bpaw print\b/, "paw")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Where an imported pack's marker file goes in `marker/` (`style/mark`), from
 * its name: `Pins - Pedestal, gold (tower)` → `pedestal-gold/tower`,
 * `Banner 2 (red)` → `flag-2/red`, `Icon - Skull (sticker)` → `sticker/skull`.
 * Null for a name it doesn't know.
 */
export function markerPathFromName(name: string): string | null {
  const n = name.trim();
  const mark = (m: string | undefined) => (m ? markSlug(m) : "blank");
  let m: RegExpMatchArray | null;
  if ((m = n.match(/^Pins - Banner(?: \((.+)\))?$/i))) return `signpost/${mark(m[1])}`;
  if ((m = n.match(/^Pins - Pedestal, (\w+)(?: \((.+)\))?$/i))) return `pedestal-${markSlug(m[1])}/${mark(m[2])}`;
  if ((m = n.match(/^Pins - You['’]re Here(?:, (\w+))?(?: \((.+)\))?$/i)))
    return `here${m[1] ? `-${markSlug(m[1])}` : ""}/${mark(m[2])}`;
  if ((m = n.match(/^Pins - Pin, (\w+)( \(large\))?$/i))) return `pin${m[2] ? "-large" : ""}/${markSlug(m[1])}`;
  if ((m = n.match(/^Pins - Party (\d+)$/i))) return `party/${m[1]}`;
  if ((m = n.match(/^Banner (\d+) \((.+)\)$/i))) return `flag-${m[1]}/${markSlug(m[2])}`;
  if ((m = n.match(/^Icons? - (.+?)( \(sticker\))?$/i))) return `${m[2] ? "sticker" : "icon"}/${markSlug(m[1])}`;
  return null;
}

/** Where a marker stands on its image, as shares of its width and height, when the pack doesn't say. */
export const MARKER_ANCHOR: [number, number] = [0.5, 0.96];
/** A marker's height at `size=1`, in hex circumradii. */
export const MARKER_HEIGHT = 0.9;

/** A style's tuning (by its folder, the file's top folder in `marker/`). */
export function markerTuning(pack: HexPack | undefined, path: string): MarkerTuning {
  if (!pack) return {};
  const style = path.split("/")[0].toLowerCase();
  const key = Object.keys(pack.config.markers).find((k) => k.toLowerCase() === style);
  return key ? pack.config.markers[key] : {};
}
