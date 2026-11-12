/**
 * A page's runs of text, laid out: joined into segments, sorted into the
 * boxes that shade them (tables, sidebars) and the columns of the page, and
 * put in reading order.
 */

import type { Box, Element, FillRect, Line, PageImage, RawPage, Rect, Seg, Span, TextRun } from "./types";

const right = (r: Rect) => r.x + r.w;
const bottom = (r: Rect) => r.y + r.h;

/**
 * How far apart two baselines may lie and still be one line. Type of two sizes set side by side (a
 * big number between two small ones) sits on baselines a little apart: the bigger size decides.
 */
const sameBase = (a: number, b: number): number =>
  Math.max(1.5, 0.22 * (Math.max(a, b) > 1.25 * Math.min(a, b) ? Math.max(a, b) : Math.min(a, b)));

/**
 * A drop capital is drawn on the baseline of the paragraph's second or third line, apart from the
 * word it opens: it is put back at the head of the paragraph's first line.
 */
export function foldDropCaps(runs: TextRun[]): TextRun[] {
  const sizes = runs.filter((r) => r.str.trim()).map((r) => r.size);
  sizes.sort((a, b) => a - b);
  const usual = sizes[Math.floor(sizes.length / 2)] ?? 10;
  const out = [...runs];
  for (const cap of runs) {
    if (!/^[A-ZÀ-Ý]$/.test(cap.str.trim()) || cap.size < 2.5 * usual) continue;
    const beside = out
      .filter((r) => r !== cap && r.str.trim() && r.size < 0.6 * cap.size)
      .filter((r) => r.y >= cap.y - cap.size && r.y <= cap.y - 2 && r.x > cap.x && r.x < cap.x + 2 * cap.size)
      .sort((a, b) => a.y - b.y || a.x - b.x)[0];
    if (!beside) continue;
    out[out.indexOf(beside)] = { ...beside, str: cap.str.trim() + beside.str.replace(/^\s+/, "") };
    out.splice(out.indexOf(cap), 1);
  }
  return out;
}

/** Runs on one baseline joined into segments; a gap wider than a word space starts a new one. */
export function buildSegs(runs: TextRun[]): Seg[] {
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: TextRun[][] = [];
  for (const run of sorted) {
    const row = rows[rows.length - 1];
    const ref = row?.[0];
    if (ref && Math.abs(run.y - ref.y) <= sameBase(ref.size, run.size)) row.push(run);
    else rows.push([run]);
  }
  const segs: Seg[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let cur: { seg: Seg; end: number; chars: Map<string, number>; sizes: Map<number, number> } | null = null;
    let space = false;
    let last: TextRun | null = null;
    const close = () => {
      if (!cur) return;
      const seg = cur.seg;
      seg.w = cur.end - seg.x;
      seg.font = [...cur.chars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      seg.size = [...cur.sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? seg.size;
      seg.h = seg.size;
      seg.y = seg.base - seg.size;
      // Trim the spaces a run may end or start with.
      const first = seg.spans[0];
      const lastSpan = seg.spans[seg.spans.length - 1];
      if (first) first.text = first.text.replace(/^\s+/, "");
      if (lastSpan) lastSpan.text = lastSpan.text.replace(/\s+$/, "");
      seg.spans = seg.spans.filter((s) => s.text);
      if (seg.spans.length) segs.push(seg);
      cur = null;
    };
    for (const run of row) {
      if (!run.str.trim()) {
        space = true;
        continue;
      }
      // A word drawn twice in the same place is a faked bold.
      if (last && last.str === run.str && Math.abs(last.x - run.x) < 0.6) continue;
      const gap = cur ? run.x - cur.end : 0;
      // A scan's word spacing wavers: only a clearly wide gap parts two cells there.
      const reach = run.font.startsWith("ocr") ? 1.7 : 0.9;
      if (cur && gap > Math.max(reach * Math.min(run.size, cur.seg.size), 6.5)) close();
      if (!cur) {
        cur = {
          seg: { x: run.x, y: 0, w: 0, h: 0, spans: [], size: run.size, font: run.font, base: run.y },
          end: run.x,
          chars: new Map(),
          sizes: new Map(),
        };
        space = false;
      }
      const spans = cur.seg.spans;
      const prev = spans[spans.length - 1];
      let text = run.str;
      const needsSpace = prev && !/\s$/.test(prev.text) && !/^\s/.test(text) && (space || gap > 0.18 * run.size);
      if (needsSpace) text = " " + text;
      if (prev && prev.bold === run.bold && prev.italic === run.italic) prev.text += text;
      else spans.push({ text, bold: run.bold, italic: run.italic });
      // Spaces a run trails off with take room but hold no ink.
      const inked = run.str.replace(/\s+$/, "").length / run.str.length;
      cur.end = Math.max(cur.end, run.x + run.w * inked);
      cur.chars.set(run.font, (cur.chars.get(run.font) ?? 0) + run.str.length);
      const size = Math.round(run.size * 2) / 2;
      cur.sizes.set(size, (cur.sizes.get(size) ?? 0) + run.str.length);
      space = false;
      last = run;
    }
    close();
  }
  return segs;
}

export const segText = (seg: Seg): string => seg.spans.map((s) => s.text).join("");
export const lineText = (line: Line): string => line.cells.map(segText).join(" ");
export const lineSpans = (line: Line): Span[] => {
  const out: Span[] = [];
  line.cells.forEach((cell, i) => {
    if (i) out.push({ text: " ", bold: false, italic: false });
    out.push(...cell.spans.map((s) => ({ ...s })));
  });
  return out;
};

/** Segments grouped by baseline into lines, top to bottom, cells left to right. */
export function buildLines(segs: Seg[], page: number, colL: number, colR: number): Line[] {
  const sorted = [...segs].sort((a, b) => a.base - b.base || a.x - b.x);
  const lines: Line[] = [];
  for (const seg of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(seg.base - line.base) <= sameBase(line.size, seg.size)) {
      line.cells.push(seg);
      line.r = Math.max(line.r, right(seg));
      line.x = Math.min(line.x, seg.x);
    } else {
      lines.push({
        cells: [seg],
        x: seg.x,
        r: right(seg),
        base: seg.base,
        size: seg.size,
        font: seg.font,
        page,
        colL,
        colR,
      });
    }
  }
  for (const line of lines) {
    line.cells.sort((a, b) => a.x - b.x);
    // The line's look is its longest cell's.
    const main = [...line.cells].sort((a, b) => segText(b).length - segText(a).length)[0];
    line.size = main.size;
    line.font = main.font;
  }
  return lines;
}

/** Shading rectangles that belong together (a table's header and its stripes) made one box each. */
export function mergeRects(rects: FillRect[]): Array<Rect & { headBottom?: number; titleBottom?: number }> {
  type B = Rect & { headBottom?: number; titleBottom?: number; parts: FillRect[] };
  let boxes: B[] = rects.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h, parts: [r] }));
  const inside = (a: Rect, b: Rect) =>
    a.x >= b.x - 3 && right(a) <= right(b) + 3 && a.y >= b.y - 3 && bottom(a) <= bottom(b) + 3;
  const stacked = (a: Rect, b: Rect) => {
    if (Math.abs(a.x - b.x) > 4 || Math.abs(right(a) - right(b)) > 4) return false;
    const gap = Math.max(a.y, b.y) - Math.min(bottom(a), bottom(b));
    return gap <= 26;
  };
  // Shading drawn cell by cell: the cells of a row sit side by side.
  const beside = (a: Rect, b: Rect) => {
    if (Math.abs(a.y - b.y) > 3 || Math.abs(bottom(a) - bottom(b)) > 3) return false;
    return Math.max(a.x, b.x) - Math.min(right(a), right(b)) <= 4;
  };
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (inside(a, b) || inside(b, a) || stacked(a, b) || beside(a, b)) {
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          boxes[i] = {
            x,
            y,
            w: Math.max(right(a), right(b)) - x,
            h: Math.max(bottom(a), bottom(b)) - y,
            parts: [...a.parts, ...b.parts],
          };
          boxes = boxes.filter((_, k) => k !== j);
          merged = true;
          break outer;
        }
      }
    }
  }
  for (const box of boxes) {
    // A dark strip across the top of the box holds a table's header rows.
    const head = box.parts
      .filter((p) => p.dark && p.y <= box.y + 3 && p.w >= box.w - 8 && p.h < 0.6 * box.h + 1)
      .sort((a, b) => b.h - a.h)[0];
    if (head && box.parts.length > 1) box.headBottom = bottom(head);
  }
  // A grid drawn with rules: only its header band and its first column are shaded. The column
  // hangs from the band's left end, and the table is as wide as the band and as tall as the two.
  for (const band of boxes) {
    const column = boxes.find(
      (c) =>
        c !== band &&
        Math.abs(c.x - band.x) <= 4 &&
        Math.abs(c.y - bottom(band)) <= 4 &&
        c.w < 0.5 * band.w &&
        c.h > band.h
    );
    if (!column) continue;
    // What the band's dark strip holds is the table's title; the rest of the band its header.
    if (band.headBottom !== undefined && band.headBottom < bottom(band) - 4) band.titleBottom = band.headBottom;
    band.headBottom = bottom(band);
    band.h = bottom(column) - band.y;
    boxes = boxes.filter((b) => b !== column);
  }
  return boxes.map(({ parts: _parts, ...rest }) => rest);
}

export interface Gutter {
  x0: number;
  x1: number;
}

/** The empty strips that run down the page between its columns of text. */
export function findGutters(segs: Seg[]): Gutter[] {
  if (segs.length < 8) return [];
  const minX = Math.floor(Math.min(...segs.map((s) => s.x)));
  const maxX = Math.ceil(Math.max(...segs.map(right)));
  const width = maxX - minX;
  if (width < 200) return [];
  const rows = new Set(segs.map((s) => Math.round(s.base / 2))).size;
  if (rows < 6) return [];
  const cover = new Array<number>(width + 1).fill(0);
  // Display type (a chapter's title across the page's top) lies over the columns, not in them.
  const sizes = segs.map((s) => s.size).sort((a, b) => a - b);
  const display = 1.6 * sizes[Math.floor(sizes.length / 2)];
  for (const s of segs) {
    if (s.size > display) continue;
    const a = Math.max(0, Math.floor(s.x) - minX);
    const b = Math.min(width, Math.ceil(right(s)) - minX);
    for (let i = a; i <= b; i++) cover[i]++;
  }
  const limit = Math.max(1, Math.floor(0.07 * rows));
  const strips: Gutter[] = [];
  let start = -1;
  for (let i = 0; i <= width + 1; i++) {
    const empty = i <= width && cover[i] <= limit;
    if (empty && start < 0) start = i;
    if (!empty && start >= 0) {
      if (i - start >= 8 && start > 0.12 * width && i < 0.88 * width) strips.push({ x0: minX + start, x1: minX + i });
      start = -1;
    }
  }
  // A column must hold some text of its own, or its gutter is a gap inside a table.
  const kept: Gutter[] = [];
  let leftEdge = minX;
  for (const g of strips) {
    const inCol = segs.filter((s) => s.x >= leftEdge - 1 && right(s) <= g.x0 + 1);
    const colRows = new Set(inCol.map((s) => Math.round(s.base / 2))).size;
    const letters = inCol.reduce((n, s) => n + segText(s).length, 0);
    if (colRows >= 4 && g.x0 - leftEdge >= 0.14 * width && letters / Math.max(1, colRows) >= 8) {
      kept.push(g);
      leftEdge = g.x1;
    }
  }
  const lastCol = segs.filter((s) => s.x >= leftEdge - 1);
  if (kept.length && new Set(lastCol.map((s) => Math.round(s.base / 2))).size < 4) kept.pop();
  return kept;
}

/** True when the lines read as a table's rows, not as prose set in two columns. */
export function looksTabular(lines: Line[], width: number, hasHead: boolean): boolean {
  // A column of numbers counting up down the box's left edge: a table rolled on a die, however
  // long the text beside each number runs.
  // (Measured from the leftmost numbered line: a header may be set a little further out.)
  const numberedLine = (l: Line) => /^\d{1,4}(\s*[-–—]\s*\d{0,4})?$/.test(segText(l.cells[0]).trim());
  const left = Math.min(...lines.filter(numberedLine).map((l) => l.cells[0].x), Infinity);
  // Numbers that go up down the edge, gaps allowed (a row whose number was set elsewhere).
  const found: Array<[number, number]> = [];
  // (A range broken over two lines, `45-` then `50`, is one number.)
  let broken = false;
  for (const l of lines) {
    if (l.cells[0].x > left + 6) continue;
    const hit = segText(l.cells[0])
      .trim()
      .match(/^(\d{1,4})(?:\s*([-–—])\s*(\d{1,4})?)?$/);
    if (!hit) continue;
    const lo = Number(hit[1]) || 10 ** hit[1].length;
    if (broken) {
      broken = false;
      if (found.length) found[found.length - 1][1] = lo;
      continue;
    }
    broken = !!hit[2] && !hit[3];
    found.push([lo, hit[3] ? Number(hit[3]) || 10 ** hit[3].length : lo]);
  }
  let up = 0;
  for (let i = 1; i < found.length; i++) if (found[i][0] > found[i - 1][1]) up++;
  const counted = found.length >= 3 && up >= 0.8 * (found.length - 1) ? found.length : 0;
  if (counted >= 3) return true;
  // One stripe of a striped table: a row or two, each number at the left edge with its text
  // hanging in a column to the right of it, never back at the margin.
  if (found.length >= 1 && found.length <= 2 && lines.length >= 2) {
    const rest = lines.filter((l) => !numberedLine(l));
    const textCol = Math.min(...lines.map((l) => (numberedLine(l) ? (l.cells[1]?.x ?? Infinity) : l.x)));
    if (Number.isFinite(textCol) && textCol > left + 15 && rest.every((l) => l.x >= textCol - 3)) return true;
  }
  const multi = lines.filter((l) => l.cells.length >= 2);
  if (multi.length < 2) return false;
  if (multi.length / lines.length < (hasHead ? 0.25 : 0.4)) return false;
  if (multi.every((l) => l.cells.length === 2)) {
    const widths = multi.flatMap((l) => l.cells.map((c) => c.w)).sort((a, b) => a - b);
    const median = widths[Math.floor(widths.length / 2)];
    if (median > 0.34 * width && !hasHead) return false;
  }
  return true;
}

/**
 * A box that sits in one column fills it as text does: each of its lines stands as one piece the
 * width of the box, so a column that holds nothing but a table is still seen as a column.
 */
function boxRows(segs: Seg[], boxes: Box[]): Seg[] {
  const xs = [...segs.map((s) => s.x), ...boxes.map((b) => b.x)];
  const rs = [...segs.map(right), ...boxes.map(right)];
  const width = Math.max(...rs) - Math.min(...xs);
  return boxes
    .filter((b) => b.w < 0.55 * width)
    .flatMap((b) =>
      b.lines.map((l) => ({
        x: b.x,
        y: l.base - l.size,
        w: b.w,
        h: l.size,
        spans: [{ text: lineText(l), bold: false, italic: false }],
        size: l.size,
        font: l.font,
        base: l.base,
      }))
    );
}

interface FlowItem {
  y: number;
  el: Element;
}

/**
 * Segments (and boxes and pictures) in reading order: across the page's
 * bands, down each column in turn. Anything that crosses a gutter splits the
 * page into the band above it and the band below.
 */
function flow(
  segs: Seg[],
  boxes: Box[],
  images: PageImage[],
  page: number,
  prefer: Gutter[][],
  bounds?: Rect
): Element[] {
  if (!segs.length && !boxes.length && !images.length) return [];
  let gutters = findGutters([...segs, ...boxRows(segs, boxes)]);
  const rows = new Set(segs.map((s) => Math.round(s.base / 2))).size;
  // (A page that is mostly tables in columns has few lines of its own: its tables' rows count
  // towards having enough to judge by, though not towards what may cross a gutter.)
  const allRows = new Set([...segs, ...boxRows(segs, boxes)].map((s) => Math.round(s.base / 2))).size;
  for (const cand of prefer) {
    if (!cand.length || allRows < 6) continue;
    const same =
      cand.length === gutters.length &&
      cand.every((g, i) => Math.abs((g.x0 + g.x1) / 2 - (gutters[i].x0 + gutters[i].x1) / 2) < 8);
    if (same) break;
    // The book's usual columns win when this page leaves their gutters clear.
    const clear = cand.every((g) => {
      const mid = (g.x0 + g.x1) / 2;
      const crossing = segs.filter((s) => s.x < mid - 3 && right(s) > mid + 3).length;
      const leftSide = segs.some((s) => right(s) <= mid);
      const rightSide = segs.some((s) => s.x >= mid);
      if (!leftSide || !rightSide) return false;
      if (crossing <= Math.max(2, 0.15 * rows)) return true;
      // A page of two columns for part of its height only (a wide table above them, a wide
      // paragraph below): enough lines of text stand on both sides of the gutter at once.
      const all = [...segs, ...boxRows(segs, boxes)];
      const sides = new Map<number, { l: number; r: number }>();
      for (const sg of all) {
        if (sg.x < mid - 3 && right(sg) > mid + 3) continue;
        // (In strips of a couple of lines: the two columns' baselines need not match.)
        const strip = Math.round(sg.base / 24);
        const row = sides.get(strip) ?? { l: 0, r: 0 };
        if (right(sg) <= mid + 3) row.l += segText(sg).length;
        else row.r += segText(sg).length;
        sides.set(strip, row);
      }
      const both = [...sides.values()].filter((row) => row.l && row.r);
      const letters = (side: "l" | "r") => both.reduce((n, row) => n + row[side], 0) / Math.max(1, both.length);
      return crossing <= 0.6 * rows && both.length >= 5 && letters("l") >= 14 && letters("r") >= 14;
    });
    if (clear) {
      gutters = cand.map((g) => {
        const mid = (g.x0 + g.x1) / 2;
        return { x0: mid - 4, x1: mid + 4 };
      });
      break;
    }
  }

  const minX = bounds?.x ?? Math.min(...segs.map((s) => s.x), ...boxes.map((b) => b.x), Infinity);
  const maxX = bounds ? right(bounds) : Math.max(...segs.map(right), ...boxes.map(right), -Infinity);
  const edges = [minX, ...gutters.map((g) => (g.x0 + g.x1) / 2), maxX];
  const colOf = (x: number) => {
    for (let i = 0; i < gutters.length; i++) if (x < (gutters[i].x0 + gutters[i].x1) / 2) return i;
    return gutters.length;
  };
  const crosses = (r: Rect, pad: number) => gutters.some((g) => r.x < g.x0 - pad && right(r) > g.x1 + pad);

  // What crosses a gutter, with the columns it lies over.
  const spanning: Array<FlowItem & { c0: number; c1: number }> = [];
  const over = (r: Rect) => ({ c0: colOf(r.x + 3), c1: colOf(right(r) - 3) });
  const perCol: { segs: Seg[]; items: FlowItem[] }[] = edges.slice(1).map(() => ({ segs: [], items: [] }));
  const spanSegs: Seg[] = [];
  for (const seg of segs) {
    if (crosses(seg, 6)) spanSegs.push(seg);
    else perCol[colOf(seg.x + Math.min(seg.w / 2, 20))].segs.push(seg);
  }
  for (const line of buildLines(spanSegs, page, minX, maxX)) {
    const box = { x: line.x, y: 0, w: line.r - line.x, h: 0 };
    spanning.push({ y: line.base, el: { kind: "line", line }, ...over(box) });
    line.colL = edges[colOf(line.x + 3)];
    line.colR = edges[colOf(line.r - 3) + 1];
  }
  for (const box of boxes) {
    const item: FlowItem = { y: box.y, el: { kind: "box", box } };
    if (crosses(box, 10)) spanning.push({ ...item, ...over(box) });
    else perCol[colOf(box.x + box.w / 2)].items.push(item);
  }
  for (const image of images) {
    const col = colOf(image.x + Math.min(image.w / 2, 30));
    const colW = edges[col + 1] - edges[col];
    perCol[col].items.push({ y: image.y, el: { kind: "image", image, page, colW } });
  }
  perCol.forEach((col, i) => {
    const colL = col.segs.length ? Math.min(...col.segs.map((s) => s.x)) : edges[i];
    const colR = col.segs.length ? Math.max(...col.segs.map(right)) : edges[i + 1];
    for (const line of buildLines(col.segs, page, colL, colR))
      col.items.push({ y: line.base - line.size, el: { kind: "line", line } });
    col.items.sort((a, b) => a.y - b.y);
  });
  spanning.sort((a, b) => a.y - b.y);

  // Columns that something lies across read together, band by band between the things across
  // them; a column nothing crosses reads top to bottom on its own (a list beside a two-column text).
  const groups: Array<{ c0: number; c1: number }> = [];
  for (const s of [...spanning].sort((a, b) => a.c0 - b.c0)) {
    const last = groups[groups.length - 1];
    if (last && s.c0 <= last.c1) last.c1 = Math.max(last.c1, s.c1);
    else groups.push({ c0: s.c0, c1: s.c1 });
  }
  const out: Element[] = [];
  for (let c = 0; c < perCol.length; c++) {
    const group = groups.find((g) => g.c0 === c);
    if (!group) {
      if (!groups.some((g) => c > g.c0 && c <= g.c1)) for (const item of perCol[c].items) out.push(item.el);
      continue;
    }
    const across = spanning.filter((s) => s.c0 >= group.c0 && s.c1 <= group.c1);
    // A table's caption set at the margin just above something that lies across the columns
    // heads it: it is read after the columns beside it, not as the last line of the first of them.
    const heads = new Map<FlowItem, FlowItem[]>();
    const headed = new Set<FlowItem>();
    for (const s of across) {
      const mine = perCol[group.c0].items.filter(
        (item) =>
          item.el.kind === "line" &&
          item.y < s.y &&
          s.y - item.el.line.base <= 48 &&
          /^(table|figure)\s+[A-Z]?\d/i.test(lineText(item.el.line)) &&
          !headed.has(item)
      );
      // (Only when nothing else of its column lies between the two.)
      const last = mine[mine.length - 1];
      if (!last || perCol[group.c0].items.some((item) => item.y > last.y && item.y < s.y && !mine.includes(item)))
        continue;
      heads.set(s, [last]);
      headed.add(last);
    }
    let top = -Infinity;
    for (let i = 0; i <= across.length; i++) {
      const cut = i < across.length ? across[i].y - 2 : Infinity;
      for (let k = group.c0; k <= group.c1; k++)
        for (const item of perCol[k].items) if (item.y >= top && item.y < cut && !headed.has(item)) out.push(item.el);
      if (i < across.length) {
        for (const head of heads.get(across[i]) ?? []) out.push(head.el);
        out.push(across[i].el);
      }
      top = cut;
    }
  }
  return out;
}

/**
 * A table's shading need not cover all of it: a first column, the header
 * above the first stripe and a last row below the last one are often left
 * white. Text on the table's baselines beside it, rows of cells just above
 * it and just below it are taken into the box. True when anything was.
 */
function growTable(box: Box, segs: Seg[], taken: Set<Seg>, page: number, gutters: Gutter[]): boolean {
  const width0 = box.w;
  const mine = box.lines.flatMap((l) => l.cells);
  const bases = box.lines.map((l) => l.base).sort((a, b) => a - b);
  const pitches = bases
    .slice(1)
    .map((b, i) => b - bases[i])
    .sort((a, b) => a - b);
  const pitch = pitches[Math.floor(pitches.length / 2)] ?? 12;
  const top0 = box.y;
  let grew = false;
  const add = (seg: Seg) => {
    taken.add(seg);
    mine.push(seg);
    const r = Math.max(right(box), right(seg));
    const b = Math.max(bottom(box), seg.base + 2);
    box.x = Math.min(box.x, seg.x - 1);
    box.y = Math.min(box.y, seg.base - seg.size);
    box.w = r - box.x;
    box.h = b - box.y;
    grew = true;
  };
  // Text across a gutter from the table is the next column's, however close it comes.
  const mids = gutters.map((g) => (g.x0 + g.x1) / 2).filter((m) => !(box.x < m - 8 && right(box) > m + 8));
  const centre = box.x + box.w / 2;
  const sameSide = (s: Seg) => mids.every((m) => s.x + s.w / 2 < m === centre < m);
  // Only text set like the table's own: a heading or a caption beside it is neither a cell nor a row.
  const sizes = mine.map((s) => s.size).sort((a, b) => a - b);
  const size = sizes[Math.floor(sizes.length / 2)] ?? 10;
  const free = () => segs.filter((s) => !taken.has(s) && sameSide(s) && Math.abs(s.size - size) <= 0.16 * size);
  // A table with a dark header strip is drawn whole but for a last white row; one shaded cell by
  // cell or in stripes alone may lack its first column and its header too.
  const open = box.headBottom === undefined;
  // Beside: on a row's baseline, within reach of the box's edge.
  for (const seg of open ? free() : []) {
    const onRow = bases.some((b) => Math.abs(b - seg.base) <= 2.5);
    const near = right(seg) > box.x - 45 && seg.x < right(box) + 45;
    if (onRow && near && seg.w < 0.7 * width0) add(seg);
  }
  // Below and above: whole rows of cells that carry the table on, one pitch at a time.
  const reach = Math.max(1.7 * pitch + 2, 3.3 * size);
  for (const dir of open ? [1, -1] : [1]) {
    // Lines of a row whose cells wrap, or of a header set on several lines: taken once a row of cells is.
    let held: Seg[] = [];
    let rowBase = NaN;
    let headed = false;
    for (let step = 0; step < (dir > 0 ? 60 : 4); step++) {
      const all = [...mine, ...held];
      const edge = dir > 0 ? Math.max(...all.map((s) => s.base)) : Math.min(...all.map((s) => s.base));
      // The very next line, whatever it is set in: a heading or a line of prose there ends the table.
      const within = (sg: Seg) => {
        const dy = (sg.base - edge) * dir;
        return dy > 2 && dy <= (held.length ? 1.5 * size : reach) && sg.x >= box.x - 6 && right(sg) <= right(box) + 6;
      };
      const near = segs.filter((sg) => !taken.has(sg) && !held.includes(sg) && sameSide(sg) && within(sg));
      if (!near.length) {
        // A last row whose number stands alone beside its lines of text.
        const left = Math.min(...mine.map((sg) => sg.x));
        if (
          dir > 0 &&
          held.some((sg) => Math.abs(sg.x - left) <= 4 && /^\d{1,4}(\s*[-–—]\s*\d{1,4})?$/.test(segText(sg)))
        )
          held.forEach(add);
        break;
      }
      const first = dir > 0 ? Math.min(...near.map((sg) => sg.base)) : Math.max(...near.map((sg) => sg.base));
      const line = near.filter((sg) => Math.abs(sg.base - first) <= 2.5);
      // A row has cells that start where the table's columns do, set like the table's text.
      // (A header's labels may be set a little off their columns: over a column is near enough.)
      const starts = mine.map((sg) => sg.x);
      // (Cells set centred in their columns line up by their middles.)
      const middles = mine.map((sg) => sg.x + sg.w / 2);
      const centred = (sg: Seg) => middles.some((m) => Math.abs(m - (sg.x + sg.w / 2)) <= 3);
      const over = (sg: Seg) =>
        dir < 0 && mine.some((m) => sg.x < right(m) && right(sg) > m.x && Math.abs(sg.x - m.x) <= 14);
      const fits = line.filter(
        (sg) =>
          Math.abs(sg.size - size) <= 0.16 * size &&
          (starts.some((x) => Math.abs(x - sg.x) <= 4) || centred(sg) || over(sg))
      );
      if (fits.length < line.length) break;
      if (line.length < 2) {
        // One cell on a line of its own: a cell's wrapped text, above or below the row it belongs to.
        const after = !Number.isNaN(rowBase) && Math.abs(line[0].base - rowBase) <= 1.5 * size;
        if (after) add(line[0]);
        else held.push(line[0]);
        continue;
      }
      if (dir < 0) {
        // Upwards, a numbered row must be the one before the table's first; a row of labels is
        // the header, and nothing above a header is the table's.
        const range = (sg: Seg) =>
          segText(sg)
            .trim()
            .match(/^(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?$/);
        const lowest = [...line].sort((a, b) => a.x - b.x)[0];
        const mineTop = [...mine].filter((sg) => range(sg)).sort((a, b) => a.base - b.base || a.x - b.x)[0];
        const hit = range(lowest);
        // (Above the header's row of labels only the rest of the header may lie, never a row.)
        if (headed && hit) break;
        if (hit && mineTop) {
          const hi = Number(hit[2] ?? hit[1]);
          if (hi + 1 !== Number((range(mineTop) as RegExpMatchArray)[1])) break;
        }
        held.forEach(add);
        held = [];
        line.forEach(add);
        rowBase = first;
        if (!hit) headed = true;
        continue;
      }
      held.forEach(add);
      held = [];
      line.forEach(add);
      rowBase = first;
    }
  }
  if (!grew) return false;
  // What now sits above the first stripe is the header.
  box.lines = buildLines(mine, page, box.x, right(box));
  if (box.headBottom === undefined && box.y < top0 - 3) {
    box.headBottom = top0;
    // Rows above the first stripe that carry a number are rows, not the header: the header is
    // what is set bold above the first of them, if anything is.
    const above = box.lines.filter((l) => l.base - l.size / 3 <= top0 + 1);
    const isRow = (l: Line) => /^\d{1,4}(\s*[-–—]\s*\d{0,4})?$/.test(segText(l.cells[0]).trim());
    if (above.some(isRow)) {
      const bold = (l: Line) => l.cells.every((c) => c.spans.every((sp) => sp.bold));
      let n = 0;
      while (n < above.length && bold(above[n]) && !isRow(above[n])) n++;
      box.headBottom = n ? above[n - 1].base + 1 : undefined;
    }
  }
  return true;
}

/** A filled strip that runs most of the way down the page at its left or right edge, a fifth of it wide at most. */
const isEdgeStrip = (page: RawPage) => (r: FillRect) =>
  r.h >= 0.7 * page.height &&
  r.w <= 0.2 * page.width &&
  r.w >= 12 &&
  (r.x <= 0.03 * page.width || right(r) >= 0.97 * page.width);

export interface LayoutOptions {
  /** True for text that is page furniture (a running head, a page number). */
  furniture?: (seg: Seg, page: RawPage) => boolean;
  /** The book's usual gutters, most common first. */
  prefer?: Gutter[][];
}

export interface PageLayout {
  elements: Element[];
  gutters: Gutter[];
  segs: Seg[];
}

export function layoutPage(page: RawPage, opts: LayoutOptions = {}): PageLayout {
  let segs = buildSegs(foldDropCaps(page.runs));
  if (opts.furniture) segs = segs.filter((s) => !opts.furniture?.(s, page));
  // A dark strip down the page's outer edge is dressing, and so are the words set on it.
  const strips = page.rects.filter(isEdgeStrip(page));
  if (strips.length) {
    const on = (s: Seg) =>
      strips.some((r) => s.x + s.w / 2 >= r.x && s.x + s.w / 2 <= right(r) && s.base >= r.y && s.base <= bottom(r));
    segs = segs.filter((s) => !on(s));
  }
  const merged = mergeRects(page.rects.filter((r) => !strips.includes(r)));
  const boxes: Box[] = [];
  const taken = new Set<Seg>();
  // Smallest boxes first, so text in a box within a box goes to the inner one.
  for (const rect of [...merged].sort((a, b) => a.w * a.h - b.w * b.h)) {
    const mine = segs.filter(
      (s) =>
        !taken.has(s) &&
        s.x + s.w / 2 >= rect.x - 1.5 &&
        s.x + s.w / 2 <= right(rect) + 1.5 &&
        s.base - s.size / 3 >= rect.y - 1.5 &&
        s.base - s.size / 3 <= bottom(rect) + 1.5
    );
    if (!mine.length) continue;
    const lines = buildLines(mine, page.num, rect.x, right(rect));
    if (lines.length <= 1 && rect.h < 26 && (lines[0]?.cells.length ?? 0) <= 1) {
      // A bar behind a single line is a heading's rule, not a box: the line stays in the flow.
      for (const seg of mine) (seg as Seg & { barred?: boolean }).barred = true;
      continue;
    }
    for (const seg of mine) taken.add(seg);
    boxes.push({ ...rect, lines, page: page.num });
  }
  // Stripes of one table with two unshaded rows between them: boxes of the very same width, one
  // under the other, each holding a row of cells. (A heading's bar holds one cell, and stays apart.)
  const numbered = (l: Line) => /^\d{1,4}(\s*[-–—]\s*\d{0,4})?$/.test(segText(l.cells[0]).trim());
  const rowed = (b: Box) => b.lines.some((l) => l.cells.length >= 2 || (numbered(l) && l.x <= b.x + 30));
  for (let again = true; again; ) {
    again = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        const same = Math.abs(a.x - b.x) <= 2 && Math.abs(right(a) - right(b)) <= 2;
        const gap = Math.max(a.y, b.y) - Math.min(bottom(a), bottom(b));
        if (!same || gap > 62 || !rowed(a) || !rowed(b)) continue;
        const y = Math.min(a.y, b.y);
        const upper = a.y <= b.y ? a : b;
        const lower = upper === a ? b : a;
        // The unshaded rows between the two stripes are the table's too.
        const between = segs.filter(
          (sg) =>
            !taken.has(sg) &&
            sg.x >= a.x - 1.5 &&
            right(sg) <= right(a) + 1.5 &&
            sg.base > bottom(upper) - 1.5 &&
            sg.base - sg.size / 3 < lower.y + 1.5
        );
        // (A caption or a heading between them says they are two tables.)
        const text = [...a.lines, ...b.lines].flatMap((l) => l.cells.map((c) => c.size)).sort((m, n) => m - n);
        const size = text[Math.floor(text.length / 2)] ?? 10;
        if (between.some((sg) => Math.abs(sg.size - size) > 0.16 * size || /^(table|figure)\s+\d/i.test(segText(sg))))
          continue;
        for (const sg of between) taken.add(sg);
        boxes[i] = {
          x: Math.min(a.x, b.x),
          y,
          w: a.w,
          h: Math.max(bottom(a), bottom(b)) - y,
          lines: buildLines(
            [...a.lines.flatMap((l) => l.cells), ...b.lines.flatMap((l) => l.cells), ...between],
            page.num,
            a.x,
            right(a)
          ),
          headBottom: upper.headBottom,
          page: page.num,
        };
        boxes.splice(j, 1);
        again = true;
        break outer;
      }
    }
  }
  const prefer = opts.prefer ?? [];
  const pageGutters = findGutters(segs.filter((s) => !taken.has(s)));
  const kept: Box[] = [];
  for (const box of boxes) {
    let tabular = looksTabular(box.lines, box.w, box.headBottom !== undefined);
    const letters = box.lines.reduce((n, l) => n + lineText(l).length, 0);
    if (!tabular && letters < 40) {
      // Shading with next to nothing on it (a heading's bar and a rule under it, a form's field)
      // is no sidebar: its words go back into the page's flow, as headings where they sat on a bar.
      for (const line of box.lines)
        for (const seg of line.cells) {
          taken.delete(seg);
          if (box.lines.length === 1) (seg as Seg & { barred?: boolean }).barred = true;
        }
      continue;
    }
    kept.push(box);
    // (A page whose own gutter is hidden by something set across it still has the book's.)
    const gutters = pageGutters.length ? pageGutters : prefer.flat();
    if (tabular && growTable(box, segs, taken, page.num, gutters)) tabular = true;
    (box as Box & { tabular?: boolean }).tabular = tabular;
    if (!tabular) {
      // Prose in a box may itself be set in columns.
      const inner = flow(
        box.lines.flatMap((l) => l.cells),
        [],
        [],
        page.num,
        [],
        box
      );
      box.lines = inner.flatMap((el) => (el.kind === "line" ? [el.line] : []));
    }
  }
  const free = segs.filter((s) => !taken.has(s));
  const elements = flow(
    free,
    kept,
    page.images.filter((i) => i.file),
    page.num,
    prefer
  );
  for (const el of elements) {
    if (el.kind === "line" && el.line.cells.some((c) => (c as Seg & { barred?: boolean }).barred))
      el.line.barred = true;
  }
  return { elements, gutters: findGutters([...free, ...boxRows(free, kept)]), segs };
}

/** The gutter layouts the book's pages use most, to settle pages that are unclear on their own. */
export function usualGutters(all: Gutter[][]): Gutter[][] {
  const count = new Map<string, { n: number; g: Gutter[] }>();
  for (const g of all) {
    if (!g.length) continue;
    const key = g.map((s) => Math.round((s.x0 + s.x1) / 20)).join(",");
    const hit = count.get(key);
    if (hit) hit.n++;
    else count.set(key, { n: 1, g });
  }
  return [...count.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .filter((c) => c.n >= 3)
    .map((c) => c.g);
}

/**
 * Running heads and page numbers: text in the page's top or bottom margin
 * whose words (digits aside) repeat down the book.
 */
export function findFurniture(pages: RawPage[]): (seg: Seg, page: RawPage) => boolean {
  const norm = (s: string) => s.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  const inMargin = (seg: Seg, page: RawPage) => seg.base < 0.075 * page.height || seg.base > 0.94 * page.height;
  const count = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const seg of buildSegs(page.runs)) {
      if (!inMargin(seg, page)) continue;
      const key = norm(segText(seg));
      if (key.length > 110 || seen.has(key)) continue;
      seen.add(key);
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  const need = Math.max(3, Math.floor(pages.length * 0.04));
  // The baselines the running heads sit on: a chapter's own label there repeats too rarely to be counted.
  const bands = new Map<number, number>();
  for (const page of pages) {
    const seen = new Set<number>();
    for (const seg of buildSegs(page.runs)) {
      if (!inMargin(seg, page)) continue;
      const key = norm(segText(seg));
      if (key !== "#" && (count.get(key) ?? 0) < need) continue;
      const band = Math.round(seg.base / 3);
      if (seen.has(band)) continue;
      seen.add(band);
      bands.set(band, (bands.get(band) ?? 0) + 1);
    }
  }
  const usual = new Set([...bands.entries()].filter(([, n]) => n >= Math.max(3, pages.length * 0.15)).map(([b]) => b));
  return (seg, page) => {
    if (!inMargin(seg, page)) return false;
    const key = norm(segText(seg));
    // A page number with the book's or the chapter's name beside it, even in a file too short to show it repeats.
    if (/^(#\s*\|?\s*[^#]{0,40}|[^#]{0,40}\|?\s*#)$/.test(key) && key.length <= 48) return true;
    if (key === "#" || (count.get(key) ?? 0) >= need) return true;
    const band = Math.round(seg.base / 3);
    return key.length <= 110 && (usual.has(band) || usual.has(band - 1) || usual.has(band + 1));
  };
}
