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
  /** A fixed markdown line, used as-is (no resolution). Mixes with call entries. */
  text?: string;
}

/** A parsed `rpg list.<name>` block (one fence). */
export interface ListBlock {
  /** Heading-bar text. */
  name: string;
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
}

/** A list block paired with its resolved entry lines (what the view renders). */
export interface ResolvedList {
  block: ListBlock;
  lines: ListLine[];
}
