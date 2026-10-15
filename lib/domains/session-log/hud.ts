/**
 * What the drawer's HUD shows of a character besides their cards: the face
 * (a portrait that opens the sheet), what's in hand, and the loadouts as
 * icons — a bow for the ranged one, crossed swords for the pair, a shield, a
 * spark for a casting focus.
 */

import type { CastingKit } from "./casting";
import { describeLoadout, type Loadout } from "./loadouts";

/** Something held — a weapon, a shield, a torch, a lute — and its picture, when it has one. */
export interface HeldItem {
  name: string;
  image?: string;
}

/** A loadout as the HUD's quick button. */
export interface HudLoadout {
  name: string;
  /** A Lucide glyph for what it is. */
  glyph: string;
  /** What it holds, in words. */
  summary: string;
  held: boolean;
  /** Its own icon (a URL), when one was made for it. */
  image?: string;
}

export interface HudInfo {
  /** Their picture (a URL), else a `token` emoji. */
  portrait?: string;
  /** The picture is the art alone: the roster draws it in the card frame. */
  framed?: boolean;
  token?: string;
  /** Their sheet, opened by clicking the portrait. */
  sheetPath?: string;
  /** What they hold and carry, as casting sees it — which spells can be cast. */
  casting?: CastingKit;
  hands?: { main?: HeldItem; off?: HeldItem; light?: HeldItem; instrument?: HeldItem };
  loadouts?: HudLoadout[];
}

const RANGED = /bow|sling|blowgun|dart|javelin|sling/i;
const FOCUS = /focus|symbol|totem|wand|orb|crystal|amulet|emblem|rod/i;

/** The glyph for a loadout, by what's in its hands. */
export function loadoutGlyph(l: Loadout): string {
  const main = l.hands.main_hand ?? "";
  const off = l.hands.off_hand ?? "";
  if (RANGED.test(main)) return "Crosshair";
  if (l.hands.shield) return "Shield";
  if (off && FOCUS.test(off)) return "Sparkles";
  if (main && off && !FOCUS.test(off)) return "Swords";
  if (l.hands.instrument) return "Music";
  if (FOCUS.test(main)) return "Sparkles";
  return "Sword";
}

/** The HUD's loadout buttons for a character: the first four, with which is in hand. */
export function hudLoadouts(
  loadouts: Loadout[],
  heldName: string | undefined,
  imageFor?: (name: string) => string | undefined
): HudLoadout[] {
  return loadouts.slice(0, 4).map((l) => {
    const image = imageFor?.(loadoutIconName(l.name));
    return {
      name: l.name,
      glyph: loadoutGlyph(l),
      summary: describeLoadout(l),
      held: l.name === heldName,
      ...(image ? { image } : {}),
    };
  });
}

/** The name a loadout's icon is saved under (the icon folder is searched by name). */
export const loadoutIconName = (name: string): string => `${name} loadout`;
