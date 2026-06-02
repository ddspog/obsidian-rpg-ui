/**
 * Vertical cell merging for `rpg table.*` blocks — the `^` marker.
 *
 * A body cell whose entire content is a caret marker merges into the cell
 * directly above it (same grid column), the vertical mirror of the `||`
 * colspan convention. Stacking markers extend the span row by row:
 *
 *   | LEVEL | PB | FEATURES        |
 *   | 1st   | +2 | Last Stand      |   ← anchor: "+2"
 *   | 2nd   | ^  | Action Surge    |   ┐
 *   | 3rd   | ^  | Fighter Subclass|   ┘ "+2" spans rows 1st–3rd (rowspan 3)
 *   | 4th   | +3 | Improvement     |   ← new anchor breaks the span
 *
 * Marker glyphs also pick the span's vertical alignment:
 *   ^   merge up, inherit the default (centred)
 *   ^^  merge up, align the value to the TOP of the span
 *   ^v  merge up, align the value to the BOTTOM of the span
 *   ^-  merge up, align the value to the CENTRE (explicit)
 *
 * Because pagination slices rows at render time, spans are resolved over the
 * VISIBLE window rather than at parse time: a marker that lands at the top of
 * a page (its anchor sitting on the previous page) re-anchors by carrying the
 * anchor's value down so the value still reads on that page.
 *
 * The resolver is renderer-agnostic — both the plain-DOM renderer
 * (`render-table-block.ts`) and the React renderer (`components/rpg-table.tsx`)
 * consume the same `RenderRow[]` so their output can't drift apart.
 */

import type { TableRow, VAlign } from "./types";

/**
 * Recognise a vertical-merge marker. Returns the explicit alignment the glyph
 * carries (`^^`/`^v`/`^-`), an empty object for the bare caret (inherit the
 * default), or null when the value isn't a merge marker at all. A cell with
 * any other content — including a caret followed by text — is not a marker.
 */
export function parseMergeMarker(value: string): { align?: VAlign } | null {
  switch (value.trim()) {
    case "^":
      return {};
    case "^^":
      return { align: "top" };
    case "^v":
    case "^V":
      return { align: "bottom" };
    case "^-":
      return { align: "middle" };
    default:
      return null;
  }
}

/**
 * Detect a category-divider row — a single-cell row whose colspan fills every
 * column. Authors write these the tx way (`| Light Armor ||||||`) to split a
 * long table into visually-grouped sections. A merge marker is never a
 * category (its value is blanked during parsing).
 */
export function isCategoryRow(row: TableRow, columnCount: number): boolean {
  if (row.cells.length !== 1) return false;
  const cell = row.cells[0];
  const span = cell.colspan ?? 1;
  return span >= columnCount && cell.value.trim().length > 0;
}

/** Strip the legacy `#css/row/...` annotation suffix from a category label. */
export function cleanCategoryLabel(raw: string): string {
  return raw.replace(/\s*#css\/row\/[^\s|]+\s*$/, "").trim();
}

/** A cell ready to render: merge markers are gone, spans are resolved. */
export interface RenderCell {
  value: string;
  colspan?: number;
  /** >1 when this cell spans down over the rows below it. */
  rowspan?: number;
  /** Nesting depth from a leading `> ` in the source. */
  indent?: number;
  /** Vertical alignment — only set when `rowspan` > 1. */
  valign?: VAlign;
  /**
   * True when `value` was carried down from an anchor on a previous page to
   * re-show a merge group orphaned at the top of the current page.
   */
  carried?: boolean;
}

/** A row ready to render. Category rows expose their cleaned label instead. */
export interface RenderRow {
  cells: RenderCell[];
  category?: boolean;
  categoryLabel?: string;
}

/** Half-open `[start, end)` window of body rows to render (for pagination). */
export interface RowRange {
  start: number;
  end: number;
}

/** Live span state for one grid column while walking rows top-to-bottom. */
interface Anchor {
  /** The anchor's display value (carried down when orphaned across a page). */
  value: string;
  /** The anchor's column width, so a carried-down orphan keeps its colspan. */
  colspan: number;
  /** Resolved vertical alignment (defaults to centre until a glyph overrides). */
  align: VAlign;
  /** Whether a glyph has already fixed the alignment (top-most glyph wins). */
  explicit: boolean;
  /**
   * The emitted cell whose rowspan grows as markers stack below it, or null
   * when the anchor sits above the visible window (its markers re-anchor via
   * carry-down instead).
   */
  cell: RenderCell | null;
}

/**
 * Resolve `^` merge markers into concrete `rowspan`s over a window of rows.
 *
 * Walks every row from the top of the table (not just the window) so spans
 * that begin before `range.start` are accounted for, but emits `RenderRow`s
 * only for rows inside `[range.start, range.end)`. Category rows reset all
 * active spans — a data cell can't merge into a section band.
 */
export function resolveRenderRows(
  allRows: TableRow[],
  columnCount: number,
  range?: RowRange
): RenderRow[] {
  const start = range?.start ?? 0;
  const end = range?.end ?? allRows.length;

  // Indexed by grid column. Sparse/undefined entries read as "no active span".
  let colAnchor: Array<Anchor | null | undefined> = [];
  const out: RenderRow[] = [];

  for (let r = 0; r < end; r++) {
    const row = allRows[r];
    if (!row) continue;
    const visible = r >= start;

    // A category divider breaks every active vertical span.
    if (isCategoryRow(row, columnCount)) {
      colAnchor = [];
      if (visible) {
        out.push({
          cells: [],
          category: true,
          categoryLabel: cleanCategoryLabel(row.cells[0].value),
        });
      }
      continue;
    }

    const renderCells: RenderCell[] = [];
    // An anchor spanning several columns (a colspanned cell) may be referenced
    // by more than one marker in the same row — only extend its rowspan once.
    const extended = new Set<Anchor>();
    let colPos = 0;

    for (const cell of row.cells) {
      const span = cell.colspan && cell.colspan > 1 ? cell.colspan : 1;

      if (cell.mergeUp) {
        const anchor = colAnchor[colPos];

        if (anchor) {
          // Top-most glyph carrying an alignment fixes the span's alignment.
          if (cell.mergeAlign && !anchor.explicit) {
            anchor.align = cell.mergeAlign;
            anchor.explicit = true;
            if (anchor.cell) anchor.cell.valign = anchor.align;
          }

          const first = !extended.has(anchor);
          if (first) extended.add(anchor);

          if (anchor.cell) {
            // Anchor is rendered in this window → extend its rowspan (once).
            if (visible && first) {
              anchor.cell.rowspan = (anchor.cell.rowspan ?? 1) + 1;
              if (!anchor.cell.valign) anchor.cell.valign = anchor.align;
            }
            // (r < start: marker sits above the window — nothing to emit.)
          } else if (visible && first) {
            // Orphan: the anchor is on a previous page. Carry its value down
            // so the value still reads here, and make this the new anchor —
            // preserving the anchor's own colspan, not the marker's.
            const promoted: RenderCell = {
              value: anchor.value,
              rowspan: 1,
              valign: anchor.align,
              carried: true,
            };
            if (anchor.colspan > 1) promoted.colspan = anchor.colspan;
            renderCells.push(promoted);
            anchor.cell = promoted;
          }

          // Keep the span active across this marker's columns.
          for (let i = 0; i < span; i++) colAnchor[colPos + i] = anchor;
        } else {
          // No span above (table top, or right after a category row). Treat
          // the marker as an empty cell so the grid stays aligned, and let it
          // seed a fresh (empty) anchor.
          const empty: RenderCell = { value: "" };
          if (span > 1) empty.colspan = span;
          const seeded: Anchor = {
            value: "",
            colspan: span,
            align: cell.mergeAlign ?? "middle",
            explicit: !!cell.mergeAlign,
            cell: visible ? empty : null,
          };
          if (visible) renderCells.push(empty);
          for (let i = 0; i < span; i++) colAnchor[colPos + i] = seeded;
        }
      } else {
        // Normal cell → becomes the fresh anchor for its column range.
        const rc: RenderCell = { value: cell.value };
        if (span > 1) rc.colspan = span;
        if (cell.indent) rc.indent = cell.indent;
        if (visible) renderCells.push(rc);
        const fresh: Anchor = {
          value: cell.value,
          colspan: span,
          align: "middle",
          explicit: false,
          cell: visible ? rc : null,
        };
        for (let i = 0; i < span; i++) colAnchor[colPos + i] = fresh;
      }

      colPos += span;
    }

    if (visible) out.push({ cells: renderCells });
  }

  return out;
}
