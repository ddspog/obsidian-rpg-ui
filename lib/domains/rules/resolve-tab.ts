/**
 * Helpers for resolving a `.tab(id)` import against a file's
 * `rpg rule.content` blocks.
 *
 * `@[[file]].tab(blockId)` (and the folder form `@[[folder/]].tab(blockId)`)
 * renders a single targeted `rule.content` block instead of the whole file.
 * The resulting tab's label, icon, color, and sort order are read from that
 * block's own frontmatter (`name`/`title`, `icon`, `color`, `order`), falling
 * back to the file-level `tab-name`/`tab-icon`/`tab-color`/`tab-order` keys,
 * and finally the file name for the label.
 */

import { parseRuleContent } from "./parse-rule-block";
import type { RuleContentBlock } from "./types";
import { parseSourceDoc } from "../features/parse-source-doc";
import type { GMFeature } from "../features/types";

/**
 * Find the `rpg rule.content` block in `text` whose frontmatter `id` or
 * `name` equals `id`. Returns the parsed block (body + frontmatter), or
 * `null` when none matches. Scans line-by-line on the fence opener so it
 * works on raw file text with the fences intact.
 */
export function findRuleContentBlock(text: string, id: string): RuleContentBlock | null {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const openMatch = lines[i].match(/^(`{3,})\s*rpg\s+rule\.content\s*$/);
    if (!openMatch) continue;
    const ticks = openMatch[1].length;
    const bodyStart = i + 1;
    let bodyEnd = lines.length;
    for (let j = bodyStart; j < lines.length; j++) {
      if (lines[j].match(new RegExp(`^\`{${ticks}}\\s*$`))) {
        bodyEnd = j;
        break;
      }
    }
    const inner = lines.slice(bodyStart, bodyEnd).join("\n");
    const parsed = parseRuleContent(inner);
    if (parsed.frontmatter.id === id || parsed.frontmatter.name === id) {
      return parsed;
    }
    // Skip past the block body so a `rpg rule.content` fence nested inside
    // another block's prose can't produce a spurious second match.
    i = bodyEnd;
  }
  return null;
}

/**
 * Find a `rpg feature.gm` block in `text` by its `id` (falling back to `name`),
 * for `@[[file]].bare(id)` card dispatch. `fileName` is the target's basename
 * (used as the parse doc name). Returns the parsed `GMFeature`, or `null`.
 */
export function findGMFeatureById(text: string, fileName: string, id: string): GMFeature | null {
  const doc = parseSourceDoc({ $name: fileName, $contents: text }, "class");
  return doc.gmFeatures?.find((g) => g.id === id || g.name === id) ?? null;
}

/** Display fields + body resolved for one tab in a `.tab(id)` import. */
export interface ResolvedTabFields {
  /** Tab label. */
  name: string;
  /** Lucide icon name or emoji, if any. */
  icon?: string;
  /** Color name or hex string, if any. */
  color?: string;
  /** Sort order; `Infinity` when neither the block nor the file specify one. */
  order: number;
  /** Markdown body of the targeted content block. */
  body: string;
}

/** Coerce an unknown value to a non-empty string, else `undefined`. */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

/**
 * Resolve the tab targeting the `rule.content` block identified by `blockId`
 * within `cleaned` (file text with frontmatter intact and `rule.related` /
 * `rule.notes` fences already stripped). Returns `null` when no matching
 * block exists — callers should fall back to the whole-file body.
 *
 * Precedence: the targeted block's own frontmatter wins for
 * `name`/`icon`/`color`/`order`; the file-level `tab-name`/`tab-icon`/
 * `tab-color`/`tab-order` keys are the fallback; finally `fileName` for the
 * label.
 */
export function resolveTabBlockFields(
  cleaned: string,
  fileFm: Record<string, unknown>,
  fileName: string,
  blockId: string
): ResolvedTabFields | null {
  const block = findRuleContentBlock(cleaned, blockId);
  if (!block) return null;
  const bfm = block.frontmatter;

  const name = str(bfm.name) ?? str(bfm.title) ?? str(fileFm["tab-name"]) ?? fileName;
  const icon = str(bfm.icon) ?? str(fileFm["tab-icon"]);
  const color = str(bfm.color) ?? str(fileFm["tab-color"]);
  const order =
    typeof bfm.order === "number"
      ? bfm.order
      : typeof fileFm["tab-order"] === "number"
        ? (fileFm["tab-order"] as number)
        : Infinity;

  return { name, icon, color, order, body: block.body };
}
