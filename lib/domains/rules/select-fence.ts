/**
 * Positional fence-body selection for the `.hN(index)` heading terminal.
 *
 * `@[[folder/]].h4(0)` should render each file's FIRST block, whatever its
 * entity — a `feature.details` intro, an `item.element`, or a
 * `rule.content`. Unlike `findContentBlockById` (which only matches
 * `rule.content` blocks by `id`/`name`), this selects ANY rpg fence by its
 * position in document order, so index `0` is always the first fence.
 *
 * Callers strip `rule.related` / `rule.notes` fences first (those are
 * local-only), so they never count toward the index.
 */

import { extractAllRpgFences } from "lib/domains/references/fence-scan";

/**
 * Pluck the inner text of a fence given its `[start, end)` offsets,
 * dropping the trailing closing-backtick line. Mirrors the slicing used by
 * the rule-call processor's block extractors.
 */
export function sliceFenceInner(text: string, start: number, end: number): string {
  const headEnd = text.indexOf("\n", start);
  if (headEnd < 0 || headEnd >= end) return "";
  const body = text.slice(headEnd + 1, end);
  // Strip the closing fence line (a line of only backticks at the end).
  const stripped = body.replace(/\n?`{3,}\s*$/, "");
  return stripped.replace(/\n$/, "");
}

/**
 * Strip the YAML head (everything up to and including the first standalone
 * `---` line) from a fence's inner text, returning the trimmed markdown
 * body. A fence with no separator is treated as all-body.
 */
export function fenceBodyMarkdown(inner: string): string {
  const lines = inner.split("\n");
  const sepIdx = lines.findIndex((l) => l.trim() === "---");
  const body = sepIdx >= 0 ? lines.slice(sepIdx + 1).join("\n") : inner;
  return body.replace(/^\n+/, "").replace(/\n+$/, "");
}

/**
 * Return the markdown body of the rpg fence at `index` (document order),
 * or `null` when the index is out of range or not a non-negative integer.
 */
export function selectFenceBodyByIndex(text: string, index: number): string | null {
  if (!Number.isInteger(index) || index < 0) return null;
  const fences = extractAllRpgFences(text);
  if (index >= fences.length) return null;
  const f = fences[index];
  return fenceBodyMarkdown(sliceFenceInner(text, f.start, f.end));
}
