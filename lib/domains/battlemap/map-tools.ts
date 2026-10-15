/**
 * What the Start Combat card can ask the log about battle maps: which there
 * are to choose from, and what a picture holds. The log answers from the vault.
 */

import type { DetectedGrid } from "./detect-grid";
import type { SquareMap } from "./square-map";

/** A map a fight can be put on. */
export interface MapChoice {
  /** `log` — declared in the log's own header; `note` — an `rpg map` note;
   *  `picture` — an image in the vault, to make a new map from. */
  kind: "log" | "note" | "picture";
  /** As listed (`Clearing`, `Kobold Ambush`, `ambush.png`). */
  label: string;
  /** How the fight names it: a plain name (`Clearing`), a note's link
   *  (`[[Kobold Ambush]]`) — or, for a picture, its link (`[[ambush.png]]`). */
  ref: string;
}

export interface MapTools {
  /** A map by how a fight names it — its default spots fill the squares. */
  lookup: (ref: string) => Promise<SquareMap | null>;
  /** Every map there is to choose from, and every picture. */
  list: () => Promise<MapChoice[]>;
  /** The grid a picture holds, found from the picture itself. */
  detect: (picture: string) => Promise<DetectedGrid | null>;
  /** A picture as a map, with the grid given. */
  picture: (picture: string, cell: number, offsetX: number, offsetY: number) => Promise<SquareMap | null>;
}
