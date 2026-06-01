/**
 * Per-system view registry for `rpg rule.*` import calls.
 *
 * Each system can declare named view functions (e.g., `view`, `paragraph`,
 * `listItem`, `row`, `bare`). When a markdown reader encounters a
 * `@[[file]].fn(args)` call, the rule-call-processor:
 *
 *   1. Resolves the wikilink to a file
 *   2. Reads the file (cached)
 *   3. Strips `rule.related` fences from the source
 *   4. Extracts every `rule.content` block via `extractAllRpgFences`
 *   5. If the first arg is the id of a content block, filters to that block
 *   6. Looks up `system.ruleViews[fn]` for the active system
 *   7. Invokes `entry.render(ctx, args)` per the entry's `mode`:
 *        - "join":  render called ONCE; ctx.content = bodies concatenated
 *        - "each":  render called per-block; ctx is per-block
 *        - "args":  render called per-block AND args is forwarded to it
 *   8. Mounts the returned ReactNode in place of the call token
 *
 * Render must be sync — returning `Promise<ReactNode>` is not supported.
 * If a view needs async data, fetch it before returning (or use the
 * value-resolver, which is sync after warmup).
 */

import type { ReactNode } from "react";

/**
 * How a view consumes the harvested content blocks.
 *   - `join`: bodies are concatenated into a single `ctx.content` string;
 *     `render` is called ONCE.
 *   - `each`: `render` is called once per matching content block; `ctx`
 *     is per-block.
 *   - `args`: like `each`, but the parsed call args are also forwarded
 *     to `render` (used by `row(name, action, content)` etc).
 */
export type RuleViewMode = "join" | "each" | "args";

/** Context passed to a view's `render` function. */
export interface RuleViewCtx {
  /** Filename of the imported file (no extension). */
  name: string;
  /** Body markdown of the rule.content block(s). For `mode: "join"`,
   *  this is the concatenation of all matching blocks; for `each`/`args`,
   *  it's the single block's body. */
  content: string;
  /** YAML frontmatter of the (first / only) matching block. */
  frontmatter: Record<string, unknown>;
  /** Path of the imported file, for cross-references. */
  file: string;
  /** Named parameters from the call site, template-interpolated against
   *  frontmatter. Undefined keys mean "use default". */
  params?: Record<string, unknown>;
}

/** Single named entry in a `RuleViewMap`. */
export interface RuleViewEntry {
  /** How this view consumes harvested blocks. */
  mode: RuleViewMode;
  /** Optional HTML tag to wrap all rendered items (e.g., `"ul"` for list
   *  views). When set, the call processor wraps the output array in this
   *  element so multiple items share one parent container. */
  wrapper?: string;
  /** When true, whole-file imports pass the raw file body (frontmatter and
   *  first heading stripped) without inlining rpg fences. Fences are left
   *  intact so Obsidian's code block processors render them normally. */
  raw?: boolean;
  /** Called once (mode=join) or per-block (mode=each/args). */
  render(ctx: RuleViewCtx, args?: unknown[]): ReactNode;
}

/** Per-system registry of named views. Lookup key is the function name
 *  the call site uses (`@[[file]].view()` → key `"view"`). */
export type RuleViewMap = Record<string, RuleViewEntry>;
