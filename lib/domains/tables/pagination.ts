/**
 * Pagination for `rpg table.*` blocks.
 *
 * The `@paginate <size> <controls>` directive (first non-pipe line in the
 * body) enables client-side pagination. Off-page rows are DOM-removed (not
 * display:none) per the Obsidian virtualization rule.
 *
 * Controls:
 *   - `prev-next` — Previous / Next buttons
 *   - `pages`     — numbered page buttons (1, 2, 3…)
 *   - `show-more` — single "Show more" button that appends the next page
 */

export type PaginationControls = "prev-next" | "pages" | "show-more";

export interface PaginationConfig {
  size: number;
  controls: PaginationControls;
}

export interface PaginationState {
  page: number;
  /** For show-more: how many pages worth of rows are visible. */
  visiblePages: number;
}

export function parsePaginateDirective(line: string): PaginationConfig | null {
  const m = line.trim().match(/^@paginate\s+(\d+)\s+(prev-next|pages|show-more)$/);
  if (!m) return null;
  const size = parseInt(m[1], 10);
  if (size <= 0) return null;
  return { size, controls: m[2] as PaginationControls };
}

export function sliceRows<T>(rows: T[], config: PaginationConfig, state: PaginationState): T[] {
  if (config.controls === "show-more") {
    return rows.slice(0, config.size * state.visiblePages);
  }
  const start = config.size * state.page;
  return rows.slice(start, start + config.size);
}

export function totalPages(rowCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(rowCount / pageSize));
}
