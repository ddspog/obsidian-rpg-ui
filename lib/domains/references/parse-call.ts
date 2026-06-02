/**
 * Parse `@[[file]].fn(args)` call expressions, with optional chaining.
 *
 * Supports chained calls:
 *   `@[[folder/]].filter(rarity == Rare).block(item.magic).magic()`
 *
 * The last segment is the terminal (render function). All preceding
 * segments are chain operations (filter, block, etc.).
 *
 * Args grammar (positional):
 *   - bare identifier:  `name`         → `"name"` (string)
 *   - quoted string:    `"hello"` / `'hello'`  → `"hello"`
 *   - integer:          `42`           → `42` (number)
 *   - float:            `3.14`         → `3.14` (number)
 *   - boolean:          `true` / `false` → boolean
 *   - null:             `null`         → null
 *
 * Named parameters (after positional args or interspersed):
 *   - `key: value`      → params[key] = value (value parsed same as positional)
 *   - `key: "template"` → params[key] = "template" (string, may contain ${…})
 *   - `key:`            → params[key] = undefined (use default)
 *
 * Args separator is comma. Whitespace is tolerated. Commas inside quoted
 * strings are preserved (`row("a, b", c)` is 2 args, not 3).
 *
 * Empty parens are valid: `@[[file]].view()` → `args: []`.
 */

export interface ParsedArgs {
  positional: unknown[];
  named: Record<string, unknown>;
}

export interface ChainSegment {
  fn: string;
  args: unknown[];
  params: Record<string, unknown>;
}

export interface ParsedCall {
  /** Raw inner text of the wikilink (without `[[` `]]`). */
  target: string;
  /** Section fragment from `#heading` in the wikilink, if present. */
  section?: string;
  /** Function name (the terminal — last in the chain). */
  fn: string;
  /** Parsed positional args of the terminal function. */
  args: unknown[];
  /** Named parameters of the terminal function (`key: value` syntax). */
  params: Record<string, unknown>;
  /** Chain operations preceding the terminal (filter, block, etc.). */
  chain: ChainSegment[];
  /** Full matched source text — for round-tripping the DOM swap. */
  source: string;
}

/**
 * Global-flag regex matching `@[[file]].fn(args)` with optional chaining.
 * Captures: [1] target, [2] full chain string (`.fn(args)` repeated).
 * Handles `)` inside quoted strings so template expressions like
 * `"${name} (${cost})"` don't prematurely close the arg list.
 */
const ARGS_INNER = String.raw`(?:[^)"'\n]*(?:"[^"\n]*"|'[^'\n]*'))*[^)"'\n]*`;
export { ARGS_INNER };
export const CALL_PATTERN = new RegExp(
  String.raw`@\[\[([^\]\n]+)\]\]((?:\.[A-Za-z_][\w-]*\(${ARGS_INNER}\))+)`,
  "g",
);

/** Segment pattern: `.fn(args)` */
const SEGMENT_RE = new RegExp(
  String.raw`\.([A-Za-z_][\w-]*)\((${ARGS_INNER})\)`,
  "g",
);

function parseSegments(chainStr: string): ChainSegment[] {
  const segments: ChainSegment[] = [];
  SEGMENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SEGMENT_RE.exec(chainStr)) !== null) {
    const { positional, named } = parseArgs(m[2]);
    segments.push({ fn: m[1], args: positional, params: named });
  }
  return segments;
}

/** Split a wikilink target into file path and optional `#section`. */
function splitSection(raw: string): { path: string; section?: string } {
  const idx = raw.indexOf("#");
  if (idx < 0) return { path: raw };
  return { path: raw.slice(0, idx), section: raw.slice(idx + 1) };
}

/** Parse a single call expression. Returns null if the input doesn't match. */
export function parseCall(source: string): ParsedCall | null {
  const re = new RegExp(`^${CALL_PATTERN.source}$`);
  const m = source.match(re);
  if (!m) return null;
  const segments = parseSegments(m[2]);
  if (segments.length === 0) return null;
  const terminal = segments[segments.length - 1];
  const { path, section } = splitSection(m[1].trim());
  return {
    target: path,
    section,
    fn: terminal.fn,
    args: terminal.args,
    params: terminal.params,
    chain: segments.slice(0, -1),
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
    const segments = parseSegments(m[2]);
    if (segments.length === 0) continue;
    const terminal = segments[segments.length - 1];
    const { path, section } = splitSection(m[1].trim());
    out.push({
      target: path,
      section,
      fn: terminal.fn,
      args: terminal.args,
      params: terminal.params,
      chain: segments.slice(0, -1),
      source: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/* ── args tokenizer ───────────────────────────────────────────────── */

const NAMED_KEY_RE = /^([A-Za-z_]\w*)\s*:\s*/;

/** Tokenize the raw inner-paren string into positional args and named params. */
export function parseArgs(raw: string): ParsedArgs {
  const positional: unknown[] = [];
  const named: Record<string, unknown> = {};
  let i = 0;
  const n = raw.length;

  while (i < n) {
    while (i < n && isWs(raw[i])) i++;
    if (i >= n) break;

    const ch = raw[i];
    if (ch === '"' || ch === "'") {
      // Quoted string — always positional
      const end = raw.indexOf(ch, i + 1);
      if (end < 0) {
        positional.push(raw.slice(i + 1));
        i = n;
      } else {
        positional.push(raw.slice(i + 1, end));
        i = end + 1;
      }
    } else {
      // Check if this is a named param: identifier followed by `:`
      const namedMatch = raw.slice(i).match(NAMED_KEY_RE);
      if (namedMatch) {
        const key = namedMatch[1];
        i += namedMatch[0].length;
        // Skip whitespace after colon (already consumed by regex)
        while (i < n && isWs(raw[i])) i++;
        // Parse value (or undefined if comma/end)
        if (i >= n || raw[i] === ",") {
          named[key] = undefined;
        } else if (raw[i] === '"' || raw[i] === "'") {
          const qch = raw[i];
          const end = raw.indexOf(qch, i + 1);
          if (end < 0) {
            named[key] = raw.slice(i + 1);
            i = n;
          } else {
            named[key] = raw.slice(i + 1, end);
            i = end + 1;
          }
        } else {
          let end = i;
          while (end < n && raw[end] !== ",") end++;
          named[key] = coerceBareToken(raw.slice(i, end).trim());
          i = end;
        }
      } else {
        // Bare positional token: read until comma
        let end = i;
        while (end < n && raw[end] !== ",") end++;
        const tok = raw.slice(i, end).trim();
        i = end;
        if (tok.length > 0) positional.push(coerceBareToken(tok));
      }
    }

    // Skip comma + trailing whitespace
    while (i < n && isWs(raw[i])) i++;
    if (raw[i] === ",") i++;
  }
  return { positional, named };
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
