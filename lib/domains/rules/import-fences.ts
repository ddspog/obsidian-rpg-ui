/**
 * Fence handling for whole-file / heading-slice imports (`@[[file]].bare()`).
 *
 * An import inlines the target's prose into the host note. Most `rpg` fences are
 * flattened to their markdown body so the text flows inline without re-running
 * the code block processor (which would re-add standalone decorations). But a
 * few fences must survive intact, because their RENDERING is the point.
 *
 * Pure string manipulation — no Obsidian imports, so it's unit-testable.
 */

/**
 * Fence types that must survive an import intact: a `table.*` lays out a
 * rollable table, a `feature.gm` / `log` renders the interactive lonelog
 * (question, `gen:` block, dice, dropdowns), and a `figure.*` wraps a diagram.
 *
 * Flattening a lonelog would print its mechanical lines (`? …`, `gen: …`) as
 * literal prose. Flattening a figure is worse than cosmetic: its unwrapped body
 * (`flowchart TD …`) lands as loose text, and if a fence follows immediately the
 * dangling backticks get absorbed into that same paragraph — so the NEXT block
 * never opens as a code fence either.
 */
export function isProcessedFence(fenceType: string): boolean {
  return /^(table|feature\.gm|log|figure)\b/.test(fenceType);
}

/**
 * Replace all `rpg ...` fences with their markdown body (text after the `---`
 * separator), except the processor-backed ones above, which are copied through
 * verbatim. Recurses into an unwrapped body so nested fences resolve too.
 */
export function inlineContentFences(text: string): string {
  const FENCE_OPEN = /^(`{3,})rpg\s+([^\n]+)$/gm;
  let result = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_OPEN.exec(text)) !== null) {
    const ticks = m[1].length;
    const fenceType = m[2].trim();
    const headEnd = m.index + m[0].length + 1; // +1 for newline
    const closeRe = new RegExp(`^\\x60{${ticks}}\\s*$`, "m");
    const tail = text.slice(headEnd);
    const closeMatch = closeRe.exec(tail);
    if (!closeMatch) continue;
    const inner = tail.slice(0, closeMatch.index);
    const fenceEnd = headEnd + closeMatch.index + closeMatch[0].length;
    const trailingNewline = text[fenceEnd] === "\n" ? 1 : 0;
    // Preserve fences that need Obsidian's code block processor to render.
    if (isProcessedFence(fenceType)) {
      result += text.slice(cursor, fenceEnd + trailingNewline);
      cursor = fenceEnd + trailingNewline;
      FENCE_OPEN.lastIndex = cursor;
      continue;
    }
    result += text.slice(cursor, m.index);
    const sep = inner.indexOf("\n---\n");
    if (sep >= 0) {
      result += inlineContentFences(inner.slice(sep + 5));
    } else {
      const sepEnd = inner.indexOf("\n---");
      if (sepEnd >= 0 && sepEnd + 4 >= inner.length) {
        // body is empty after separator
      } else {
        result += inlineContentFences(inner);
      }
    }
    cursor = fenceEnd + trailingNewline;
    FENCE_OPEN.lastIndex = cursor;
  }
  result += text.slice(cursor);
  return result;
}
