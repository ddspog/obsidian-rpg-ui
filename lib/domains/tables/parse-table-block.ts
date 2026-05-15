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

import type { FooterCell, FooterRow, FooterSegment, TableCell, TableDef, TableRow } from "./types";
import { parsePaginateDirective, type PaginationConfig } from "./pagination";

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
function parseFooter(line: string): { caption: string; classes: string[] } | null {
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
 * Detect a `|= … =|` roll-footer row. Must begin with `|=` and end with
 * `=|` (tolerating surrounding whitespace). Distinct from a `||`-prefixed
 * colspan row since the `=` suffix is required.
 */
function isFooterRollLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|=") && t.endsWith("=|");
}

/**
 * Parse the inside of `{{ roll[ : … ] }}`. Grammar:
 *
 *   roll                                   — default: roll on key column,
 *                                            show every non-weight column
 *   roll : <target>[, <target>…]           — specific target columns
 *   roll : … by = <col>                    — override weight column
 *   roll by = <col>                        — bare roll, custom weight col
 *
 * Targets and the `by=` value can be bare identifiers (single word, no
 * spaces) or single-quoted strings (`'Adventuring Motivation'`) for labels
 * with spaces or capitals. Column refs are normalised to the same keying
 * scheme as the table's `columns` field so the renderer can look them up.
 *
 * Returns null when the expression isn't a well-formed `roll` call.
 */
function parseRollExpression(inner: string): { targets: string[]; by?: string } | null {
  const src = inner.trim();
  let i = 0;

  function skipWs(): void {
    while (i < src.length && /\s/.test(src[i])) i++;
  }

  function readColumnRef(): string | null {
    if (src[i] === "'") {
      i++;
      let out = "";
      while (i < src.length && src[i] !== "'") out += src[i++];
      if (src[i] !== "'") return null;
      i++;
      return normalizeColumnKey(out);
    }
    const m = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!m) return null;
    i += m[0].length;
    return normalizeColumnKey(m[0]);
  }

  skipWs();
  const helperMatch = src.slice(i).match(/^roll\b/);
  if (!helperMatch) return null;
  i += helperMatch[0].length;
  skipWs();

  const targets: string[] = [];
  let by: string | undefined;

  // Optional `:` introducing the target list. When absent, the target list
  // stays empty → renderer interprets as "all non-weight columns".
  if (src[i] === ":") {
    i++;
    skipWs();
    const first = readColumnRef();
    if (!first) return null;
    targets.push(first);
    skipWs();

    while (src[i] === ",") {
      i++;
      skipWs();
      const next = readColumnRef();
      if (!next) return null;
      targets.push(next);
      skipWs();
    }
  }

  // Optional `by=<col>` kwarg (works with or without a target list).
  if (i < src.length) {
    const kw = src.slice(i).match(/^by\s*=\s*/);
    if (!kw) return null;
    i += kw[0].length;
    skipWs();
    const byCol = readColumnRef();
    if (!byCol) return null;
    by = byCol;
    skipWs();
  }

  if (i < src.length) return null; // trailing garbage
  return { by, targets };
}

/**
 * Tokenize a footer cell body into `{ kind: "text" | "roll" }` segments.
 * Literal text outside `{{ }}` becomes a text segment; a well-formed
 * `{{ roll : … }}` becomes a roll segment. A `{{ … }}` that isn't a roll
 * expression is preserved verbatim as text so the raw author intent
 * round-trips (the same policy `substituteExpressions` uses).
 */
function tokenizeFooterCell(body: string): FooterSegment[] {
  const out: FooterSegment[] = [];
  const re = /\{\{([^{}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      out.push({ kind: "text", text: body.slice(lastIndex, match.index) });
    }
    const parsed = parseRollExpression(match[1]);
    if (parsed) {
      out.push({ kind: "roll", targets: parsed.targets, by: parsed.by });
    } else {
      // Unknown expression — keep verbatim so other helpers downstream
      // (e.g. `substituteExpressions`) still see it.
      out.push({ kind: "text", text: match[0] });
    }
    lastIndex = re.lastIndex;
  }

  if (lastIndex < body.length) {
    out.push({ kind: "text", text: body.slice(lastIndex) });
  }
  return out;
}

/**
 * Parse a `|= … =|` line into a FooterRow. Inner cells are split on
 * unescaped `|`. Each cell body is then tokenized into markdown + roll
 * segments. Leading/trailing whitespace on each cell is preserved on the
 * surrounding text segments so authored spacing round-trips.
 */
function parseFooterRollLine(line: string): FooterRow {
  const t = line.trim();
  // Strip `|=` prefix and `=|` suffix.
  const inner = t.slice(2, -2);
  const parts = inner.split("|");
  const cells: FooterCell[] = parts.map((body) => ({
    segments: tokenizeFooterCell(body),
  }));
  return { cells };
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

  // ── Split into: table lines, footer caption, roll-footer rows ──
  const tableLines: string[] = [];
  const footerRollLines: string[] = [];
  let footer: { caption: string; classes: string[] } | null = null;
  let pagination: PaginationConfig | undefined;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    if (!pagination && line.trim().startsWith("@paginate")) {
      const p = parsePaginateDirective(line);
      if (p) {
        pagination = p;
        continue;
      }
    }

    if (isFooterRollLine(line)) {
      footerRollLines.push(line);
      continue;
    }

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
    footerRows: footerRollLines.map(parseFooterRollLine),
    pagination,
  };
}
