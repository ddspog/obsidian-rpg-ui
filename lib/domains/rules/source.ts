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
import type { SourceTuple } from "./types";

/** Resolve a block's source, falling back to file frontmatter. */
export function resolveSource(
  blockFrontmatter: Record<string, unknown>,
  fileFrontmatter: Record<string, unknown> | null | undefined
): SourceTuple | undefined {
  const fromBlock = coerceSource(blockFrontmatter.source);
  if (fromBlock) return fromBlock;
  if (fileFrontmatter) return coerceSource(fileFrontmatter.source);
  return undefined;
}

/**
 * Is `blockSource` homebrew relative to `contextSource`?
 *
 * When `contextSource` is undefined (no importing compendium), the check is
 * self-referential: a block without a source is flagged; a block with one is not.
 */
export function isHomebrew(
  blockSource: SourceTuple | undefined,
  contextSource: SourceTuple | undefined
): boolean {
  if (!blockSource) return true;
  if (!contextSource) return false;
  if (blockSource.system !== contextSource.system) return true;
  if (contextSource.company && blockSource.company !== contextSource.company) return true;
  if (contextSource.book && blockSource.book !== contextSource.book) return true;
  return false;
}
