/**
 * Parse `@[[Target]].<steps…>` reference strings into a structured
 * shape the resolver can walk against cached fence-body data.
 *
 * Syntax:
 *   @[[Longsword]].item.element.cost                — dot-key walk
 *   @[[Longsword]].item.element[0].weapon.damage    — explicit index
 *   @[[Cleric]].feature.details[Spellcasting].text  — named match
 *   @[[Talon]].metadata.cssclasses[0]               — frontmatter
 *
 * The shorthand `item.element` (no index) is treated as `item.element[0]`
 * at resolve time — callers shouldn't rewrite the AST for that.
 */

/** One step in a parsed reference path. */
export type RefStep =
  | { kind: "key"; name: string }
  | { kind: "index"; index: number }
  | { kind: "named"; name: string };

/** A parsed `@[[…]].path` reference. `target` is the raw wikilink text
 *  (may include a `|alias` or `folder/Name` prefix — resolution of the
 *  actual file lives outside this module). */
export interface ParsedRef {
  /** The raw `[[…]]` inner text (without the brackets). */
  target: string;
  /** Dot/bracket path steps after the file. Empty when only `@[[File]]`
   *  was written (rare — caller decides what to do). */
  steps: RefStep[];
  /** Full matched source string, useful for round-tripping the DOM
   *  swap and for error display on unresolved references. */
  source: string;
}

/** Global-flag regex matching every `@[[File]].path` occurrence in a
 *  text block. Designed to be reused across the post-processor's text
 *  walk — compile once, reset per use. */
export const REFERENCE_PATTERN = /@\[\[([^\]\n]+)\]\]((?:\.[A-Za-z_][\w-]*|\[[^\]\n]+\])+)/g;

/**
 * Parse a single `@[[File]].path` string into a `ParsedRef`. Returns
 * null when the input doesn't match the reference grammar — callers
 * typically funnel through `matchAllReferences` and never hit this
 * null path.
 */
export function parseReference(source: string): ParsedRef | null {
  const re = new RegExp(`^${REFERENCE_PATTERN.source}$`);
  const m = source.match(re);
  if (!m) return null;
  return {
    target: m[1].trim(),
    steps: parseSteps(m[2]),
    source,
  };
}

/**
 * Stream every `@[[File]].path` reference found inside a text block,
 * in document order. Yields `ParsedRef` entries with precise start /
 * end offsets so the post-processor can slice the host text node
 * surgically without a second regex pass.
 */
export function matchAllReferences(text: string): Array<ParsedRef & { start: number; end: number }> {
  const out: Array<ParsedRef & { start: number; end: number }> = [];
  REFERENCE_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REFERENCE_PATTERN.exec(text)) !== null) {
    out.push({
      target: m[1].trim(),
      steps: parseSteps(m[2]),
      source: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/**
 * Split a step string (the part after the `@[[…]]`, starting with
 * either `.` or `[`) into its constituent steps. The pattern loop
 * peels off one step at a time — `.key` becomes `{kind:"key"}`, `[N]`
 * becomes `{kind:"index"}` when the brackets wrap a pure integer,
 * otherwise the bracket content is treated as a named match.
 */
function parseSteps(raw: string): RefStep[] {
  const steps: RefStep[] = [];
  const re = /\.([A-Za-z_][\w-]*)|\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[1] !== undefined) {
      steps.push({ kind: "key", name: m[1] });
    } else if (m[2] !== undefined) {
      const inner = m[2].trim();
      if (/^-?\d+$/.test(inner)) {
        steps.push({ kind: "index", index: Number(inner) });
      } else {
        steps.push({ kind: "named", name: inner });
      }
    }
  }
  return steps;
}
