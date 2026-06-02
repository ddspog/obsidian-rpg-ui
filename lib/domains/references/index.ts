/**
 * Domain barrel for the `@[[File]].path` reference system.
 *
 * Exposes the pure-functional parser / resolver / fence-scanner and
 * the file-content cache. The markdown post-processor + reference
 * registry that drive live reactivity live one layer up in
 * `lib/plugin/reference-processor.ts` — the reason is that those
 * consume Obsidian types (`MarkdownPostProcessorContext`,
 * `MarkdownRenderChild`) that this domain module deliberately avoids
 * to stay unit-testable without jsdom.
 */

export type { ParsedRef, RefStep } from "./parse";
export { parseReference, matchAllReferences, REFERENCE_PATTERN } from "./parse";

export type { FenceMatch } from "./fence-scan";
export { extractAllRpgFences, groupFences } from "./fence-scan";

export type { FileRefView, ResolveResult, ResolveKind } from "./resolve";
export { resolveReference } from "./resolve";

export type { VaultAdapter, CacheListener } from "./cache";
export { FileRefCache } from "./cache";
