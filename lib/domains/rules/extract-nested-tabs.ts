/**
 * Pure extractor for a run of `rpg rule.tab` fences embedded in a markdown
 * body string.
 *
 * Used by both `rule.content` bodies (tabs nested inside a content block)
 * and tab panels (tabs nested inside another tab) so the tab group can be
 * rendered directly from the parsed source — rather than relying on the
 * post-hoc DOM-merge pass that only reliably groups tabs at a document's
 * top level.
 */

import { parseRuleTab } from "./parse-rule-block";
import type { RuleTabBlock } from "./types";

/**
 * Scan `body` for `rpg rule.tab` fences. Returns the markdown before the
 * first tab fence (`intro`) plus every parsed tab, or `null` when the body
 * contains no tab fences. Fence boundaries are tracked by triple-backtick
 * depth so a tab body may itself contain nested fenced blocks.
 */
export function extractNestedTabs(body: string): { intro: string; tabs: RuleTabBlock[] } | null {
  const tabs: RuleTabBlock[] = [];
  let firstIdx = -1;
  const openRe = /^(`{3,})rpg\s+rule\.tab\s*$/gm;

  let m: RegExpExecArray | null;
  while ((m = openRe.exec(body)) !== null) {
    if (firstIdx < 0) firstIdx = m.index;
    const bodyStart = m.index + m[0].length + 1;
    const lines = body.slice(bodyStart).split("\n");
    let depth = 1;
    let consumed = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      const tickMatch = trimmed.match(/^(`{3,})/);
      if (tickMatch) {
        const isCloser = trimmed === tickMatch[1];
        if (isCloser) {
          depth--;
        } else {
          depth++;
        }
      }
      consumed += line.length + 1;
      if (depth === 0) {
        const tabSource = body.slice(bodyStart, bodyStart + consumed - line.length - 1);
        tabs.push(parseRuleTab(tabSource));
        break;
      }
    }
  }

  if (tabs.length === 0) return null;
  const intro = body.slice(0, firstIdx).replace(/\n+$/, "");
  return { intro, tabs };
}
