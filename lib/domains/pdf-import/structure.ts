/**
 * The book's shape: which pages make which chapter (from the file's bookmarks,
 * or its biggest headings), and each chapter's blocks as a tree of sections.
 */

import type { Block, Chapter, OutlineEntry, Section } from "./types";

const SMALL = new Set(
  "a an and as at but by for from in into nor of on or per the to vs via with de da do das dos e em o os um uma".split(
    " "
  )
);

/** `STEP 2. CHOOSE A CLASS` → `Step 2. Choose a Class`; text that is not all capitals is left alone. */
export function titleCase(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const letters = clean.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 2 || letters !== letters.toUpperCase()) return clean;
  let first = true;
  return clean.replace(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’]*/g, (word, offset: number) => {
    const lower = word.toLowerCase();
    const start = first || /[:.!?(]\s*$/.test(clean.slice(0, offset));
    first = false;
    if (/^(II|III|IV|VI|VII|VIII|IX|XI|XII|XIII|XIV|XV|XX)$/.test(word)) return word;
    if (word.length <= 4 && !/[AEIOUYÀ-ÿ]/.test(word) && word.length >= 2) return word;
    if (word.length === 2 && !SMALL.has(lower) && !/^(is|it|be|my|no|so|up|we|go|do|if|us|he|me)$/.test(lower))
      return word;
    if (!start && SMALL.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

/** A name safe for a file or folder in a vault. */
export function fileName(text: string): string {
  return text
    .replace(/[:]/g, ",")
    .replace(/[\\/|#^[\]<>?*"]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 90)
    .trim();
}

export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export interface ChapterPlan {
  title: string;
  number: string;
  firstPage: number;
  lastPage: number;
  /** An index or a table of contents: read past, not written. */
  skip?: boolean;
}

const UNNUMBERED = /^(appendix|index|glossary|credits|licen[cs]e|afterword|front matter|open game)/i;

/** Chapters from the file's top bookmarks. Empty when it has too few to go by. */
export function planFromOutline(outline: OutlineEntry[], from: number, to: number): ChapterPlan[] {
  const top = outline
    .filter((o) => o.depth === 0 && o.title && !/^blank page$/i.test(o.title) && o.page >= from && o.page <= to)
    .sort((a, b) => a.page - b.page);
  const unique = top.filter((o, i) => i === 0 || o.page !== top[i - 1].page);
  if (unique.length < 2) return [];
  const plans: ChapterPlan[] = [];
  if (unique[0].page > from) {
    plans.push({ title: "Front Matter", number: "", firstPage: from, lastPage: unique[0].page - 1 });
  }
  unique.forEach((o, i) => {
    const lastPage = i + 1 < unique.length ? unique[i + 1].page - 1 : to;
    plans.push({ title: o.title, number: "", firstPage: o.page, lastPage });
  });
  return numberChapters(plans);
}

export function numberChapters(plans: ChapterPlan[]): ChapterPlan[] {
  const numbered = plans.filter((p) => !UNNUMBERED.test(p.title));
  let n = numbered[0] && /^(intro|foreword|preface|prologue|welcome)/i.test(numbered[0].title) ? 0 : 1;
  for (const plan of plans) {
    const own = plan.title.match(/^chapter\s+(\d+)\s*[:.–-]?\s*(.*)$/i);
    if (own) {
      plan.number = own[1].padStart(2, "0");
      plan.title = own[2] || plan.title;
      n = Number(own[1]) + 1;
    } else if (/^index$/i.test(plan.title.trim())) plan.skip = true;
    else if (!UNNUMBERED.test(plan.title)) plan.number = String(n++).padStart(2, "0");
    plan.title = titleCase(plan.title);
  }
  return plans;
}

const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Blocks as a tree: each heading takes what follows it, down to the next heading of its rank or above. */
export function toSections(blocks: Block[], title: string, page: number): Section {
  const root: Section = { title, level: 0, style: "", page, blocks: [], children: [] };
  const stack: Section[] = [root];
  for (const block of blocks) {
    if (block.type === "heading") {
      while (stack.length > 1 && stack[stack.length - 1].level >= block.level) stack.pop();
      const tagged = block.text.match(/^(.*\S)\s+(CR\s+\d+(?:\/\d+)?)$/i);
      const node: Section = {
        title: titleCase(tagged ? tagged[1] : block.text),
        tag: tagged?.[2],
        level: block.level,
        style: block.style,
        page: block.page,
        blocks: [],
        children: [],
      };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else stack[stack.length - 1].blocks.push(block);
  }
  // The chapter's own title set as its one heading: its parts are the chapter's.
  while (root.children.length === 1 && !root.blocks.some((b) => b.type !== "image")) {
    const only = root.children[0];
    root.blocks.push(...only.blocks);
    root.children = only.children;
  }
  liftRepeats(root);
  return root;
}

/**
 * A book sometimes sets one of a run of like sections a size smaller (a class
 * whose name fell on a crowded page), which files it under the one before.
 * It gives itself away by repeating that one's parts: a section whose own
 * parts carry a title an earlier part of its parent has is lifted beside its parent.
 */
function liftRepeats(node: Section): void {
  for (let i = 0; i < node.children.length; i++) {
    const parent = node.children[i];
    const at = parent.children.findIndex((s, k) => {
      if (k === 0 || !s.children.length || s.level - parent.level > 1) return false;
      const earlier = new Set(parent.children.slice(0, k).map((c) => c.title.toLowerCase()));
      return s.children.some((c) => earlier.has(c.title.toLowerCase()));
    });
    if (at > 0) {
      const lifted = parent.children.splice(at);
      node.children.splice(i + 1, 0, ...lifted);
    }
  }
  for (const child of node.children) liftRepeats(child);
}

/**
 * The chapter's own name set as a heading on its first page (`CHAPTER 1`,
 * `CHARACTER CREATION & LEVELING`) is dropped: the note carries it already.
 */
export function dropTitleHeadings(blocks: Block[], title: string, number: string): Block[] {
  const want = key(title);
  let seenText = false;
  let checked = 0;
  return blocks.filter((b) => {
    if (b.type === "para" || b.type === "list" || b.type === "table") seenText = true;
    if (b.type !== "heading" || checked >= 4) return true;
    checked++;
    const have = key(b.text);
    const isNumber =
      /^(chapter|appendix|part)\s*[\dA-Za-z]{0,4}$/i.test(b.text.trim()) || have === key(`chapter ${Number(number)}`);
    const same = have === want || (want.length >= 6 && have.includes(want));
    return !((isNumber && !seenText) || same);
  });
}

/** How many lines of a note a section takes, near enough to decide what to split. */
export function sizeOf(section: Section): number {
  let n = section.level ? 1 : 0;
  const count = (blocks: Block[]): number =>
    blocks.reduce((sum, b) => {
      if (b.type === "para") return sum + 2;
      if (b.type === "list") return sum + b.items.length + 1;
      if (b.type === "table") return sum + b.rows.length + 4;
      if (b.type === "side") return sum + 5 + count(b.blocks);
      return sum + 2;
    }, 0);
  n += count(section.blocks);
  for (const child of section.children) n += sizeOf(child);
  return n;
}

/** True when a section's parts are entries of one kind (spells, items, backgrounds): a folder of notes. */
export function isCatalog(section: Section, min: number): boolean {
  if (section.children.length < min) return false;
  const styles = new Map<string, number>();
  for (const c of section.children) styles.set(c.style, (styles.get(c.style) ?? 0) + 1);
  const most = Math.max(...styles.values());
  if (most / section.children.length < 0.8) return false;
  // Entries of a kind are listed by name; steps and parts that follow one another are not a catalog.
  const names = section.children.map((c) => c.title.toLowerCase());
  let ordered = 0;
  for (let i = 1; i < names.length; i++) if (names[i - 1].localeCompare(names[i]) <= 0) ordered++;
  return ordered / (names.length - 1) >= 0.85;
}

/** The first big, wide picture near a chapter's start is its banner. */
export function takeBanner(chapter: Chapter): void {
  const find = (blocks: Block[]): number =>
    blocks.findIndex(
      (b) => b.type === "image" && b.page <= chapter.firstPage + 1 && b.pxW >= 900 && b.pxW / b.pxH >= 1.15
    );
  const pools = [chapter.root.blocks, ...chapter.root.children.slice(0, 1).map((c) => c.blocks)];
  for (const pool of pools) {
    const i = find(pool);
    if (i >= 0) {
      chapter.banner = (pool[i] as Extract<Block, { type: "image" }>).file;
      pool.splice(i, 1);
      return;
    }
  }
}

/** Every block of a section and of the sections under it, in order. */
export function walkBlocks(section: Section, visit: (b: Block, owner: Section) => void): void {
  const each = (blocks: Block[], owner: Section) => {
    for (const b of blocks) {
      visit(b, owner);
      if (b.type === "side") each(b.blocks, owner);
    }
  };
  each(section.blocks, section);
  for (const c of section.children) walkBlocks(c, visit);
}

/** A page of a table of contents or an index: most of its lines end in dots and a page number. */
export function isContentsPage(lines: string[]): boolean {
  if (lines.length < 8) return false;
  const dotted = lines.filter((l) => /(\.{3,}|…{2,}|(\. ){3,})\s*\d{1,4}\s*$/.test(l)).length;
  return dotted / lines.length > 0.35;
}
