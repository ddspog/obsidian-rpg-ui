/**
 * The import, start to finish: read every page (OCR where a page has no
 * text), lay the pages out, type their lines, gather chapters and write the
 * notes. The host supplies what differs between Obsidian and a terminal:
 * where files go, how a picture is encoded, how a page is read by OCR.
 */

import { toBlocks } from "./blocks";
import { emitBook, mender, wordsOf, type EmitContext } from "./emit";
import { readOutline, readPage, type DecodedImage } from "./extract";
import { findFurniture, layoutPage, lineText, segText, usualGutters, type Gutter } from "./layout";
import { lookFor } from "./looks";
import { placer } from "./organise";
import { readStyles } from "./styles";
import {
  chapterLabel,
  dropTitleHeadings,
  fileName,
  isContentsPage,
  missingFromContents,
  readContents,
  numberChapters,
  planFromOutline,
  promoteNames,
  slug,
  takeBanner,
  titleCase,
  toSections,
  walkBlocks,
  type ChapterPlan,
  type ContentsEntry,
} from "./structure";
import type { Block, Chapter, Element, ImportOptions, RawPage, TabLook, TextRun } from "./types";

export { inkMeter, invertDarkBars, ocrToRuns } from "./ocr";

export interface ImportHost {
  writeText(path: string, text: string): Promise<void>;
  writeBinary(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  /** Every note under a folder (paths from the vault's root), so none the vault already has is written over. */
  listNotes?(dir: string): Promise<string[]>;
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
  /** Entries of the book's table of contents, and those not found as headings. */
  contents: { entries: number; missing: string[] };
  /** Entity notes the vault already had, left as they were. */
  kept: string[];
  /** Entities written, by kind. */
  entities: Record<string, number>;
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
  // Into a system's folder: the book goes to its compendium under a plain folder name, as the others there.
  const system = options.system?.replace(/\/+$/, "");
  let book = system ? slug(options.title) || "imported-book" : fileName(options.title) || "Imported Book";
  let root = system ? `${system}/compendium/${book}` : parent ? `${parent.replace(/\/+$/, "")}/${book}` : book;
  // A folder that already holds notes is never written into: the book takes the next free name beside it.
  if (host.listNotes) {
    const base = root;
    for (let n = 2; (await host.listNotes(root)).length; n++) root = `${base}-${n}`;
    book = root.slice(root.lastIndexOf("/") + 1);
  }
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
      // A page of art gives OCR a few stray letters, not text: it stays a picture.
      const read = runs.reduce((n, r) => n + r.str.replace(/[^A-Za-zÀ-ÿ0-9]/g, "").length, 0);
      if (read >= 80) {
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
  const contents: ContentsEntry[] = [];
  const everything: Element[] = [];
  for (const page of pages) {
    const { elements } = layoutPage(page, { furniture, prefer });
    host.debug?.("layout", { page: page.num, elements });
    const lines = elements.flatMap((el) => (el.kind === "line" ? [lineText(el.line)] : []));
    if (isContentsPage(lines)) {
      // The contents pages are not written, but their entries are checked against what was found.
      if (page.num - from < Math.max(12, total * 0.1)) {
        // Read cell by cell, a column at a time: a contents page's columns are too ragged to find by their gutters.
        const cells = elements.flatMap((el) => (el.kind === "line" ? el.line.cells : []));
        const starts: number[] = [];
        for (const x of cells.map((c) => c.x).sort((a, b) => a - b)) {
          if (!starts.length || x - starts[starts.length - 1] > 60) starts.push(x);
        }
        const column = (x: number) => starts.reduce((best, st, i) => (x >= st - 1 ? i : best), 0);
        cells.sort((a, b) => column(a.x) - column(b.x) || a.base - b.base || a.x - b.x);
        contents.push(...readContents(cells.map(segText)));
      }
      continue;
    }
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
  // Bookmarks that leave most of the book in one piece (a file joined from two) say nothing of its chapters.
  const longest = Math.max(0, ...plans.map((p) => p.lastPage - p.firstPage + 1));
  if (plans.length && total > 40 && longest > 0.7 * total) plans = [];
  if (!plans.length) plans = planFromHeadings(perPage, styles, from, to);
  const chapters: Chapter[] = [];
  const drafts: Array<{ plan: ChapterPlan; blocks: Block[] }> = [];
  for (const plan of plans) {
    if (plan.skip) continue;
    stop();
    const elements: Element[] = [];
    for (let p = plan.firstPage; p <= plan.lastPage; p++) elements.push(...(perPage.get(p) ?? []));
    const blocks = toBlocks(elements, { styles });
    if (options.entities) promoteNames(blocks);
    nameChapter(plan, blocks);
    drafts.push({ plan, blocks });
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
  // A vault that keeps banners and reference pictures in folders of their own gets them there,
  // under plain names as its others have; else they stay in the book's folder, named for the book.
  const folderFor = (banner: boolean) => (banner ? options.bannerFolder : options.pictureFolder)?.replace(/\/+$/, "");
  const rename = async (file: string, near: string, banner = false): Promise<string> => {
    const hit = used.get(file);
    if (hit) return hit;
    const ext = file.slice(file.lastIndexOf("."));
    const folder = folderFor(banner);
    const base = (folder ? slug(near) || "art" : `${bookSlug}-${slug(near) || "art"}`).slice(0, 80);
    let name = `${base}${ext}`;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}${ext}`;
    taken.add(name);
    used.set(file, name);
    await host.rename(`${root}/${ASSETS}/${file}`, folder ? `${folder}/${name}` : `${root}/${ASSETS}/${name}`);
    return name;
  };
  let tables = 0;
  let sidebars = 0;
  for (const chapter of chapters) {
    if (chapter.banner)
      chapter.banner = await rename(chapter.banner, folderFor(true) ? chapter.title : `${chapter.title} banner`, true);
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
    source: options.source?.trim() || `From **${options.title}**.`,
    options,
    look: (title, index) => picked.get(title) ?? lookFor(title, index),
    mend: mender(vocabulary),
    files: [],
    tableIds: new Set(),
    names: new Set(),
    kinds: options.entities ? new Map() : undefined,
    found: [],
    place: system && options.entities ? placer(system, options.title, options.marker) : undefined,
    existing:
      system && host.listNotes
        ? new Set((await host.listNotes(`${system}/worldbuilding`)).map((p) => p.replace(/\.md$/, "").toLowerCase()))
        : undefined,
    kept: [],
    scanned: new Set(pages.filter((p) => p.ocr).map((p) => p.num)),
  };
  const facts = [
    `*Imported from a PDF of ${doc.numPages} pages${ocrPages ? `, ${ocrPages} of them read by OCR` : ""}: ${tables} tables, ${sidebars} sidebars, ${used.size} pictures.*`,
  ];
  const missing = missingFromContents(contents, chapters);
  if (contents.length) {
    facts.push(
      "",
      missing.length
        ? `*The book's table of contents has ${contents.length} entries; ${missing.length} were not found as headings (a heading set as a picture, or split or joined differently): ${missing
            .slice(0, 60)
            .map((m) => `${m.title} (p. ${m.page})`)
            .join(", ")}${missing.length > 60 ? "…" : ""}.*`
        : `*All ${contents.length} entries of the book's table of contents were found as headings.*`
    );
  }
  const files = emitBook(chapters, ctx, facts);
  host.debug?.("entities", ctx.found);
  // An entity's portrait is kept with the others of its kind, where the vault has a folder for them.
  for (const [file, kind] of ctx.portraits ?? []) {
    const to = options.portraitFolders?.[kind]?.replace(/\/+$/, "");
    const at = folderFor(false) ?? `${root}/${ASSETS}`;
    if (to && to !== at) await host.rename(`${at}/${file}`, `${to}/${file}`);
  }
  const kinds = [...(ctx.kinds ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  if (ctx.kept?.length) {
    files[files.length - 1].text +=
      `\n*${ctx.kept.length} entities were already in the vault under the same name and were left as they are: ${ctx.kept
        .slice(0, 40)
        .map((p) => p.replace(/^.*\//, "").replace(/\.md$/, ""))
        .join(", ")}${ctx.kept.length > 40 ? "…" : ""}.*\n`;
  }
  if (kinds.length) {
    // The index note is written last, so the count can still be added to it.
    const index = files[files.length - 1];
    index.text += `\n*Written as game entities: ${kinds.map(([k, n]) => `${n} ${k}${n === 1 ? "" : k.endsWith("s") ? "es" : "s"}`).join(", ")}.*\n`;
  }
  let done = 0;
  for (const file of files) {
    stop();
    host.progress?.("Writing notes", done++, files.length);
    await host.writeText(file.outside ? file.path : `${root}/${file.path}`, file.text);
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
    contents: { entries: contents.length, missing: missing.map((m) => `${m.title} (p. ${m.page})`) },
    kept: ctx.kept ?? [],
    entities: Object.fromEntries(kinds),
    tables,
    sidebars,
  };
}

/**
 * A chapter the bookmarks only number (`Chapter Two`) takes its name from its first page, where it
 * is set under the number (`CHAPTER TWO`, then `PRIMORDIAL AND DIVINE NAMES`).
 */
function nameChapter(plan: ChapterPlan, blocks: Block[]): void {
  if (!/^chapter \d+$/i.test(plan.title)) return;
  const heads = blocks.filter((b) => b.type === "heading" && b.page === plan.firstPage).slice(0, 3) as Array<
    Extract<Block, { type: "heading" }>
  >;
  const at = heads.findIndex((h) => chapterLabel(h.text));
  if (at < 0) return;
  const rest = chapterLabel(heads[at].text)?.rest;
  const next = heads[at + 1];
  const name = rest || (next && next.level <= heads[at].level + 1 ? next.text : "");
  if (name && name.length <= 80) plan.title = titleCase(name);
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
