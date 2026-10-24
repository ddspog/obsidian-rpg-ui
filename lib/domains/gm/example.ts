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

import type { GMDialAspect, GMFeature, GMGenStep, GMGeneratorAspect, GMInterpret, GMStep } from "../features/types";
import type { TableDef } from "../tables/types";
import type { DialDecl } from "../lonelog/dial-ops";
import { resolveConsult } from "../lonelog/list-ops";
import { emitGMFeature, generatorSteps } from "./emit";
import { answerFateQuestion, resolveInterpret } from "./fate-chart";
import { PICK_TOKEN, chooseTables, parseBranchRef, pickResult, pickSides, resolveTableRoll } from "./steps";
import { NESTED_SEP } from "../session-log/choice";
import { parseFormula, rolledValue, setDiceValue } from "../session-log/formula";

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
  /**
   * The CF dial (keyed "CF"), for `effectiveCf`'s generator `vs CF` fallback.
   * Populated from a feature's own `dial` / `reads:` links.
   */
  dials?: Record<string, GMDialAspect & { name?: string }>;
  /**
   * The generalized resource registry (session by `abbr`, PC by resource name),
   * for resolving `[<abbr>±n]` / `[<PC>/<name>±n]` ops to running values. Folds
   * in the dials above plus each feature's `resources:` declarations.
   */
  resources?: Record<string, DialDecl>;
  /**
   * Resolved `calls:` targets: a step's `calls` ref (e.g.
   * `@[[Random Event]]#random-event`) → the bare child lines to lay out
   * as its `+ ` children (`["Event Focus: d100= ->", "Event Meaning: d100= ->"]`).
   * Built by the render layer (it reads the target file's generator/step-set).
   */
  calls?: Record<string, string[]>;
  /**
   * Generator step work-label → table ref, for steps (and their composed
   * children) that roll a table inline (`GMGenStep.table`). Built by the render
   * layer alongside `tables` (which holds the loaded `TableDef` by ref).
   */
  stepTables?: Record<string, string>;
  /**
   * Generator step work-label → its `interpret` map, for a table-backed step
   * whose ROLLED RESULT is interpreted (by regex) to chain a follow-up step
   * (e.g. Event Focus "NPC Action" → `@[[Characters]]`). Distinct from the
   * roll-comparison interpret; matched against the result string.
   */
  stepFollows?: Record<string, import("../features/types").GMInterpret>;
  /**
   * Declared lonelog LISTS (keyed by name), for resolving a consult ref
   * (`[Characters?]`) chained by a step's ramification. A consult resolves to
   * the list's `default` (the testing path). Built by the render layer from the
   * `list:` features it loads (via `reads:` or a step's consult refs).
   */
  lists?: Record<string, import("../lonelog/list-ops").ListDecl>;
  /**
   * Generator NAME → its composed working lines, for a generator that builds its
   * steps from cross-file `emits:` sub-generators (Random Event = Event Focus +
   * Event Meaning). Those steps live in other files, so the render layer resolves
   * them; `expandStepBlockGens` uses this to populate an empty `gen: <name>`
   * block the same way a step block's own steps populate one.
   */
  genLines?: Record<string, string[]>;
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
    return answerFateQuestion(roll, cf, feature.oracle.likelihood).wording;
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
  const result = resultLine(baseRaw, feature.generator?.follow, stepCtx);
  if (result) {
    const withAnswer = out.replace(/->\s*(\([^)]*\))\s*$/m, `-> ${result} $1`);
    out = withAnswer !== out ? withAnswer : out.replace(/->(?=\s*$)/m, `-> ${result}`);
  }

  return out;
}

/**
 * Resolve a raw interpret value to its display result plus an optional auto-pick
 * line. A `@[[link]]` branch ref importing a step block:
 *   - NORMAL steps (`step:`) always fire — their generated lines are inserted.
 *   - `choice:` steps form the pick-one dropdown (`label [a/b - ]`); a lone
 *     choice with no normal steps auto-picks (a one-item dropdown is pointless).
 * The legacy `follow` map behaves like choices. `insert` is null when nothing to
 * append (multiple choices → the GM picks from the dropdown).
 */
function resolveBranchResult(
  baseRaw: string,
  follow: Record<string, Record<string, string>> | undefined,
  stepCtx?: GMStepContext
): { result: string; insert: string | null } {
  const ref = parseBranchRef(baseRaw);
  if (ref) {
    const all = stepCtx?.steps?.[ref.target]?.steps ?? [];
    const normal = all.filter((s) => s.step);
    const choices = all.filter((s) => s.choice);
    const inserts = normal.flatMap((s) => stepLines(s, stepCtx));
    if (choices.length === 1 && normal.length === 0) {
      inserts.push(...stepLines(choices[0], stepCtx));
      return { result: ref.label, insert: inserts.length ? inserts.join("\n") : null };
    }
    const labels = choices.map((s) => s.choice as string);
    const result = labels.length > 0 ? `${ref.label} [${labels.join("/")} - ]` : ref.label;
    return { result, insert: inserts.length ? inserts.join("\n") : null };
  }
  const options = follow?.[baseRaw];
  const flabels = options ? Object.keys(options) : [];
  if (flabels.length === 1) {
    const gen = options![flabels[0]];
    return { result: baseRaw, insert: gen?.trim() ? `${flabels[0]}: ${gen}` : null };
  }
  return { result: flabels.length > 0 ? `${baseRaw} [${flabels.join("/")} - ]` : baseRaw, insert: null };
}

/** A step's emitted line(s): its own `<label>: <calc>`, plus — when it `calls:`
 *  a sub-procedure — that procedure's steps as `+ ` children (one flat level). */
function stepLines(s: GMStep, stepCtx?: GMStepContext): string[] {
  const out: string[] = [];
  const own = stepGeneratedLine(s);
  if (own.trim()) out.push(own);
  for (const child of (s.calls ? stepCtx?.calls?.[s.calls.trim()] : undefined) ?? []) out.push(`+ ${child}`);
  return out;
}

/** The display result for a raw interpret value (label + optional dropdown), for
 *  the `example:` simulator. Auto-picks a single choice to a bare label. */
function resultLine(
  baseRaw: string | null,
  follow: Record<string, Record<string, string>> | undefined,
  stepCtx?: GMStepContext
): string | null {
  if (!baseRaw) return null;
  return resolveBranchResult(baseRaw, follow, stepCtx).result;
}

/**
 * Flatten every pickable follow-up into one option-label → generated-line map,
 * for the dropdown's pick-to-insert (consumed by `applyChoicePick`). Merges the
 * legacy generator `follow` lines with the imported step blocks' choices — a
 * step's line is the flat labeled form `"<choice>: <calc>"` (empty `calc` =
 * record the pick with no line).
 */
/** The die a table is rolled with: its header's first column (`d20`, `d6`), else `d100`. */
function tableDie(table: TableDef | undefined): string {
  const label = table?.columnLabels?.[0]?.trim() ?? "";
  return label.match(/^(\d*d\d+)\*?$/i)?.[1].toLowerCase() ?? "d100";
}

/** A word-pair line is written `<ref> d100= ->`; roll it with its own table's die instead. */
function withTableDice(line: string, tables: GMStepContext["tables"]): string {
  if (!tables) return line;
  return line.replace(/(@?\[\[[^\]\n]+\]\](?:#[\w./-]+)?)\s+d100(?==)/g, (m, ref: string) => {
    const die = tableDie(tables[ref]);
    return die === "d100" ? m : `${ref} ${die}`;
  });
}

export function gmStepLines(feature: GMFeature, stepCtx?: GMStepContext): Record<string, string> {
  const out = gmStepLinesRaw(feature, stepCtx);
  for (const [choice, line] of Object.entries(out)) out[choice] = withTableDice(line, stepCtx?.tables);
  return out;
}

function gmStepLinesRaw(feature: GMFeature, stepCtx?: GMStepContext): Record<string, string> {
  const out = gmFollowLines(feature);
  const add = (s: GMStep) => {
    if (!s.choice) return;
    out[s.choice] = stepGeneratedLine(s);
    // What a nested dropdown's option spawns, under the pick it was made below.
    for (const t of s.then ?? []) if (t.choice) out[`${s.choice}${NESTED_SEP}${t.choice}`] = stepGeneratedLine(t);
  };
  // The feature's OWN steps map its own `choices` generator's picks (a tool page
  // that declares both the picker and what each pick spawns, e.g. Event Meaning).
  for (const s of feature.steps ?? []) add(s);
  for (const step of Object.values(stepCtx?.steps ?? {})) for (const s of step.steps ?? []) add(s);
  return out;
}

/**
 * The generated line(s) a picked step inserts under the `gen:`. A note/empty
 * step yields its flat `calc` (`"<choice>: <calc>"`, or `""` to record the pick
 * with no line). A WORD-PAIR step (`tables`) yields ONE line per chosen table —
 * each a self-describing single-die table-roll, labeled `<choice> <n>` so the
 * pair re-resolves independently against its own tables. `pick` randomly selects
 * a subset (e.g. 2 of 3 Elements tables); `rng` is injectable for tests.
 */
export function stepGeneratedLine(s: GMStep, rng: () => number = Math.random): string {
  const label = s.step ?? s.choice ?? "";
  if (s.then && s.then.length > 0) {
    const kinds = s.then.map((t) => t.choice).filter((c): c is string => !!c);
    return `${s.thenLabel?.trim() || "Kind"}: [${kinds.join("/")} - ]`;
  }
  if (s.tables && s.tables.length > 0) {
    const tables = s.tables;
    return chooseTables(tables, s.pick, rng)
      .flatMap((ref, i) => {
        const at = tables.indexOf(ref);
        const row = `${s.labels?.[at]?.trim() || `${label} ${i + 1}`}: ${ref} d100= ->`;
        // A second roll, on its own row under the table's: which of the row's options it takes.
        const spec = s.choose?.[at]?.trim();
        if (!spec) return [row];
        const combine = spec.includes("+");
        return [row, `${combine ? "Combine" : "Pick one"}: @pick(${spec}) d${pickSides(spec)}= ->`];
      })
      .join("\n");
  }
  const calc = s.calc ?? "";
  return calc.trim() === "" ? "" : `${label}: ${calc}`;
}

/** Flatten a feature's follow strategies (across all results, over its top-level
 *  `generator:` aspect AND its `generators:` list, and each generator's steps)
 *  into one option-label → generated-line lookup, for the dropdown's pick. */
export function gmFollowLines(feature: GMFeature): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of [feature.generator, ...(feature.generators ?? [])]) {
    if (!g) continue;
    for (const s of generatorSteps(g)) {
      for (const byOption of Object.values(s.follow ?? {})) {
        for (const [label, line] of Object.entries(byOption)) out[label] = line;
      }
    }
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
  const stepMap = stepByLabel(stepCtx, [feature]);
  const step = label ? (stepMap[label] ?? stepMap[label.replace(/ \d+$/, "")]) : undefined;
  if (step && (step.table || step.tables || step.likelihood || step.interpret)) {
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

/** Every loaded step keyed by its label (choice OR normal `step`), for resolving
 *  appended lines. */
function stepByLabel(stepCtx?: GMStepContext, own?: GMFeature[]): Record<string, GMStep> {
  const out: Record<string, GMStep> = {};
  // A feature's OWN steps count too: a tool page may declare both a `choices`
  // generator and the step block naming what each pick spawns (Event Meaning),
  // so its picked lines must resolve without a cross-file block.
  for (const f of own ?? []) {
    for (const s of f.steps ?? []) {
      const key = s.step ?? s.choice;
      if (key) out[key] = s;
    }
  }
  for (const block of Object.values(stepCtx?.steps ?? {})) {
    for (const s of block.steps ?? []) {
      const key = s.step ?? s.choice;
      if (key) out[key] = s;
    }
  }
  return out;
}

/** A `+ label: @[[file]]#id d20=…` row's own table, as a step to resolve it by. */
function selfDescribedTable(line: string, stepCtx?: GMStepContext): GMStep | undefined {
  const ref = line.replace(/^\s*\+\s*[^:]+:\s*/, "").match(/^(@?\[\[[^\]\n]+\]\](?:#[\w./-]+)?)/)?.[1];
  return ref && stepCtx?.tables?.[ref] ? { tables: [ref] } : undefined;
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
  const n = rolledValue(content);
  if (n == null) return `${head} -> `;
  let result: string | null = null;
  if (step.table) {
    const table = stepCtx?.tables?.[step.table];
    if (table) {
      const filled = resolveTableRoll(`${content} ->`, table).match(/->\s*(\S.*)$/);
      result = filled ? filled[1].trim() : null;
    }
  } else if (step.tables) {
    // Word-pair line: the table ref is self-described at the head of the content
    // (`@[[file]]#id d100=N`), so look it up and fill from the rolled row. This
    // keeps the random Elements subset stable across re-rolls (it's baked in the
    // line, not re-derived from the step).
    const refM = content.match(/^(@?\[\[[^\]\n]+\]\](?:#[\w./-]+)?)/);
    const table = refM ? stepCtx?.tables?.[refM[1]] : undefined;
    if (table) {
      const filled = resolveTableRoll(`${content} ->`, table).match(/->\s*(\S.*)$/);
      result = filled ? filled[1].trim() : null;
    }
  } else if (step.likelihood && cf != null) {
    result = answerFateQuestion(n, cf, step.likelihood).wording;
  } else if (step.interpret) {
    result = resolveInterpret(step.interpret, { roll: n, cf }) ?? null;
  }
  return result ? `${head} -> ${result}` : `${head} -> `;
}

/** The part of a line before its `->`, without the row's label: what is being rolled. */
const rollOf = (line: string): { head: string; content: string } => {
  const arrow = line.match(/->|→/);
  const head = (arrow ? line.slice(0, line.indexOf(arrow[0])) : line).replace(/\s*$/, "");
  return { head, content: head.replace(/^\s*[^:]+:\s*/, "").trim() };
};

/**
 * Fill a second roll's result from the row above it: the nearest line that rolls a table. Left
 * as it is while either die is unrolled, and blanked when its own die is cleared.
 */
export function resolvePickLine(lines: string[], i: number, stepCtx?: GMStepContext): string {
  const { head, content } = rollOf(lines[i]);
  const spec = content.match(PICK_TOKEN)?.[1] ?? "";
  const pick = rolledValue(content);
  for (let j = i - 1; j >= 0; j--) {
    const above = rollOf(lines[j]);
    const ref = above.content.match(/^(@?\[\[[^\]\n]+\]\](?:#[\w./-]+)?)/)?.[1];
    if (!ref) continue;
    const table = stepCtx?.tables?.[ref];
    const n = rolledValue(above.content);
    // The row above reads as what it offers (`Anca / Esu + dan / bre`), not column by column.
    const offered = table && n != null ? pickResult(table, n, spec, 0) : undefined;
    if (offered) lines[j] = `${above.head} -> ${offered}`;
    const result = table && n != null && pick != null ? pickResult(table, n, spec, pick) : undefined;
    return result ? `${head} -> ${result}` : `${head} -> `;
  }
  return `${head} -> `;
}

/** Value baked into a live log body's `[<abbr>:n]` token (e.g. `[CF:5]`). */
function bodyDial(body: string, abbr: string): number | undefined {
  const esc = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = body.match(new RegExp(`\\[${esc}:\\s*(\\d+)\\s*\\]`));
  return m ? parseInt(m[1], 10) : undefined;
}

/** Chaos factor baked into a live log body's `[CF:n]` tag (the GM's session CF). */
function bodyCf(body: string): number | undefined {
  return bodyDial(body, "CF");
}

/**
 * Effective chaos factor for a body: a `[CF:n]` token if present, else the CF
 * dial's `default` (loaded via a feature's `reads:` link, keyed by abbr "CF"),
 * else undefined (the legacy "no CF available" case).
 */
function effectiveCf(body: string, stepCtx?: GMStepContext): number | undefined {
  return bodyCf(body) ?? stepCtx?.dials?.["CF"]?.default;
}

/**
 * Map generator NAME → its generator aspect, across each feature's top-level
 * `generator:` and every entry in its `generators:` list (first name wins). Lets
 * live re-resolution find a card-composed generator (declared in `generators:`),
 * not only a feature's single top-level generator aspect. A STEP-BLOCK feature
 * (invoked via `gen: <self>` to test its steps) is registered under a synthetic
 * aspect so its block is entered (its working lines resolve via their own
 * `stepTables`, not the — absent — generator interpret).
 */
function genByName(features: GMFeature[]): Record<string, GMGeneratorAspect> {
  const out: Record<string, GMGeneratorAspect> = {};
  for (const f of features) {
    if (f.generator?.name && !out[f.generator.name]) out[f.generator.name] = f.generator;
    for (const g of f.generators ?? []) if (g.name && !out[g.name]) out[g.name] = g;
    if (f.steps?.length && f.name && !out[f.name]) out[f.name] = { name: f.name };
  }
  return out;
}

/**
 * Re-resolve every GM-feature line in a LIVE log body. For each `gen: <name>`
 * matching a loaded generator (top-level `generator:` OR a `generators:` entry),
 * re-resolves its indented `label: contest -> …` lines from their current die
 * values: the primary work line via the generator's `interpret` (a branch-link
 * result becomes `label [step/step - ]`, importing the linked step block's
 * choices); an APPENDED step line via that step's `table` / `likelihood` /
 * `interpret`. Idempotent — unrolled lines and non-GM blocks are left untouched.
 * Used at save time so rolling a die surfaces the branch + dropdown (the editable
 * lonelog body is the source of truth).
 */
export function resolveGmBody(body: string, features: GMFeature[], stepCtx?: GMStepContext): string {
  const lines = body.split("\n");
  const cf = effectiveCf(body, stepCtx);
  const steps = stepByLabel(stepCtx, features);
  const gens = genByName(features);
  const soloLabels = autoInsertLabels(stepCtx);
  let cur: GMGeneratorAspect | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const genM = line.match(/^gen:\s*(.+)$/);
    if (genM) {
      cur = gens[genM[1].trim()] ?? null;
      continue;
    }
    if (!/^\s/.test(line)) {
      cur = null; // left the gen block (a new entry head)
      continue;
    }
    if (!cur || !/->|→/.test(line)) continue;
    // A second roll (`@pick(1,2+3)`): which of the rolled row above's options it takes.
    if (PICK_TOKEN.test(line)) {
      lines[i] = resolvePickLine(lines, i, stepCtx);
      continue;
    }
    const label = line.match(/^\s*([^:]+):\s/)?.[1]?.trim();
    // A generator step (or a composed `+ ` child) that rolls a table INLINE →
    // auto-fill the `->` from the matched row. Checked before the child-skip
    // below, so a `+ ` child resolves via its OWN step's table (not the parent
    // generator's interpret). The `+ ` prefix is stripped to match the step name.
    const childLabel = label?.replace(/^\+\s+/, "");
    const tableRef = childLabel ? stepCtx?.stepTables?.[childLabel] : undefined;
    if (tableRef) {
      lines[i] = reResolveStepLine(line, { table: tableRef }, stepCtx, cf);
      // Interpret the rolled RESULT (by regex) and chain the matched follow-up
      // as a nested (`+ `, one indent deeper) step — Event Focus "NPC Action" →
      // `@[[Characters]]`. Clears a stale ramification below first (so a re-roll
      // to a different / non-matching result swaps or drops it).
      const followMap = childLabel ? stepCtx?.stepFollows?.[childLabel] : undefined;
      const result = branchOf(lines[i]);
      const followRef = followMap && result ? matchResultInterpret(followMap, result) : null;
      const indent = line.match(/^\s*/)?.[0] ?? "";
      while (lines[i + 1] != null && isDeeperChild(lines[i + 1], indent)) lines.splice(i + 1, 1);
      // A follow-up that CONSULTS a list (`[Characters?]`) resolves to that
      // list's default (`Characters: a passing stranger`); other refs chain
      // as-is (a `@[[link]]` branch or plain line).
      if (followRef) {
        const consulted = resolveConsult(followRef, stepCtx?.lists);
        lines.splice(i + 1, 0, `${indent}  + ${consulted ?? followRef}`);
      }
      continue;
    }
    // A `+ ` child line belongs to a called sub-procedure, not the current
    // generator — its parent's teardown/insert manages it, so never re-resolve
    // it as one of this generator's own working lines. EXCEPT when it matches a
    // known step (a picked choice's word-pair children are `+ ` too): those
    // resolve against their OWN step, by the `+ `-stripped label.
    const ownStep = childLabel ? (steps[childLabel] ?? steps[childLabel.replace(/ \d+$/, "")]) : undefined;
    if (isChildLine(line)) {
      // A row named for its table (`Masculine name: @[[…]]#id d20=…`) has no step of
      // that label, but it names its table itself, so it fills from it.
      const rowStep = ownStep ?? selfDescribedTable(line, stepCtx);
      if (rowStep && (rowStep.table || rowStep.tables || rowStep.likelihood || rowStep.interpret)) {
        lines[i] = reResolveStepLine(line, rowStep, stepCtx, cf);
      }
      continue;
    }
    const step = label ? (steps[label] ?? steps[label.replace(/ \d+$/, "")]) : undefined;
    if (step && (step.table || step.tables || step.likelihood || step.interpret)) {
      lines[i] = reResolveStepLine(line, step, stepCtx, cf);
      continue;
    }
    // A generator working line — match it to one of the generator's steps by its
    // work-label (else a lone step) and re-resolve via that step's interpret.
    const genStep = matchGenStep(cur, label);
    if (!genStep?.interpret) continue;
    const oldBranch = branchOf(line);
    const { line: newLine, insert } = reResolveBranchLine(line, genStep.interpret, genStep.follow, stepCtx, cf);
    const newBranch = branchOf(newLine);
    const indent = line.match(/^\s*/)?.[0] ?? "";
    if (oldBranch !== newBranch) {
      // The branch RESULT changed — tear down the stale spawned subtree below
      // (the auto-inserted parent step(s) + their `+ ` children), then re-emit
      // the fresh one. Marks the spawning line with a trailing ` ...`.
      while (lines[i + 1] != null && (soloLabels.has(lineLabel(lines[i + 1])) || isChildLine(lines[i + 1]))) {
        lines.splice(i + 1, 1);
      }
      lines[i] = insert ? `${newLine} ...` : newLine;
      if (insert) lines.splice(i + 1, 0, ...insert.split("\n").map((l) => `${indent}${l}`));
    } else {
      // Same result (e.g. the reader re-rolled a CHILD die, or a parent die that
      // stays in the same band) — keep the existing subtree and its rolled-in
      // child values; only refresh the line itself.
      lines[i] = insert ? `${newLine} ...` : newLine;
    }
  }
  return lines.join("\n");
}

/**
 * Populate a `gen: <name>` invocation with the named source's OWN working lines,
 * so a `feature.gm` body can test itself just by naming the generator, while the
 * fence carries only the `?` / `=>` framing. Two sources, in order:
 *   - a STEP BLOCK feature (`gen: Interrupt Scene`) → each step's line plus its
 *     `calls:` children;
 *   - a GENERATOR composing cross-file `emits:` sub-gens (`gen: Random Event`)
 *     → the composed lines the loader resolved into `stepCtx.genLines`.
 * The generated lines are DERIVED here at render, not authored. Only fills an
 * EMPTY gen block (the next line isn't already indented), so the reader's
 * rolled-in values survive.
 */
export function expandStepBlockGens(body: string, features: GMFeature[], stepCtx?: GMStepContext): string {
  const blocks: Record<string, GMFeature> = {};
  for (const f of features) if (f.steps?.length && f.name) blocks[f.name] = f;
  const genLines = stepCtx?.genLines ?? {};
  if (Object.keys(blocks).length === 0 && Object.keys(genLines).length === 0) return body;
  const lines = body.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const m = lines[i].match(/^(\s*)gen:\s*(.+)$/);
    if (!m || /^\s/.test(lines[i + 1] ?? "")) continue; // no gen, or already populated
    const name = m[2].trim();
    const indent = `${m[1]}  `;
    // A GENERATOR of this name wins over a step block of the same name: one
    // feature may declare both (a `choices` picker generator plus the step block
    // naming what each pick spawns), and `gen:` invokes the generator — the step
    // block is the pick map, reached through the dropdown, not the `gen:` line.
    const composed = genLines[name];
    if (composed) {
      for (const line of composed) out.push(`${indent}${line}`);
      continue;
    }
    const block = blocks[name];
    if (block) {
      for (const step of block.steps ?? []) {
        for (const line of stepLines(step, stepCtx)) out.push(`${indent}${line}`);
      }
    }
  }
  return out.join("\n");
}

/** The `label:` at the head of an indented working/step line (`""` if none). */
function lineLabel(line: string): string {
  return line.match(/^\s*([^:]+):\s/)?.[1]?.trim() ?? "";
}

/** A `+ ` child line — a composed sub-step laid one flat level below its parent. */
function isChildLine(line: string): boolean {
  return /^\s*\+\s/.test(line);
}

/** A `+ ` child DEEPER than a parent line's indent — a chained ramification
 *  (e.g. Event Focus's follow-up) that its parent's re-roll manages. */
function isDeeperChild(line: string, parentIndent: string): boolean {
  return isChildLine(line) && (line.match(/^\s*/)?.[0].length ?? 0) > parentIndent.length;
}

/** First interpret entry whose key (used as a REGEX) matches the result string
 *  → its value (a follow-up ref). Exact-string fallback for an invalid regex.
 *  Null when nothing matches. */
function matchResultInterpret(interpret: GMInterpret, result: string): string | null {
  for (const [pattern, value] of Object.entries(interpret)) {
    try {
      if (new RegExp(pattern).test(result)) return value;
    } catch {
      if (pattern === result) return value;
    }
  }
  return null;
}

/** The branch RESULT a working line resolved to — the text after `->`, minus a
 *  trailing ` ...` spawn marker and any `[choice - ]` dropdown token. Used to
 *  tell a genuine branch change (re-emit the subtree) from a same-branch edit
 *  (preserve it, incl. the reader's rolled-in child values). */
function branchOf(line: string): string {
  const parts = line.split(/->|→/);
  if (parts.length < 2) return "";
  let r = parts
    .slice(1)
    .join("->")
    .trim()
    .replace(/\s*\.\.\.$/, "");
  const bracket = r.indexOf("[");
  if (bracket >= 0) r = r.slice(0, bracket).trim();
  return r;
}

/** The generator step a working line belongs to: matched by its `work` label,
 *  else the sole step when the generator has exactly one (labelless / single). */
function matchGenStep(g: GMGeneratorAspect, label: string | undefined): GMGenStep | undefined {
  const steps = generatorSteps(g);
  if (label) {
    const byWork = steps.find((s) => s.work === label);
    if (byWork) return byWork;
  }
  return steps.length === 1 ? steps[0] : undefined;
}

/** Labels whose lines are AUTO-inserted under a branch (so they can be cleared
 *  on a re-roll): every normal `step:` label, plus a step block's sole `choice:`
 *  when it has no normal steps (an auto-picked lone choice). */
function autoInsertLabels(stepCtx?: GMStepContext): Set<string> {
  const out = new Set<string>();
  for (const block of Object.values(stepCtx?.steps ?? {})) {
    const all = block.steps ?? [];
    for (const s of all) if (s.step) out.add(s.step);
    const choices = all.filter((s) => s.choice);
    if (choices.length === 1 && !all.some((s) => s.step) && choices[0].choice) out.add(choices[0].choice);
  }
  return out;
}

/** Re-resolve a primary contest line to a branch result and, for a single-choice
 *  branch, the follow-up line to auto-insert. `insert` is null otherwise. Blanks
 *  the result on a cleared die. */
function reResolveBranchLine(
  line: string,
  interpret: GMInterpret,
  follow: Record<string, Record<string, string>> | undefined,
  stepCtx: GMStepContext | undefined,
  bodyCfValue: number | undefined
): { line: string; insert: string | null } {
  const arrow = line.match(/->|→/);
  if (!arrow) return { line, insert: null };
  const head = line.slice(0, line.indexOf(arrow[0])).replace(/\s*$/, "");
  const content = head.replace(/^\s*[^:]+:\s*/, "").trim();
  const rolled = rolledValue(content);
  if (rolled == null) return { line: `${head} -> `, insert: null };
  const vsCf = content.match(/vs\s+CF\s+(\d+)/i);
  const cf = vsCf ? parseInt(vsCf[1], 10) : bodyCfValue;
  const baseRaw = resolveInterpret(interpret, { roll: rolled, cf });
  if (!baseRaw) return { line: `${head} -> `, insert: null };
  const { result, insert } = resolveBranchResult(baseRaw, follow, stepCtx);
  return { line: `${head} -> ${result}`, insert };
}
