/**
 * Parse `@[[file]].fn(args)` call expressions.
 *
 * Distinct from the property-path form (`@[[file]].path.to.key`) handled
 * by `parse.ts`: a call REQUIRES parentheses. Without them, the path
 * parser claims the token. With them, this module claims it.
 *
 * Args grammar:
 *   - bare identifier:  `name`         → `"name"` (string)
 *   - quoted string:    `"hello"` / `'hello'`  → `"hello"`
 *   - integer:          `42`           → `42` (number)
 *   - float:            `3.14`         → `3.14` (number)
 *   - boolean:          `true` / `false` → boolean
 *   - null:             `null`         → null
 *
 * Args separator is comma. Whitespace is tolerated. Commas inside quoted
 * strings are preserved (`row("a, b", c)` is 2 args, not 3).
 *
 * Empty parens are valid: `@[[file]].view()` → `args: []`.
 */

export interface ParsedCall {
  /** Raw inner text of the wikilink (without `[[` `]]`). */
  target: string;
  /** Function name (the identifier after the dot). */
  fn: string;
  /** Parsed positional args. */
  args: unknown[];
  /** Full matched source text — for round-tripping the DOM swap. */
  source: string;
}

/**
 * Global-flag regex matching every `@[[file]].fn(args)` occurrence.
 * `args` capture is the raw inner string of the parens (may be empty,
 * may contain commas/quotes — `parseArgs` tokenizes it).
 */
export const CALL_PATTERN = /@\[\[([^\]\n]+)\]\]\.([A-Za-z_][\w-]*)\(([^)\n]*)\)/g;

/** Parse a single call expression. Returns null if the input doesn't match. */
export function parseCall(source: string): ParsedCall | null {
  const re = new RegExp(`^${CALL_PATTERN.source}$`);
  const m = source.match(re);
  if (!m) return null;
  return {
    target: m[1].trim(),
    fn: m[2],
    args: parseArgs(m[3]),
    source,
  };
}

/**
 * Stream every `@[[file]].fn(args)` occurrence in document order, with
 * precise [start, end) offsets. The post-processor uses these to slice
 * a host text node surgically.
 */
export function matchAllCalls(text: string): Array<ParsedCall & { start: number; end: number }> {
  const out: Array<ParsedCall & { start: number; end: number }> = [];
  CALL_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CALL_PATTERN.exec(text)) !== null) {
    out.push({
      target: m[1].trim(),
      fn: m[2],
      args: parseArgs(m[3]),
      source: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/* ── args tokenizer ───────────────────────────────────────────────── */

/** Tokenize the raw inner-paren string into a list of typed args. */
export function parseArgs(raw: string): unknown[] {
  const out: unknown[] = [];
  let i = 0;
  const n = raw.length;

  while (i < n) {
    // Skip leading whitespace
    while (i < n && isWs(raw[i])) i++;
    if (i >= n) break;

    const ch = raw[i];
    if (ch === '"' || ch === "'") {
      // Quoted string: find the matching closing quote (no escape handling for now).
      const end = raw.indexOf(ch, i + 1);
      if (end < 0) {
        // Unterminated quote — take everything to end of input as the value.
        out.push(raw.slice(i + 1));
        i = n;
      } else {
        out.push(raw.slice(i + 1, end));
        i = end + 1;
      }
    } else {
      // Bare token: read until the next comma at depth 0. (No paren depth
      // since the outer regex already disallows nested parens in `args`.)
      let end = i;
      while (end < n && raw[end] !== ",") end++;
      const tok = raw.slice(i, end).trim();
      i = end;
      if (tok.length > 0) out.push(coerceBareToken(tok));
    }

    // Skip the comma + any trailing whitespace.
    while (i < n && isWs(raw[i])) i++;
    if (raw[i] === ",") i++;
  }
  return out;
}

function isWs(c: string): boolean {
  return c === " " || c === "\t";
}

function coerceBareToken(tok: string): unknown {
  if (tok === "true") return true;
  if (tok === "false") return false;
  if (tok === "null") return null;
  if (/^-?\d+$/.test(tok)) return Number(tok);
  if (/^-?\d+\.\d+$/.test(tok)) return Number(tok);
  return tok;
}
