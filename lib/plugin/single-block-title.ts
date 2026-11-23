/**
 * Hides the title of a note that opens on its one `rpg` block (`singleBlockNote`):
 * its `# heading` section, and the inline title and embed title around it, in
 * reading view, hover previews and embeds. Every section of every note sets or
 * clears the mark on its view, so a view showing another note next is right.
 */

import type { App, MarkdownPostProcessorContext } from "obsidian";
import { TFile } from "obsidian";
import { namesItself, singleBlockNote, type SingleBlock } from "lib/domains/notes/single-block";

const HIDDEN_TITLE = "rpg-single-block-title";
const NOTE_MARK = "rpg-single-block-note";

interface Options {
  app: App;
  enabled: () => boolean;
}

export function buildSingleBlockTitleProcessor({ app, enabled }: Options) {
  // Text read per note and modification time, so a note is read once however many sections it has.
  const cache = new Map<string, { mtime: number; result: SingleBlock }>();

  const judge = async (path: string): Promise<SingleBlock> => {
    const file = app.vault.getAbstractFileByPath(path);
    const mtime = file instanceof TFile ? file.stat.mtime : 0;
    const hit = cache.get(path);
    if (hit && hit.mtime === mtime) return hit.result;
    // The note's own text: an embedded note's sections may carry the embedding note's.
    const text = file instanceof TFile ? await app.vault.cachedRead(file) : "";
    const result = singleBlockNote(text);
    cache.set(path, { mtime, result });
    return result;
  };

  return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    const on = enabled();
    const first = el.firstElementChild;
    const isHeading = !!first && /^H[1-6]$/.test(first.tagName);
    const apply = (result: SingleBlock) => {
      // Only over a block that prints its own name (a statblock, an item, a spell, a feature).
      const single = on && result.single && namesItself(result.meta);
      if (isHeading && single && result.heading !== undefined) {
        el.toggleClass(HIDDEN_TITLE, (first?.textContent ?? "").trim() === stripMarks(result.heading));
      }
      // The view and embed around the section only exist once it is attached.
      window.setTimeout(() => {
        el.closest(".markdown-preview-view")?.toggleClass(NOTE_MARK, single);
        el.closest(".markdown-embed")?.toggleClass(NOTE_MARK, single);
      }, 0);
    };
    void judge(ctx.sourcePath).then(apply);
  };
}

/** A heading as it renders: links and emphasis reduced to their text. */
function stripMarks(heading: string): string {
  return heading
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_, target: string, label?: string) => label ?? target)
    .replace(/[*_`]/g, "")
    .trim();
}
