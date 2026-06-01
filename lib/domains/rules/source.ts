/**
 * Source tuple resolution and homebrew classification.
 *
 * A rule block's source comes from (in order of precedence):
 *   1. The block's own `source:` frontmatter field
 *   2. The enclosing file's frontmatter `source:`
 *
 * A block is "homebrew" relative to a context tuple when:
 *   - The block has NO resolved source (missing source = homebrew), OR
 *   - The block's system differs from the context's system, OR
 *   - The block's company differs from the context's company (when context declares one), OR
 *   - The block's book differs from the context's book (when context declares one)
 *
 * The missing-source-is-homebrew rule is deliberate: it forces authors to
 * explicitly tag canonical content, so untagged content visibly stands out
 * until it's claimed.
 */

import { coerceSource } from "./parse-rule-block";
import { homebrewBySetting } from "lib/domains/lists/official-sources";
import type { SourceTuple } from "./types";

export type ResolvedSource = SourceTuple | string;

/** Flatten a resolved source to comparable free text (for the setting-driven
 *  `officialSources` match, which works on the `source:` string form). */
function sourceText(s: ResolvedSource | undefined): string | undefined {
  if (s === undefined) return undefined;
  if (typeof s === "string") return s;
  const joined = [s.system, s.book, s.company].filter(Boolean).join(" ");
  return joined || undefined;
}

/** Resolve a block's source, falling back to file frontmatter.
 *  Returns a SourceTuple when the value is a structured object, or a raw
 *  string when the frontmatter carries a free-text source attribution. */
export function resolveSource(
  blockFrontmatter: Record<string, unknown>,
  fileFrontmatter: Record<string, unknown> | null | undefined
): ResolvedSource | undefined {
  const blockRaw = blockFrontmatter.source;
  const fromBlock = coerceSource(blockRaw);
  if (fromBlock) return fromBlock;
  if (typeof blockRaw === "string" && blockRaw) return blockRaw;

  if (fileFrontmatter) {
    const fileRaw = fileFrontmatter.source;
    const fromFile = coerceSource(fileRaw);
    if (fromFile) return fromFile;
    if (typeof fileRaw === "string" && fileRaw) return fileRaw;
  }
  return undefined;
}

/**
 * Is `blockSource` homebrew relative to `contextSource`?
 *
 * When `contextSource` is undefined (no importing compendium), the check is
 * self-referential: a block without a source is flagged; a block with one is not.
 */
export function isHomebrew(
  blockSource: ResolvedSource | undefined,
  contextSource: ResolvedSource | undefined
): boolean {
  if (!blockSource) return true;
  if (!contextSource) return false;

  // Both strings: direct comparison
  if (typeof blockSource === "string" && typeof contextSource === "string") {
    return blockSource !== contextSource;
  }
  // Mixed string vs tuple: always different
  if (typeof blockSource === "string" || typeof contextSource === "string") {
    return true;
  }
  // Both tuples: structured comparison
  if (blockSource.system !== contextSource.system) return true;
  if (contextSource.company && blockSource.company !== contextSource.company) return true;
  if (contextSource.book && blockSource.book !== contextSource.book) return true;
  return false;
}

/**
 * Setting-aware homebrew verdict. When the file's system declares official
 * sources (`officialSources` in settings), homebrew is decided purely by
 * whether `blockSource` matches one of those patterns — the same global signal
 * list blocks use. Otherwise it falls back to the context-relative
 * {@link isHomebrew} (block-vs-importing-compendium comparison), so systems
 * without official sources keep their existing behavior.
 *
 * `filePath` is the note the content lives in (its mapping supplies patterns).
 */
export function isHomebrewForFile(
  blockSource: ResolvedSource | undefined,
  contextSource: ResolvedSource | undefined,
  filePath: string
): boolean {
  const bySetting = homebrewBySetting(sourceText(blockSource), filePath);
  if (bySetting !== null) return bySetting;
  return isHomebrew(blockSource, contextSource);
}
