/**
 * The drawer as a hotbar (Baldur's Gate 3's): each card a square tile — an
 * outlined glyph in its type's colour, the card's name and text on hover —
 * and above them the actor's resources as pills: the action (a dot), the
 * bonus action (a triangle), the reaction (a diamond) while a fight is on;
 * spell slots (blue squares, a warlock's pact slots purple) and the uses of
 * features (their own glyph) always. A pill picks out the tiles that spend it.
 */

import type { SessionFeatureCard } from "./card-types";

/** What a tile is, for its colour and its pill. */
export type TileKind = "attack" | "action" | "bonus" | "reaction" | "spell" | "passive" | "gm" | "party" | "other";

export function tileKind(card: SessionFeatureCard, stack?: { actorType?: string; bucket?: string }): TileKind {
  if (card.kind === "party") return "party";
  if (stack?.actorType === "gm") return "gm";
  if (card.cast || card.origin === "spell" || /spell/i.test(stack?.bucket ?? "")) return "spell";
  const bucket = card.bucket as string;
  if (bucket === "attack") return "attack";
  if (bucket === "action") return "action";
  if (bucket === "bonus") return "bonus";
  if (bucket === "reaction") return "reaction";
  if (bucket === "passive" || bucket === "active") return "passive";
  return "other";
}

/** Where a tile's card comes from — its background: the actions anyone has,
 *  an item, a class, subclass, lineage, heritage, background, talent, a spell. */
export type TileSource =
  | "basic"
  | "item"
  | "class"
  | "subclass"
  | "lineage"
  | "heritage"
  | "background"
  | "talent"
  | "spell"
  | "gm"
  | "party"
  | "other";

const SOURCES = new Set<string>([
  "basic",
  "item",
  "class",
  "subclass",
  "lineage",
  "heritage",
  "background",
  "talent",
  "spell",
]);

export function tileSource(card: SessionFeatureCard, stack?: { actorType?: string }): TileSource {
  if (card.kind === "party") return "party";
  if (stack?.actorType === "gm") return "gm";
  if (card.sourceKind && SOURCES.has(card.sourceKind)) return card.sourceKind as TileSource;
  if (card.cast || card.origin === "spell") return "spell";
  if (card.origin === "weapon") return "item";
  if (card.origin === "basic") return "basic";
  return "other";
}

/** A glyph for each kind of thing a card does, by its name — the first that fits. */
const GLYPHS: Array<[RegExp, string]> = [
  // The party's and the GM's own.
  [/short rest/i, "Flame"],
  [/long rest/i, "Moon"],
  [/\bloot/i, "Coins"],
  [/\bshop|trade/i, "ShoppingCart"],
  [/travel/i, "Compass"],
  [/weather/i, "CloudSun"],
  [/group check/i, "Users"],
  [/\bluck\b/i, "Clover"],
  [/end of session/i, "BookMarked"],
  [/fate|oracle|question/i, "HelpCircle"],
  [/meaning/i, "Sparkle"],
  [/thread|list/i, "ListOrdered"],
  [/start combat|end combat/i, "Swords"],
  [/scene/i, "Clapperboard"],
  [/next turn|next round/i, "Hourglass"],
  [/random event|event/i, "Zap"],
  // Basic actions.
  [/opportunity attack/i, "Swords"],
  [/\bdash\b/i, "Wind"],
  [/disengage/i, "LogOut"],
  [/dodge/i, "ShieldHalf"],
  [/\bhelp\b/i, "HeartHandshake"],
  [/\bhide\b/i, "EyeOff"],
  [/search/i, "Search"],
  [/grapple/i, "Hand"],
  [/shove/i, "MoveRight"],
  [/\bready\b/i, "Timer"],
  [/stabiliz/i, "Cross"],
  [/improvise|freeform/i, "Feather"],
  [/use (an )?object|use item/i, "Package"],
  // Weapons and their like.
  [/bow|crossbow|sling|dart|javelin|blowgun/i, "Crosshair"],
  [/shield/i, "Shield"],
  [/dagger|sword|scimitar|rapier|glaive|axe|hammer|mace|maul|pick|spear|staff|club|claw|bite|slam|estoc/i, "Sword"],
  [/heal|gift|cure|potion|draft/i, "HeartPulse"],
  [/two-weapon/i, "Swords"],
  [/mark|hunter/i, "Target"],
  [/light|radiant|bolt|ray|blast/i, "Sparkles"],
];

/** The glyph a tile draws: its own `icon:` when it names one, else one by its name and kind. */
export function tileGlyph(card: SessionFeatureCard, kind: TileKind): string {
  if (card.icon && !/\p{Extended_Pictographic}/u.test(card.icon)) return card.icon;
  const hit = GLYPHS.find(([re]) => re.test(card.name));
  if (hit) return hit[1];
  if (card.attackForm === "ranged") return "Crosshair";
  if (card.attackForm === "melee") return "Sword";
  const byKind: Record<TileKind, string> = {
    attack: "Sword",
    action: "CircleDot",
    bonus: "Zap",
    reaction: "RotateCcw",
    spell: "Wand2",
    passive: "Gem",
    gm: "BookOpen",
    party: "Users",
    other: "Square",
  };
  return byKind[kind];
}

/** A feature's glyph for its uses pill (Mystic Mark's target) — not a geometric pip. */
export function resourceGlyph(name: string): string {
  return GLYPHS.find(([re]) => re.test(name))?.[1] ?? "Star";
}

/** One of the actor's resources, as a pill. */
export interface HotbarResource {
  /** What it is: the economy's, a circle's slots, a pact's, a feature's uses. */
  kind: "action" | "bonus" | "reaction" | "slot" | "pact" | "use" | "toggle" | "passive" | "class";
  /** Its name, for the tooltip (`Action`, `1st-Circle Slots`, `Mystic Mark`). */
  label: string;
  /** How many there are, and how many are left. */
  max: number;
  left: number;
  /** A slot's circle. */
  circle?: number;
  /** When a feature's uses come back (`short rest`). */
  recovery?: string;
  /** A feature's glyph. */
  glyph?: string;
  /** A word more for its tooltip (`not spent outside a fight`). */
  note?: string;
}

/** The pill a filter is keyed by. */
export const resourceKey = (r: HotbarResource) => `${r.kind}:${r.circle ?? r.label}`;

/** Whether a tile spends a pill's resource — what clicking the pill picks out. */
export function spendsResource(card: SessionFeatureCard, kind: TileKind, r: HotbarResource): boolean {
  switch (r.kind) {
    case "action":
      return (
        kind === "attack" ||
        kind === "action" ||
        (kind === "spell" && card.bucket !== "bonus" && card.bucket !== "reaction")
      );
    case "bonus":
      return card.bucket === "bonus";
    case "reaction":
      return card.bucket === "reaction";
    case "slot":
    case "pact":
      return !!card.cast && card.cast.circle <= (r.circle ?? 0);
    case "toggle":
      // The toggle itself, and every card it changes.
      return card.name === r.label || !!card.modifiedBy?.some((m) => m.from === r.label);
    case "passive":
      return card.bucket === "passive" || kind === "passive";
    case "class":
      // (Picked out by the hotbar, which knows the card's stack.)
      return false;
    case "use": {
      const same = (a?: string) => !!a && a.trim().toLowerCase() === r.label.trim().toLowerCase();
      return same(card.resourceRef) || same(card.name) || !!card.riders?.some((x) => same(x.name));
    }
  }
}

/** The economy's three, out of what a round gives (one each) less what it's spent. */
export function economyResources(
  used: Record<"action" | "bonus" | "reaction", string[]>,
  outOfCombat = false
): HotbarResource[] {
  return (
    [
      ["action", "Action"],
      ["bonus", "Bonus action"],
      ["reaction", "Reaction"],
    ] as const
  ).map(([kind, label]) => ({
    kind,
    label,
    max: 1,
    left: Math.max(0, 1 - used[kind].length),
    ...(outOfCombat ? { note: "not spent outside a fight" } : {}),
  }));
}
