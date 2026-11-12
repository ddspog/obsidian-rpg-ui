/**
 * Chapters written as notes: one note a chapter, its sections as tabs, a long
 * note split into a folder of notes, entries of one kind (spells, items) as a
 * folder of their own, tables as `rpg table` blocks and sidebars as
 * `rpg rule.side`.
 */

import { reviewLine } from "../review/block-review";
import { rollRange, SOFT } from "./blocks";
import {
  fenced,
  itemsFromTable,
  priceKey,
  priceList,
  recogniseEntity,
  type EntityKind,
  type EntityOut,
} from "./entities";
import type { Placer } from "./organise";
import { dieOfNumbered, tableReviews } from "./review";
import { captionParts, fileName, isCatalog, sizeOf, slug, titleCase, walkBlocks } from "./structure";
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
  /** The page each table written starts on, by its id: for the review of the import. */
  tablePages?: Map<string, number>;
  names: Set<string>;
  /** How many of each kind of entity were written; absent when entities are not looked for. */
  kinds?: Map<string, number>;
  /** Where each entity's note goes when entities are kept in folders of their own; absent: beside the text. */
  place?: Placer;
  /** Notes the vault already has (lower-cased paths from its root, no `.md`): never written over. */
  existing?: Set<string>;
  /** Notes left as they were because the vault already had them. */
  kept?: string[];
  /** What the book's price lists (mounts, vehicles) say, by name: written into the stat blocks they price. */
  prices?: Map<string, { list: string; fields: Array<[string, string]> }>;
  /** Traits notes shared by a creature type, built up as creatures are written. */
  traitNotes?: Map<string, { lines: string[]; ids: Map<string, string>; taken: Set<string> }>;
  /** The opening text of the chapter being written, with its title: tells what its creatures are listed for. */
  chapterIntro?: string;
  /** Pictures that are an entity's portrait, with the entity's kind. */
  portraits?: Map<string, string>;
  /** Pages whose text came from OCR. */
  scanned?: Set<number>;
  /** Every entity written: its kind, name and the note it is in. */
  found?: Array<{ kind: string; title: string; path: string }>;
}

/** Where a piece of text is being written: its note (below the book's folder, no `.md`) and the sections above it. */
interface Where {
  path: string;
  trail: string[];
  /** The note is one of the entity notes kept outside the book's folder. */
  outside?: boolean;
  /** Inside an entity already: only a stat block is looked for there (a companion in a subclass). */
  inside?: boolean;
}

/** Adds a note to write, unless the vault already has one there (which is then left alone). */
function pushFile(ctx: EmitContext, file: OutFile): void {
  if (file.outside && ctx.existing?.has(file.path.replace(/\.md$/, "").toLowerCase())) {
    ctx.kept?.push(file.path);
    return;
  }
  ctx.files.push(file);
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

const DICE = [2, 3, 4, 6, 8, 10, 12, 20, 30, 100, 1000];

/**
 * The die a table is rolled on, when its first column counts from 1 to the die's top with no gap
 * (`1`…`20`, `01-05`…`96-00`) and its header names a die or a roll (`d20`, `1d100`, `Die Roll`, `Roll`).
 */
export function dieOf(rows: string[][]): number {
  const head = (rows[0]?.[0] ?? "").trim();
  const named = head.match(/^1?d(\d{1,4}|%)$/i);
  if (!named && !/^(die|dice)?\s*(roll|result)?$|^(roll|die|dice|d\d+ roll|#|no\.?|number)$/i.test(head)) return 0;
  let next = 1;
  for (const row of rows.slice(1)) {
    const range = rollRange(row[0]);
    if (!range || range[0] !== next || range[1] < range[0]) return 0;
    next = range[1] + 1;
  }
  const top = next - 1;
  if (rows.length < 3 || !DICE.includes(top)) return 0;
  if (named && (named[1] === "%" ? 100 : Number(named[1])) !== top) return 0;
  // A bare column of numbers is a die only when it is one a player owns: a list of steps is not.
  if (!named && !head && top !== 100) return 0;
  return top;
}

function renderTable(block: Extract<Block, { type: "table" }>, ctx: EmitContext, near: string): string[] {
  const width = Math.max(...block.rows.map((r) => r.length));
  const cell = (c: string) => ctx.mend(c).replace(/\|/g, "\\|").trim() || " ";
  const row = (r: string[]) => `|${Array.from({ length: width }, (_, i) => cell(r[i] ?? "")).join("|")}|`;
  const caption = block.caption?.replace(/[[\]]/g, "").trim();
  // `Table 2-3: Creator Deity Epithet` is addressed by its name: the number may change with the edition.
  const name = (caption && captionParts(caption)?.name) || caption;
  const id = uniqueId(slug(name || `${near} table`), ctx.tableIds);
  ctx.tablePages?.set(id, block.page);
  // What a person should check in it, written at the block's top: the block shows it, and turns
  // off what does not work (a dice table with gaps keeps its roll row, which stays off till mended).
  const reviews = [...tableReviews(block.rows, block.page, caption), ...(block.reviews ?? [])];
  const gappy = reviews.some((r) => r.kind === "table-numbers") && !rollRange(block.rows[0]?.[0]);
  const die = dieOf(block.rows) || (gappy ? dieOfNumbered(block.rows) : 0);
  const head = die ? [`d${die}*`, ...block.rows[0].slice(1)] : block.rows[0];
  const rule = `|${Array.from({ length: width }, () => "---").join("|")}|`;
  // (Rolls that land on a number the table lacks are rolled again, so it stays of use.)
  const lines = [`\`\`\`rpg table.${id}`, ...reviews.map(reviewLine), ...(gappy && die ? ["@reroll"] : [])];
  if (block.rows.length > 21) lines.push("@paginate 10 pages");
  lines.push(row(head), rule);
  for (const r of block.rows.slice(1)) lines.push(row(r));
  if (die) {
    // Columns rolled each on its own die (parts of a name) when the text above the table says so.
    const each = block.each && width > 2;
    const parts = block.rows.slice(1).flatMap((r) => r.slice(1));
    const glued = parts.length > 0 && parts.every((c) => c.length <= 12 && !/\s/.test(c.trim()));
    lines.push(rule, `|= {{ roll${each ? ` each${glued ? " join=''" : ""}` : ""} }} =|`);
  }
  if (caption) lines.push(`[${caption}]`);
  lines.push("```");
  return lines;
}

export function renderBlocks(blocks: Block[], ctx: EmitContext, near: string, where?: Where): string[] {
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
      // What the lines under a caption say of the table's use (`Roll independently on each column`).
      const at = blocks.indexOf(block);
      const table = blocks.slice(at + 1, at + 8).find((b) => b.type !== "para" && b.type !== "list");
      if (block.caption && table?.type === "table") {
        const said = blocks
          .slice(at + 1, blocks.indexOf(table))
          .map((b) => (b.type === "para" ? b.spans.map((sp) => sp.text).join("") : ""))
          .join(" ");
        if (/\broll(ed)?\b[^.]{0,60}\b(independently|separately|each (column|part)|once (for|on) each)/i.test(said))
          table.each = true;
      }
    } else if (block.type === "list") {
      block.items.forEach((item, i) => out.push(`${block.ordered ? `${i + 1}.` : "-"} ${spansToMd(item, ctx.mend)}`));
    } else if (block.type === "table") {
      gap();
      out.push(...renderTable(block, ctx, near));
      if (ctx.kinds && where) {
        // A table of weapons, armor or gear also gives a note an item, in a folder named for the table.
        const dir = `${where.path}/${fileName(titleCase(block.caption ?? block.rows[0][0] ?? `${near} items`))}`;
        const place = ctx.place;
        const items = itemsFromTable(
          block,
          place ? (type, name) => place("item", name, { type }, where.trail) : dir,
          (d, n) => uniqueName(d, n, ctx)
        );
        for (const item of items) pushFile(ctx, item);
        if (items.length) ctx.kinds.set("item", (ctx.kinds.get("item") ?? 0) + items.length);
      }
    } else if (block.type === "image") {
      gap();
      out.push(`![[${block.file}]]`);
    } else if (block.type === "side") {
      const body = renderBlocks(block.blocks, ctx, near, where);
      const fence = fenceFor(body);
      gap();
      out.push(`${fence}rpg rule.side`, ...(block.reviews ?? []).map(reviewLine), "type: rules");
      if (block.title) out.push(`title: ${yamlValue(titleCase(block.title))}`);
      out.push("---", ...body, fence);
    }
  }
  while (out[out.length - 1] === "") out.pop();
  return out;
}

const hashes = (depth: number) => "#".repeat(Math.min(6, Math.max(1, depth)));

/**
 * A section that is a game entity, written as the plugin's block for it; null for any other.
 * Notes it brings with it (a creature's traits, a class's subclasses) are written here.
 */
function entityFor(
  section: Section,
  depth: number,
  ctx: EmitContext,
  where: Where,
  hint?: EntityKind
): EntityOut | null {
  if (!ctx.kinds) return null;
  const inner: Where = { path: where.path, trail: [...where.trail, section.title], inside: true };
  const out = recogniseEntity(section, {
    book: ctx.book,
    notePath: where.path,
    trail: where.trail,
    hint,
    scanned: ctx.scanned?.has(section.page),
    only: where.inside ? "creature" : undefined,
    depth,
    md: (spans) => spansToMd(spans, ctx.mend),
    render: (blocks, near) => renderBlocks(blocks, ctx, near, inner),
    inline: (child, d) => renderInline(child, d, ctx, inner),
    priceOf: (name) => ctx.prices?.get(priceKey(name)),
    shareTrait: ctx.place ? (type, creature, feature) => shareTrait(ctx, type, creature, feature) : undefined,
    unique: (dir, name) => uniqueName(dir, name, ctx),
  });
  if (!out) return null;
  ctx.kinds.set(out.kind, (ctx.kinds.get(out.kind) ?? 0) + 1);
  ctx.found?.push({ kind: out.kind, title: section.title, path: where.path });
  for (const file of out.files) pushFile(ctx, file);
  const place = ctx.place;
  const link = (path: string, name: string) => `[[${path}|${name}]]`;
  if (out.childNotes.length) {
    const links: string[] = [];
    for (const child of out.childNotes) {
      const target = place?.("subclass", child.section.title, {}, inner.trail);
      const name = uniqueName(where.path, fileName(child.section.title), ctx);
      writeNote(
        {
          section: child.section,
          path: target ?? `${where.path}/${name}`,
          outside: !!target,
          title: child.section.title,
          fields: [["source", ctx.source], ...child.fields],
          depth: 3,
          trail: inner.trail,
          hint: "subclass",
        },
        ctx
      );
      if (target) links.push(`- ${link(target, child.section.title)}`);
    }
    if (links.length) out.lines.push(...links);
    else out.lines.push(`\`@[[${ctx.book}/${where.path}/]].shallow().tab()\``);
  }
  // Kept in a folder of its own: the entity is written there, and the text it sat in shows it from there.
  // Where the creature sits in the book says what the book takes it for.
  const around = [...where.trail, ctx.chapterIntro ?? ""].join(" · ");
  const info = {
    ...(out.info ?? {}),
    druid: /\bdruids?\b|wild shape|beast forms?|beast shapes?/i.test(around),
    npc: /\bnpcs?\b|non-?player characters?/i.test(where.trail.join(" · ")),
  };
  if (out.portrait) (ctx.portraits ??= new Map()).set(out.portrait, out.kind);
  const target = !where.outside ? place?.(out.kind, section.title, info, where.trail) : undefined;
  if (target) {
    const body = [...out.lines];
    if (!out.consumed) for (const child of section.children) body.push(...renderInline(child, 2, ctx, inner));
    pushFile(ctx, {
      outside: true,
      path: `${target}.md`,
      text:
        [
          ...frontmatter([["source", ctx.source], ...out.fields]),
          // The note's own name, with the mark of where it comes from when the book has one.
          `# ${escapeMd(target.slice(target.lastIndexOf("/") + 1))}`,
          ...body,
        ].join("\n") + "\n",
    });
    out.placed = target;
    out.lines = [`!${link(target, section.title)}`];
    out.fields = [];
    out.consumed = true;
  }
  return out;
}

/**
 * A creature's trait or action, kept in the traits note of its creature type. One that another
 * creature already has word for word is shared; one of the same name with other words is kept
 * under the creature's name, and still shown by its own.
 */
function shareTrait(
  ctx: EmitContext,
  type: string,
  creature: string,
  feature: { name: string; type: string; body: string[] }
): string {
  const path = ctx.place?.("creature traits", type, {}, []) ?? `${type} Traits`;
  const notes = (ctx.traitNotes ??= new Map());
  let note = notes.get(path);
  if (!note) {
    note = {
      lines: [
        ...frontmatter([
          ["source", ctx.source],
          ["cssclasses", "\n  - note-feature"],
        ]),
        `# ${escapeMd(path.slice(path.lastIndexOf("/") + 1))}`,
      ],
      ids: new Map(),
      taken: new Set(),
    };
    notes.set(path, note);
  }
  const key = `${feature.name}\n${feature.body.join("\n")}`;
  let id = note.ids.get(key);
  if (!id) {
    id = feature.name;
    if (note.taken.has(id.toLowerCase())) id = `${creature}: ${feature.name}`;
    for (let n = 2; note.taken.has(id.toLowerCase()); n++) id = `${creature}: ${feature.name} (${n})`;
    note.taken.add(id.toLowerCase());
    note.ids.set(key, id);
    const yaml = id === feature.name ? [] : [`id: ${JSON.stringify(id)}`];
    yaml.push(`name: ${JSON.stringify(feature.name)}`, `type: ${feature.type}`, "heading: p");
    note.lines.push(...fenced("feature.details", yaml, feature.body));
  }
  return `@[[${path}]]#${id}`;
}

/**
 * Entities filed into the system's folders, listed the way the system's own pages list them:
 * a call a folder and a letter, which shows every note there, this book's and any other's.
 */
function listPlaced(placed: Array<{ path: string; title: string }>, ctx: EmitContext): string[] {
  const folders = new Map<string, Set<string>>();
  const initial = (name: string) => (name.match(/[A-Za-z0-9]/)?.[0] ?? "").toUpperCase();
  for (const p of placed) {
    const dir = p.path.slice(0, p.path.lastIndexOf("/"));
    const letters = folders.get(dir) ?? new Set<string>();
    letters.add(initial(p.path.slice(dir.length + 1)));
    folders.set(dir, letters);
  }
  // Notes the vault already keeps in those folders are listed with the book's.
  for (const path of ctx.existing ?? []) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    for (const [folder, letters] of folders)
      if (folder.toLowerCase() === dir) letters.add(initial(path.slice(dir.length + 1)));
  }
  const order = (dir: string) => {
    const name = dir.slice(dir.lastIndexOf("/") + 1);
    return (parseInt(name, 10) || 0) * 2 + (/ritual/.test(name) ? 1 : 0);
  };
  const dirs = [...folders.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  const out: string[] = [];
  dirs.forEach((dir, i) => {
    const view = /\/spells\//.test(dir) && ctx.options.views?.includes("spell") ? "spell" : "h4";
    const body: string[] = [];
    for (const letter of [...(folders.get(dir) ?? [])].filter(Boolean).sort()) {
      body.push(`## ${letter}`, `\`@[[${dir}/]].shallow().filter(${letter} prefix name).${view}()\``);
    }
    if (dirs.length === 1) out.push(...body);
    else {
      // `1st-circle-ritual` → `1st Circle Ritual`.
      const name = dir
        .slice(dir.lastIndexOf("/") + 1)
        .replace(/-/g, " ")
        .replace(/(^|\s)([a-z])/g, (_m, lead: string, c: string) => lead + c.toUpperCase());
      const look = ctx.look(name, i);
      out.push("```rpg rule.tab", `name: ${name}`, `icon: ${look.icon}`, `color: ${look.color}`, "---", ...body, "```");
    }
  });
  return out;
}

/** A section as headings and text, its subsections under deeper headings. */
function renderInline(section: Section, depth: number, ctx: EmitContext, where: Where): string[] {
  const head = `${hashes(depth)} ${escapeMd(section.title)}`;
  const entity = entityFor(section, depth, ctx, where);
  const inner: Where = { path: where.path, trail: [...where.trail, section.title], inside: where.inside };
  const out = entity ? [head, ...entity.lines] : [head, ...renderBlocks(section.blocks, ctx, section.title, inner)];
  if (!entity?.consumed) for (const child of section.children) out.push(...renderInline(child, depth + 1, ctx, inner));
  return out;
}

/** Sections as a row of tabs; a big section's own parts become tabs inside its tab. */
function renderTabs(sections: Section[], depth: number, ctx: EmitContext, nest: boolean, where: Where): string[] {
  const out: string[] = [];
  sections.forEach((section, i) => {
    const look = ctx.look(section.title, i);
    const nested = nest && section.children.length >= 3 && section.children.length <= 12 && sizeOf(section) > 150;
    const body = nested
      ? [
          `${hashes(depth)} ${escapeMd(section.title)}`,
          ...renderBlocks(section.blocks, ctx, section.title, {
            path: where.path,
            trail: [...where.trail, section.title],
          }),
          ...renderTabs(section.children, depth + 1, ctx, false, {
            path: where.path,
            trail: [...where.trail, section.title],
          }),
        ]
      : renderInline(section, depth, ctx, where);
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
  const seen = new Set<string>();
  for (const [k, v] of fields) {
    if (v === undefined || v === "" || seen.has(k)) continue;
    seen.add(k);
    out.push(v.startsWith("\n") ? `${k}:${v}` : `${k}: ${v}`);
  }
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
  /** Titles of the sections this one sits under. */
  trail: string[];
  /** What the section is already known to be. */
  hint?: EntityKind;
  /** The path is from the vault's root: an entity's note kept outside the book's folder. */
  outside?: boolean;
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
  const where: Where = { path, trail: [...spec.trail, section.title], outside: spec.outside };
  const push = (text: string) => pushFile(ctx, { path: `${path}.md`, text, outside: spec.outside });
  const entity = entityFor(section, 1, ctx, { path, trail: spec.trail, outside: spec.outside }, spec.hint);
  const lines = [
    ...frontmatter([...spec.fields, ...(entity?.fields ?? [])]),
    `# ${escapeMd(title)}`,
    ...(entity ? entity.lines : renderBlocks(section.blocks, ctx, section.title, where)),
  ];
  if (entity?.consumed) {
    push(lines.join("\n") + "\n");
    return;
  }

  if (!split) {
    if (kids.length >= 2 && kids.length <= 12 && size > 60) lines.push(...renderTabs(kids, 2, ctx, true, where));
    else for (const child of kids) lines.push(...renderInline(child, 2, ctx, where));
  } else {
    const names: string[] = [];
    const placed: Array<{ path: string; title: string }> = [];
    kids.forEach((child, i) => {
      // An entity that is kept in a folder of its own needs no note here: the list below links to it.
      if (ctx.place) {
        const kept = entityFor(child, 1, ctx, { path, trail: where.trail });
        if (kept?.placed) {
          placed.push({ path: kept.placed, title: child.title });
          return;
        }
      }
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
          trail: where.trail,
        },
        ctx
      );
    });
    const call = `@[[${ctx.book}/${path}/]].shallow()`;
    if (placed.length) {
      if (names.length) lines.push(`\`${call}.tab()\``);
      lines.push(...listPlaced(placed, ctx));
    } else if (!catalog || kids.length <= 14) lines.push(`\`${call}.tab()\``);
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
  push(lines.join("\n") + "\n");
}

export function chapterName(chapter: Chapter): string {
  const base = fileName(chapter.title);
  return chapter.number ? `${chapter.number}. ${base}` : base;
}

export function emitBook(chapters: Chapter[], ctx: EmitContext, facts: string[]): OutFile[] {
  // The book's price lists are read first: a mount's stat block may come chapters after its price.
  if (ctx.kinds) {
    ctx.prices = new Map();
    for (const chapter of chapters)
      walkBlocks(chapter.root, (block) => {
        if (block.type === "table") for (const [k, v] of priceList(block)) ctx.prices?.set(k, v);
      });
  }
  const index = [...frontmatter([["source", ctx.source]]), `# ${ctx.options.title}`, ""];
  for (const chapter of chapters) {
    const name = uniqueName("", chapterName(chapter), ctx);
    ctx.chapterIntro = [
      chapter.title,
      ...chapter.root.blocks
        .slice(0, 4)
        .map((b) => (b.type === "para" ? b.spans.map((sp) => sp.text).join("") : ""))
        .filter(Boolean),
    ]
      .join(" ")
      .slice(0, 900);
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
        trail: [],
      },
      ctx
    );
    index.push(`- [[${name}]] (p. ${chapter.firstPage}–${chapter.lastPage})`);
  }
  for (const [path, note] of ctx.traitNotes ?? [])
    pushFile(ctx, { outside: true, path: `${path}.md`, text: note.lines.join("\n") + "\n" });
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
