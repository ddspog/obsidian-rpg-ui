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
      console.error("DnD UI Toolkit: getSectionInfo returned null");
      return null;
    }

    const lines = sectionInfo.text.split("\n");
    if (lines.length === 0) {
      console.error("DnD UI Toolkit: No lines in section text");
      return null;
    }

    // Find the opening fence line
    const lineStart = sectionInfo.lineStart;
    const fenceLine = lines[lineStart];

    if (!fenceLine) {
      console.error(`DnD UI Toolkit: No fence line at index ${lineStart}`);
      return null;
    }

    console.log(`DnD UI Toolkit: Fence line: "${fenceLine}"`);

    // Match the pattern ```rpg <meta>
    // Allow for optional trailing content after the meta
    const match = fenceLine.match(/^```rpg\s+(\S+)/);
    if (match && match[1]) {
      const meta = match[1].trim();
      console.log(`DnD UI Toolkit: Extracted meta: "${meta}"`);
      return meta;
    }

    console.error(`DnD UI Toolkit: Fence line did not match expected pattern: "${fenceLine}"`);
    return null;
  } catch (e) {
    console.error("Error extracting meta from code block:", e);
    return null;
  }
}
