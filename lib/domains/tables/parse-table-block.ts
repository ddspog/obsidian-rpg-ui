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
import { parseMergeMarker } from "./row-merge";

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

  // Split on `|` that is NOT inside `[[…]]` wikilinks, keeping empty
  // segments so we can detect the `||` colspan convention.
  const segments: string[] = [];
  let current = "";
  let bracketDepth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "[" && trimmed[i + 1] === "[") {
      bracketDepth++;
      current += "[[";
      i++;
    } else if (trimmed[i] === "]" && trimmed[i + 1] === "]" && bracketDepth > 0) {
      bracketDepth--;
      current += "]]";
      i++;
    } else if (trimmed[i] === "|" && bracketDepth === 0) {
      segments.push(current.trim());
      current = "";
    } else {
      current += trimmed[i];
    }
  }
  segments.push(current.trim());

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

/** A footer line: `[CAPTION #css/tx/table @title]`. The `@title` token
 *  flags the caption to render larger/header-styled. */
function parseFooter(line: string): { caption: string; classes: string[]; title: boolean } | null {
  const t = line.trim();
  if (!t.startsWith("[") || !t.endsWith("]")) return null;
  const inner = t.slice(1, -1).trim();
  if (!inner) return null;
  const tokens = inner.split(/\s+/);
  const classes: string[] = [];
  const captionParts: string[] = [];
  let title = false;
  for (const tok of tokens) {
    if (tok.startsWith("#")) {
      classes.push(tok.slice(1));
    } else if (tok === "@title") {
      title = true;
    } else {
      captionParts.push(tok);
    }
  }
  return { caption: captionParts.join(" "), classes, title };
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
 * A stricter separator that marks the body/footer boundary — the SECOND
 * `|---|`. Requires 3+ dashes per column so a body row of single-hyphen
 * cells (`| - | - |`) isn't mistaken for the boundary; author empty cells
 * with an em-dash (`—`), not `-`.
 */
function isFooterBoundaryLine(line: string): boolean {
  const t = line.trim();
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(t);
}

/**
 * Detect an axis (diagonal corner) cell: `{{ axis <col> <sep> <row> }}`. The
 * separator glyph IS the diagonal drawn:
 *   - `\` → ↘ (top-left → bottom-right); col label in the upper-right triangle.
 *   - `/` → ↗ (bottom-left → top-right); col label in the upper-left triangle.
 * In both, the FIRST label names what the COLUMNS mean (hugs the top) and the
 * SECOND names the ROWS (hugs the bottom). Splits on the first `/` or `\`.
 * Returns null when the cell isn't an axis expression.
 */
export function parseAxisCell(value: string): { col: string; row: string; dir: "up" | "down" } | null {
  const m = value.trim().match(/^\{\{\s*axis\s+(.+?)\s*([/\\])\s*(.+?)\s*\}\}$/);
  if (!m) return null;
  return { col: m[1].trim(), row: m[3].trim(), dir: m[2] === "/" ? "up" : "down" };
}

/** Recognised per-cell `@modifier` tokens (see TableCell.mods). */
const CELL_MODIFIERS = new Set([
  "compact",
  "highlight-col",
  "highlight-row",
  "highlight-cross",
  "header",
  "middle",
  "middle-col",
  "middle-row",
  "middle-cross",
]);

/**
 * Strip leading `@modifier` tokens from a cell value. A modifier is `@<name>`
 * at the very start followed by whitespace or end-of-cell; only RECOGNISED
 * names are consumed (so unknown `@words` and `@[[refs]]` stay as content).
 * Returns the consumed mod names and the remaining text.
 */
/**
 * Strip `@modifier` tokens from a cell value — both LEADING and TRAILING runs,
 * so they can flank the content (`@compact Foo`, `Foo @header`, or
 * `{{ axis A / B }} @header @highlight-cross`). A modifier is `@<name>`
 * bounded by whitespace / cell edges; only RECOGNISED names are consumed, so
 * unknown `@words` and `@[[refs]]` stay as content. Returns the consumed mod
 * names and the remaining text.
 */
function stripCellModifiers(value: string): { mods: string[]; rest: string } {
  const mods: string[] = [];
  let rest = value;
  const LEAD = /^@([a-z][a-z-]*)(?:\s+|$)/;
  const TRAIL = /\s+@([a-z][a-z-]*)$/;
  let m: RegExpMatchArray | null;
  while ((m = rest.match(LEAD)) !== null && CELL_MODIFIERS.has(m[1])) {
    mods.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  while ((m = rest.match(TRAIL)) !== null && CELL_MODIFIERS.has(m[1])) {
    mods.push(m[1]);
    rest = rest.slice(0, rest.length - m[0].length);
  }
  return { mods, rest };
}

/**
 * Apply per-cell markers to a parsed row, in place — shared by header and
 * body rows so vertical merges work in either:
 *   - `^` / `^^` / `^v` / `^-` → `mergeUp` (+ optional `mergeAlign`); the
 *     cell content is blanked and any `||` colspan dropped (a marker occupies
 *     exactly one column).
 *   - leading `@modifier` tokens → `mods` (stripped from the value).
 *   - a leading `> ` (repeatable) → `indent` depth, stripped from the value.
 */
function applyRowMarkers(row: TableRow): void {
  for (const cell of row.cells) {
    const marker = parseMergeMarker(cell.value);
    if (marker) {
      cell.mergeUp = true;
      if (marker.align) cell.mergeAlign = marker.align;
      cell.value = "";
      delete cell.colspan;
      continue;
    }
    const { mods, rest } = stripCellModifiers(cell.value);
    if (mods.length) {
      cell.mods = mods;
      cell.value = rest;
    }
    const m = cell.value.match(/^(>+)\s/);
    if (m) {
      cell.indent = m[1].length;
      cell.value = cell.value.slice(m[0].length);
    }
  }
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
  let footer: { caption: string; classes: string[]; title: boolean } | null = null;
  let pagination: PaginationConfig | undefined;
  let wide = false;

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

    if (line.trim() === "@wide") {
      wide = true;
      continue;
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

  // ── Split into header / body / footer-cell sections ──
  // The first separator splits header from the rest; a SECOND (strict)
  // separator splits body rows from custom footer-cell rows.
  const sepIdx = tableLines.findIndex(isSeparatorLine);
  const headerLines = sepIdx >= 0 ? tableLines.slice(0, sepIdx) : [];
  const afterHeader = sepIdx >= 0 ? tableLines.slice(sepIdx + 1) : tableLines;
  const footIdxRel = afterHeader.findIndex(isFooterBoundaryLine);
  const bodyLines = footIdxRel >= 0 ? afterHeader.slice(0, footIdxRel) : afterHeader;
  const footerCellLines = footIdxRel >= 0 ? afterHeader.slice(footIdxRel + 1) : [];

  const headerRows: TableRow[] = headerLines.map((l) => {
    const row: TableRow = { cells: splitCells(l) };
    applyRowMarkers(row);
    return row;
  });
  const rows: TableRow[] = bodyLines.map((l) => {
    const row: TableRow = { cells: splitCells(l) };
    applyRowMarkers(row);
    return row;
  });
  // Footer cells render as authored (no vertical merge in the tfoot), but
  // still split on `||` for colspan and honour `@modifier`s + axis cells.
  const footerCells: TableRow[] = footerCellLines.map((l) => {
    const row: TableRow = { cells: splitCells(l) };
    applyRowMarkers(row);
    return row;
  });

  // ── Derive columns ──
  // `*` key sigil: scan every header cell (any row); the first wins. Strip it
  // from the displayed label.
  let keyColumnIndex = -1;
  for (const hr of headerRows) {
    let columnPos = 0;
    for (const cell of hr.cells) {
      const span = cell.colspan ?? 1;
      const trimmed = cell.value.trim();
      if (trimmed.length > 1 && trimmed.endsWith("*")) {
        cell.value = trimmed.slice(0, -1).trimEnd();
        if (keyColumnIndex < 0) keyColumnIndex = columnPos;
      }
      columnPos += span;
    }
  }
  // Effective label per grid column: walk header rows top→bottom, recording
  // each column's value from any non-merge cell (expanded across its colspan).
  // A `^` marker carries no value, so a column that merges down keeps the
  // label from the row above.
  const colValue: string[] = [];
  for (const hr of headerRows) {
    let columnPos = 0;
    for (const cell of hr.cells) {
      const span = cell.colspan ?? 1;
      if (!cell.mergeUp) {
        for (let i = 0; i < span; i++) colValue[columnPos + i] = cell.value;
      }
      columnPos += span;
    }
  }
  // The column COUNT comes from the LAST header row (the column-name row), so
  // a group row that spans extra columns via trailing `||` doesn't inflate it.
  const lastHeader = headerRows[headerRows.length - 1];
  let columnCount = 0;
  if (lastHeader) for (const cell of lastHeader.cells) columnCount += cell.colspan ?? 1;
  const columnLabels: string[] = [];
  for (let c = 0; c < columnCount; c++) columnLabels.push(colValue[c] ?? "");
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
    footerCells,
    keyColumn,
    caption: footer?.caption,
    captionTitle: footer?.title || undefined,
    classes: footer?.classes ?? [],
    footerRows: footerRollLines.map(parseFooterRollLine),
    pagination,
    wide: wide || undefined,
  };
}
