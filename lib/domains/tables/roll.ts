/**
 * Roll engine for `rpg table.<name>` footer expressions.
 *
 * Handles the two roll modes implied by `{{ roll : … [by=…] }}`:
 *
 * 1. **Range-match**: the chosen weight column (default = keyColumn, default
 *    = first column) parses as roll ranges — integers (`3`) and min-max
 *    spans (`1-4`). The dice size is the maximum endpoint. A uniform roll
 *    in `[1..max]` is matched against each row's range. Gaps (roll falls
 *    outside every range) yield a "Rolled X, nothing found." message so
 *    the author notices table-authoring mistakes.
 *
 * 2. **Uniform pick**: the weight column contains text (no numeric ranges
 *    parse), so there's nothing to roll against. Fall back to picking a
 *    random value directly from the target column.
 *
 * Empty / `0` / `-` cells in the weight column exclude that row.
 */

import type { TableDef } from "./types";

/** Parsed weight-cell: a closed integer range `[min..max]`. */
export interface RollRange {
  min: number;
  max: number;
  rowIndex: number;
}

/** Result of a single roll against a table column set. */
export type RollOutcome =
  | { kind: "hit"; values: string[]; rolled: number }
  | { kind: "uniform"; values: string[] }
  | { kind: "miss"; rolled: number; max: number };

/**
 * Parse a weight-column cell into a `[min, max]` range or `null` when the
 * row is excluded. Recognised forms:
 *
 *   "3"        → { min: 3, max: 3 }
 *   "1-4"      → { min: 1, max: 4 }
 *   "01-03"    → { min: 1, max: 3 }    (leading zeros tolerated)
 *   ""         → null (row excluded)
 *   "0"        → null
 *   "-"        → null
 *
 * Returns `undefined` when the cell isn't parseable as a range at all —
 * caller uses that signal to switch to uniform-pick fallback.
 */
export function parseWeightCell(raw: string | undefined): RollRange | null | undefined {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === "" || t === "-") return null;

  const rangeMatch = t.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (min === 0 && max === 0) return null;
    if (min > max) return { min: max, max: min, rowIndex: -1 };
    return { min, max, rowIndex: -1 };
  }

  const intMatch = t.match(/^\d+$/);
  if (intMatch) {
    const n = Number(t);
    if (n === 0) return null;
    return { min: n, max: n, rowIndex: -1 };
  }

  // Not a range, not a plain int → caller falls back to uniform pick.
  return undefined;
}

/**
 * Parse every row's weight-column cell into ranges. Returns the full set of
 * ranges + the max endpoint (dice size). Returns `null` when ANY cell is
 * unparseable (text column) — caller should switch to uniform-pick mode
 * over the target column.
 *
 * Rows with excluded cells are simply omitted from the returned list (their
 * rolls will never fire). Rows where the weight column itself is absent
 * are treated as excluded too.
 */
export function parseWeightColumn(
  rows: { cells: { value: string }[] }[],
  weightColIdx: number,
): { ranges: RollRange[]; max: number } | null {
  const ranges: RollRange[] = [];
  let max = 0;
  let sawAny = false;
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i].cells[weightColIdx];
    const parsed = parseWeightCell(cell?.value);
    if (parsed === undefined) return null; // text → fallback
    if (parsed === null) continue; // excluded
    sawAny = true;
    parsed.rowIndex = i;
    ranges.push(parsed);
    if (parsed.max > max) max = parsed.max;
  }
  if (!sawAny) return null;
  return { ranges, max };
}

/**
 * Pick which row matches `rolled` in the parsed ranges. Returns the row
 * index, or `null` for a gap (rolled value outside every range).
 */
export function matchRoll(ranges: RollRange[], rolled: number): number | null {
  for (const r of ranges) {
    if (rolled >= r.min && rolled <= r.max) return r.rowIndex;
  }
  return null;
}

/**
 * Execute one roll. `rand` is `Math.random`-shaped so tests can inject a
 * deterministic PRNG. Resolution:
 *
 *   - Weight column parses → uniform roll in `[1..max]`, match → "hit" or
 *     "miss" (gap).
 *   - Weight column is non-numeric → "uniform" pick from each target
 *     column's values (one value per target, independent picks across rows
 *     so compound outputs read like "A — B" from distinct rows). Rows
 *     with empty target values are skipped.
 */
export function rollOnce(
  table: TableDef,
  targets: string[],
  weightCol: string | undefined,
  rand: () => number = Math.random,
): RollOutcome {
  const weightKey = weightCol ?? table.keyColumn ?? table.columns[0];
  const weightIdx = weightKey ? table.columns.indexOf(weightKey) : -1;

  // Bare `{{ roll }}` (no targets): show every column that isn't the
  // weight column. Keeps declaration order so "1 — 4 — Bob" reads the
  // way the author wrote the table.
  const targetIndices: number[] =
    targets.length === 0
      ? table.columns.map((_, i) => i).filter((i) => i !== weightIdx)
      : targets.map((t) => table.columns.indexOf(t));

  // No valid weight column at all — pure uniform fallback.
  if (weightIdx < 0) {
    return uniformPick(table, targetIndices, rand);
  }

  const weight = parseWeightColumn(table.rows, weightIdx);
  if (!weight || weight.max === 0) {
    return uniformPick(table, targetIndices, rand);
  }

  const rolled = Math.floor(rand() * weight.max) + 1;
  const rowIdx = matchRoll(weight.ranges, rolled);
  if (rowIdx == null) return { kind: "miss", rolled, max: weight.max };

  const row = table.rows[rowIdx];
  const values = targetIndices.map((idx) => (idx >= 0 ? row.cells[idx]?.value ?? "" : ""));
  return { kind: "hit", values, rolled };
}

/** Each target column contributes one uniformly-picked non-empty value. */
function uniformPick(
  table: TableDef,
  targetIndices: number[],
  rand: () => number,
): RollOutcome {
  const values = targetIndices.map((idx) => {
    if (idx < 0) return "";
    const pool: string[] = [];
    for (const row of table.rows) {
      const v = row.cells[idx]?.value?.trim();
      if (v) pool.push(v);
    }
    if (pool.length === 0) return "";
    return pool[Math.floor(rand() * pool.length)];
  });
  return { kind: "uniform", values };
}

/** Render a `RollOutcome` into the string(s) the renderer actually shows. */
export function formatRollOutcome(outcome: RollOutcome): string {
  switch (outcome.kind) {
    case "hit":
    case "uniform":
      return outcome.values.filter((v) => v !== "").join(" — ");
    case "miss":
      return `Rolled ${outcome.rolled}, nothing found.`;
  }
}
