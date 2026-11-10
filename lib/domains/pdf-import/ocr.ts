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
export function ocrToRuns(result: OcrResult, scale: number): TextRun[] {
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
        font: "ocr",
        bold: false,
        italic: false,
      });
    }
  }
  return runs;
}
