/**
 * GM feature example → filled lonelog.
 *
 * Turns a feature's `example:` fill-in values into a concrete lonelog excerpt by
 * filling the feature's own emit template: named `{{placeholders}}`, dice
 * (`d10=` → `d10=8`), and the `->` outcome. The outcome is computed from the
 * feature's `interpret`/`likelihood` using the rolled value (so the example
 * proves the feature's own mechanics) unless an explicit `result` is given.
 *
 * Pure string assembly; no Obsidian / vault dependencies.
 */

import type { GMFeature, GMInterpret, GMStep } from "../features/types";
import type { TableDef } from "../tables/types";
import { emitGMFeature } from "./emit";
import { resolveInterpret, fateResult, FATE_WORDING } from "./fate-chart";
import { parseBranchRef, stepLabels, resolveTableRoll } from "./steps";
import { parseFormula, setDiceValue } from "../session-log/formula";

const RESERVED = new Set(["rolls", "result", "narration"]);

/**
 * Cross-file step context: the step blocks an entry feature's `interpret`
 * branch links resolve to (keyed by the link target's basename), plus any
 * tables a step's `calc` rolls against (keyed by the table link's basename).
 * Loaded by the render layer (it needs vault access); the pure builders and
 * resolvers take it as input.
 */
export interface GMStepContext {
  steps?: Record<string, GMFeature>;
  tables?: Record<string, TableDef>;
}

/** First rolled value in the example's `rolls` map (the primary die). */
function firstRoll(rolls: unknown): number | undefined {
  if (!rolls || typeof rolls !== "object") return undefined;
  const v = Object.values(rolls as Record<string, unknown>)[0];
  return typeof v === "number" ? v : undefined;
}

/** Compute the `->` outcome from whichever aspect carries interpret/likelihood. */
function computeResult(feature: GMFeature, roll: number | undefined, cf: number | undefined): string | null {
  const interpretAspect = [feature.generator, feature.roll, feature.oracle].find((a) => a?.interpret);
  if (interpretAspect?.interpret && roll != null) {
    const r = resolveInterpret(interpretAspect.interpret, { roll, cf });
    if (r) return r;
  }
  if (feature.oracle?.likelihood && roll != null && cf != null) {
    return FATE_WORDING[fateResult(roll, cf, feature.oracle.likelihood)];
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the filled lonelog excerpt for a feature's `example`, or null when the
 * feature declares none. When a result resolves to a `@[[link]]` branch ref and
 * the linked step block is supplied in `stepCtx`, the result shows the branch
 * label plus a `[step / step - ]` dropdown of that block's choices.
 */
export function buildGMExampleLog(feature: GMFeature, stepCtx?: GMStepContext): string | null {
  const ex = feature.example;
  if (!ex) return null;
  let out = emitGMFeature(feature);
  if (!out) return null;

  const cf = typeof ex.cf === "number" ? ex.cf : feature.oracle?.cf;
  const roll = firstRoll(ex.rolls);

  // 1. Named {{placeholder}} fills (every non-reserved scalar key).
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(ex)) {
    if (RESERVED.has(k)) continue;
    if (v == null || typeof v === "object") continue;
    values[k] = String(v);
  }
  if (typeof ex.narration === "string" && values.title == null && /\{\{title\}\}/.test(out)) {
    values.title = ex.narration;
  }
  out = out.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in values ? values[key] : m));

  // 2. Dice fills: `d10=` → `d10=8` (only unfilled tokens).
  if (ex.rolls && typeof ex.rolls === "object") {
    for (const [die, value] of Object.entries(ex.rolls)) {
      out = out.replace(new RegExp(`${escapeRegExp(die)}=(?!\\d)`), `${die}=${value}`);
    }
  }

  // 3. Outcome fill. The result is the matched `interpret`/`likelihood` value.
  // When it's a `@[[link]]` branch ref, the line shows the branch LABEL plus a
  // `[opt/opt - ]` dropdown of the linked step block's choices; otherwise it
  // falls back to the legacy inline `follow` strategies on the generator.
  const baseRaw = typeof ex.result === "string" ? ex.result : computeResult(feature, roll, cf);
  const result = resultLine(baseRaw, feature, stepCtx);
  if (result) {
    const withAnswer = out.replace(/->\s*(\([^)]*\))\s*$/m, `-> ${result} $1`);
    out = withAnswer !== out ? withAnswer : out.replace(/->(?=\s*$)/m, `-> ${result}`);
  }

  return out;
}

/** Compose a result string (label + optional `[opt/opt - ]` dropdown) from a raw
 *  interpret value: a `@[[link]]` branch ref imports the linked step block's
 *  choices; otherwise the legacy generator `follow` map supplies them. */
function resultLine(baseRaw: string | null, feature: GMFeature, stepCtx?: GMStepContext): string | null {
  if (!baseRaw) return null;
  const ref = parseBranchRef(baseRaw);
  if (ref) {
    const step = stepCtx?.steps?.[ref.target];
    const labels = step ? stepLabels(step) : [];
    return labels.length > 0 ? `${ref.label} [${labels.join("/")} - ]` : ref.label;
  }
  const options = feature.generator?.follow?.[baseRaw];
  const labels = options ? Object.keys(options) : [];
  return labels.length > 0 ? `${baseRaw} [${labels.join("/")} - ]` : baseRaw;
}

/**
 * Flatten every pickable follow-up into one option-label → generated-line map,
 * for the dropdown's pick-to-insert (consumed by `applyChoicePick`). Merges the
 * legacy generator `follow` lines with the imported step blocks' choices — a
 * step's line is the flat labeled form `"<choice>: <calc>"` (empty `calc` =
 * record the pick with no line).
 */
export function gmStepLines(feature: GMFeature, stepCtx?: GMStepContext): Record<string, string> {
  const out = gmFollowLines(feature);
  for (const step of Object.values(stepCtx?.steps ?? {})) {
    for (const s of step.steps ?? []) {
      out[s.choice] = s.calc.trim() === "" ? "" : `${s.choice}: ${s.calc}`;
    }
  }
  return out;
}

/** Flatten a feature's follow strategies (across all results) into one
 *  option-label → generated-line lookup, for the dropdown's pick-to-insert. */
export function gmFollowLines(feature: GMFeature): Record<string, string> {
  const out: Record<string, string> = {};
  const follow = feature.generator?.follow;
  if (!follow) return out;
  for (const byOption of Object.values(follow)) {
    for (const [label, line] of Object.entries(byOption)) out[label] = line;
  }
  return out;
}

/**
 * Resolve a contest check string (e.g. `"d10=8 vs CF 5"`) to its worded result
 * via an `interpret` map, appending a `[opt/opt - ]` choice slot when the result
 * offers follow strategies. Returns null when the die isn't rolled yet, the
 * string isn't a contest, or no interpret matches — callers leave the line as-is.
 */
export function resolveContest(
  check: string,
  interpret?: GMInterpret,
  follow?: Record<string, Record<string, string>>
): string | null {
  if (!interpret) return null;
  const formula = parseFormula(check);
  if (!formula || formula.check.kind !== "contest") return null;
  const terms = [formula.check.left, formula.check.right];
  const dice = terms.find((t) => t.kind === "dice");
  const threshold = terms.find((t) => t.kind === "threshold");
  if (!dice || dice.kind !== "dice" || dice.value == null) return null;
  const cf = threshold && threshold.kind === "threshold" ? threshold.value : undefined;
  const base = resolveInterpret(interpret, { roll: dice.value, cf });
  if (!base) return null;
  const opts = follow?.[base] ? Object.keys(follow[base]) : [];
  return opts.length > 0 ? `${base} [${opts.join("/")} - ]` : base;
}

/** Re-resolve a contest line's result after its die changed. Only touches lines
 *  that parse as a contest with a die (the feature's own working line); other
 *  lines (inserted follow-ups like `? … -> (d100=)`) are left untouched. */
function reResolveContestLine(
  line: string,
  interpret?: GMInterpret,
  follow?: Record<string, Record<string, string>>
): string {
  if (!interpret) return line;
  const arrow = line.match(/->|→/);
  if (!arrow) return line;
  const head = line.slice(0, line.indexOf(arrow[0])).replace(/\s*$/, "");
  const check = head.replace(/^\s*[A-Za-z][\w ]*?:\s+/, "").trim(); // drop a `Label: ` prefix
  const result = resolveContest(check, interpret, follow);
  if (result != null) return `${head} -> ${result}`;
  // No result: blank it only when this really is a contest line whose die was
  // cleared; otherwise leave the line (don't wipe an inserted line's content).
  const f = parseFormula(check);
  const isContest = f?.check.kind === "contest" && [f.check.left, f.check.right].some((t) => t.kind === "dice");
  return isContest ? `${head} -> ` : line;
}

/**
 * Apply a die edit to the lonelog: set the die value on the matched line, then
 * re-resolve that line's result. An APPENDED step line (its label matches a
 * loaded step carrying resolution metadata) resolves via that step's table /
 * likelihood / interpret; otherwise the entry's own contest re-resolution runs.
 * Used by the example simulator (the lonelog string is the editable state).
 */
export function applyDieEdit(
  log: string,
  source: string,
  raw: string,
  value: string,
  feature: GMFeature,
  stepCtx?: GMStepContext
): string {
  const lines = log.split("\n");
  const idx = lines.findIndex((l) => l.trim() === source);
  if (idx < 0) return log;
  let line = lines[idx].includes(raw) ? lines[idx].replace(raw, setDiceValue(raw, value)) : lines[idx];
  const label = line.match(/^\s*([^:]+):\s/)?.[1]?.trim();
  const step = label ? stepByLabel(stepCtx)[label] : undefined;
  if (step && (step.table || step.likelihood || step.interpret)) {
    line = reResolveStepLine(line, step, stepCtx, exampleCf(feature));
  } else {
    line = reResolveContestLine(line, feature.generator?.interpret, feature.generator?.follow);
  }
  lines[idx] = line;
  return lines.join("\n");
}

/** The chaos factor an example resolves against: explicit `example.cf`, else the
 *  oracle's constant `cf`. */
function exampleCf(feature: GMFeature): number | undefined {
  const ex = feature.example?.cf;
  return typeof ex === "number" ? ex : feature.oracle?.cf;
}

/** Every loaded step keyed by its choice label, for resolving appended lines. */
function stepByLabel(stepCtx?: GMStepContext): Record<string, GMStep> {
  const out: Record<string, GMStep> = {};
  for (const block of Object.values(stepCtx?.steps ?? {})) {
    for (const s of block.steps ?? []) out[s.choice] = s;
  }
  return out;
}

/**
 * Re-resolve an appended step line after its die changed: fill the `->` from the
 * step's `table` (looked-up row), `likelihood` (Fate Chart), or `interpret`
 * (comparison map). Blanks the result when the die is cleared.
 */
function reResolveStepLine(
  line: string,
  step: GMStep,
  stepCtx: GMStepContext | undefined,
  cf: number | undefined
): string {
  const arrow = line.match(/->|→/);
  if (!arrow) return line;
  const head = line.slice(0, line.indexOf(arrow[0])).replace(/\s*$/, "");
  const content = head.replace(/^\s*[^:]+:\s*/, "").trim();
  const rolled = content.match(/d\d+\s*=\s*(\d+)/i);
  if (!rolled) return `${head} -> `;
  const n = parseInt(rolled[1], 10);
  let result: string | null = null;
  if (step.table) {
    const target = parseBranchRef(step.table)?.target ?? step.table;
    const table = stepCtx?.tables?.[target];
    if (table) {
      const filled = resolveTableRoll(`${content} ->`, table).match(/->\s*(\S.*)$/);
      result = filled ? filled[1].trim() : null;
    }
  } else if (step.likelihood && cf != null) {
    result = FATE_WORDING[fateResult(n, cf, step.likelihood)];
  } else if (step.interpret) {
    result = resolveInterpret(step.interpret, { roll: n, cf }) ?? null;
  }
  return result ? `${head} -> ${result}` : `${head} -> `;
}
