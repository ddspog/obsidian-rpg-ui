/**
 * Declarative RPG table — type definitions.
 *
 * A `rpg table.<name>` fence parses into a `TableDef`. Tables live inside
 * compendium docs (Cleric.md, Fighter.md, …) and are addressable from other
 * `rpg` blocks via `<source>:<name>` (e.g. `Cleric:progression`), with the
 * bare `<name>` form resolving within the same source doc.
 *
 * The table is a grid of `TableCell`s with optional `colspan` carried from
 * the tx-style `||` convention. Header rows (every row above the `---`
 * separator) are preserved as authored so multi-row headers round-trip.
 */

/** One cell of a table row. `colspan` = 1 is the default and is omitted. */
export interface TableCell {
  value: string;
  colspan?: number;
}

/** One row of the table body. */
export interface TableRow {
  cells: TableCell[];
}

/**
 * A single `rpg table.<name>` block.
 *
 * `columns` holds normalised column keys (lowercased, spaces → underscores)
 * used for programmatic lookup; `columnLabels` keeps the original header text
 * for rendering. `keyColumn` (optional) names the column whose values
 * uniquely identify a row — lookups like `row=3` resolve by matching that
 * column. `headerRows` holds every header row above the `---` separator so
 * a multi-row header (via `||` colspan) round-trips to `<thead>`.
 */
export interface TableDef {
  /** Local name inside the source doc (e.g. `progression`). */
  name: string;
  /** Parent compendium-doc name, set during aggregation (e.g. `Cleric`). */
  source?: string;
  /** Normalised column keys (lowercased, spaces/dashes → underscores). */
  columns: string[];
  /** Original column labels, in order. */
  columnLabels: string[];
  /** Body rows (not header). */
  rows: TableRow[];
  /** Every header row as authored — allows multi-row headers. */
  headerRows: TableRow[];
  /** Which column keys a row by value. Omitted ⇒ row-index lookup only. */
  keyColumn?: string;
  /** Caption from the trailing `[CAPTION #css/...]` footer. */
  caption?: string;
  /** Classes from the footer (strings after `#`, e.g. `css/tx/table`). */
  classes: string[];
}
