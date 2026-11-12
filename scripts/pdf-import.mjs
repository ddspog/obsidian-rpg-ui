#!/usr/bin/env node
/**
 * The PDF import from a terminal: the same code the plugin's command runs, with pdfjs-dist and
 * files on disk in place of Obsidian. Made to be driven by a person or by a model: `--json` reports
 * each stage as it runs and ends with the result, and every import leaves a report of what needs a
 * person's judgement. `node scripts/pdf-import.mjs help` says how.
 */
import esbuild from "esbuild";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const HELP = `PDF import: a PDF into a vault as a compendium book.

COMMANDS
  import <book.pdf> <out folder> [options]   (the default: \`pdf-import.mjs book.pdf out\` imports)
      Writes the book's notes under <out folder>, an "Import review" note listing what needs a
      person's judgement, and a report (JSON) of the whole result. Options:
        --title "Name"          the book's name (its folder, and the source its notes carry)
        --from N --to N         read only these pages (1-based; columns and running heads are
                                 learnt from the pages read, so debug on the whole book)
        --system <folder>       the out folder is a vault: file the book into <folder>/compendium
                                 and its entities into <folder>/worldbuilding; nothing is written over
        --game "Line" --publisher "Name" --marker ᴰ --source '...'
        --banners <folder> --pictures <folder> --portraits <folder> --views spell
        --max-lines 300 --catalog-min 8
        --no-images --no-ocr --no-entities
        --dry-run               read and check everything, write nothing but the report
        --report <file.json>    where the report goes (default <out>/.pdf-import/<book>.json;
                                 a dot folder, so Obsidian does not show it)
        --json                  one JSON object a line on stdout (see OUTPUT); human text otherwise
        --fail-on fix|check     exit 3 when the review has items of that severity (or worse)

  pages <book.pdf> <n,n,...> [--json]
      What the layout made of those pages: lines with their position and size, boxes read as tables
      or sidebars and their rows, pictures, in reading order. The whole book is read first, so the
      columns and running heads are the ones the import uses.

  review <report.json> [--severity fix|check|note] [--kind <kind>] [--limit 50] [--json]
      The items of a report, worst first, each with its note, table id and page of the PDF.

  help
      This text.

OUTPUT (--json)
  {"type":"start", "pdf", "out", "options"}
  {"type":"progress", "stage", "done", "total", "elapsed"}   a few times a stage, not every page
  {"type":"stage", "name":"pages"|"chapters"|"tables mended"|"review", ...what it found}
  {"type":"result", "folder", "notes", "tables", "entities", "chapters", "review":{"note","counts",
                    "top"}, "report", "seconds"}                         the last line on success
  {"type":"error", "message", "stage"}                                   the last line on failure

THE REVIEW
  Each item: {kind, severity, note, table, page, message}. severity "fix": wrong as written (a table
  that cannot be rolled, a piece of a table left apart); "check": may be wrong, compare with the book
  (a row widened over a skipped number, text that reads like a table, a contents entry not found);
  "note": for the record. "note" is the vault path without .md; "page" is the PDF's page, for
  \`pages\` to look at. Kinds: table-numbers, table-fragment, table-column, row-widened, rows-joined,
  text-like-table, row-as-heading, contents-missing, ocr-page, chapters, kept.

EXIT
  0 done, 1 failed, 2 bad arguments, 3 done but the review has items --fail-on asked about.

ENVIRONMENT
  PDF_IMPORT_DEBUG=1 prints heading looks, every block and every entity found (stderr).
  OCR_LANG=por, OCR_LANG_PATH=<folder> choose the OCR language and where its data is.

  To measure an import against a book already adapted by hand:
  node scripts/pdf-import-compare.mjs <import folder> <vault folders...> [-v]
`;

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const COMMANDS = new Set(["import", "pages", "review", "help"]);
const command = COMMANDS.has(argv[0]) ? argv.shift() : argv.length ? "import" : "help";
const args = argv;
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
const usage = (message) => {
  console.error(`${message}\n\nnode scripts/pdf-import.mjs help   for the commands and options.`);
  process.exit(2);
};
if (command === "help" || has("help") || has("h")) {
  process.stdout.write(HELP);
  process.exit(0);
}
const json = has("json");
/** One line of the --json stream. */
const emit = (type, data = {}) => {
  if (json) process.stdout.write(JSON.stringify({ type, ...data }) + "\n");
};

if (command === "review") {
  const [file] = args.filter((a) => !a.startsWith("--"));
  const severity = flag("severity");
  const kind = flag("kind");
  const limit = Number(flag("limit", 50));
  if (!file || !fs.existsSync(file)) usage(`review: no report at ${file ?? "(none given)"}`);
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  const order = { fix: 0, check: 1, note: 2 };
  const items = report.result.review.items.filter(
    (i) => (!severity || order[i.severity] <= order[severity]) && (!kind || i.kind === kind)
  );
  if (json) {
    for (const item of items.slice(0, limit)) emit("item", item);
    emit("summary", {
      shown: Math.min(limit, items.length),
      matching: items.length,
      counts: report.result.review.counts,
    });
  } else {
    const c = report.result.review.counts;
    console.log(
      `${report.title}: ${c.fix} to fix, ${c.check} to check, ${c.note} for the record (${report.result.review.note}).`
    );
    for (const i of items.slice(0, limit))
      console.log(
        `[${i.severity}] ${i.kind}${i.page ? ` p.${i.page}` : ""}${i.note ? ` ${i.note}` : ""}${i.table ? ` #${i.table}` : ""}\n    ${i.message}`
      );
    if (items.length > limit) console.log(`…${items.length - limit} more (--limit).`);
  }
  process.exit(0);
}

const title = flag("title");
const from = flag("from");
const to = flag("to");
const maxLines = Number(flag("max-lines", 300));
const catalogMin = Number(flag("catalog-min", 8));
const noImages = has("no-images") || command === "pages";
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
const dryRun = has("dry-run") || command === "pages";
const reportFlag = flag("report");
const failOn = flag("fail-on");
if (failOn && !["fix", "check"].includes(failOn)) usage("--fail-on takes fix or check");
const positional = args.filter((a) => !a.startsWith("--"));
const unknown = args.filter((a) => a.startsWith("--"));
if (unknown.length) usage(`unknown option ${unknown[0]}`);
const pdfPath = positional[0];
const debugPages = new Set(
  (command === "pages" ? (positional[1] ?? "") : (process.env.PDF_IMPORT_PAGES ?? ""))
    .split(",")
    .filter(Boolean)
    .map(Number)
);
const outDir = command === "pages" ? fs.mkdtempSync(path.join(os.tmpdir(), "rpg-pdf-pages-")) : positional[1];
if (!pdfPath || !fs.existsSync(pdfPath)) usage(`no PDF at ${pdfPath ?? "(none given)"}`);
if (command === "import" && !outDir) usage("import: give the PDF and the out folder");
if (command === "pages" && !debugPages.size) usage("pages: give the pages, e.g. 30,31");

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

const started = Date.now();
let stage = "starting";
let lastProgress = { stage: "", at: 0 };
let cancelled = false;
process.on("SIGINT", () => {
  cancelled = true;
});

/** Where the files go: the out folder, or nowhere at all in a dry run. */
const write = (p, body) => {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(path.join(outDir, p)), { recursive: true });
  fs.writeFileSync(path.join(outDir, p), body);
};

const layoutLine = (l) => ({
  x: Math.round(l.x),
  r: Math.round(l.r),
  y: Math.round(l.base),
  size: l.size,
  cells: l.cells.map((c) => c.spans.map((s) => s.text).join("")),
});

const host = {
  async writeText(p, text) {
    write(p, text);
  },
  async writeBinary(p, bytes) {
    write(p, bytes);
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
    if (!dryRun) fs.rmSync(path.join(outDir, p), { force: true });
  },
  async rename(a, b) {
    if (dryRun) return;
    fs.mkdirSync(path.dirname(path.join(outDir, b)), { recursive: true });
    if (fs.existsSync(path.join(outDir, b)) && a !== b) return fs.rmSync(path.join(outDir, a), { force: true });
    if (fs.existsSync(path.join(outDir, a))) fs.renameSync(path.join(outDir, a), path.join(outDir, b));
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
  cancelled: () => cancelled,
  debug:
    process.env.PDF_IMPORT_DEBUG || debugPages.size
      ? (what, data) => {
          if (what === "layout") {
            // What the layout made of the pages asked for, in reading order.
            if (!debugPages.has(data.page)) return;
            if (json) {
              emit("layout", {
                page: data.page,
                elements: data.elements.map((el) =>
                  el.kind === "line"
                    ? { kind: "line", ...layoutLine(el.line) }
                    : el.kind === "image"
                      ? { kind: "image", file: el.image.file }
                      : {
                          kind: el.box.tabular ? "table" : "sidebar",
                          x: Math.round(el.box.x),
                          y: Math.round(el.box.y),
                          w: Math.round(el.box.w),
                          h: Math.round(el.box.h),
                          header: el.box.headBottom === undefined ? undefined : Math.round(el.box.headBottom),
                          lines: el.box.lines.map(layoutLine),
                        }
                ),
              });
              return;
            }
            const cells = (l) => l.cells.map((c) => c.spans.map((s) => s.text).join("")).join(" ¦ ");
            const at = (l) => `x${Math.round(l.x)}-${Math.round(l.r)} y${Math.round(l.base)} ${l.size}pt`;
            const out = command === "pages" ? console.log : console.error;
            for (const el of data.elements) {
              if (el.kind === "line") out(`[p${data.page}] line ${at(el.line)} ${cells(el.line)}`);
              else if (el.kind === "image") out(`[p${data.page}] image ${el.image.file}`);
              else {
                const b = el.box;
                out(
                  `[p${data.page}] box x${Math.round(b.x)} y${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}` +
                    ` ${b.tabular ? "table" : "sidebar"}${b.headBottom === undefined ? "" : " header to y" + Math.round(b.headBottom)}`
                );
                for (const l of b.lines) out(`[p${data.page}]   ${at(l)} ${cells(l)}`);
              }
            }
          } else if (!process.env.PDF_IMPORT_DEBUG) return;
          else if (what === "styles") console.error(JSON.stringify(data, null, 1));
          else if (what === "entities")
            for (const e of data) console.error(`[entity] ${e.kind} | ${e.title} | ${e.path}`);
          else if (data.blocks)
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
  progress(name, done, total) {
    stage = name;
    const now = Date.now();
    const changed = name !== lastProgress.stage;
    // A few lines a stage: when it starts, when it ends, and every few seconds between.
    if (!changed && done !== total && now - lastProgress.at < 3000) return;
    lastProgress = { stage: name, at: now };
    if (json) emit("progress", { stage: name, done, total, elapsed: Math.round((now - started) / 1000) });
    else if (command !== "pages") {
      if (process.stderr.isTTY) process.stderr.write(`\r${name} ${done}/${total}        `);
      else console.error(`${name} ${done}/${total}`);
    }
  },
  event(name, data) {
    if (json) emit("stage", { name, ...data });
    else if (command === "import") {
      if (process.stderr.isTTY) process.stderr.write("\n");
      const line =
        name === "pages"
          ? `read ${data.pages} pages${data.ocrPages ? `, ${data.ocrPages} by OCR` : ""}`
          : name === "chapters"
            ? `${data.chapters.length} chapters from the ${data.from === "bookmarks" ? "bookmarks" : data.from === "headings" ? "biggest headings" : "whole book (no bookmarks or headings to cut by)"}`
            : name === "tables mended"
              ? `tables mended: ${data.joined} pieces put back, ${data.folded} wrapped lines folded, ${data.widened} rows widened`
              : name === "review"
                ? `review: ${data.fix} to fix, ${data.check} to check, ${data.note} for the record`
                : `${name}: ${JSON.stringify(data)}`;
      console.error(`· ${line}`);
    }
  },
};

const options = {
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
};
emit("start", {
  command,
  pdf: path.resolve(pdfPath),
  out: command === "pages" ? null : path.resolve(outDir),
  dryRun,
  options,
});

let result;
try {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, verbosity: 0, isOffscreenCanvasSupported: false }).promise;
  result = await importPdf(pdfjs, doc, options, host);
} catch (e) {
  if (ocrWorker) await ocrWorker.terminate();
  if (json) emit("error", { message: String(e?.message ?? e), stage });
  else console.error(`\nThe import failed while ${stage.toLowerCase()}: ${e?.stack ?? e}`);
  process.exit(1);
}
if (ocrWorker) await ocrWorker.terminate();
if (command === "pages") {
  fs.rmSync(outDir, { recursive: true, force: true });
  process.exit(0);
}

const seconds = Math.round((Date.now() - started) / 1000);
const slug = (t) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "book";
const reportPath = reportFlag ?? (dryRun ? null : path.join(outDir, ".pdf-import", `${slug(options.title)}.json`));
if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        pdf: path.resolve(pdfPath),
        title: options.title,
        options,
        finishedAt: new Date().toISOString(),
        seconds,
        result,
      },
      null,
      1
    )
  );
}
const { counts, note: reviewNote, items } = result.review;
const summary = {
  folder: result.folder,
  notes: result.notes,
  pages: result.pages,
  ocrPages: result.ocrPages,
  images: result.images,
  tables: result.tables,
  sidebars: result.sidebars,
  entities: result.entities,
  kept: result.kept.length,
  chapters: result.chapters,
  contents: { entries: result.contents.entries, missing: result.contents.missing.length },
  review: { note: reviewNote, counts, top: items.filter((i) => i.severity === "fix").slice(0, 20) },
  report: reportPath ? path.resolve(reportPath) : null,
  dryRun,
  seconds,
};
if (json) emit("result", summary);
else {
  if (process.stderr.isTTY) process.stderr.write("\n");
  const entities = Object.entries(result.entities)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  console.log(
    `${dryRun ? "Checked (dry run, nothing written)" : `Wrote ${result.notes} notes to ${path.join(outDir, result.folder)}`}: ` +
      `${result.chapters.length} chapters, ${result.tables} tables, ${result.sidebars} sidebars, ${result.images} pictures` +
      `${entities ? `, ${entities}` : ""} (${seconds} s).`
  );
  console.log(
    `Review: ${counts.fix} to fix, ${counts.check} to check against the book, ${counts.note} for the record.`
  );
  if (!dryRun) console.log(`  note:   ${reviewNote}.md`);
  if (reportPath) console.log(`  report: ${reportPath}   (node scripts/pdf-import.mjs review <report> --severity fix)`);
  for (const i of items.filter((x) => x.severity === "fix").slice(0, 10))
    console.log(`  [fix] ${i.page ? `p.${i.page} ` : ""}${i.message}`);
}
const order = { fix: 0, check: 1 };
const failing =
  failOn && items.some((i) => (i.severity === "fix" ? 0 : i.severity === "check" ? 1 : 2) <= order[failOn]);
process.exit(failing ? 3 : 0);
