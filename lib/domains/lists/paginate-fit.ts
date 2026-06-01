/**
 * Pure pagination/layout helpers for `rpg list.*` — no React, no Obsidian, so
 * the bin-packing that decides page breaks is unit-testable in isolation.
 *
 * The view measures each row's rendered height and calls {@link packRows} to
 * split rows into viewport-height pages, mirroring how `column-fill: auto` +
 * `break-inside: avoid` lay content out across N columns of height H.
 */

import type { ListBlock, ListHighlight, ResolvedList } from "./types";

export type HeadingRow = {
  kind: "heading";
  listId: string;
  name: string;
  subtitle?: string;
  cont?: boolean;
};
export type EntryRow = {
  kind: "entry";
  listId: string;
  markdown: string;
  key: string;
  highlight?: ListHighlight;
};
export type Row = HeadingRow | EntryRow;

export interface Section {
  listId: string;
  name: string;
  subtitle?: string;
  cont?: boolean;
  lines: EntryRow[];
}

/** Flatten resolved lists into the row sequence (one heading per list, then
 *  its entry lines), preserving block order. */
export function buildRows(lists: ResolvedList[]): Row[] {
  const rows: Row[] = [];
  for (const { block, lines } of lists) {
    rows.push({ kind: "heading", listId: block.id, name: block.name, subtitle: block.subtitle });
    lines.forEach((l, i) =>
      // Key by list id + index: stable and unique even for literal lines
      // (which have no file path).
      rows.push({
        kind: "entry",
        listId: block.id,
        markdown: l.markdown,
        key: `${block.id}:${i}`,
        highlight: l.highlight,
      })
    );
  }
  return rows;
}

/**
 * Choose a column count and split rows into pages, from measured row heights.
 *
 * Column count is content-driven: prefer `maxCols`, but drop to fewer columns
 * when balancing across `maxCols` would make each column shorter than
 * `minColHeight` (so a short list collapses 3→2→1 instead of leaving empty
 * columns). Columns are then balanced (equal height) by CSS, not filled
 * sequentially.
 *
 * Pagination only happens when `paginate` is on AND the content can't fit in
 * `maxCols` columns of `maxHeight` — then pages are filled to `maxCols ×
 * maxHeight` worth of rows (headings kept with their first entry).
 */
export interface LayoutOpts {
  /** Per-column height cap (the viewport-height box), in px. */
  maxHeight: number;
  /** Maximum columns (from the block's `columns:` setting). */
  maxCols: number;
  /** Minimum balanced column height before dropping a column, in px. */
  minColHeight: number;
  /** Whether the block opted into pagination. */
  paginate: boolean;
}

export interface Layout {
  /** Chosen column count (1..maxCols). */
  cols: number;
  /** Rows split into pages (one page unless paginating overflow). */
  pages: Row[][];
}

export function computeLayout(rows: Row[], consumed: number[], opts: LayoutOpts): Layout {
  const maxCols = Math.max(1, Math.floor(opts.maxCols));
  if (rows.length === 0) return { cols: 1, pages: [[]] };

  const total = consumed.reduce((sum, h) => sum + (h > 0 ? h : 0), 0);
  const minH = opts.minColHeight > 0 ? opts.minColHeight : 1;
  // Most columns whose balanced height stays >= minColHeight, capped at maxCols.
  const cols = Math.min(maxCols, Math.max(1, Math.floor(total / minH)));

  const H = opts.maxHeight;
  if (opts.paginate && H > 0 && total > maxCols * H) {
    const cap = maxCols * H;
    const pages: Row[][] = [];
    let page: Row[] = [];
    let h = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rh = consumed[i] ?? 0;
      const lookahead = row.kind === "heading" ? (consumed[i + 1] ?? 0) : 0;
      if (h > 0 && h + rh + lookahead > cap) {
        pages.push(page);
        page = [];
        h = 0;
      }
      page.push(row);
      h += rh;
    }
    if (page.length) pages.push(page);
    return { cols: maxCols, pages: pages.length ? pages : [[]] };
  }

  return { cols, pages: [rows] };
}

/** Prepend a "(cont.)" heading to any page that opens mid-list. */
export function withContinuations(pages: Row[][], byId: Map<string, ListBlock>): Row[][] {
  return pages.map((page) => {
    if (page.length === 0 || page[0].kind === "heading") return page;
    const lid = page[0].listId;
    const meta = byId.get(lid);
    if (!meta) return page;
    const cont: HeadingRow = {
      kind: "heading",
      listId: lid,
      name: meta.name,
      subtitle: meta.subtitle,
      cont: true,
    };
    return [cont, ...page];
  });
}

/** Group a page's rows into renderable sections (heading + its entry lines). */
export function groupIntoSections(rows: Row[]): Section[] {
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const row of rows) {
    if (row.kind === "heading") {
      cur = {
        listId: row.listId,
        name: row.name,
        subtitle: row.subtitle,
        cont: row.cont,
        lines: [],
      };
      sections.push(cur);
    } else {
      if (!cur) {
        cur = { listId: row.listId, name: "", lines: [] };
        sections.push(cur);
      }
      cur.lines.push(row);
    }
  }
  return sections;
}

/** First page index where each list's content appears (for pill → page jumps). */
export function firstPageByList(pages: Row[][]): Map<string, number> {
  const out = new Map<string, number>();
  pages.forEach((pg, pi) =>
    pg.forEach((row) => {
      if (!out.has(row.listId)) out.set(row.listId, pi);
    })
  );
  return out;
}

/** Cheap page-boundary equality, to avoid redundant state updates / loops. */
export function sameBoundaries(a: Row[][] | null, b: Row[][]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].length !== b[i].length) return false;
  return true;
}
