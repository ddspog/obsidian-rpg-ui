/**
 * OCR's words as runs of text, so a scanned page goes through the same layout
 * as a page that has its own text. The words come from tesseract.js
 * (`recognize(image, {}, { blocks: true })`), with boxes in the picture's pixels.
 */

import type { TextRun } from "./types";

interface OcrBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface OcrWord {
  text: string;
  confidence?: number;
  bbox: OcrBox;
}

interface OcrLine {
  words: OcrWord[];
  bbox: OcrBox;
  baseline?: { x0: number; y0: number; x1: number; y1: number };
  rowAttributes?: { rowHeight?: number; ascenders?: number; descenders?: number };
}

export interface OcrResult {
  blocks?: Array<{ paragraphs?: Array<{ lines?: OcrLine[] }> }> | null;
}

/**
 * `scale` is how many pixels of the picture make one point of the page.
 * A line's type size is read from its height; sizes close to the page's usual
 * one are set to it, since a line's height wavers with the letters it holds.
 */
/** How much of a box of the picture is ink, 0 to 1. */
export type InkMeter = (box: OcrBox) => number;

/** Measures ink in a page's pixels (RGBA): the share of a box that is clearly darker than the paper. */
export function inkMeter(data: Uint8ClampedArray | Uint8Array, width: number, height: number): InkMeter {
  // The paper's own tone, from a sample of the page, so a tinted page is not all ink.
  const sample: number[] = [];
  const stride = Math.max(4, Math.floor((width * height) / 4000)) * 4;
  for (let i = 0; i < data.length; i += stride)
    sample.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  sample.sort((a, b) => a - b);
  const paper = sample[Math.floor(sample.length * 0.7)] ?? 255;
  const cut = paper * 0.6;
  return (box) => {
    const x0 = Math.max(0, Math.floor(box.x0));
    const x1 = Math.min(width, Math.ceil(box.x1));
    const y0 = Math.max(0, Math.floor(box.y0));
    const y1 = Math.min(height, Math.ceil(box.y1));
    let dark = 0;
    for (let y = y0; y < y1; y++) {
      let i = (y * width + x0) * 4;
      for (let x = x0; x < x1; x++, i += 4) {
        if (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 < cut) dark++;
      }
    }
    const area = (x1 - x0) * (y1 - y0);
    return area > 0 ? dark / area : 0;
  };
}

/**
 * White text on a dark bar (a heading, a table's header) is lost on OCR, which
 * looks for dark text. Bars are found as bands of long dark runs and turned
 * to their negative in place, so their text reads like any other. Returns how
 * many bars were turned.
 */
export function invertDarkBars(data: Uint8ClampedArray | Uint8Array, width: number, height: number): number {
  const lum = (i: number) => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  const need = Math.floor(width * 0.1);
  // Long dark runs, row by row, gathered into bands that start and end at about the same place.
  interface Band {
    x0: number;
    x1: number;
    from: number;
    last: number;
  }
  const open: Band[] = [];
  const done: Band[] = [];
  for (let y = 0; y < height; y += 2) {
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const dark = x < width && lum((y * width + x) * 4) < 110;
      if (dark && start < 0) start = x;
      if (!dark && start >= 0) {
        if (x - start >= need) {
          const band = open.find((b) => Math.abs(b.x0 - start) <= 14 && Math.abs(b.x1 - x) <= 14 && y - b.last <= 70);
          if (band) band.last = y;
          else open.push({ x0: start, x1: x, from: y, last: y });
        }
        start = -1;
      }
    }
    for (let i = open.length - 1; i >= 0; i--) if (y - open[i].last > 70) done.push(...open.splice(i, 1));
  }
  done.push(...open);
  let bars = 0;
  for (const { x0, x1, from, last } of done) {
    const h = last - from + 2;
    if (h < 14 || h > 80) continue;
    let dark = 0;
    let all = 0;
    let sum = 0;
    let squares = 0;
    for (let y = from; y < last; y += 2)
      for (let x = x0; x < x1; x += 3, all++) {
        const v = lum((y * width + x) * 4);
        if (v >= 110) continue;
        dark++;
        sum += v;
        squares += v * v;
      }
    if (!all || dark / all < 0.5) continue;
    // A bar is one flat colour; a dark stretch of a picture is not, and is left alone.
    const mean = sum / dark;
    if (Math.sqrt(Math.max(0, squares / dark - mean * mean)) > 22) continue;
    for (let y = from; y <= Math.min(height - 1, last + 1); y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
    bars++;
  }
  return bars;
}

/**
 * OCR does not say which words are bold. Ink does: a bold word covers more
 * of its box than the words around it. Words well above the page's usual
 * share of ink are marked bold, which is what tells headings and the names
 * that open a paragraph from the text.
 */
function boldWords(words: Array<{ ink: number; text: string }>): Set<number> {
  const usual = words
    .filter((w) => w.text.length >= 3)
    .map((w) => w.ink)
    .sort((a, b) => a - b);
  const median = usual[Math.floor(usual.length / 2)] ?? 0;
  const out = new Set<number>();
  if (!median) return out;
  words.forEach((w, i) => {
    if (w.ink > median * 1.3 && w.ink < 0.75) out.add(i);
  });
  return out;
}

export function ocrToRuns(result: OcrResult, scale: number, ink?: InkMeter): TextRun[] {
  const lines: Array<{ line: OcrLine; size: number }> = [];
  for (const block of result.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        // Specks and page texture read as stray one- and two-letter words of low confidence.
        const words = (line.words ?? []).filter((w) => {
          const text = w.text?.trim() ?? "";
          const sure = w.confidence ?? 100;
          return text && sure >= 30 && (sure >= 70 || text.length > 2);
        });
        if (!words.length) continue;
        const row = line.rowAttributes;
        const height =
          row?.rowHeight && row.rowHeight > 0
            ? row.rowHeight - Math.abs(row.descenders ?? 0) * 0.5
            : (line.bbox.y1 - line.bbox.y0) * 0.8;
        lines.push({ line: { ...line, words }, size: height / scale });
      }
    }
  }
  if (!lines.length) return [];
  const sizes = lines.map((l) => l.size).sort((a, b) => a - b);
  const usual = sizes[Math.floor(sizes.length / 2)];
  const runs: TextRun[] = [];
  const all = lines.flatMap(({ line }) => line.words);
  const bold = ink ? boldWords(all.map((w) => ({ ink: ink(w.bbox), text: w.text }))) : new Set<number>();
  let index = 0;
  for (const { line, size: raw } of lines) {
    const size = Math.abs(raw - usual) / usual < 0.2 ? usual : Math.round(raw);
    const base = (line.baseline ? Math.max(line.baseline.y0, line.baseline.y1) : line.bbox.y1) / scale;
    for (const word of line.words) {
      runs.push({
        str: word.text,
        x: word.bbox.x0 / scale,
        y: base,
        w: (word.bbox.x1 - word.bbox.x0) / scale,
        size,
        font: bold.has(index) ? "ocr-Bold" : "ocr",
        bold: bold.has(index),
        italic: false,
      });
      index++;
    }
  }
  return runs;
}
