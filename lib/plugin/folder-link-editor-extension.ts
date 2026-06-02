/**
 * Live Preview folder-link tagger.
 *
 * Reading mode gets folder-link classes via a markdown post-processor
 * (`folder-link-processor.ts`); Live Preview renders its internal links
 * through CodeMirror decorations, so that post-processor never runs on
 * them. This ViewPlugin fills the gap: on every editor update it walks
 * `view.dom.querySelectorAll("a.internal-link[data-href]")`, looks up
 * the resolved target in the metadata cache, and applies the same
 * class-tagging contract as the reading-mode pass.
 *
 * Anchors carry a `data-rpg-folder-tagged` marker with a snapshot hash
 * of the current style list so we can skip untouched ones cheaply and
 * still re-tag when settings change. The active file's path comes from
 * `app.workspace.getActiveFile()` — Live Preview only shows one file
 * per editor, so that's the right resolution context.
 */

import type { App, TFile } from "obsidian";
import { ViewPlugin, type PluginValue, type ViewUpdate, type EditorView } from "@codemirror/view";
import { tagAnchor } from "lib/plugin/folder-link-processor";
import type { FolderLinkStyle } from "settings";

export interface FolderLinkEditorExtensionDeps {
  app: App;
  getStyles: () => readonly FolderLinkStyle[];
  /** Token that changes whenever `folderLinkStyles` is updated — the
   *  plugin can bump it inside `saveSettings` so visible editors re-
   *  tag their anchors without waiting for the next CM update cycle. */
  getStylesVersion: () => number;
}

const TAGGED_ATTR = "data-rpg-folder-tagged";

export function buildFolderLinkEditorExtension(deps: FolderLinkEditorExtensionDeps) {
  const { app, getStyles, getStylesVersion } = deps;

  class FolderLinkViewPlugin implements PluginValue {
    private lastVersion = -1;
    constructor(view: EditorView) {
      this.tag(view);
    }
    update(u: ViewUpdate): void {
      // Re-scan when the editor's DOM changes (scrolling, typing, link
      // widgets mounting/unmounting) or when settings have been saved
      // since the previous pass.
      if (u.viewportChanged || u.docChanged || u.geometryChanged || this.lastVersion !== getStylesVersion()) {
        this.tag(u.view);
      }
    }
    private tag(view: EditorView): void {
      const styles = getStyles();
      const version = getStylesVersion();
      this.lastVersion = version;
      const activeFile: TFile | null = app.workspace.getActiveFile();
      const sourcePath = activeFile?.path ?? "";
      const anchors = view.dom.querySelectorAll<HTMLAnchorElement>("a.internal-link[data-href]");
      for (const anchor of Array.from(anchors)) {
        const marker = anchor.getAttribute(TAGGED_ATTR);
        const expected = `${version}:${anchor.getAttribute("data-href") ?? ""}`;
        if (marker === expected) continue;
        tagAnchor(app, anchor, sourcePath, styles);
        anchor.setAttribute(TAGGED_ATTR, expected);
      }
    }
  }

  return ViewPlugin.fromClass(FolderLinkViewPlugin);
}
