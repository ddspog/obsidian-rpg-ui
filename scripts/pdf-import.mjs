#!/usr/bin/env node
/**
 * The PDF import from a terminal: the same code the plugin's command runs,
 * with pdfjs-dist and files on disk in place of Obsidian.
 *
 *   node scripts/pdf-import.mjs <book.pdf> <out folder> [--title "Name"] [--from N] [--to N]
 *        [--max-lines 300] [--catalog-min 8] [--no-images] [--no-ocr] [--no-entities]
 */
import esbuild from "esbuild";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const has = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const title = flag("title");
const from = flag("from");
const to = flag("to");
const maxLines = Number(flag("max-lines", 300));
const catalogMin = Number(flag("catalog-min", 8));
const noImages = has("no-images");
const noOcr = has("no-ocr");
const noEntities = has("no-entities");
const [pdfPath, outDir] = args;
if (!pdfPath || !outDir) {
  console.error("usage: pdf-import.mjs <book.pdf> <out folder> [--title …] [--from N] [--to N]");
  process.exit(2);
}

const bundle = path.join(os.tmpdir(), `rpg-pdf-import-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(here, "../lib/domains/pdf-import/pipeline.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle,
  logLevel: "warning",
});
const { importPdf, ocrToRuns } = await import(pathToFileURL(bundle).href);
fs.rmSync(bundle, { force: true });

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
let canvas = null;
try {
  canvas = await import("@napi-rs/canvas");
} catch {
  console.warn("@napi-rs/canvas is not installed: pictures and OCR are skipped.");
}

/** RGBA pixels from what pdf.js hands over (grey 1bpp, RGB or RGBA). */
function toRgba(img) {
  const { width, height, data, kind } = img;
  const out = new Uint8ClampedArray(width * height * 4);
  if (kind === 3 || data.length === width * height * 4) out.set(data);
  else if (kind === 2 || data.length === width * height * 3) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      out[j] = data[i];
      out[j + 1] = data[i + 1];
      out[j + 2] = data[i + 2];
      out[j + 3] = 255;
    }
  } else {
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const v = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
        const j = (y * width + x) * 4;
        out[j] = out[j + 1] = out[j + 2] = v;
        out[j + 3] = 255;
      }
  }
  return out;
}

// OCR with tesseract.js; English data comes from the @tesseract.js-data/eng package, other
// languages (OCR_LANG=por) from tesseract.js's download site unless OCR_LANG_PATH points at a folder.
let ocrWorker = null;
async function ocrPage(page) {
  if (!canvas) return [];
  if (!ocrWorker) {
    const { createWorker } = await import("tesseract.js");
    const lang = process.env.OCR_LANG || "eng";
    const local = path.join(here, `../node_modules/@tesseract.js-data/${lang}/4.0.0_best_int`);
    const langPath = process.env.OCR_LANG_PATH || (fs.existsSync(local) ? local : undefined);
    ocrWorker = await createWorker(lang, 1, { ...(langPath ? { langPath } : {}), cachePath: os.tmpdir() });
  }
  const scale = 2.5;
  const viewport = page.getViewport({ scale });
  const c = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: c.getContext("2d"), viewport }).promise;
  const { data } = await ocrWorker.recognize(c.toBuffer("image/png"), {}, { blocks: true });
  return ocrToRuns(data, scale);
}

const host = {
  async writeText(p, text) {
    fs.mkdirSync(path.dirname(path.join(outDir, p)), { recursive: true });
    fs.writeFileSync(path.join(outDir, p), text);
  },
  async writeBinary(p, bytes) {
    fs.mkdirSync(path.dirname(path.join(outDir, p)), { recursive: true });
    fs.writeFileSync(path.join(outDir, p), bytes);
  },
  async remove(p) {
    fs.rmSync(path.join(outDir, p), { force: true });
  },
  async rename(a, b) {
    fs.renameSync(path.join(outDir, a), path.join(outDir, b));
  },
  encodeImage: canvas
    ? async (img) => {
        if (!img.data) return null;
        const c = canvas.createCanvas(img.width, img.height);
        const ctx = c.getContext("2d");
        ctx.putImageData(new canvas.ImageData(toRgba(img), img.width, img.height), 0, 0);
        return { bytes: c.toBuffer("image/webp", 82), ext: "webp" };
      }
    : undefined,
  ocrPage: noOcr ? undefined : ocrPage,
  debug: process.env.PDF_IMPORT_DEBUG
    ? (what, data) => {
        if (what === "styles") console.error(JSON.stringify(data, null, 1));
        else
          for (const b of data.blocks)
            console.error(
              `[${data.chapter}] p${b.page} ${b.type}${b.level ? b.level : ""} ` +
                (b.text ??
                  b.caption ??
                  b.title ??
                  b.file ??
                  (b.spans ?? [])
                    .map((s) => s.text)
                    .join("")
                    .slice(0, 70))
            );
      }
    : undefined,
  progress(stage, done, total) {
    if (process.stderr.isTTY) process.stderr.write(`\r${stage} ${done}/${total}        `);
    else if (done === 0 || done === total) console.error(`${stage} (${total})`);
  },
};

const started = Date.now();
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data, verbosity: 0, isOffscreenCanvasSupported: false }).promise;
const result = await importPdf(
  pdfjs,
  doc,
  {
    title: title ?? path.basename(pdfPath, path.extname(pdfPath)),
    maxLines,
    catalogMin,
    images: !noImages,
    ocr: !noOcr,
    entities: !noEntities,
    from: from ? Number(from) : undefined,
    to: to ? Number(to) : undefined,
  },
  host
);
if (ocrWorker) await ocrWorker.terminate();
console.log(JSON.stringify({ ...result, seconds: Math.round((Date.now() - started) / 1000) }, null, 2));
process.exit(0);
