/**
 * What an import could not settle on its own, for a person (or a model) to look at: tables whose
 * numbers do not make a whole roll, pieces of tables left apart, rows the repair widened, text that
 * reads like a table, headings of the book's contents not found, pages read by OCR. Each item says
 * where it is (the note, the table, the page of the book) and what to check.
 */

import { rollRange } from "./blocks";
import { parseReviewLine, type BlockReview } from "../review/block-review";
import { captionParts } from "./structure";
import type { Block, OutFile, Span } from "./types";

export type ReviewSeverity = "fix" | "check" | "note";

export interface ReviewItem {
  /** What sort of thing it is; the same kind always means the same check. */
  kind: ReviewKind;
  /** `fix`: something is wrong as written. `check`: may be wrong; compare with the book. `note`: for the record. */
  severity: ReviewSeverity;
  /** The note it is in, from the vault's root, without `.md`. */
  note?: string;
  /** The `rpg table` block's id, for a table. */
  table?: string;
  /** The kind of `rpg` block it is in (`stat.monster`, `rule.side`), for another block. */
  block?: string;
  /** The page of the PDF (1-based) it starts on. */
  page?: number;
  message: string;
}

export type ReviewKind =
  | "table-numbers"
  | "table-fragment"
  | "table-column"
  | "row-widened"
  | "rows-joined"
  | "text-like-table"
  | "row-as-heading"
  | "contents-missing"
  | "ocr-page"
  | "chapters"
  | "entity-incomplete"
  | "kept";

/** One line on each kind, for the review note and for a model reading the JSON. */
export const REVIEW_KINDS: Record<ReviewKind, string> = {
  "table-numbers":
    "A table rolled on a die whose numbers skip or stop short: it cannot be rolled as written. Its missing rows may be in the text near it or on the next page, or the book itself skips them.",
  "table-fragment":
    "A few numbered rows without a caption of their own, not starting at 1: most likely a piece of the table before or after it.",
  "table-column":
    "A column that is empty in nearly every row: usually a cell of another column, or a number, that slipped sideways.",
  "row-widened":
    "A row widened over a number found nowhere, so every roll lands on a row. Right when the book skips the number; wrong when the importer lost the row.",
  "rows-joined": "Rows put back into a table from elsewhere in the chapter. Usually right; look once at the order.",
  "text-like-table": "Text whose lines open with numbers that count up: perhaps a table read as text.",
  "row-as-heading": "A heading that opens with a number: perhaps a table's row read as a heading.",
  "contents-missing":
    "An entry of the book's table of contents with no heading or caption of that name: a heading set as a picture, split or joined differently, or lost.",
  "ocr-page": "A page read by OCR: words and numbers may be wrong.",
  chapters: "How the book was cut into chapters.",
  "entity-incomplete":
    "A game entity (a creature, a spell) written with facts that could not be read: filled with a placeholder.",
  kept: "An entity note the vault already had, left as it was; the book links to it.",
};

const SEVERITY_ORDER: Record<ReviewSeverity, number> = { fix: 0, check: 1, note: 2 };

const DICE = [2, 3, 4, 6, 8, 10, 12, 20, 30, 100, 1000];

/** `1, 2, 3, 5, 8, 9` → `1–3, 5, 8–9`. */
export function ranges(numbers: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < numbers.length; i++) {
    let j = i;
    while (j + 1 < numbers.length && numbers[j + 1] === numbers[j] + 1) j++;
    out.push(i === j ? `${numbers[i]}` : `${numbers[i]}–${numbers[j]}`);
    i = j;
  }
  return out.join(", ");
}

/** What is wrong with a table's numbers, or null when it can be rolled as it is (or is not rolled at all). */
function numberTrouble(rows: string[][]): { missing: number[]; die: number; doubled: number[] } | null {
  // (A piece of a table may open with a row, not a header.)
  const body = rollRange(rows[0]?.[0]) ? rows : rows.slice(1);
  const ranges = body.map((r) => rollRange(r[0]));
  if (body.length < 2 || ranges.filter(Boolean).length < 0.6 * body.length) return null;
  const head = rows[0].join(" ");
  const named = head.match(/\b1?d(\d{1,4}|%)\*?(?=\s|$|\))/i);
  const top = Math.max(...ranges.map((r) => r?.[1] ?? 0));
  const namedDie = named ? (named[1] === "%" ? 100 : Number(named[1])) : 0;
  const die = DICE.includes(namedDie) && namedDie >= top ? namedDie : (DICE.find((d) => d >= top) ?? top);
  const seen = new Map<number, number>();
  for (const r of ranges) if (r) for (let n = r[0]; n <= r[1]; n++) seen.set(n, (seen.get(n) ?? 0) + 1);
  const missing: number[] = [];
  const doubled: number[] = [];
  for (let n = 1; n <= die; n++) {
    if (!seen.has(n)) missing.push(n);
    else if ((seen.get(n) ?? 0) > 1) doubled.push(n);
  }
  return missing.length || doubled.length ? { missing, die, doubled } : null;
}

/**
 * The die a table is rolled on when its first column is mostly roll numbers, gaps or not (`0` when
 * it is not such a table): the one its header names, else the smallest its numbers fit.
 */
export function dieOfNumbered(rows: string[][]): number {
  const body = rollRange(rows[0]?.[0]) ? rows : rows.slice(1);
  const found = body.map((r) => rollRange(r[0]));
  if (body.length < 2 || found.filter(Boolean).length < 0.6 * body.length) return 0;
  return numberTrouble(rows)?.die ?? DICE.find((d) => d >= Math.max(...found.map((r) => r?.[1] ?? 0))) ?? 0;
}

/**
 * What is wrong with a table as the import writes it, as review lines for the block: numbers that
 * skip or stop short (rolling is off until they are mended), a piece of another table, a column
 * nearly empty. `page` is the PDF's page the table starts on.
 */
export function tableReviews(rows: string[][], page: number, caption?: string): BlockReview[] {
  const out: BlockReview[] = [];
  const at = `(the book's PDF page ${page})`;
  const body = rollRange(rows[0]?.[0]) ? rows : rows.slice(1);
  const numbered = body.filter((r) => rollRange(r[0]));
  const first = numbered.length ? (rollRange(numbered[0][0]) as [number, number])[0] : 0;
  const trouble = numberTrouble(rows);
  if (!captionParts(caption ?? "") && numbered.length && numbered.length <= 4 && first > 1) {
    out.push({
      severity: "fix",
      kind: "table-fragment",
      off: [],
      message: `Only rows ${ranges(numbered.map((r) => (rollRange(r[0]) as [number, number])[0]))} ${at}, with no caption: most likely a piece of the table before or after it, to join to it.`,
    });
  } else if (trouble) {
    const parts: string[] = [];
    if (trouble.missing.length) parts.push(`no row for ${ranges(trouble.missing)} of the d${trouble.die}`);
    if (trouble.doubled.length) parts.push(`${ranges(trouble.doubled)} in two rows`);
    out.push({
      severity: "fix",
      kind: "table-numbers",
      off: ["roll"],
      message: `The table has ${parts.join(" and ")} ${at}. The missing rows may be in the text or the table near it, or on the next page; if the book itself skips a number, widen the row before it. Delete this line when the numbers are whole.`,
    });
  }
  // A column empty in nearly every row (a stray cell pushed sideways).
  const width = Math.max(...rows.map((r) => r.length));
  if (rows.length >= 4)
    for (let c = 1; c < width; c++) {
      const filled = rows.slice(1).filter((r) => (r[c] ?? "").trim()).length;
      if (filled > 0 && filled <= Math.max(1, 0.1 * (rows.length - 1)))
        out.push({
          severity: "check",
          kind: "table-column",
          off: [],
          message: `Column ${c + 1} (“${rows[0][c] || "no header"}”) is filled in only ${filled} of ${rows.length - 1} rows ${at}: a cell that slipped sideways?`,
        });
    }
  return out;
}

const plain = (spans: Span[]) => spans.map((s) => s.text).join("");

/** Text of a chapter that may be a table read as text, or a row read as a heading, found before the notes are written. */
export function reviewBlocks(blocks: Block[], chapter: string): ReviewItem[] {
  const out: ReviewItem[] = [];
  const lead = (text: string) => rollRange(text.replace(/\*/g, "").trim().split(/\s+/)[0]);
  const runs: Array<{ page: number; count: number; sample: string; side?: Extract<Block, { type: "side" }> }> = [];
  const look = (list: Block[], side?: Extract<Block, { type: "side" }>) => {
    let run: { page: number; count: number; sample: string; next: number; side?: typeof side } | null = null;
    for (const b of list) {
      const text = b.type === "para" ? plain(b.spans) : b.type === "list" ? "" : "";
      const r = text ? lead(text) : null;
      if (r && (!run || r[0] > run.next - 1)) {
        if (!run) run = { page: b.page, count: 0, sample: text.slice(0, 60), next: r[1] + 1, side };
        run.count++;
        run.next = r[1] + 1;
        continue;
      }
      if (run && run.count >= 3) runs.push(run);
      run = null;
      if (b.type === "side") look(b.blocks, b);
    }
    if (run && run.count >= 3) runs.push(run);
  };
  look(blocks);
  for (const run of runs) {
    // Inside a sidebar: the review goes into the sidebar's block.
    if (run.side) {
      (run.side.reviews ??= []).push({
        severity: "check",
        kind: "text-like-table",
        off: [],
        message: `${run.count} lines in a row open with numbers that count up, from “${run.sample}…” (the book's PDF page ${run.page}): perhaps a table read as text.`,
      });
      continue;
    }
    out.push({
      kind: "text-like-table",
      severity: "check",
      page: run.page,
      message: `In “${chapter}”, ${run.count} lines in a row open with numbers that count up, from “${run.sample}…”.`,
    });
  }
  for (const b of blocks) {
    if (b.type !== "heading" || b.caption) continue;
    if (/^\d{1,3}(\s*[-–]\s*\d{1,3})?\s+\S/.test(b.text) && b.text.length <= 60 && !captionParts(b.text))
      out.push({
        kind: "row-as-heading",
        severity: "check",
        page: b.page,
        message: `In “${chapter}”, the heading “${b.text}” opens with a number.`,
      });
  }
  return out;
}

export interface ReviewInput {
  files: OutFile[];
  /** The book's folder, from the vault's root. */
  root: string;
  /** The page each written table starts on, by its id. */
  tablePages: Map<string, number>;
  /** Found in the chapters' text before writing (see `reviewBlocks`). */
  textItems: ReviewItem[];
  contentsMissing: Array<{ title: string; page: number }>;
  ocrPages: number[];
  kept: string[];
  chapters: { count: number; from: "bookmarks" | "headings" | "one"; pages: number };
}

/** Every item that needs a person's judgement, worst first, each with the note and the page it is on. */
export function buildReview(input: ReviewInput): ReviewItem[] {
  const items: ReviewItem[] = [];
  // The reviews written into the blocks themselves: each block's review lines, under its fence.
  for (const file of input.files) {
    if (!file.path.endsWith(".md")) continue;
    const note = (file.outside ? file.path : `${input.root}/${file.path}`).replace(/\.md$/, "");
    const lines = file.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const fence = lines[i].match(/^`{3,}rpg\s+(\S+)/);
      if (!fence) continue;
      const table = fence[1].startsWith("table.") ? fence[1].slice("table.".length) : undefined;
      for (let k = i + 1; k < lines.length; k++) {
        const review = parseReviewLine(lines[k]);
        if (!review) break;
        items.push({
          kind: (review.kind as ReviewKind) ?? "table-numbers",
          severity: review.severity,
          note,
          ...(table ? { table } : { block: fence[1] }),
          page: table ? input.tablePages.get(table) : undefined,
          message: review.message,
        });
      }
    }
  }

  // Text items carry a page; their note is the one that holds the text they quote.
  for (const item of input.textItems) {
    const quote = item.message
      .match(/“([^”]{12,})/)?.[1]
      ?.replace(/…$/, "")
      .slice(0, 40);
    const file = quote ? input.files.find((f) => f.text.includes(quote)) : undefined;
    items.push(
      file ? { ...item, note: (file.outside ? file.path : `${input.root}/${file.path}`).replace(/\.md$/, "") } : item
    );
  }

  for (const entry of input.contentsMissing)
    items.push({
      kind: "contents-missing",
      severity: "check",
      message: `“${entry.title}” (the book's page ${entry.page}) is in the table of contents but not found as a heading or a caption.`,
    });
  if (input.ocrPages.length)
    items.push({
      kind: "ocr-page",
      severity: "check",
      page: input.ocrPages[0],
      message: `${input.ocrPages.length} pages were read by OCR: ${ranges(input.ocrPages)}.`,
    });
  if (input.chapters.from !== "bookmarks")
    items.push({
      kind: "chapters",
      severity: input.chapters.from === "one" && input.chapters.pages > 40 ? "fix" : "check",
      message:
        input.chapters.from === "one"
          ? `The file has no bookmarks and no headings big enough to cut it by: all ${input.chapters.pages} pages are one chapter.`
          : `The file has no usable bookmarks: its ${input.chapters.count} chapters were cut at its biggest headings.`,
    });
  for (const path of input.kept)
    items.push({
      kind: "kept",
      severity: "note",
      note: path.replace(/\.md$/, ""),
      message: "Already in the vault; left as it was.",
    });

  return items.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.page ?? 1e9) - (b.page ?? 1e9)
  );
}

/** How many items of each severity and kind. */
export function reviewCounts(items: ReviewItem[]): {
  fix: number;
  check: number;
  note: number;
  kinds: Record<string, number>;
} {
  const counts = { fix: 0, check: 0, note: 0, kinds: {} as Record<string, number> };
  for (const item of items) {
    counts[item.severity]++;
    counts.kinds[item.kind] = (counts.kinds[item.kind] ?? 0) + 1;
  }
  return counts;
}

/** The review as a note of the book: a checklist by kind, each item linked to its note. */
export function renderReview(items: ReviewItem[], title: string, source: string): string {
  const counts = reviewCounts(items);
  const lines = [
    "---",
    `source: ${JSON.stringify(source)}`,
    "cssclasses:",
    "  - note-compendium",
    "---",
    `# Import review: ${title}`,
    "",
    items.length
      ? `What the import could not settle on its own: **${counts.fix}** to fix, **${counts.check}** to check against the book, ${counts.note} for the record. Tick an item once it is dealt with.`
      : "The import found nothing that needs a person's judgement.",
  ];
  const kinds = [...new Set(items.map((i) => i.kind))];
  for (const kind of kinds) {
    const mine = items.filter((i) => i.kind === kind);
    lines.push("", `## ${kindTitle(kind)} (${mine.length})`, "", `*${REVIEW_KINDS[kind]}*`, "");
    for (const item of mine.slice(0, 300)) {
      const where = [
        item.note ? `[[${item.note}${item.table ? "" : ""}|${item.note.slice(item.note.lastIndexOf("/") + 1)}]]` : "",
        item.page ? `p. ${item.page}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push(`- [ ] ${where ? `${where}: ` : ""}${item.message}`);
    }
    if (mine.length > 300) lines.push(`- …and ${mine.length - 300} more.`);
  }
  return lines.join("\n") + "\n";
}

function kindTitle(kind: ReviewKind): string {
  return {
    "table-numbers": "Tables that cannot be rolled",
    "table-fragment": "Pieces of tables",
    "table-column": "Columns nearly empty",
    "row-widened": "Rows widened over a skipped number",
    "rows-joined": "Rows put back",
    "text-like-table": "Text that reads like a table",
    "row-as-heading": "Headings that open with a number",
    "contents-missing": "Contents entries not found",
    "ocr-page": "Pages read by OCR",
    chapters: "Chapters",
    "entity-incomplete": "Entities with facts missing",
    kept: "Notes left as they were",
  }[kind];
}
