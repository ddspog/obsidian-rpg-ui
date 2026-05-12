/**
 * Folder Link Style Manager
 *
 * Maintains a `<style id="rpg-folder-link-styles">` element in the main
 * document and every popout window, regenerating its contents from the
 * active `folderLinkStyles` setting. Mirrors `applyColorSettings` in
 * `main.ts`: called once on load and again on every settings save, plus
 * on `window-open` so detached panes pick the stylesheet up too.
 *
 * Separate from `applyColorSettings` because that one writes CSS
 * variables on `:root`; this one needs to emit full rule blocks (a
 * variable-per-style scheme doesn't fit — each entry needs a distinct
 * selector so class-based tagging can pick the right rule).
 */

import type { App } from "obsidian";
import { generateFolderLinkCss } from "lib/domains/folder-link-styles";
import type { FolderLinkStyle } from "settings";

const STYLE_ELEMENT_ID = "rpg-folder-link-styles";

function ensureStyleElement(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ELEMENT_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const el = doc.createElement("style");
  el.id = STYLE_ELEMENT_ID;
  doc.head.appendChild(el);
  return el;
}

export class FolderLinkStyleManager {
  constructor(private readonly app: App) {}

  /** Regenerate the stylesheet and push it to every open document. */
  apply(styles: readonly FolderLinkStyle[]): void {
    const css = generateFolderLinkCss(styles);
    const write = (doc: Document): void => {
      const el = ensureStyleElement(doc);
      if (el.textContent !== css) el.textContent = css;
    };
    write(document);
    this.app.workspace.iterateAllLeaves((leaf) => {
      const doc = leaf.view.containerEl.ownerDocument;
      if (doc && doc !== document) write(doc);
    });
  }

  /** Remove the managed style element from every document. Called on
   *  plugin unload so a reload doesn't leave orphaned rules styling
   *  links after the plugin is gone. */
  dispose(): void {
    const drop = (doc: Document): void => {
      doc.getElementById(STYLE_ELEMENT_ID)?.remove();
    };
    drop(document);
    this.app.workspace.iterateAllLeaves((leaf) => {
      const doc = leaf.view.containerEl.ownerDocument;
      if (doc && doc !== document) drop(doc);
    });
  }
}
