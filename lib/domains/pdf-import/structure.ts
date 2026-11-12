/**
 * The book's shape: which pages make which chapter (from the file's bookmarks,
 * or its biggest headings), and each chapter's blocks as a tree of sections.
 */

import { CREATURE_TYPE, FACT_LINE, MAGIC_HEAD, SPELL_HEAD, opensEntity } from "./patterns";
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

const UNNUMBERED =
  /^(appendix|appendices|index|glossary|credits|licen[cs]e|afterword|front matter|open game|list of|checklist|cover|inside cover)/i;

const UNITS =
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(
    " "
  );
const TENS = "twenty thirty forty fifty sixty seventy eighty ninety".split(" ");

/** `12`, `Twelve`, `Twenty One`, `twenty-one`, `IV` as a number; 0 when the words are not one. */
export function numberFrom(text: string): number {
  const t = text.trim().toLowerCase();
  if (/^\d{1,3}$/.test(t)) return Number(t);
  const words = t.split(/[\s-]+/);
  const unit = UNITS.indexOf(words[words.length - 1]);
  const ten = TENS.indexOf(words[0]);
  if (words.length === 1 && unit >= 0) return unit;
  if (words.length === 1 && ten >= 0) return (ten + 2) * 10;
  if (words.length === 2 && ten >= 0 && unit > 0 && unit < 10) return (ten + 2) * 10 + unit;
  if (/^[ivxl]+$/.test(t)) {
    const val: Record<string, number> = { i: 1, v: 5, x: 10, l: 50 };
    let n = 0;
    for (let i = 0; i < t.length; i++) n += val[t[i]] < (val[t[i + 1]] ?? 0) ? -val[t[i]] : val[t[i]];
    return n;
  }
  return 0;
}

/** `Chapter Two: Monsters` → 2 and `Monsters`; `Chapter Twenty One` → 21 and nothing. */
export function chapterLabel(text: string): { n: number; rest: string } | null {
  const hit = text.trim().match(/^chapter\s+(.*)$/i);
  if (!hit) return null;
  const words = hit[1].split(/\s+/);
  // The longest run of words that is a number: `Twenty One`, before `One`.
  for (const take of [2, 1]) {
    if (words.length < take) continue;
    const head = words.slice(0, take).join(" ");
    const n = numberFrom(head.replace(/[:.,–—-]+$/, ""));
    if (!n) continue;
    const rest = words
      .slice(take)
      .join(" ")
      .replace(/^[:.,–—-]+\s*/, "")
      .trim();
    if (take === 1 && !/[:.,–—-]$/.test(head) && rest && /^[a-z]/.test(rest)) continue;
    return { n, rest };
  }
  return null;
}

/** The caption of a table or a figure (`Table 2-13: Epithets`), which some files bookmark one by one. */
export const CAPTION = /^(table|figure|fig\.|map|chart|plate|illustration)\s+[A-Z]?\d+(?:\s*[-.–:]\s*\d+)*[a-z]?\b/i;

/** `Table 2-13: Epithets` → `2-13` and `Epithets`. */
export function captionParts(text: string): { number: string; name: string } | null {
  const hit = text.trim().match(/^table\s+([A-Z]?\d+(?:\s*[-.–]\s*\d+)*[a-z]?)\s*[:.–—-]?\s*(.*)$/i);
  if (!hit) return null;
  return { number: hit[1].replace(/\s+/g, ""), name: hit[2].trim() };
}

/**
 * Chapters from the file's bookmarks. Empty when they say too little.
 *
 * Bookmarks are as tidy as the program that made the file: the chapters may sit under one bookmark
 * named for the file, beside one for every table, or among their own sections. So: bookmarks that
 * say `Chapter N` are the chapters wherever they sit; without any, the shallowest bookmarks that
 * cut the book into more than one real piece are.
 */
export function planFromOutline(outline: OutlineEntry[], from: number, to: number): ChapterPlan[] {
  const total = to - from + 1;
  const entries = outline.filter(
    (o) =>
      o.title &&
      o.page >= from &&
      o.page <= to &&
      !/^blank page$/i.test(o.title) &&
      // Marks a word processor leaves behind (`_Hlk180566310`), the file's own name, captions.
      !/^_\w+$/.test(o.title) &&
      !/\.(pdf|indd|docx?|pub)$/i.test(o.title) &&
      !CAPTION.test(o.title)
  );
  const build = (starts: Array<{ title: string; page: number }>): ChapterPlan[] => {
    const plans: ChapterPlan[] = [];
    if (starts[0].page > from)
      plans.push({ title: "Front Matter", number: "", firstPage: from, lastPage: starts[0].page - 1 });
    starts.forEach((o, i) => {
      const lastPage = i + 1 < starts.length ? starts[i + 1].page - 1 : to;
      plans.push({ title: o.title, number: "", firstPage: o.page, lastPage });
    });
    return numberChapters(plans);
  };

  const labelled = entries.map((o, i) => ({ o, i, label: chapterLabel(o.title) })).filter((e) => e.label);
  const numbers = new Set(labelled.map((e) => e.label?.n));
  if (numbers.size >= 2) {
    const starts: Array<{ title: string; page: number }> = [];
    const seen = new Set<number>();
    const pages = new Set<number>();
    for (const { o, i, label } of labelled) {
      if (!label || seen.has(label.n)) continue;
      seen.add(label.n);
      pages.add(o.page);
      // `Chapter Twenty` with its name as the next bookmark on the same page.
      const next = entries[i + 1];
      const named = !label.rest && next && next.page === o.page && !chapterLabel(next.title) ? next.title : label.rest;
      starts.push({ title: named ? `Chapter ${label.n}: ${named}` : `Chapter ${label.n}`, page: o.page });
    }
    starts.sort((a, b) => a.page - b.page);
    const first = starts[0].page;
    const last = starts[starts.length - 1].page;
    // The chapters' own depth, and whether they have it to themselves or share it with their sections.
    const depths = new Map<number, number>();
    for (const { o } of labelled) depths.set(o.depth, (depths.get(o.depth) ?? 0) + 1);
    const depth = [...depths.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const level = entries.filter((o) => o.depth <= depth && !pages.has(o.page));
    const among = level.filter((o) => o.page > first && o.page < last).length;
    const pure = among <= 0.4 * starts.length;
    const extra = new Map<number, string>();
    for (const o of level) {
      const outside = o.page < first || o.page > last;
      if (extra.has(o.page) || !(outside || pure)) continue;
      if (o.page > first && !pure && !UNNUMBERED.test(o.title)) continue;
      extra.set(o.page, o.title);
    }
    for (const [page, title] of extra) starts.push({ title, page });
    starts.sort((a, b) => a.page - b.page);
    return build(starts);
  }

  let shallowest: ChapterPlan[] = [];
  for (let depth = 0; depth <= 3; depth++) {
    const top = entries.filter((o) => o.depth <= depth).sort((a, b) => a.page - b.page);
    const unique = top.filter((o, i) => i === 0 || o.page !== top[i - 1].page);
    if (unique.length < 2) continue;
    if (depth > 0 && total / unique.length < 3) break;
    const longest = Math.max(
      unique[0].page - from,
      ...unique.map((o, i) => (i + 1 < unique.length ? unique[i + 1].page : to + 1) - o.page)
    );
    // Bookmarks that leave most of the book in one piece (a file joined from two, a bookmark
    // around the whole book) say little of its chapters: the ones under them may say more.
    if (total > 40 && longest > 0.7 * total) {
      if (!shallowest.length) shallowest = build(unique);
      continue;
    }
    return build(unique);
  }
  return shallowest;
}

export function numberChapters(plans: ChapterPlan[]): ChapterPlan[] {
  const numbered = plans.filter((p) => !UNNUMBERED.test(p.title));
  let n = numbered[0] && /^(intro|foreword|preface|prologue|welcome)/i.test(numbered[0].title) ? 0 : 1;
  for (const plan of plans) {
    const own = chapterLabel(plan.title);
    if (own) {
      plan.number = String(own.n).padStart(2, "0");
      plan.title = own.rest || `Chapter ${own.n}`;
      n = own.n + 1;
    } else if (/^(index|list of tables|list of figures)$/i.test(plan.title.trim())) plan.skip = true;
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
    if (block.type === "heading" && !block.caption) {
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
    // Only a heading that says what the chapter is called: any other lone heading is a real section.
    const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []);
    const [a, b] = [words(only.title), words(title)];
    const shared = [...a].filter((w) => b.has(w)).length;
    if (shared < Math.min(a.size, b.size) || !shared) break;
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
    if (b.type !== "heading" || b.caption || checked >= 4) return true;
    checked++;
    const have = key(b.text);
    const isNumber =
      /^(chapter|appendix|part)\s*[\dA-Za-z]{0,4}$/i.test(b.text.trim()) ||
      have === key(`chapter ${Number(number)}`) ||
      chapterLabel(b.text)?.rest === "";
    const same = have === want || (want.length >= 6 && have.includes(want));
    return !((isNumber && !seenText) || same);
  });
}

/**
 * A name the type did not mark as a heading (a scan, a book that sets names
 * in the text's own face) is known by the line under it: the one that opens a
 * spell's, a magic item's or a creature's facts. Such names become headings,
 * all of one rank below every other, so each entity is a section.
 */
export function promoteNames(blocks: Block[]): number {
  const text = (b: Block | undefined) =>
    b?.type === "para"
      ? b.spans
          .map((s) => s.text)
          .join("")
          .trim()
      : "";
  const opens = (i: number) => {
    const under = text(blocks[i + 1]);
    const creature = CREATURE_TYPE.test(under) && /^armor class\b/i.test(text(blocks[i + 2]));
    return creature || /^armor class\s+\d/i.test(under) || SPELL_HEAD.test(under) || MAGIC_HEAD.test(under);
  };
  // Names the type did mark set the rank: a name found by its line alone is their fellow, not their part.
  const ranks = new Map<number, number>();
  blocks.forEach((b, i) => {
    if (b.type === "heading" && opens(i)) ranks.set(b.level, (ranks.get(b.level) ?? 0) + 1);
  });
  const level = [...ranks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 90;
  let made = 0;
  for (let i = 0; i + 1 < blocks.length; i++) {
    const name = text(blocks[i]);
    if (!name || name.length > 70 || /[.!?;,]$/.test(name) || FACT_LINE.test(name) || opensEntity(name)) continue;
    if (!opens(i)) continue;
    blocks[i] = { type: "heading", level, text: name, page: blocks[i].page, style: "name" };
    made++;
  }
  return made;
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

export interface ContentsEntry {
  title: string;
  /** The page number the book prints, which need not be the file's. */
  page: number;
}

/** The entries of a table of contents, from its lines; a title that wrapped is joined to the line that carries its page. */
export function readContents(lines: string[]): ContentsEntry[] {
  const out: ContentsEntry[] = [];
  let carry = "";
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const hit = line.match(/^(.*?)\s*(?:\.{2,}|…+|(?:\s\.)+)\s*(\d{1,4})$/);
    if (hit) {
      const title = `${carry} ${hit[1]}`.trim();
      if (title) out.push({ title: titleCase(title), page: Number(hit[2]) });
      carry = "";
    } else carry = line.length <= 45 && !/[.!?]$/.test(line) && !/^(table of )?contents$/i.test(line) ? line : "";
  }
  return out;
}

/** The contents entries that no chapter or heading of the import carries. */
export function missingFromContents(contents: ContentsEntry[], chapters: Chapter[]): ContentsEntry[] {
  const bare = (text: string) =>
    text
      .toLowerCase()
      .replace(/^(chapter\s+\d+|appendix\s+[a-z])\s*[:.]?\s*/, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  const have = new Set<string>();
  const walk = (section: Section) => {
    have.add(bare(section.title));
    // A book that lists its tables in its contents: their captions count as found.
    walkBlocks({ ...section, children: [] }, (b) => {
      if (b.type === "heading") have.add(bare(b.text));
      else if (b.type === "table" && b.caption) have.add(bare(b.caption));
    });
    section.children.forEach(walk);
  };
  for (const chapter of chapters) walk(chapter.root);
  const seen = new Set<string>();
  return contents.filter((entry) => {
    const key = bare(entry.title);
    if (!key || have.has(key) || seen.has(key)) return false;
    if (/^(index|tableofcontents|contents|charactersheet)$/.test(key)) return false;
    seen.add(key);
    return true;
  });
}
