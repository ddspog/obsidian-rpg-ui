/**
 * Expression substitution for `{{ helper args… }}` inside markdown text.
 *
 * Grammar (whitespace-tolerant, single line):
 *
 *   expr       := `{{` ws* helper (ws+ arg)* ws* `}}`
 *   helper     := identifier
 *   arg        := kwarg | value
 *   kwarg      := identifier `=` value
 *   value      := quotedString | number | identifier
 *
 * Identifiers resolve against the evaluator's `vars` context (e.g. `LV`,
 * `CLASS`). Unknown identifiers become the literal string of the identifier —
 * a cheap way to keep compendium rendering useful when character context
 * isn't attached. Helpers that can't resolve their target return the raw
 * `{{…}}` source so the reader sees exactly what was authored.
 */

import type { TableDef } from "./types";

// ─── Tokenizer + parser ───────────────────────────────────────────────────────

export type ExprValue =
  | { kind: "ident"; name: string }
  | { kind: "string"; value: string }
  | { kind: "number"; value: number };

export interface ExprCall {
  helper: string;
  args: ExprValue[];
  kwargs: Record<string, ExprValue>;
}

/** Parse `{{ ... }}` contents. Throws on unrecognised tokens. */
export function parseExpr(inner: string): ExprCall {
  const src = inner.trim();
  let i = 0;

  function peek(): string {
    return src[i] ?? "";
  }
  function skipWs(): void {
    while (i < src.length && /\s/.test(src[i])) i++;
  }
  function readIdent(): string {
    const m = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!m) throw new Error(`expected identifier at ${i} in ${JSON.stringify(src)}`);
    i += m[0].length;
    return m[0];
  }
  function readString(): string {
    if (src[i] !== '"') throw new Error(`expected \" at ${i}`);
    i++;
    let out = "";
    while (i < src.length && src[i] !== '"') {
      out += src[i++];
    }
    if (src[i] !== '"') throw new Error("unterminated string");
    i++;
    return out;
  }
  function readNumber(): number {
    const m = src.slice(i).match(/^-?\d+(?:\.\d+)?/);
    if (!m) throw new Error(`expected number at ${i}`);
    i += m[0].length;
    return Number(m[0]);
  }
  function readValue(): ExprValue {
    const c = peek();
    if (c === '"') return { kind: "string", value: readString() };
    if (c === "-" || /[0-9]/.test(c)) return { kind: "number", value: readNumber() };
    return { kind: "ident", name: readIdent() };
  }

  skipWs();
  const helper = readIdent();
  const args: ExprValue[] = [];
  const kwargs: Record<string, ExprValue> = {};
  skipWs();

  while (i < src.length) {
    // Peek for `ident=`:
    const kwMatch = src.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (kwMatch) {
      const key = kwMatch[1];
      i += kwMatch[0].length;
      skipWs();
      kwargs[key] = readValue();
    } else {
      args.push(readValue());
    }
    skipWs();
  }

  return { helper, args, kwargs };
}

// ─── Value resolution against the evaluator context ───────────────────────────

export interface EvalContext {
  /** All tables, keyed both by `<source>:<name>` and bare `<name>`. */
  tables: Record<string, TableDef>;
  /** Variable scope for identifiers — `LV`, `CLASS`, `WIS_MOD`, etc. */
  vars: Record<string, string | number>;
  /** Stable seed suffix appended to `random` when no `seed=` is supplied. */
  defaultSeed?: string;
}

/**
 * Coerce an `ExprValue` to a string under the given context. Unknown
 * identifiers round-trip as their own name so unresolved compendium
 * references still read meaningfully.
 */
function resolveValue(v: ExprValue, ctx: EvalContext): string {
  switch (v.kind) {
    case "string":
      return v.value;
    case "number":
      return String(v.value);
    case "ident": {
      const hit = ctx.vars[v.name];
      if (hit != null) return String(hit);
      return v.name;
    }
  }
}

// ─── Seeded random (mulberry32 + tiny string hash) ───────────────────────────

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWithSeed<T>(items: T[], seed: string): T | undefined {
  if (items.length === 0) return undefined;
  const rng = mulberry32(hashString(seed));
  const idx = Math.floor(rng() * items.length);
  return items[idx];
}

// ─── Table resolution ────────────────────────────────────────────────────────

/** `Cleric:progression` or bare `progression` (for same-source lookups). */
function findTable(name: string, ctx: EvalContext): TableDef | undefined {
  return ctx.tables[name] ?? ctx.tables[name.split(":").pop() ?? name];
}

function rowByKey(table: TableDef, keyValue: string): Record<string, string> | undefined {
  if (!table.keyColumn) return undefined;
  const keyIdx = table.columns.indexOf(table.keyColumn);
  if (keyIdx < 0) return undefined;
  for (const row of table.rows) {
    const cell = row.cells[keyIdx];
    if (cell && cell.value === keyValue) {
      return rowToRecord(table, row);
    }
  }
  return undefined;
}

/** Step-function lookup for sparse numeric-key tables (Destroy the Profane,
 *  Channel Divinity uses, …) where the table only lists threshold rows but
 *  the value applies for every level until the next threshold. Returns the
 *  row whose numeric key is the highest one ≤ `keyValue`. Falls back to
 *  exact match when keys aren't all numeric. */
function rowByKeyStep(table: TableDef, keyValue: string): Record<string, string> | undefined {
  if (!table.keyColumn) return undefined;
  const keyIdx = table.columns.indexOf(table.keyColumn);
  if (keyIdx < 0) return undefined;
  const target = Number(keyValue);
  if (!Number.isFinite(target)) return rowByKey(table, keyValue);
  let best: { rowKey: number; row: { cells: { value: string }[] } } | undefined;
  for (const row of table.rows) {
    const cell = row.cells[keyIdx];
    if (!cell) continue;
    const k = Number(cell.value);
    if (!Number.isFinite(k) || k > target) continue;
    if (!best || k > best.rowKey) best = { rowKey: k, row };
  }
  return best ? rowToRecord(table, best.row) : undefined;
}

function rowToRecord(table: TableDef, row: { cells: { value: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < table.columns.length; i++) {
    out[table.columns[i]] = row.cells[i]?.value ?? "";
  }
  return out;
}

// ─── Helper registry ─────────────────────────────────────────────────────────

type Helper = (call: ExprCall, ctx: EvalContext) => string | undefined;

const HELPERS: Record<string, Helper> = {
  /**
   * `table "Cleric:progression" row=LV col="cantrips"` — one cell.
   * `table "progression" row=LV` — row as `key=value; key=value` string.
   * `table "destroy-the-profane" row=CLASS_LEVEL col="cr" step=true` —
   *   step-function lookup: the highest numeric key ≤ row wins. Use this
   *   for sparse tables that only list threshold rows (per-level features
   *   that change at certain milestones).
   */
  table(call, ctx) {
    const name = call.args[0];
    if (!name) return undefined;
    const tableName = resolveValue(name, ctx);
    const t = findTable(tableName, ctx);
    if (!t) return undefined;

    const rowExpr = call.kwargs.row;
    if (!rowExpr) return undefined;
    const rowValue = resolveValue(rowExpr, ctx);

    const stepExpr = call.kwargs.step;
    const stepFlag = stepExpr ? resolveValue(stepExpr, ctx).toLowerCase() : "";
    const isStep = stepFlag === "true" || stepFlag === "1" || stepFlag === "yes";

    const record = isStep ? rowByKeyStep(t, rowValue) : rowByKey(t, rowValue);
    if (!record) return undefined;

    const colExpr = call.kwargs.col;
    if (!colExpr) {
      return Object.entries(record)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
    }
    const colKey = resolveValue(colExpr, ctx);
    const normalized = colKey.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    return record[normalized] ?? record[colKey];
  },

  /**
   * `random "wild-surge" col="effect" seed=CHAR_ID` — one random cell.
   * Without `col=`, returns a single random row formatted as `a | b | c`.
   */
  random(call, ctx) {
    const nameExpr = call.args[0];
    if (!nameExpr) return undefined;
    const tableName = resolveValue(nameExpr, ctx);
    const t = findTable(tableName, ctx);
    if (!t || t.rows.length === 0) return undefined;

    const seedExpr = call.kwargs.seed;
    const seed = seedExpr ? resolveValue(seedExpr, ctx) : `${tableName}:${ctx.defaultSeed ?? ""}`;
    const row = pickWithSeed(t.rows, seed);
    if (!row) return undefined;

    const record = rowToRecord(t, row);
    const colExpr = call.kwargs.col;
    if (!colExpr) return row.cells.map((c) => c.value).join(" | ");
    const colKey = resolveValue(colExpr, ctx);
    const normalized = colKey.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    return record[normalized] ?? record[colKey];
  },

  /** `tableRows "progression"` — row count as a decimal string. */
  tableRows(call, ctx) {
    const nameExpr = call.args[0];
    if (!nameExpr) return undefined;
    const t = findTable(resolveValue(nameExpr, ctx), ctx);
    return t ? String(t.rows.length) : undefined;
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Find every `{{ ... }}` expression in `source`, evaluate it, and return the
 * substituted string. Helpers that fail to resolve leave the original
 * `{{ ... }}` text in place so authors can see unresolved references. Parse
 * errors likewise leave the original text intact and log a console warn.
 */
export function substituteExpressions(source: string, ctx: EvalContext): string {
  // Pre-pass: `{{ leveled: { 1: 1d4, 6: 1d6, 13: 1d8, 17: 1d10 } }}` — step
  // function keyed by the character's class level. Picks the highest key ≤
  // `CLASS_LEVEL`. Nested `{…}` braces make this incompatible with the
  // generic `{{helper args}}` grammar below, so we handle it separately
  // before the main parser runs. The colon between `leveled` and the map
  // is optional so both `leveled: { … }` and `leveled { … }` parse.
  const withLeveled = source.replace(/\{\{\s*leveled\s*:?\s*\{([^{}]*)\}\s*\}\}/g, (match, body) => {
    const levelRaw = ctx.vars["CLASS_LEVEL"] ?? ctx.vars["LV"];
    const level = typeof levelRaw === "number" ? levelRaw : Number(levelRaw);
    if (!Number.isFinite(level)) return match;
    let best: { key: number; value: string } | null = null;
    for (const entry of String(body).split(",")) {
      const m = entry.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
      if (!m) continue;
      const key = parseInt(m[1], 10);
      if (!Number.isFinite(key) || key > level) continue;
      if (!best || key > best.key) best = { key, value: m[2] };
    }
    return best?.value ?? match;
  });
  return withLeveled.replace(/\{\{([^{}]+)\}\}/g, (match, inner) => {
    try {
      const call = parseExpr(inner);
      const helper = HELPERS[call.helper];
      if (!helper) return match;
      const result = helper(call, ctx);
      return result ?? match;
    } catch (err) {
      console.warn("[rpg-ui-toolkit] expression parse failed:", inner, err);
      return match;
    }
  });
}
