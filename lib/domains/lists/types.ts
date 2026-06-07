/**
 * Types for `rpg list.*` — newspaper-flow reference lists.
 *
 * A list block declares a heading `name` and a set of `entries`, each of
 * which is a reference call (`@[[/folder/]].fn()` / `@[[file]].fn(id)`)
 * plus a `format` template printed once per resolved record. Consecutive
 * list blocks merge into one flowing, paginated multi-column view.
 */

/** Column behaviour for the flowing layout. `auto` = content-driven up to 3. */
export type ListColumns = "auto" | 1 | 2 | 3;

/**
 * One entry, as authored in YAML. Either a reference call (`call` + `format`)
 * that pulls data from files, or a literal `text` line of fixed markdown. A
 * bare string in the `entries` array is shorthand for `{ text }`. The two
 * kinds can be mixed freely in one list.
 */
export interface ListEntry {
  /** Reference call, e.g. `@[[/spells/cantrips/]].spell()`. Omit for a literal line. */
  call?: string;
  /**
   * Line template for a call entry: `${field}` interpolation against the
   * resolved record's fields, plus inline markdown and `[[wikilinks]]`. One
   * line is emitted per resolved record.
   */
  format?: string;
  /**
   * Multi-cell `format` for a call entry — `format: ["[[${name}]]", "${cr}"]`.
   * Each element is a cell template, interpolated per record into one cell of a
   * two-(or N-)cell row. The call's `${field}` interpolation works the same as
   * `format`; this just splits the output across cells. Mutually exclusive with
   * the single-string `format`.
   */
  formatCells?: string[];
  /** A fixed markdown line, used as-is (no resolution). Mixes with call entries. */
  text?: string;
  /**
   * Explicit multi-cell row — `- [A, B]` in YAML. Each element is a literal
   * markdown item rendered as one cell, side-by-side on a single row. Literal
   * only (call output is one line per record and isn't packed into cells).
   */
  items?: string[];
}

/** A parsed `rpg list.<name>` block (one fence). */
export interface ListBlock {
  /** Heading-bar text. */
  name: string;
  /**
   * Two-label heading bar (`name: [A, B]`): the cells, left → right. When set,
   * the bar renders A left / B right (justified). `name` holds the joined form
   * for pills, keys, and fallback rendering.
   */
  titleCells?: string[];
  /** Optional italic subtitle under the bar. */
  subtitle?: string;
  /** Stable id (defaults to the `<name>` after the dot in the fence meta). */
  id: string;
  /** Column behaviour; defaults to "auto" (responsive 2→3). */
  columns: ListColumns;
  /** When true, the merged content is split into viewport-height pages
   *  (auto-fit by measurement) with a pill bar + prev/next controls.
   *  Enabled by `paginate: true` / `paginate: auto` in YAML. */
  paginate?: boolean;
  /** Entry specs. */
  entries: ListEntry[];
}

/**
 * A record resolved from one entry call — one per enumerated file (folder
 * target), one for a single-file target, or one per imported entry
 * (`.list(id)` composition).
 */
export interface ResolvedRecord {
  /** Fields available to `${...}` interpolation (block / file frontmatter,
   *  plus the injected `name`, `basename`, `path`). */
  fields: Record<string, unknown>;
  /** Display name (`fields.name` ?? file basename). */
  name: string;
  /** Source file path (for wikilink resolution / de-duplication). */
  file: string;
}

/** Highlight treatment for a line (from a `.highlight(label?, color?)` chain). */
export interface ListHighlight {
  label?: string;
  color?: string;
}

/** A single rendered line in the flat, mergeable sequence. */
export interface ListLine {
  /** The id of the list this line belongs to. */
  listId: string;
  /** Markdown for the line (already format-interpolated). */
  markdown: string;
  /** Source file path, for keying / de-duplication. */
  file: string;
  /** Set when the entry's call carried `.highlight()` — badges the line. */
  highlight?: ListHighlight;
  /** When set, the line is a multi-cell row (from an `items` entry): each
   *  string renders as one cell, side-by-side. `markdown` is unused then. */
  cells?: string[];
}

/** A list block paired with its resolved entry lines (what the view renders). */
export interface ResolvedList {
  block: ListBlock;
  lines: ListLine[];
}
