/**
 * The card frames framed pictures are drawn in. Each kind of thing has its own
 * (a spell's, a character's, an item's…): drawn in CSS (gold filigree on deep
 * violet) unless an image replaces it — made once, in the plugin's settings,
 * with a window cut out for the art. Views read them here, set by the plugin
 * at load.
 */

/** What a frame is for. */
export type FrameKind = "spell" | "portrait" | "item" | "creature" | "banner";

/** How a frame shows the name: on its bottom band, on a plaque over the art's foot, or not at all. */
export type FrameNameMode = "band" | "plaque" | "none";

/** What each kind of frame is: its shape, how it shows a name, the prompt it starts from, and who draws it. */
export interface FrameKindInfo {
  id: FrameKind;
  label: string;
  /** The aspect the frame is asked for. */
  aspect: "3:4" | "16:9" | "1:1";
  /** Whether it shows the name unless a block says otherwise. */
  name: FrameNameMode;
  /** The style its prompt starts from. */
  style: string;
  /** The blocks that can use it (`framed: <id>` on any of them), for the docs and the settings. */
  blocks: string[];
}

export const FRAME_KINDS: Record<FrameKind, FrameKindInfo> = {
  spell: {
    id: "spell",
    label: "Spell card",
    aspect: "3:4",
    name: "band",
    style:
      "slim, discreet gilded arcane card frame, a thin gold line on deep violet with small corner flourishes, a narrow name band across the bottom",
    blocks: ["spell (the spell page's picture)"],
  },
  portrait: {
    id: "portrait",
    label: "Character portrait",
    aspect: "3:4",
    name: "band",
    style:
      "slim, discreet heraldic portrait frame, a thin gold and dark wood border with small laurel corners, a narrow name band across the bottom",
    blocks: ["character.health / character.sheet (the sheet portrait)", "log roster faces (name hidden)"],
  },
  item: {
    id: "item",
    label: "Item card",
    aspect: "3:4",
    name: "band",
    style:
      "slim, discreet brass item card frame, a thin border with small rivets at the corners, a narrow name band across the bottom",
    blocks: ["item reference pictures (when framed)"],
  },
  creature: {
    id: "creature",
    label: "Creature card",
    aspect: "3:4",
    name: "band",
    style:
      "slim, discreet iron bestiary card frame, a thin border with small claw marks at the corners, a narrow name band across the bottom",
    blocks: ["creature / foe pictures (when framed)"],
  },
  banner: {
    id: "banner",
    label: "Chapter banner",
    aspect: "16:9",
    name: "none",
    style: "wide gilded scroll-work banner frame, thin, ornate corners",
    blocks: ["page and chapter banners (when framed)"],
  },
};

/** A generated frame: its picture, and where its window is (percent of its size). */
export interface CardFrameImage {
  /** The frame's file in the vault. */
  path: string;
  /** Where the art shows through, as percentages of the frame. */
  window: { top: number; right: number; bottom: number; left: number };
  /** Its width / height, for the shape the card takes. */
  aspect: number;
}

/** What the settings hold for one kind of frame. */
export interface CardFrameSettings {
  /** A generated frame; none: the CSS one. */
  image?: CardFrameImage;
  /** How it shows the name; the kind's own, if not set. */
  name?: FrameNameMode;
  /** The prompt style it was made from. */
  style?: string;
}

let source: () => Partial<Record<FrameKind, CardFrameSettings>> = () => ({});

export function setCardFrameSource(get: () => Partial<Record<FrameKind, CardFrameSettings>> | undefined): void {
  source = () => get() ?? {};
}

export function cardFrameSettings(kind: FrameKind): CardFrameSettings | undefined {
  return source()[kind];
}

/** How a block asked to be framed: the frame it uses, and whether it shows the name. */
export interface FrameSpec {
  kind: FrameKind;
  name?: FrameNameMode;
}

/**
 * A block's `framed:` and `frame-name:` as a spec, or undefined when it isn't framed.
 * `framed: true` takes the block's own kind; `framed: item` names another.
 * `frame-name: false` (or `none`) hides the name; `band` and `plaque` pick how it shows.
 */
export function frameSpec(framed: unknown, frameName: unknown, own: FrameKind): FrameSpec | undefined {
  let kind: FrameKind;
  if (framed === true) kind = own;
  else if (typeof framed === "string" && framed.trim().toLowerCase() in FRAME_KINDS)
    kind = framed.trim().toLowerCase() as FrameKind;
  else return undefined;
  const n = frameName === false ? "none" : typeof frameName === "string" ? frameName.trim().toLowerCase() : "";
  return { kind, ...(n === "none" || n === "band" || n === "plaque" ? { name: n as FrameNameMode } : {}) };
}
