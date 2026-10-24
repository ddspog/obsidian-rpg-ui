/**
 * GM step blocks — cross-file follow-up choices imported into a `gen:` line.
 *
 * An entry feature's `interpret` result can be a branch reference: a wikilink
 * (`@[[Altered Scene]]` / `[[Altered Scene#blockid|Label]]`) pointing at a STEP
 * block — a `feature.gm` carrying `steps:`. When that branch comes up, the UI
 * imports the step block's choices as a dropdown on the `gen:` line; picking one
 * appends a flat `  <choice>: <calc>` line under the generator (one indent level,
 * never a nested block).
 *
 * These helpers are pure (no Obsidian / vault). The render layer resolves the
 * branch ref to an actual step `GMFeature` (cross-file) and hands it in.
 */

import { rolledValue } from "../session-log/formula";
import type { GMFeature, GMStep } from "../features/types";
import type { TableDef } from "../tables/types";

export interface BranchRef {
  /** Display label shown on the branching line (e.g. "Altered Scene"). */
  label: string;
  /** Linked file — the wikilink target, no extension. */
  target: string;
  /** Optional specific block id within the file (`@[[file]]#blockid`). */
  block?: string;
}

/**
 * Parse an `interpret` result / `table` ref that is a branch reference — a
 * `@[[file]]`, `[[file]]`, `[[file#blockid]]`, `@[[file]]#blockid`, or
 * `[[file|Label]]` (in any combination). The block id may sit inside the
 * brackets (`#blockid` before `]]`) or trail them (`]]#blockid`). Returns null
 * for a plain-text result (e.g. `"Expected Scene"` with no link).
 */
export function parseBranchRef(result: string): BranchRef | null {
  const m = result.trim().match(/^@?\[\[([^\]]+)\]\](?:#([\w./-]+))?$/);
  if (!m) return null;
  const inner = m[1].trim();
  const outerBlock = m[2]?.trim() || undefined;
  const pipe = inner.indexOf("|");
  const explicitLabel = pipe >= 0 ? inner.slice(pipe + 1).trim() : "";
  const beforePipe = pipe >= 0 ? inner.slice(0, pipe) : inner;
  const hash = beforePipe.indexOf("#");
  const innerBlock = hash >= 0 ? beforePipe.slice(hash + 1).trim() || undefined : undefined;
  const target = (hash >= 0 ? beforePipe.slice(0, hash) : beforePipe).trim();
  const label = explicitLabel || (target.split("/").pop() ?? target).trim();
  if (!target) return null;
  return { label, target, block: outerBlock ?? innerBlock };
}

/** The choice labels a step block offers (in declared order; skips `use:` splices). */
export function stepLabels(step: GMFeature): string[] {
  return (step.steps ?? []).map((s) => s.choice).filter((c): c is string => !!c);
}

/** The `calc` expression for a given choice on a step block, or undefined. */
export function stepCalc(step: GMFeature, choice: string): string | undefined {
  return (step.steps ?? []).find((s) => s.choice === choice)?.calc;
}

/** The `@[[link]]`s referenced by `use:` steps in a step list (to load + splice). */
export function stepUseLinks(steps: GMStep[]): string[] {
  return steps.filter((s) => s.use).map((s) => s.use as string);
}

/**
 * Replace each `use: @[[link]]` step with the imported block's steps (from
 * `resolved`, keyed by the raw use link), flattening the list. Unresolved
 * `use:` steps drop out. Pure — the render layer loads the targets (cross-file)
 * and hands in the resolved map. Runs at load time so downstream sees flat steps.
 */
export function spliceStepUses(steps: GMStep[], resolved: Record<string, GMStep[]>): GMStep[] {
  return steps.flatMap((s) => (s.use ? (resolved[s.use] ?? []) : [s]));
}

/**
 * Pick the step block from a page's loaded features, honoring an optional
 * `block` id (matched against the feature `name`). With no id, the single
 * `steps`-bearing feature is returned; null when ambiguous or absent.
 */
export function selectStepBlock(features: GMFeature[], block?: string): GMFeature | null {
  const stepBlocks = features.filter((f) => Array.isArray(f.steps) && f.steps.length > 0);
  if (block) return stepBlocks.find((f) => f.name === block) ?? null;
  return stepBlocks.length === 1 ? stepBlocks[0] : null;
}

/**
 * Append a picked step as a flat labeled calc line under the named `gen:` line.
 * The new `  <choice>: <calc>` goes after the generator's existing indented
 * block (so successive picks accumulate in order), at one indent level — never
 * nested. An empty `calc` records nothing (returns the log unchanged); the
 * caller marks the pick on the branch line separately.
 */
export function appendStepLine(log: string, genName: string, choice: string, calc: string): string {
  if (calc.trim() === "") return log;
  const lines = log.split("\n");
  const genIdx = lines.findIndex((l) => l.trim() === `gen: ${genName}`);
  if (genIdx < 0) return log;
  let insertAt = genIdx + 1;
  while (insertAt < lines.length && /^\s+\S/.test(lines[insertAt])) insertAt++;
  lines.splice(insertAt, 0, `  ${choice}: ${calc.trim()}`);
  return lines.join("\n");
}

/** Does a table's roll-key cell (`"3"`, `"7-10"`, `"21+"`) cover value `n`? */
function rangeMatches(key: string, n: number): boolean {
  const k = key.trim();
  let m = k.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (m) return n >= +m[1] && n <= +m[2];
  m = k.match(/^(\d+)\s*\+$/);
  if (m) return n >= +m[1];
  m = k.match(/^(\d+)$/);
  if (m) return n === +m[1];
  return false;
}

/**
 * What a rolled row says. One value column: its text. Several (a name table's Start and
 * Ending, a Part 1 and Part 2): every filled one, `Start: Hod · Ending: dare`, each named
 * by its column, or just the values when the columns are numbered alternatives (`1`, `2`).
 */
function rowResult(table: TableDef, row: TableDef["rows"][number]): string {
  const values = row.cells
    .slice(1)
    .map((c, i) => ({ label: (table.columnLabels?.[i + 1] ?? "").trim(), text: c.value.trim() }));
  const filled = values.filter((v) => v.text);
  if (filled.length <= 1 || values.length <= 1) return (values[0]?.text ?? "") || filled[0]?.text || "";
  const numbered = values.every((v) => /^\d*$/.test(v.label));
  return filled.map((v) => (numbered || !v.label ? v.text : `${v.label}: ${v.text}`)).join(" · ");
}

/**
 * A second roll on a rolled row. `@pick(1,2,3+4,5)` names the row's value columns by number:
 * the groups are separated by `+`, and one value of each group is joined to the others (Start 1-3
 * + End 1-2 → six names); a single group is a plain pick among alternatives (two names in a
 * row, use either). The die has one face per option.
 */
export const PICK_TOKEN = /@pick\(([\d,+\s]*)\)/;

/** The groups of 1-based value-column numbers a pick spec names. */
export function parsePickSpec(spec: string): number[][] {
  return spec
    .split("+")
    .map((g) =>
      g
        .split(",")
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => n > 0)
    )
    .filter((g) => g.length > 0);
}

/** How many faces a pick's die has: the options the spec names, whatever the row fills. */
export function pickSides(spec: string): number {
  return parsePickSpec(spec).reduce((n, g) => n * g.length, 1);
}

/** What a rolled row offers a pick: every value of the first group joined to every one of the next. */
export function pickOptions(row: TableDef["rows"][number], spec: string): string[] {
  const groups = parsePickSpec(spec)
    .map((g) => g.map((i) => (row.cells[i]?.value ?? "").trim()).filter((v) => v))
    .filter((g) => g.length > 0);
  return groups.reduce<string[]>((acc, g) => acc.flatMap((a) => g.map((v) => `${a}${v}`)), [""]).filter((o) => o);
}

/** What the row offers a pick, at a glance: alternatives split by `/`, groups joined by `+`. */
export function pickChoices(row: TableDef["rows"][number], spec: string): string {
  return parsePickSpec(spec)
    .map((g) => g.map((i) => (row.cells[i]?.value ?? "").trim()).filter((v) => v))
    .filter((g) => g.length > 0)
    .map((g) => g.join(" / "))
    .join(" + ");
}

/** The row of `table` that roll `n` lands on. */
export function rowAt(table: TableDef, n: number): TableDef["rows"][number] | undefined {
  return table.rows.find((r) => rangeMatches(r.cells[0]?.value ?? "", n));
}

/**
 * The option a second roll `pick` takes from the row the first roll `n` landed on. A row that
 * fills fewer columns than the spec names offers fewer options, so the roll wraps around them.
 */
export function pickResult(table: TableDef, n: number, spec: string, pick: number): string | undefined {
  const row = rowAt(table, n);
  if (pick === 0) return row ? pickChoices(row, spec) || undefined : undefined; // the options, before one is taken
  const options = row ? pickOptions(row, spec) : [];
  return options.length > 0 ? options[(((pick - 1) % options.length) + options.length) % options.length] : undefined;
}

/**
 * Auto-fill a table-backed calc's result from the rolled die. Given a calc like
 * `"@[[Scene Adjustment]] d10=2 ->"` and the linked `TableDef`, looks up the row
 * whose first column covers the rolled value and writes the second column after
 * the arrow (`"… -> Add a Character"`). Returns the calc unchanged when the die
 * isn't rolled, no row matches, or the line already carries a result. The filled
 * value stays editable (it's plain text in the line).
 */
export function resolveTableRoll(calc: string, table: TableDef): string {
  const arrow = calc.match(/->\s*(\S.*)?$/);
  if (arrow && arrow[1]) return calc; // already has a result after `->`
  const n = rolledValue(calc);
  if (n == null) return calc;
  for (const row of table.rows) {
    const key = row.cells[0]?.value ?? "";
    if (rangeMatches(key, n)) {
      const result = rowResult(table, row);
      if (!result) return calc;
      return calc.replace(/->\s*$/, `-> ${result}`);
    }
  }
  return calc;
}

/**
 * Choose `pick` of `tables` at random (for a word-pair step's `pick` field, e.g.
 * 2 of the 3 Elements tables). When `pick` is null/undefined or ≥ the list
 * length, the list is returned unchanged (a full pair). Uses a partial
 * Fisher–Yates shuffle; `rng` is injectable so the selection is deterministic in
 * tests (`Math.random` by default — allowed in plugin runtime).
 */
export function chooseTables(tables: string[], pick?: number, rng: () => number = Math.random): string[] {
  if (pick == null || pick >= tables.length) return [...tables];
  const arr = [...tables];
  for (let i = 0; i < pick; i++) {
    const j = i + Math.floor(rng() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, pick);
}

/** Every step in a list, with the steps a nested dropdown (`then`) holds, at any depth. */
export function flattenSteps(steps: GMStep[]): GMStep[] {
  return steps.flatMap((s) => [s, ...flattenSteps(s.then ?? [])]);
}
