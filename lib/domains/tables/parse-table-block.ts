/**
 * Parser for `rpg table.<name>` fences.
 *
 * Structure of a block body:
 *
 *   [optional YAML-ish options lines, e.g. `key: level`]
 *   | LEVEL | PB | FEATURES |            ← one or more header rows
 *   |---|---|---|                        ← separator
 *   | 1 | +2 | Spellcasting |            ← body rows
 *   ...
 *   [CAPTION #css/tx/table #css/tx/wide] ← optional footer
 *
 * `||` at the end of a cell row extends the previous cell's colspan by one
 * each time (tx convention). Every header row above the separator is kept so
 * multi-row headers (e.g. a column-group row + a column-name row) round-trip
 * unchanged to `<thead>`.
 */

import type { TableCell, TableDef, TableRow } from "./types";

/** Normalise a column label into a stable key: lowercase, non-alphanum → `_`. */
export function normalizeColumnKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

/**
 * Split a pipe-delimited row into cells, honouring the tx `||` colspan rule:
 * a second pipe with no text between it and the previous one extends the
 * previous cell by one column. `|a||b|` → `[a (colspan=2), b]`.
 *
 * The leading and trailing pipes (if present) are stripped before splitting.
 */
export function splitCells(line: string): TableCell[] {
  // Strip optional leading/trailing pipes and surrounding whitespace.
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  // Split on `|` but keep empty segments so we can detect adjacent pipes.
  const segments = trimmed.split("|").map((s) => s.trim());

  const out: TableCell[] = [];
  for (const seg of segments) {
    if (seg === "" && out.length > 0) {
      // Empty cell → extend previous cell's colspan.
      const prev = out[out.length - 1];
      prev.colspan = (prev.colspan ?? 1) + 1;
    } else {
      out.push({ value: seg });
    }
  }
  return out;
}

/** A row like `|---|---|` (markdown table separator). */
function isSeparatorLine(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("|") && !t.includes("|")) return false;
  // A separator has only `:`, `-`, `|`, and whitespace — and at least one `-`.
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(t);
}

/** A footer line: `[CAPTION #css/tx/table #css/tx/wide]`. */
function parseFooter(
  line: string,
): { caption: string; classes: string[] } | null {
  const t = line.trim();
  if (!t.startsWith("[") || !t.endsWith("]")) return null;
  const inner = t.slice(1, -1).trim();
  if (!inner) return null;
  const tokens = inner.split(/\s+/);
  const classes: string[] = [];
  const captionParts: string[] = [];
  for (const tok of tokens) {
    if (tok.startsWith("#")) {
      classes.push(tok.slice(1));
    } else {
      captionParts.push(tok);
    }
  }
  return { caption: captionParts.join(" "), classes };
}

/**
 * Parse the body of a `rpg table.<name>` fence.
 *
 * Key column resolution: a header cell ending in `*` (e.g. `LEVEL*`) marks
 * itself as the row-lookup key and the `*` is stripped from display. If no
 * header cell carries a `*`, the first column is treated as the key by
 * default. Override with `*` only when you need a different column.
 */
export function parseTableBlock(name: string, body: string): TableDef {
  const lines = body.split("\n");

  // ── Split into: table lines, footer ──
  const tableLines: string[] = [];
  let footer: { caption: string; classes: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    if (line.trim().startsWith("|")) {
      tableLines.push(line);
      continue;
    }

    const f = parseFooter(line);
    if (f) {
      footer = f;
      continue;
    }
  }

  // ── Find the separator row and split header / body ──
  const sepIdx = tableLines.findIndex(isSeparatorLine);
  const headerLines = sepIdx >= 0 ? tableLines.slice(0, sepIdx) : [];
  const bodyLines = sepIdx >= 0 ? tableLines.slice(sepIdx + 1) : tableLines;

  const headerRows: TableRow[] = headerLines.map((l) => ({ cells: splitCells(l) }));
  const rows: TableRow[] = bodyLines.map((l) => ({ cells: splitCells(l) }));

  // ── Derive columns from the LAST header row (most specific names). The
  //    same row carries the `*` key sigil — we strip it here and remember
  //    which column index it pointed at.
  const lastHeader = headerRows[headerRows.length - 1];
  const columnLabels: string[] = [];
  let keyColumnIndex = -1;
  if (lastHeader) {
    let columnPos = 0;
    for (const cell of lastHeader.cells) {
      const span = cell.colspan ?? 1;
      const trimmed = cell.value.trim();
      const isKey = trimmed.length > 1 && trimmed.endsWith("*");
      const display = isKey ? trimmed.slice(0, -1).trimEnd() : cell.value;
      if (isKey) {
        cell.value = display;
        if (keyColumnIndex < 0) keyColumnIndex = columnPos;
      }
      columnLabels.push(display);
      for (let i = 1; i < span; i++) columnLabels.push(display);
      columnPos += span;
    }
  }
  const columns = columnLabels.map(normalizeColumnKey);

  // Default: first column is the key when no `*` sigil was given.
  if (keyColumnIndex < 0 && columns.length > 0) keyColumnIndex = 0;
  const keyColumn = keyColumnIndex >= 0 ? columns[keyColumnIndex] : undefined;

  return {
    name,
    columns,
    columnLabels,
    rows,
    headerRows,
    keyColumn,
    caption: footer?.caption,
    classes: footer?.classes ?? [],
  };
}
