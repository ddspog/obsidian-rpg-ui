/**
 * The import, start to finish: read every page (OCR where a page has no
 * text), lay the pages out, type their lines, gather chapters and write the
 * notes. The host supplies what differs between Obsidian and a terminal:
 * where files go, how a picture is encoded, how a page is read by OCR.
 */

import { toBlocks } from "./blocks";
import { emitBook, mender, wordsOf, type EmitContext } from "./emit";
import { readOutline, readPage, type DecodedImage } from "./extract";
import { findFurniture, layoutPage, lineText, usualGutters, type Gutter } from "./layout";
import { lookFor } from "./looks";
import { readStyles } from "./styles";
import {
  dropTitleHeadings,
  fileName,
  isContentsPage,
  numberChapters,
  planFromOutline,
  slug,
  takeBanner,
  toSections,
  walkBlocks,
  type ChapterPlan,
} from "./structure";
import type { Block, Chapter, Element, ImportOptions, RawPage, TabLook, TextRun } from "./types";

export { ocrToRuns } from "./ocr";

export interface ImportHost {
  writeText(path: string, text: string): Promise<void>;
  writeBinary(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  /** A picture as a file's bytes (`webp`, `png`…), or null to leave it out. */
  encodeImage?(img: DecodedImage): Promise<{ bytes: Uint8Array; ext: string } | null>;
  /** The words on a page that has no text of its own, read from its picture. */
  ocrPage?(page: any, num: number): Promise<TextRun[]>;
  /** Icons and colours for the book's tabs from a model, by title; the rules of thumb fill the rest. */
  refineLooks?(titles: string[]): Promise<Map<string, TabLook>>;
  progress?(stage: string, done: number, total: number): void;
  /** Told what was found on the way (heading looks, chapters), for a log. */
  debug?(what: string, data: unknown): void;
  /** True once the user has asked to stop. */
  cancelled?(): boolean;
}

export interface ImportResult {
  folder: string;
  notes: number;
  images: number;
  pages: number;
  ocrPages: number;
  chapters: Array<{ name: string; pages: string }>;
  tables: number;
  sidebars: number;
}

const ASSETS = "_assets";

export async function importPdf(
  pdfjs: any,
  doc: any,
  options: ImportOptions,
  host: ImportHost,
  /** The folder the book's own folder is made in. */
  parent = ""
): Promise<ImportResult> {
  const book = fileName(options.title) || "Imported Book";
  const root = parent ? `${parent.replace(/\/+$/, "")}/${book}` : book;
  const from = Math.max(1, options.from ?? 1);
  const to = Math.min(doc.numPages, options.to ?? doc.numPages);
  const total = to - from + 1;
  const stop = () => {
    if (host.cancelled?.()) throw new Error("Import cancelled.");
  };

  // 1. Read the pages. Pictures are written as they are met, so their pixels never pile up.
  const pages: RawPage[] = [];
  const seen = new Map<string, string | null>();
  const pagesOf = new Map<string, Set<number>>();
  let ocrPages = 0;
  let written = 0;
  for (let num = from; num <= to; num++) {
    stop();
    host.progress?.("Reading pages", num - from, total);
    const page = await readPage(pdfjs, doc, num, {
      seen,
      onImage:
        options.images && host.encodeImage
          ? async (img, _key, p, i) => {
              if (img.width < 120 || img.height < 120) return null;
              const ratio = img.width / img.height;
              if (ratio > 8 || ratio < 1 / 8) return null;
              const enc = await host.encodeImage?.(img);
              if (!enc) return null;
              const name = `p${String(p).padStart(4, "0")}-${i + 1}.${enc.ext}`;
              await host.writeBinary(`${root}/${ASSETS}/${name}`, enc.bytes);
              written++;
              return name;
            }
          : undefined,
    });
    for (const image of page.images) {
      const set = pagesOf.get(image.key) ?? new Set<number>();
      set.add(num);
      pagesOf.set(image.key, set);
    }
    const letters = page.runs.reduce((n, r) => n + r.str.trim().length, 0);
    if (
      letters < 12 &&
      options.ocr &&
      host.ocrPage &&
      page.images.some((i) => i.w * i.h > 0.4 * page.width * page.height)
    ) {
      host.progress?.("Reading pages (OCR)", num - from, total);
      const raw = await doc.getPage(num);
      const runs = await host.ocrPage(raw, num);
      raw.cleanup();
      if (runs.length) {
        page.runs = runs;
        page.ocr = true;
        // The page's picture is the scan itself.
        page.images = page.images.filter((i) => i.w * i.h <= 0.4 * page.width * page.height);
        ocrPages++;
      }
    }
    pages.push(page);
  }

  // 2. Pictures that repeat down the book are its dressing (page backgrounds, rules): dropped.
  const dressing = new Set<string>();
  const need = Math.max(3, Math.floor(total * 0.02));
  for (const [key, set] of pagesOf) if (set.size >= need) dressing.add(key);
  const removed = new Set<string>();
  for (const page of pages) {
    for (const image of page.images) {
      if (dressing.has(image.key) && image.file) {
        if (!removed.has(image.file)) {
          await host.remove(`${root}/${ASSETS}/${image.file}`);
          removed.add(image.file);
        }
        image.file = undefined;
      }
    }
    // A scan's own picture, and a picture placed twice on a page, are not embedded twice.
    const once = new Set<string>();
    page.images = page.images.filter((i) => i.file && !once.has(i.file) && once.add(i.file));
  }

  // 3. Lay the pages out, with the book's usual columns settling the unclear ones.
  stop();
  host.progress?.("Laying out", 0, total);
  const furniture = findFurniture(pages);
  const own: Gutter[][] = pages.map((p) => layoutPage(p, { furniture }).gutters);
  const prefer = usualGutters(own);
  const perPage = new Map<number, Element[]>();
  const everything: Element[] = [];
  for (const page of pages) {
    const { elements } = layoutPage(page, { furniture, prefer });
    const lines = elements.flatMap((el) => (el.kind === "line" ? [lineText(el.line)] : []));
    if (isContentsPage(lines)) continue;
    perPage.set(page.num, elements);
    everything.push(...elements);
  }
  const styles = readStyles(everything);
  host.debug?.("styles", {
    body: `${styles.bodyFamily} ${styles.bodySize}`,
    leading: styles.leading,
    ranks: styles.ranks,
    prefer,
  });

  // 4. Chapters: the file's bookmarks, else its biggest headings, else the whole book as one.
  const outline = await readOutline(doc);
  let plans: ChapterPlan[] = planFromOutline(outline, from, to);
  if (!plans.length) plans = planFromHeadings(perPage, styles, from, to);
  const chapters: Chapter[] = [];
  const drafts: Array<{ plan: ChapterPlan; blocks: Block[] }> = [];
  for (const plan of plans) {
    if (plan.skip) continue;
    stop();
    const elements: Element[] = [];
    for (let p = plan.firstPage; p <= plan.lastPage; p++) elements.push(...(perPage.get(p) ?? []));
    drafts.push({ plan, blocks: toBlocks(elements, { styles }) });
  }
  for (const { plan, blocks: all } of drafts) {
    host.debug?.("blocks", { chapter: plan.title, blocks: all });
    const blocks = dropTitleHeadings(all, plan.title, plan.number);
    if (!blocks.some((b) => b.type !== "image")) continue;
    const chapter: Chapter = {
      title: plan.title,
      number: plan.number,
      firstPage: plan.firstPage,
      lastPage: plan.lastPage,
      root: toSections(blocks, plan.title, plan.firstPage),
    };
    takeBanner(chapter);
    chapters.push(chapter);
  }

  // 5. Pictures get names that say where they sit; ones no note shows are removed.
  const vocabulary = new Set<string>();
  const used = new Map<string, string>();
  const taken = new Set<string>();
  const bookSlug = slug(book);
  const rename = async (file: string, near: string): Promise<string> => {
    const hit = used.get(file);
    if (hit) return hit;
    const ext = file.slice(file.lastIndexOf("."));
    const base = `${bookSlug}-${slug(near) || "art"}`.slice(0, 80);
    let name = `${base}${ext}`;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}${ext}`;
    taken.add(name);
    used.set(file, name);
    await host.rename(`${root}/${ASSETS}/${file}`, `${root}/${ASSETS}/${name}`);
    return name;
  };
  let tables = 0;
  let sidebars = 0;
  for (const chapter of chapters) {
    if (chapter.banner) chapter.banner = await rename(chapter.banner, `${chapter.title} banner`);
    const todo: Array<{ block: Extract<Block, { type: "image" }>; near: string }> = [];
    walkBlocks(chapter.root, (block, owner) => {
      if (block.type === "image") todo.push({ block, near: owner.level ? owner.title : chapter.title });
      else if (block.type === "para") wordsOf(block.spans.map((s) => s.text).join(""), vocabulary);
      else if (block.type === "list")
        for (const item of block.items) wordsOf(item.map((s) => s.text).join(""), vocabulary);
      else if (block.type === "table") tables++;
      else if (block.type === "side") sidebars++;
    });
    for (const { block, near } of todo) block.file = await rename(block.file, near);
  }
  for (const file of new Set([...seen.values()])) {
    if (file && !used.has(file) && !removed.has(file)) {
      await host.remove(`${root}/${ASSETS}/${file}`);
      removed.add(file);
    }
  }

  // 6. Tab icons and colours: rules of thumb, and a model's picks where one is offered.
  let picked = new Map<string, TabLook>();
  if (host.refineLooks) {
    const titles = new Set<string>();
    for (const chapter of chapters) {
      titles.add(chapter.title);
      for (const child of chapter.root.children) titles.add(child.title);
    }
    host.progress?.("Asking the model for tab icons", 0, 1);
    try {
      picked = await host.refineLooks([...titles].slice(0, 400));
    } catch (e) {
      console.warn("[pdf-import] the model step failed; rules of thumb are used", e);
    }
  }

  // 7. Write the notes.
  const ctx: EmitContext = {
    book,
    source: `From **${options.title}**.`,
    options,
    look: (title, index) => picked.get(title) ?? lookFor(title, index),
    mend: mender(vocabulary),
    files: [],
    tableIds: new Set(),
    names: new Set(),
  };
  const facts = [
    `*Imported from a PDF of ${doc.numPages} pages${ocrPages ? `, ${ocrPages} of them read by OCR` : ""}: ${tables} tables, ${sidebars} sidebars, ${used.size} pictures.*`,
  ];
  const files = emitBook(chapters, ctx, facts);
  let done = 0;
  for (const file of files) {
    stop();
    host.progress?.("Writing notes", done++, files.length);
    await host.writeText(`${root}/${file.path}`, file.text);
  }
  host.progress?.("Done", 1, 1);
  void written;
  return {
    folder: root,
    notes: files.length,
    images: used.size,
    pages: total,
    ocrPages,
    chapters: chapters.map((c) => ({ name: c.title, pages: `${c.firstPage}–${c.lastPage}` })),
    tables,
    sidebars,
  };
}

/** Chapters cut at the book's biggest headings, when the file has no bookmarks. */
function planFromHeadings(
  perPage: Map<number, Element[]>,
  styles: ReturnType<typeof readStyles>,
  from: number,
  to: number
): ChapterPlan[] {
  for (let rank = 1; rank <= 2; rank++) {
    const starts: Array<{ title: string; page: number }> = [];
    for (const [num, elements] of perPage) {
      const lines = elements.flatMap((el) => (el.kind === "line" ? [el.line] : []));
      lines.forEach((line, i) => {
        if (styles.headingLevel(line, lines[i - 1], lines[i + 1]) !== rank) return;
        const last = starts[starts.length - 1];
        // A title set on two lines is one title.
        if (last && last.page === num && i > 0 && styles.headingLevel(lines[i - 1], lines[i - 2], line) === rank)
          last.title += " " + lineText(line);
        else if (!last || last.page !== num) starts.push({ title: lineText(line), page: num });
      });
    }
    // Headings that come every page or two are sections, or noise on a scan, not chapters.
    const real = starts.filter((st) => st.title.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 4);
    if (
      real.length === starts.length &&
      starts.length >= 2 &&
      starts.length <= 80 &&
      (to - from + 1) / starts.length >= 3
    ) {
      const plans: ChapterPlan[] = [];
      if (starts[0].page > from)
        plans.push({ title: "Front Matter", number: "", firstPage: from, lastPage: starts[0].page - 1 });
      starts.forEach((s, i) =>
        plans.push({
          title: s.title,
          number: "",
          firstPage: s.page,
          lastPage: i + 1 < starts.length ? starts[i + 1].page - 1 : to,
        })
      );
      return numberChapters(plans);
    }
  }
  return [{ title: "Book", number: "", firstPage: from, lastPage: to }];
}
