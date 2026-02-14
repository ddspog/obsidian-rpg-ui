import { MarkdownPostProcessorContext } from "obsidian";

/**
 * Extracts the meta identifier from an rpg code block.
 * The meta is the word(s) after "rpg" in the fence line (e.g., "attributes" from the fence rpg attributes).
 *
 * @param ctx - The markdown post processor context
 * @param el - The HTML element containing the code block
 * @returns The meta identifier (e.g., "attributes", "skills") or null if extraction fails
 */
export function extractMeta(ctx: MarkdownPostProcessorContext, el: HTMLElement): string | null {
  try {
    const sectionInfo = ctx.getSectionInfo(el);
    if (!sectionInfo) {
      return null;
    }

    const lines = sectionInfo.text.split("\n");
    if (lines.length === 0) {
      return null;
    }

    // Find the opening fence line
    const lineStart = sectionInfo.lineStart;
    const fenceLine = lines[lineStart];

    if (!fenceLine) {
      return null;
    }

    // Match the pattern ```rpg <meta>
    const match = fenceLine.match(/^```rpg\s+(.+)$/);
    if (match && match[1]) {
      return match[1].trim();
    }

    return null;
  } catch (e) {
    console.error("Error extracting meta from code block:", e);
    return null;
  }
}
