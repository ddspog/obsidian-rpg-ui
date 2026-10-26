/**
 * Labels: title banners put together to fit their text, placed anywhere on a
 * map. A pack's `label/<family>/` folder holds one banner cut into slices, each
 * file named for its role:
 *
 *   left, right             the end caps, once each
 *   centre                  an optional fixed middle (an ornament), once, kept in the middle
 *   fill                    the plain strip; repeats, on both sides of a centre
 *   fill-left, fill-right   the strip when the two sides differ; repeat
 *
 * A role that starts with `fill` repeats; nothing else does. More art for one
 * role takes a number or letter (`fill-2`, `fillb`), picked by seed per slot.
 * A banner grows from the middle: one fill on each side at a time when it has
 * a centre, so the centre stays put.
 */

import { hashSeed, type HexPack, type LabelTuning, type TileFile } from "./packs";

export type LabelRole = "left" | "fill-left" | "centre" | "fill-right" | "right" | "fill";
/** In the order a banner is drawn, then the strip both sides share. */
export const LABEL_ROLES: LabelRole[] = ["left", "fill-left", "centre", "fill-right", "right", "fill"];

export const ROLE_HINT: Record<LabelRole, string> = {
  left: "left end cap, drawn once",
  "fill-left": "plain strip left of the centre; repeats",
  centre: "fixed middle (an ornament), drawn once in the middle",
  "fill-right": "plain strip right of the centre; repeats",
  right: "right end cap, drawn once",
  fill: "plain strip; repeats (both sides of a centre)",
};

const ROLE_NAME = /^(fill-left|fill-right|fill|left|right|centre|center)(?:-?(\d+|[a-z]))?$/i;

/** A file's role from its name (`fill`, `fill-2`, `centre`), or null. */
export function labelRole(name: string): LabelRole | null {
  const m = name.trim().match(ROLE_NAME);
  if (!m) return null;
  const role = m[1].toLowerCase();
  return (role === "center" ? "centre" : role) as LabelRole;
}

/**
 * A role read from an imported pack's names: `Title Banner 1 (flex) left`,
 * `… (flex) left extension`. A `mid` is the centre when the
 * banner has extensions (they're the strip then), else it is the strip.
 */
export function legacyLabelRole(name: string, hasExtensions: boolean): LabelRole | null {
  // A name already in the standard keeps its role (`fill-left` isn't a `left`).
  const standard = labelRole(name);
  if (standard) return standard;
  const n = name.toLowerCase();
  if (/\bleft\s+extension\b/.test(n)) return "fill-left";
  if (/\bright\s+extension\b/.test(n)) return "fill-right";
  if (/\bmid(dle)?\b/.test(n)) return hasExtensions ? "centre" : "fill";
  if (/\bleft\b/.test(n)) return "left";
  if (/\bright\b/.test(n)) return "right";
  return null;
}

/** File names for a folder's tiles by role (`fill`, then `fill-2` …), as renames of their paths. */
export function planLabelRenames(
  files: TileFile[],
  roleOf: (f: TileFile) => LabelRole | null
): Array<{ from: string; to: string }> {
  const used = new Map<LabelRole, number>();
  const out: Array<{ from: string; to: string }> = [];
  for (const f of files) {
    const role = roleOf(f);
    if (!role) continue;
    const n = (used.get(role) ?? 0) + 1;
    used.set(role, n);
    const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/") + 1) : "";
    const to = dir + (n === 1 ? role : `${role}-${n}`);
    if (to !== f.path) out.push({ from: f.path, to });
  }
  return out;
}

export interface LabelFamily {
  name: string;
  pieces: Partial<Record<LabelRole, TileFile[]>>;
  tuning: LabelTuning;
  /** Just the text, no banner (`lettering: true` in `labels:`). */
  lettering?: boolean;
}

/** Each `label/<family>/` folder of a pack, its files sorted by role (by name). */
export function labelFamilies(pack: HexPack | undefined): Map<string, LabelFamily> {
  const out = new Map<string, LabelFamily>();
  if (!pack) return out;
  for (const folder of pack.layers.label.folders.values()) {
    const pieces: LabelFamily["pieces"] = {};
    for (const f of folder.files) {
      const role = labelRole(f.name);
      if (role) (pieces[role] ??= []).push(f);
    }
    const tuningKey = Object.keys(pack.config.labels).find((k) => k.toLowerCase() === folder.name.toLowerCase());
    out.set(folder.name.toLowerCase(), {
      name: folder.name,
      pieces,
      tuning: tuningKey ? pack.config.labels[tuningKey] : {},
    });
  }
  // Lettering styles live in `labels:` alone: there's no art to put in a folder.
  for (const [name, tuning] of Object.entries(pack.config.labels)) {
    if (tuning.lettering && !out.has(name.toLowerCase()))
      out.set(name.toLowerCase(), { name, pieces: {}, tuning, lettering: true });
  }
  return out;
}

/** A lettering style's letters, as `measureEm` and the map draw them: weight, then style. */
export function letteringFont(tuning: LabelTuning): { family: string; weight: number; italic: boolean } {
  return { family: tuning.font ?? LABEL_FONT, weight: tuning.weight ?? 700, italic: !!tuning.italic };
}

/**
 * Text bent along a circular arc of `arc` degrees (positive bows upwards, as
 * a realm's name over its land) across a width `w`: the SVG path the text
 * runs on, centred on (0, 0), and how far it rises in the middle (`sag`).
 */
export function arcPath(w: number, arc: number): { d: string; sag: number } {
  const a = Math.min(Math.abs(arc), 300);
  if (a < 0.5 || w <= 0) return { d: `M${-w / 2},0L${w / 2},0`, sag: 0 };
  const theta = (a * Math.PI) / 180;
  // The text's own length lies along the arc (so the arc's chord is shorter than it), with a
  // little spare at each end: text past the path's ends isn't drawn, and measuring is never exact.
  const r = (w * ARC_SPARE) / theta;
  const half = r * Math.sin(theta / 2);
  const sag = r * (1 - Math.cos(theta / 2));
  const up = arc > 0;
  // Ends level at y = sag/2 (up) or -sag/2 (down), so the middle of the bend sits on (0, 0).
  const y = up ? sag / 2 : -sag / 2;
  return {
    d: `M${round(-half)},${round(y)}A${round(r)},${round(r)} 0 ${a > 180 ? 1 : 0} ${up ? 1 : 0} ${round(half)},${round(y)}`,
    sag,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** How much longer than its text an arc is drawn. */
const ARC_SPARE = 1.12;

/**
 * Text broken onto lines no wider than `maxEm` (in ems, as `measure` gives),
 * between words; a word wider than that keeps a line to itself.
 */
export function wrapText(text: string, maxEm: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!(maxEm > 0) || words.length < 2) return [text];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const tried = line ? `${line} ${word}` : word;
    if (line && measure(tried) > maxEm) {
      lines.push(line);
      line = word;
    } else line = tried;
  }
  if (line) lines.push(line);
  return lines;
}

/** Text as a case shows it, for measuring: `upper`, `title`, `lower`, or as written. */
export function withCase(text: string, kase: "upper" | "title" | "lower" | "none" | undefined): string {
  if (kase === "upper") return text.toUpperCase();
  if (kase === "lower") return text.toLowerCase();
  if (kase === "title") return text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return text;
}

/** What a family can draw: a banner that grows needs both caps and a strip, or a centre. */
export function canGrow(family: LabelFamily): boolean {
  const p = family.pieces;
  return !!(p.left && p.right && (p.fill || p["fill-left"] || p["fill-right"] || p.centre));
}

/** Every image a family may draw. */
export function familyFiles(family: LabelFamily): TileFile[] {
  return LABEL_ROLES.flatMap((r) => family.pieces[r] ?? []);
}

/** Text height as a share of the banner's, when the pack doesn't say. */
export const LABEL_TEXT_SIZE = 0.3;
/** Pixels each piece overlaps the one before, when the pack doesn't say. */
export const LABEL_OVERLAP = 2;
/** Room kept around the text inside its box, in ems (half each side). */
export const LABEL_PAD = 1;
/** A typeface for banner text, when the pack doesn't name one. */
export const LABEL_FONT = 'Georgia, "Times New Roman", serif';

export interface ImageSizeLike {
  w: number;
  h: number;
}

export interface LabelPiece {
  url: string;
  role: LabelRole;
  /** In the banner's pixels, from its top left. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ComposedLabel {
  pieces: LabelPiece[];
  w: number;
  h: number;
  /** Where the text is centred, and its height, in the banner's pixels. */
  text: { x: number; y: number; size: number };
}

/**
 * The banner for a text `em` ems wide (at a font size of 1): the caps with as
 * many strips as the text needs, grown from the middle. Null when the family
 * can't grow or has nothing measured to draw.
 */
export function composeLabel(
  family: LabelFamily,
  em: number,
  sizeOf: (url: string) => ImageSizeLike | undefined,
  seed: string
): ComposedLabel | null {
  if (!canGrow(family)) return null;
  const share = family.tuning.size ?? LABEL_TEXT_SIZE;
  const overlap = family.tuning.overlap ?? LABEL_OVERLAP;
  const pick = (role: LabelRole, slot: number): TileFile | undefined => {
    const list = family.pieces[role];
    return list?.length ? list[hashSeed(`${seed}:${role}:${slot}`) % list.length] : undefined;
  };
  const size = (f: TileFile | undefined) => (f ? sizeOf(f.url) : undefined);
  const left = pick("left", 0);
  const right = pick("right", 0);
  const centre = pick("centre", 0);
  const sl = size(left);
  const sr = size(right);
  const sc = size(centre);
  if (!left || !right || !sl || !sr || (centre && !sc)) return null;
  const fillOf = (side: "fill-left" | "fill-right") =>
    family.pieces[side] ? side : family.pieces.fill ? "fill" : null;
  const fl = fillOf("fill-left") ?? fillOf("fill-right");
  const fr = fillOf("fill-right") ?? fl;
  const wOf = (role: LabelRole | null) => size(role ? pick(role, 0) : undefined)?.w ?? 0;
  const h = Math.max(sl.h, sr.h, sc?.h ?? 0);
  // The text box: the pack's insets, else a quarter of each cap and an eighth of the height.
  const [t, ri, b, li] = family.tuning.inset ?? [h / 8, sr.w / 4, h / 8, sl.w / 4];
  const textSize = share * h;
  const need = (em + LABEL_PAD) * textSize;
  const bare = sl.w + (sc?.w ?? 0) + sr.w - overlap * (centre ? 2 : 1) - li - ri;
  // A centre keeps the middle: strips go on in pairs, one each side.
  const step = centre ? wOf(fl) + wOf(fr) - 2 * overlap : wOf(fl) - overlap;
  const n = step > 0 ? Math.max(0, Math.ceil((need - bare) / step)) : 0;
  const order: Array<{ role: LabelRole; slot: number }> = [{ role: "left", slot: 0 }];
  if (centre) {
    for (let i = 0; i < n; i++) order.push({ role: fl as LabelRole, slot: i });
    order.push({ role: "centre", slot: 0 });
    for (let i = 0; i < n; i++) order.push({ role: fr as LabelRole, slot: n + i });
  } else {
    for (let i = 0; i < n; i++) order.push({ role: fl as LabelRole, slot: i });
  }
  order.push({ role: "right", slot: 0 });
  const pieces: LabelPiece[] = [];
  let x = 0;
  for (const [i, { role, slot }] of order.entries()) {
    const f = pick(role, slot);
    const s = size(f);
    if (!f || !s) continue;
    if (i > 0) x -= overlap;
    pieces.push({ url: f.url, role, x, y: (h - s.h) / 2, w: s.w, h: s.h });
    x += s.w;
  }
  return { pieces, w: x, h, text: { x: li + (x - li - ri) / 2, y: t + (h - t - b) / 2, size: textSize } };
}
