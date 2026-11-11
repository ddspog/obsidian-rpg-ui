/**
 * The book's type: which font and size its body text is set in, how far apart
 * its lines sit, and which other looks are headings, ranked by size.
 */

import { lineText, segText } from "./layout";
import { FACT_LINE } from "./patterns";
import type { Element, Line } from "./types";

export const family = (font: string): string =>
  font
    .replace(
      /[-_ ,]?(bold|black|heavy|semibold|semilight|demi|light|regular|medium|italic|oblique|roman|book|bd|rg|it|bdit|sb)+$/gi,
      ""
    )
    .replace(/[-_ ,]+$/, "");

const weight = (font: string): string =>
  /black|heavy|extrabold|bold|semibold|demi|[-_ ]bd\b|[-_ ]sb\b/i.test(font) ? "b" : "r";

export const styleKey = (line: Line): string =>
  `${family(line.font)}|${weight(line.font)}|${Math.round(line.size)}${line.barred ? "|bar" : ""}`;

export interface StyleBook {
  bodySize: number;
  bodyFamily: string;
  /** The usual distance between two baselines of body text. */
  leading: number;
  /** 1 for the biggest heading look, 2 for the next… 0 when the line is not a heading. */
  headingLevel(line: Line, prev?: Line, next?: Line): number;
  /** Heading looks, biggest first, with how often each is used. */
  ranks: Array<{ key: string; size: number; count: number }>;
}

const isUpper = (text: string) => {
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
};

/** A line that could be a heading by its look alone, leaving its neighbours aside. */
function candidate(line: Line, bodySize: number, bodyFamily: string): boolean {
  // A name with a short tag set at the line's far end (a creature and its rating) is still one heading.
  if (line.cells.length > 2) return false;
  if (line.cells.length === 2 && segText(line.cells[1]).length > 12) return false;
  const text = lineText(line);
  if (text.length > 90 || text.length < 2) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(text)) return false;
  if (line.barred) return true;
  if (line.font.startsWith("ocr")) {
    // A scan's sizes waver by a fifth from line to line: only a clearly bigger line, or a bold
    // one that reads as a title, is a heading there.
    if (/[.,;:]$/.test(text) || !/^[A-Z0-9À-Ý]/.test(text) || FACT_LINE.test(text)) return false;
    if (line.size >= bodySize * 1.35) return true;
    return line.cells[0].spans.every((s) => s.bold) && text.length <= 60 && line.size >= bodySize * 0.9;
  }
  if (line.size >= bodySize * 1.12) return true;
  if (line.size < bodySize * 0.97) return false;
  // At the body's size, a line that is a fact (a label and its value) is not a heading, bold as it may be.
  if (FACT_LINE.test(text) || /\d\)?$/.test(text)) return false;
  if (/[.,;:]$/.test(text) && !isUpper(text)) return false;
  const spans = line.cells[0].spans;
  if (family(line.font) !== bodyFamily) return isUpper(text) || spans.every((s) => s.bold) || text.length <= 50;
  return spans.every((s) => s.bold && !s.italic) && text.length <= 60;
}

export function readStyles(elements: Element[]): StyleBook {
  const lines = elements.flatMap((el) => (el.kind === "line" ? [el.line] : []));
  const chars = new Map<string, { n: number; size: number; fam: string }>();
  for (const line of lines) {
    const size = Math.round(line.size * 2) / 2;
    const key = `${family(line.font)}|${size}`;
    const hit = chars.get(key) ?? { n: 0, size, fam: family(line.font) };
    hit.n += lineText(line).length;
    chars.set(key, hit);
  }
  const body = [...chars.values()].sort((a, b) => b.n - a.n)[0] ?? { size: 10, fam: "", n: 0 };
  const bodySize = body.size;
  const bodyFamily = body.fam;

  const gaps = new Map<number, number>();
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1];
    const b = lines[i];
    if (a.page !== b.page || Math.abs(a.size - bodySize) > 0.6 || Math.abs(b.size - bodySize) > 0.6) continue;
    const dy = Math.round((b.base - a.base) * 2) / 2;
    if (dy > 0.8 * bodySize && dy < 2.2 * bodySize) gaps.set(dy, (gaps.get(dy) ?? 0) + 1);
  }
  const leading = [...gaps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? bodySize * 1.25;

  const count = new Map<string, { key: string; size: number; count: number; bar: boolean; w: string }>();
  // How often each look is used at all, and how often on a line that stands alone among other looks.
  const used = new Map<string, { all: number; alone: number }>();
  lines.forEach((line, i) => {
    const key = styleKey(line);
    const u = used.get(key) ?? { all: 0, alone: 0 };
    u.all++;
    const same = (o?: Line) => !!o && o.page === line.page && styleKey(o) === key;
    if (!same(lines[i - 1]) && !same(lines[i + 1])) u.alone++;
    used.set(key, u);
    if (!candidate(line, bodySize, bodyFamily)) return;
    const hit = count.get(key) ?? { key, size: line.size, count: 0, bar: !!line.barred, w: weight(line.font) };
    hit.count++;
    count.set(key, hit);
  });
  // A look near the body's size that mostly runs on for lines is text in a second face (a stat
  // block set in a sans, a sidebar), not a heading, however short some of its lines are.
  for (const [key, st] of count) {
    const u = used.get(key);
    if (st.size < bodySize * 1.12 && !st.bar && u && u.alone / u.all < 0.5) count.delete(key);
  }
  const order = { x: 0, b: 1, r: 2 } as Record<string, number>;
  // Display sizes rank by size. Among looks near the body's size, a bar behind the line marks an
  // entry's name (a spell, an item), which outranks the small headings of an inset such as a stat block.
  const tier = (st: { size: number; bar: boolean }) => (st.size >= bodySize * 1.25 ? 0 : st.bar ? 1 : 2);
  const ranks = [...count.values()]
    .filter((st) => st.count >= 2 || st.size >= bodySize * 1.5)
    .sort(
      (a, b) =>
        tier(a) - tier(b) ||
        Math.round(b.size) - Math.round(a.size) ||
        Number(b.bar) - Number(a.bar) ||
        order[a.w] - order[b.w]
    );
  const level = new Map(ranks.map((r, i) => [r.key, i + 1]));

  return {
    bodySize,
    bodyFamily,
    leading,
    ranks,
    headingLevel(line, prev, next) {
      if (!candidate(line, bodySize, bodyFamily)) return 0;
      const key = styleKey(line);
      const lv = level.get(key) ?? 0;
      if (!lv) return 0;
      // Body-sized looks only count when the line stands alone among lines of another look.
      if (line.size < bodySize * 1.12 && !line.barred) {
        const alike = (o?: Line) =>
          !!o && o.page === line.page && styleKey(o) === key && Math.abs(o.base - line.base) < 2.5 * line.size;
        if (alike(prev) && alike(next)) return 0;
      }
      return lv;
    },
  };
}
