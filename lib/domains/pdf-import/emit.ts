/**
 * Chapters written as notes: one note a chapter, its sections as tabs, a long
 * note split into a folder of notes, entries of one kind (spells, items) as a
 * folder of their own, tables as `rpg table` blocks and sidebars as
 * `rpg rule.side`.
 */

import { SOFT } from "./blocks";
import { fileName, isCatalog, sizeOf, slug, titleCase } from "./structure";
import type { Block, Chapter, ImportOptions, OutFile, Section, Span, TabLook } from "./types";

export interface EmitContext {
  /** The book's folder name; calls name folders from here, so the book can be moved whole. */
  book: string;
  /** The `source` line every note carries. */
  source: string;
  options: ImportOptions;
  look: (title: string, index: number) => TabLook;
  /** Mends words broken across lines. */
  mend: (text: string) => string;
  files: OutFile[];
  tableIds: Set<string>;
  names: Set<string>;
}

const yamlValue = (text: string): string =>
  /[:#"'[\]{}|>&*!%@`,]|^\s|\s$|^[-?]/.test(text) ? JSON.stringify(text) : text;

const escapeMd = (text: string): string => text.replace(/([*<])/g, "\\$1").replace(/^(\s*)([#>+-])(\s)/, "$1\\$2$3");

export function spansToMd(spans: Span[], mend: (t: string) => string): string {
  const joined: Span[] = [];
  for (const s of spans) {
    const last = joined[joined.length - 1];
    if (last && last.bold === s.bold && last.italic === s.italic) last.text += s.text;
    else joined.push({ ...s });
  }
  let out = "";
  joined.forEach((s, i) => {
    // A broken word whose halves differ in emphasis: join it; the vocabulary cannot help.
    let text = s.text;
    if (text.endsWith(SOFT) && joined[i + 1]) text = text.slice(0, -1);
    text = escapeMd(mend(text));
    const mark = s.bold && s.italic ? "***" : s.bold ? "**" : s.italic ? "*" : "";
    if (!mark || !text.trim()) {
      out += text;
      return;
    }
    const lead = text.match(/^\s*/)?.[0] ?? "";
    const trail = text.match(/\s*$/)?.[0] ?? "";
    out += lead + mark + text.trim() + mark + trail;
  });
  return out.replace(/[ \t]+/g, " ").trim();
}

/** A fence longer than any inside the text it wraps. */
function fenceFor(lines: string[]): string {
  let longest = 2;
  for (const line of lines) {
    const m = line.match(/^(`{3,})/);
    if (m) longest = Math.max(longest, m[1].length);
  }
  return "`".repeat(longest + 1);
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base || "table";
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function renderTable(block: Extract<Block, { type: "table" }>, ctx: EmitContext, near: string): string[] {
  const width = Math.max(...block.rows.map((r) => r.length));
  const cell = (c: string) => ctx.mend(c).replace(/\|/g, "\\|").trim() || " ";
  const row = (r: string[]) => `|${Array.from({ length: width }, (_, i) => cell(r[i] ?? "")).join("|")}|`;
  const caption = block.caption?.replace(/[[\]]/g, "").trim();
  const id = uniqueId(slug(caption || `${near} table`), ctx.tableIds);
  const lines = [
    `\`\`\`rpg table.${id}`,
    row(block.rows[0]),
    `|${Array.from({ length: width }, () => "---").join("|")}|`,
  ];
  for (const r of block.rows.slice(1)) lines.push(row(r));
  if (caption) lines.push(`[${caption}]`);
  lines.push("```");
  return lines;
}

export function renderBlocks(blocks: Block[], ctx: EmitContext, near: string): string[] {
  const out: string[] = [];
  const gap = () => {
    if (out.length && out[out.length - 1] !== "") out.push("");
  };
  for (const block of blocks) {
    if (block.type === "para") {
      gap();
      out.push(spansToMd(block.spans, ctx.mend));
    } else if (block.type === "heading") {
      out.push(`#### ${escapeMd(titleCase(block.text))}`);
    } else if (block.type === "list") {
      block.items.forEach((item, i) => out.push(`${block.ordered ? `${i + 1}.` : "-"} ${spansToMd(item, ctx.mend)}`));
    } else if (block.type === "table") {
      gap();
      out.push(...renderTable(block, ctx, near));
    } else if (block.type === "image") {
      gap();
      out.push(`![[${block.file}]]`);
    } else if (block.type === "side") {
      const body = renderBlocks(block.blocks, ctx, near);
      const fence = fenceFor(body);
      gap();
      out.push(`${fence}rpg rule.side`, "type: rules");
      if (block.title) out.push(`title: ${yamlValue(titleCase(block.title))}`);
      out.push("---", ...body, fence);
    }
  }
  while (out[out.length - 1] === "") out.pop();
  return out;
}

const hashes = (depth: number) => "#".repeat(Math.min(6, Math.max(1, depth)));

/** A section as headings and text, its subsections under deeper headings. */
function renderInline(section: Section, depth: number, ctx: EmitContext): string[] {
  const out = [`${hashes(depth)} ${escapeMd(section.title)}`, ...renderBlocks(section.blocks, ctx, section.title)];
  for (const child of section.children) out.push(...renderInline(child, depth + 1, ctx));
  return out;
}

/** Sections as a row of tabs; a big section's own parts become tabs inside its tab. */
function renderTabs(sections: Section[], depth: number, ctx: EmitContext, nest: boolean): string[] {
  const out: string[] = [];
  sections.forEach((section, i) => {
    const look = ctx.look(section.title, i);
    const nested = nest && section.children.length >= 3 && section.children.length <= 12 && sizeOf(section) > 150;
    const body = nested
      ? [
          `${hashes(depth)} ${escapeMd(section.title)}`,
          ...renderBlocks(section.blocks, ctx, section.title),
          ...renderTabs(section.children, depth + 1, ctx, false),
        ]
      : renderInline(section, depth, ctx);
    const fence = fenceFor(body);
    out.push(
      `${fence}rpg rule.tab`,
      `name: ${yamlValue(section.title)}`,
      `icon: ${look.icon}`,
      `color: ${look.color}`,
      "---",
      ...body,
      fence
    );
  });
  return out;
}

function frontmatter(fields: Array<[string, string | undefined]>): string[] {
  const out = ["---"];
  for (const [k, v] of fields) if (v !== undefined && v !== "") out.push(`${k}: ${v}`);
  out.push("---");
  return out;
}

/** Letters of a long list of entries dealt into tabs of about thirty entries each. */
function letterGroups(names: string[]): string[][] {
  const byLetter = new Map<string, number>();
  for (const name of names) {
    const letter = (name.match(/[A-Za-z0-9]/)?.[0] ?? "#").toUpperCase();
    byLetter.set(letter, (byLetter.get(letter) ?? 0) + 1);
  }
  const letters = [...byLetter.keys()].sort();
  const groups: string[][] = [];
  let cur: string[] = [];
  let n = 0;
  for (const letter of letters) {
    const count = byLetter.get(letter) ?? 0;
    if (cur.length && n + count > 30) {
      groups.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(letter);
    n += count;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function uniqueName(dir: string, name: string, ctx: EmitContext): string {
  let out = name || "Untitled";
  for (let n = 2; ctx.names.has(`${dir}/${out}`.toLowerCase()); n++) out = `${name} (${n})`;
  ctx.names.add(`${dir}/${out}`.toLowerCase());
  return out;
}

interface NoteSpec {
  section: Section;
  /** Path below the book's folder, without `.md`. */
  path: string;
  title: string;
  fields: Array<[string, string | undefined]>;
  depth: number;
}

/** One note; when it is too long, or its parts are entries of a kind, its parts go to a folder beside it. */
function writeNote(spec: NoteSpec, ctx: EmitContext): void {
  const { section, path, title, depth } = spec;
  const size = sizeOf(section);
  const kids = section.children;
  const { maxLines, catalogMin } = ctx.options;
  const catalog = isCatalog(section, catalogMin);
  const split =
    kids.length >= 2 && (catalog ? depth < 3 : depth < 2) && (size > maxLines || (catalog && size > maxLines / 2));
  const lines = [
    ...frontmatter(spec.fields),
    `# ${escapeMd(title)}`,
    ...renderBlocks(section.blocks, ctx, section.title),
  ];

  if (!split) {
    if (kids.length >= 2 && kids.length <= 12 && size > 60) lines.push(...renderTabs(kids, 2, ctx, true));
    else for (const child of kids) lines.push(...renderInline(child, 2, ctx));
  } else {
    const names: string[] = [];
    kids.forEach((child, i) => {
      const base = fileName(child.title);
      const name = uniqueName(path, catalog ? base : `${String(i + 1).padStart(2, "0")}. ${base}`, ctx);
      names.push(name);
      const look = ctx.look(child.title, i);
      writeNote(
        {
          section: child,
          path: `${path}/${name}`,
          title: child.title,
          fields: [
            ["source", ctx.source],
            ["tab-name", yamlValue(child.title)],
            ["tab-icon", look.icon],
            ["tab-color", look.color],
          ],
          depth: depth + 1,
        },
        ctx
      );
    });
    const call = `@[[${ctx.book}/${path}/]].shallow()`;
    if (!catalog || kids.length <= 14) lines.push(`\`${call}.tab()\``);
    else {
      const groups = letterGroups(names);
      const tabs: string[] = [];
      groups.forEach((letters, i) => {
        const name = letters.length > 1 ? `${letters[0]}–${letters[letters.length - 1]}` : letters[0];
        const look = ctx.look(section.title, i);
        tabs.push("```rpg rule.tab", `name: ${name}`, `icon: ${look.icon}`, `color: ${look.color}`, "---");
        for (const letter of letters) tabs.push(`## ${letter}`, `\`${call}.filter(${letter} prefix name).h4()\``);
        tabs.push("```");
      });
      lines.push(...tabs);
    }
  }
  ctx.files.push({ path: `${path}.md`, text: lines.join("\n") + "\n" });
}

export function chapterName(chapter: Chapter): string {
  const base = fileName(chapter.title);
  return chapter.number ? `${chapter.number}. ${base}` : base;
}

export function emitBook(chapters: Chapter[], ctx: EmitContext, facts: string[]): OutFile[] {
  const index = [...frontmatter([["source", ctx.source]]), `# ${ctx.options.title}`, ""];
  for (const chapter of chapters) {
    const name = uniqueName("", chapterName(chapter), ctx);
    writeNote(
      {
        section: chapter.root,
        path: name,
        title: name,
        fields: [
          ["banner", chapter.banner ? `"[[${chapter.banner}]]"` : undefined],
          ["banner-height", chapter.banner ? "600" : undefined],
          ["banner-y", chapter.banner ? "0" : undefined],
          ["content-start", chapter.banner ? "425" : undefined],
          ["source", ctx.source],
        ],
        depth: 0,
      },
      ctx
    );
    index.push(`- [[${name}]] (p. ${chapter.firstPage}–${chapter.lastPage})`);
  }
  index.push("", ...facts);
  ctx.files.push({ path: `${fileName(ctx.options.title)}.md`, text: index.join("\n") + "\n" });
  return ctx.files;
}

/**
 * Settles words broken across lines, from the words the book itself uses:
 * `char­acter` is joined when the book says `character`; `note­taking` keeps
 * its hyphen when the book says `note-taking`, or knows `note` and `taking`
 * but not `notetaking`.
 */
export function mender(vocabulary: Set<string>): (text: string) => string {
  const re = new RegExp(`([A-Za-zÀ-ÿ]+)${SOFT}([a-zà-ÿ]+)`, "g");
  return (text) => {
    if (!text.includes(SOFT)) return text;
    return text
      .replace(re, (_m, a: string, b: string) => {
        const joined = (a + b).toLowerCase();
        if (vocabulary.has(joined)) return a + b;
        if (vocabulary.has(`${a}-${b}`.toLowerCase())) return `${a}-${b}`;
        if (vocabulary.has(a.toLowerCase()) && vocabulary.has(b.toLowerCase()) && a.length > 2 && b.length > 2)
          return `${a}-${b}`;
        return a + b;
      })
      .split(SOFT)
      .join("");
  };
}

/** The words a text uses, lower-cased, hyphenated compounds whole. */
export function wordsOf(text: string, into: Set<string>): void {
  if (text.includes(SOFT)) text = text.replace(new RegExp(`[A-Za-zÀ-ÿ]+${SOFT}[a-zà-ÿ]+`, "g"), " ");
  for (const m of text.matchAll(/[A-Za-zÀ-ÿ]+(?:-[A-Za-zÀ-ÿ]+)*/g)) {
    const word = m[0].toLowerCase();
    into.add(word);
  }
}
