/**
 * Marker and label lines written back from their fields, for Mark mode's Edit
 * tool: what follows `m(q,r):` or `l(q,r):`, in the order the parser reads
 * them, with defaults left out so an edited line reads like a typed one.
 *
 *   m(q,r): pedestal-gold[star] (Mervine) [[Mervine]] size=1.2 piece
 *   l(q,r): (Dunlind) realm [[Dunlind]] size=2.9 rot=-3 arc=22 #141414
 */

import type { HexLabelLine, HexMarkerLine } from "./parse-hex-map";

/** What an edit can change on a marker. */
export type MarkerFields = Pick<HexMarkerLine, "spec" | "text" | "link" | "size" | "piece" | "caption">;
/** What an edit can change on a label. */
export type LabelFields = Pick<
  HexLabelLine,
  "text" | "family" | "link" | "size" | "rot" | "arc" | "width" | "halo" | "case" | "spacing" | "color"
>;

/** A number as a line writes it: at most two decimals, no trailing zeros. */
const num = (n: number) => String(Math.round(n * 100) / 100);

/** Brackets would end a `(Caption)` early, and `]]` a `[[Note]]`. */
const clean = (s: string | undefined) => (s ?? "").replace(/[()]/g, "").trim();
const cleanLink = (s: string | undefined) =>
  (s ?? "")
    .replace(/^\[\[|\]\]$/g, "")
    .replace(/[[\]]/g, "")
    .trim();

export function markerContent(m: MarkerFields): string {
  const parts: string[] = [];
  if (m.spec?.trim()) parts.push(m.spec.trim().replace(/\s+/g, ""));
  if (clean(m.text)) parts.push(`(${clean(m.text)})`);
  if (cleanLink(m.link)) parts.push(`[[${cleanLink(m.link)}]]`);
  if (m.size !== undefined && Math.abs(m.size - 1) > 0.001) parts.push(`size=${num(m.size)}`);
  if (m.piece) parts.push("piece");
  const c = m.caption;
  if (c?.style?.trim()) parts.push(`text=${c.style.trim().replace(/\s+/g, "")}`);
  if (c?.size !== undefined && Math.abs(c.size - 1) > 0.001) parts.push(`tsize=${num(c.size)}`);
  if (c?.offset && (c.offset[0] || c.offset[1])) parts.push(`toff=${num(c.offset[0])},${num(c.offset[1])}`);
  if (c?.arc) parts.push(`arc=${num(c.arc)}`);
  if (c?.halo !== undefined) parts.push(`tline=${c.halo === false ? "none" : c.halo}`);
  if (c?.case) parts.push(`tcase=${c.case}`);
  if (c?.rot) parts.push(`trot=${num(c.rot)}`);
  if (c?.spacing) parts.push(`tspace=${num(c.spacing)}`);
  if (c?.width) parts.push(`twidth=${num(c.width)}`);
  if (c?.color?.trim()) parts.push(c.color.trim());
  return parts.join(" ");
}

export function labelContent(l: LabelFields): string {
  const parts: string[] = [];
  if (clean(l.text)) parts.push(`(${clean(l.text)})`);
  if (l.family?.trim()) parts.push(l.family.trim().replace(/\s+/g, ""));
  if (cleanLink(l.link)) parts.push(`[[${cleanLink(l.link)}]]`);
  if (l.size !== undefined && Math.abs(l.size - 1) > 0.001) parts.push(`size=${num(l.size)}`);
  if (l.rot) parts.push(`rot=${num(l.rot)}`);
  if (l.arc) parts.push(`arc=${num(l.arc)}`);
  if (l.width) parts.push(`width=${num(l.width)}`);
  if (l.halo !== undefined) parts.push(`line=${l.halo === false ? "none" : l.halo}`);
  if (l.case) parts.push(`case=${l.case}`);
  if (l.spacing !== undefined) parts.push(`space=${num(l.spacing)}`);
  if (l.color?.trim()) parts.push(l.color.trim());
  return parts.join(" ");
}
