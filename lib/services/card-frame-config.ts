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
  /** The rpg blocks whose `framed: true` means this frame (any framed block can borrow it with `framed: <id>`). */
  fences: string[];
  /** Where else it's drawn, for the settings. */
  also?: string[];
}

export const FRAME_KINDS: Record<FrameKind, FrameKindInfo> = {
  spell: {
    id: "spell",
    label: "Spell card",
    aspect: "3:4",
    name: "band",
    style:
      "slim, discreet gilded arcane card frame, a thin gold line on deep violet with small corner flourishes, a narrow name band across the bottom",
    fences: ["spell"],
  },
  portrait: {
    id: "portrait",
    label: "Character portrait",
    aspect: "3:4",
    name: "band",
    style:
      "slim, discreet heraldic portrait frame, a thin gold and dark wood border with small laurel corners, a narrow name band across the bottom",
    fences: ["character.health", "character.sheet", "character.description"],
    also: ["log roster faces (name hidden)"],
  },
  item: {
    id: "item",
    label: "Item card",
    aspect: "3:4",
    name: "band",
    style:
      "slim, discreet brass item card frame, a thin border with small rivets at the corners, a narrow name band across the bottom",
    fences: [],
  },
  creature: {
    id: "creature",
    label: "Creature card",
    aspect: "3:4",
    name: "band",
    style:
      "slim, discreet iron bestiary card frame, a thin border with small claw marks at the corners, a narrow name band across the bottom",
    fences: [],
  },
  banner: {
    id: "banner",
    label: "Chapter banner",
    aspect: "16:9",
    name: "none",
    style: "wide gilded scroll-work banner frame, thin, ornate corners",
    fences: [],
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
  /** Its own edit of the plain frame's CSS (written for `.frame`, `.frame .inner`…); the default, if not set. */
  plainCss?: string;
  /** CSS the model wrote for it, from the style prompt (written for `.frame`, `.frame .inner`…). */
  css?: string;
  /** Which one blocks draw: the plain CSS, the generated CSS, or the image; the image when there is one, if not set. */
  use?: FrameSource;
}

/** Where a frame comes from: the plugin's plain CSS, CSS the model wrote, or a painted image. */
export type FrameSource = "css" | "generated" | "image";

let source: () => Partial<Record<FrameKind, CardFrameSettings>> = () => ({});

export function setCardFrameSource(get: () => Partial<Record<FrameKind, CardFrameSettings>> | undefined): void {
  source = () => get() ?? {};
}

export function cardFrameSettings(kind: FrameKind): CardFrameSettings | undefined {
  return source()[kind];
}

/** Which frame blocks draw for a kind: the one chosen when it's there; else the image, the generated CSS, the plain CSS. */
export function activeFrameSource(settings: CardFrameSettings | undefined): FrameSource {
  const use = settings?.use;
  if (use === "css") return "css";
  if (use === "generated" && settings?.css) return "generated";
  if (settings?.image) return "image";
  if (settings?.css && use !== "image") return "generated";
  return "css";
}

/** The image a kind's frames are drawn with, or undefined for a CSS frame. */
export function activeFrameImage(settings: CardFrameSettings | undefined): CardFrameImage | undefined {
  return activeFrameSource(settings) === "image" ? settings?.image : undefined;
}

/**
 * Point frames at a file or folder that moved (`old` → `now`). True when one
 * changed, for the settings to be saved.
 */
export function retargetFrames(
  frames: Partial<Record<FrameKind, CardFrameSettings>> | undefined,
  old: string,
  now: string
): boolean {
  let changed = false;
  for (const f of Object.values(frames ?? {})) {
    const p = f?.image?.path;
    if (!p) continue;
    if (p === old) f.image!.path = now;
    else if (p.startsWith(`${old}/`)) f.image!.path = now + p.slice(old.length);
    else continue;
    changed = true;
  }
  return changed;
}

/**
 * Frames whose file isn't where they say: pointed at the same name in the
 * frames folder, when it's there (`exists` asks the vault). True when one changed.
 */
export function relinkFrames(
  frames: Partial<Record<FrameKind, CardFrameSettings>> | undefined,
  folder: string,
  exists: (path: string) => boolean
): boolean {
  let changed = false;
  for (const f of Object.values(frames ?? {})) {
    const p = f?.image?.path;
    if (!p || exists(p)) continue;
    const there = `${folder}/${p.split("/").pop()}`;
    if (!exists(there)) continue;
    f.image!.path = there;
    changed = true;
  }
  return changed;
}

/** A framed block found in a note: which frame it asks for. */
export interface FramedUse {
  kind: FrameKind;
  /** The block's type (`spell`, `character.sheet`…). */
  block: string;
}

/** The framed rpg blocks in a note's source, with the frame each one draws. */
export function framedUses(source: string): FramedUse[] {
  const uses: FramedUse[] = [];
  const fence = /^(`{3,}|~{3,})\s*rpg\s+([\w.-]+)[^\n]*\n([\s\S]*?)^\1\s*$/gm;
  for (const m of source.matchAll(fence)) {
    const block = m[2];
    const framed = m[3].match(/^framed:\s*(.+?)\s*$/m)?.[1].replace(/^["']|["']$/g, "");
    if (!framed) continue;
    const own = Object.values(FRAME_KINDS).find((k) => k.fences.includes(block))?.id;
    // `framed: true` on a block with no frame of its own draws nothing.
    if (framed === "true" && !own) continue;
    const spec = frameSpec(framed === "true" ? true : framed, undefined, own ?? "portrait");
    if (spec) uses.push({ kind: spec.kind, block });
  }
  return uses;
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
