#!/usr/bin/env node
/**
 * The PDF import from a terminal: the same code the plugin's command runs,
 * with pdfjs-dist and files on disk in place of Obsidian.
 *
 *   node scripts/pdf-import.mjs <book.pdf> <out folder> [--title "Name"] [--from N] [--to N]
 *        [--max-lines 300] [--catalog-min 8] [--no-images] [--no-ocr] [--no-entities]
 *        [--system tales-of-the-valiant]   the out folder is then a vault: the book goes to that system's
 *                                          compendium and its entities to its worldbuilding folders
 *        [--marker ᴰ] [--source 'From **D&D 5e** "Book" by **Publisher**.']
 *        [--game "Tales of the Valiant"] [--publisher "Kobold Press"] [--portraits "z50. Reference"]
 *        [--banners "z51. Banners/Book"] [--pictures "z50. Reference/Compendium/Book"] [--views spell]
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
const system = flag("system");
const marker = flag("marker");
const source = flag("source");
const bannerFolder = flag("banners");
const pictureFolder = flag("pictures");
const views = flag("views");
const game = flag("game");
const publisher = flag("publisher");
const portraits = flag("portraits");
const debugPages = new Set((process.env.PDF_IMPORT_PAGES ?? "").split(",").filter(Boolean).map(Number));
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
const { importPdf, ocrToRuns, inkMeter, invertDarkBars } = await import(pathToFileURL(bundle).href);
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
  const ctx = c.getContext("2d");
  const pixels = ctx.getImageData(0, 0, c.width, c.height);
  if (invertDarkBars(pixels.data, c.width, c.height)) ctx.putImageData(pixels, 0, 0);
  const { data } = await ocrWorker.recognize(c.toBuffer("image/png"), {}, { blocks: true });
  return ocrToRuns(data, scale, inkMeter(pixels.data, c.width, c.height));
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
  async listNotes(dir) {
    const out = [];
    const walk = (d) => {
      for (const entry of fs.readdirSync(path.join(outDir, d), { withFileTypes: true })) {
        const rel = `${d}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (entry.name.endsWith(".md")) out.push(rel);
      }
    };
    if (fs.existsSync(path.join(outDir, dir))) walk(dir);
    return out;
  },
  async remove(p) {
    fs.rmSync(path.join(outDir, p), { force: true });
  },
  async rename(a, b) {
    fs.mkdirSync(path.dirname(path.join(outDir, b)), { recursive: true });
    if (fs.existsSync(path.join(outDir, b)) && a !== b) return fs.rmSync(path.join(outDir, a), { force: true });
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
  debug:
    process.env.PDF_IMPORT_DEBUG || debugPages.size
      ? (what, data) => {
          if (what === "layout") {
            // PDF_IMPORT_PAGES=30,31: what the layout made of those pages, in reading order.
            if (!debugPages.has(data.page)) return;
            const cells = (l) => l.cells.map((c) => c.spans.map((s) => s.text).join("")).join(" ¦ ");
            const at = (l) => `x${Math.round(l.x)}-${Math.round(l.r)} y${Math.round(l.base)} ${l.size}pt`;
            for (const el of data.elements) {
              if (el.kind === "line") console.error(`[p${data.page}] line ${at(el.line)} ${cells(el.line)}`);
              else if (el.kind === "image") console.error(`[p${data.page}] image ${el.image.file}`);
              else {
                const b = el.box;
                console.error(
                  `[p${data.page}] box x${Math.round(b.x)} y${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}` +
                    ` ${b.tabular ? "table" : "sidebar"}${b.headBottom === undefined ? "" : " header to y" + Math.round(b.headBottom)}`
                );
                for (const l of b.lines) console.error(`[p${data.page}]   ${at(l)} ${cells(l)}`);
              }
            }
          } else if (what === "styles") console.error(JSON.stringify(data, null, 1));
          else if (what === "entities")
            for (const e of data) console.error(`[entity] ${e.kind} | ${e.title} | ${e.path}`);
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
    system,
    marker,
    // A game line and a publisher make the source line the vault's notes carry.
    source:
      source ??
      (game
        ? `From **${game}** "${title ?? path.basename(pdfPath, path.extname(pdfPath))}"${publisher ? ` by **${publisher}**` : ""}.`
        : undefined),
    portraitFolders: portraits
      ? {
          creature: `${portraits}/Bestiary`,
          vehicle: `${portraits}/Bestiary`,
          "magic item": `${portraits}/Items`,
          spell: `${portraits}/Spells`,
        }
      : undefined,
    bannerFolder,
    pictureFolder,
    views: views ? views.split(",") : undefined,
    from: from ? Number(from) : undefined,
    to: to ? Number(to) : undefined,
  },
  host
);
if (ocrWorker) await ocrWorker.terminate();
console.log(JSON.stringify({ ...result, seconds: Math.round((Date.now() - started) / 1000) }, null, 2));
process.exit(0);
