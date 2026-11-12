/**
 * Reads a PDF page with pdf.js into runs of text, pictures and filled boxes.
 * pdf.js is handed in (Obsidian's own copy from `loadPdfJs()`, or `pdfjs-dist`
 * under Node), so nothing here depends on either.
 */

import type { FillRect, OutlineEntry, PageImage, RawPage, TextRun } from "./types";

type PdfJs = any;
type PdfDoc = any;
type PdfPage = any;

type Matrix = [number, number, number, number, number, number];

const mul = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** The box around a rectangle (in the matrix's own space) once the matrix is applied. */
function boxOf(m: Matrix, x0: number, y0: number, x1: number, y1: number) {
  const pts = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** `ABCDEF+Verdigris-Bd` → `Verdigris-Bd`. */
export function fontName(raw: string): string {
  return (raw || "").replace(/^[A-Z]{6}\+/, "");
}

export function isBold(font: string): boolean {
  return /bold|black|heavy|semibold|demi|extrabold|[-_ ]bd\b|[-_ ]sb\b|[-_]b$/i.test(font);
}

export function isItalic(font: string): boolean {
  return /italic|oblique|[-_ ](bd|sb)?it$|[-_]i$/i.test(font);
}

/** A decoded picture as pdf.js holds it: raw pixels, or a bitmap in a browser. */
export interface DecodedImage {
  width: number;
  height: number;
  /** 1 = grey 1bpp, 2 = RGB, 3 = RGBA (pdf.js `ImageKind`). */
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: unknown;
}

/** Called for each picture worth keeping; returns the file it was written to, or null. */
export type ImageSink = (img: DecodedImage, key: string, page: number, index: number) => Promise<string | null>;

export interface ReadPageOptions {
  /** Pictures smaller than this (in points, either side) are decoration. */
  minImage?: number;
  onImage?: ImageSink;
  /** Keys already written: a picture seen again is not written twice. */
  seen?: Map<string, string | null>;
}

function fillIsDark(args: any): { dark: boolean; white: boolean } {
  let r = 0;
  let g = 0;
  let b = 0;
  if (typeof args?.[0] === "string") {
    const hex = args[0].replace("#", "");
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (args && typeof args[0] === "number") {
    [r, g, b] = [args[0], args[1], args[2]];
  } else {
    return { dark: false, white: false };
  }
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return { dark: lum < 110, white: r > 251 && g > 251 && b > 251 };
}

/** A cheap fingerprint of a picture's pixels, so the same picture on two pages is one. */
function signature(img: DecodedImage): string {
  const d = img.data;
  if (!d) return "";
  let h = 2166136261;
  const step = Math.max(1, Math.floor(d.length / 4096));
  for (let i = 0; i < d.length; i += step) h = Math.imul(h ^ d[i], 16777619);
  return (h >>> 0).toString(36);
}

async function getObj(page: PdfPage, id: string): Promise<DecodedImage | null> {
  const store = id.startsWith("g_") ? page.commonObjs : page.objs;
  try {
    if (store.has(id)) return store.get(id);
  } catch {
    /* not resolved yet */
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 4000);
    try {
      store.get(id, (obj: DecodedImage) => {
        clearTimeout(timer);
        resolve(obj);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export async function readPage(pdfjs: PdfJs, doc: PdfDoc, num: number, opts: ReadPageOptions = {}): Promise<RawPage> {
  const page: PdfPage = await doc.getPage(num);
  const viewport = page.getViewport({ scale: 1 });
  const vt = viewport.transform as Matrix;
  const out: RawPage = { num, width: viewport.width, height: viewport.height, runs: [], images: [], rects: [] };
  const OPS = pdfjs.OPS;
  const minImage = opts.minImage ?? 40;

  // The operator list comes first: it loads the fonts, whose real names tell bold from italic.
  const ops = await page.getOperatorList();
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  let fill = { dark: false, white: false };
  const fillOps = new Set<number>(
    [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter(
      (v) => v !== undefined
    )
  );
  let imageIndex = 0;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args as Matrix);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      if (args?.[0]) ctm = mul(ctm, Array.from(args[0]) as Matrix);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.setFillRGBColor) fill = fillIsDark(args);
    else if (fn === OPS.constructPath) {
      const mm = args?.[2];
      // Newer pdf.js names the painting operator in the path itself; older ones put it next.
      const paint = typeof args?.[0] === "number" ? args[0] : ops.fnArray[i + 1];
      if (!mm || !fillOps.has(paint) || fill.white) continue;
      const r = boxOf(mul(vt, ctm), mm[0], mm[1], mm[2], mm[3]);
      if (r.w < 12 || r.h < 7) continue;
      if (r.w * r.h > 0.8 * out.width * out.height) continue;
      out.rects.push({ ...r, dark: fill.dark } as FillRect);
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const r = boxOf(mul(vt, ctm), 0, 0, 1, 1);
      if (r.w < minImage || r.h < minImage) continue;
      const inline = fn === OPS.paintInlineImageXObject;
      const img: DecodedImage | null = inline ? args[0] : await getObj(page, args[0]);
      if (!img || !img.width || !img.height) continue;
      const id = String(inline ? `inline${num}_${i}` : args[0]);
      const sig = signature(img);
      const key = sig
        ? `${img.width}x${img.height}:${sig}`
        : id.startsWith("g_")
          ? id
          : `${img.width}x${img.height}@${num}:${id}`;
      const image: PageImage = { ...r, key, pxW: img.width, pxH: img.height };
      if (opts.onImage) {
        const seen = opts.seen;
        if (seen?.has(key)) image.file = seen.get(key) ?? undefined;
        else {
          const file = await opts.onImage(img, key, num, imageIndex++);
          seen?.set(key, file);
          image.file = file ?? undefined;
        }
      }
      out.images.push(image);
    }
  }

  const tc = await page.getTextContent();
  const names = new Map<string, string>();
  const nameOf = (id: string): string => {
    let name = names.get(id);
    if (name === undefined) {
      name = "";
      try {
        name = fontName(page.commonObjs.get(id)?.name ?? "");
      } catch {
        /* the font was never loaded */
      }
      if (!name) name = String(tc.styles?.[id]?.fontFamily ?? id);
      names.set(id, name);
    }
    return name;
  };
  for (const it of tc.items as any[]) {
    if (typeof it.str !== "string" || !it.str) continue;
    const t = mul(vt, it.transform as Matrix);
    // Text set on its side (a label up a margin) is not part of the page's flow.
    if (Math.abs(t[1]) > 0.3 * Math.abs(t[0]) + 0.01) continue;
    const size = Math.hypot(t[2], t[3]) || it.height || 0;
    if (size < 2) continue;
    const font = nameOf(it.fontName);
    // Soft hyphens are dropped and the many hyphen characters made one, so `1st‑level` reads as it looks.
    const str = it.str
      .replace(/\u00AD/g, "")
      .replace(/[\u2010\u2011]/g, "-")
      .replace(/-{2,}/g, "-");
    if (!str) continue;
    const run: TextRun = {
      str,
      x: t[4],
      y: t[5],
      w: it.width ?? 0,
      size,
      font,
      bold: isBold(font),
      italic: isItalic(font),
    };
    out.runs.push(run);
  }
  page.cleanup();
  return out;
}

/** The file's bookmarks, flattened, each with the page it lands on. */
export async function readOutline(doc: PdfDoc): Promise<OutlineEntry[]> {
  const out: OutlineEntry[] = [];
  let outline: any[] | null = null;
  try {
    outline = await doc.getOutline();
  } catch {
    return out;
  }
  const walk = async (items: any[] | undefined, depth: number) => {
    for (const it of items ?? []) {
      const title = String(it.title ?? "")
        .replace(/\s+/g, " ")
        .trim();
      const at = out.length;
      let found = false;
      try {
        const dest = typeof it.dest === "string" ? await doc.getDestination(it.dest) : it.dest;
        if (dest?.[0]) {
          out.push({ title, page: (await doc.getPageIndex(dest[0])) + 1, depth });
          found = true;
        }
      } catch {
        /* a bookmark that points nowhere */
      }
      await walk(it.items, depth + 1);
      // A bookmark that only holds others (no place of its own) starts where the first of them does.
      if (!found && out.length > at) out.splice(at, 0, { title, page: out[at].page, depth });
    }
  };
  await walk(outline ?? undefined, 0);
  return out;
}
