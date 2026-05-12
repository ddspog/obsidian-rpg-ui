/**
 * Reading-mode markdown post-processor for folder link styling.
 *
 * Walks `<a class="internal-link" data-href="…">` anchors in the
 * rendered fragment, resolves each `data-href` to a real vault file
 * through `metadataCache.getFirstLinkpathDest`, and tags anchors whose
 * resolved folder matches one of the configured `FolderLinkStyle`
 * entries with `rpg-folder-link` + `rpg-folder-link--<id>`. The
 * generated stylesheet in `FolderLinkStyleManager` does the actual
 * styling — this processor only drives the class assignment.
 *
 * `data-href` carries the raw wikilink text as authored (`Gandalf`, or
 * `People/Gandalf`), not a resolved path, so we have to consult the
 * metadata cache; a CSS-only prefix selector would miss shortname
 * links. Unresolved links (broken wikilinks) are simply skipped.
 *
 * Live Preview needs a separate CM6 extension — its link anchors are
 * rendered by the editor, not by `MarkdownRenderer`, so markdown post-
 * processors don't see them.
 */

import { MarkdownRenderChild, type App, type MarkdownPostProcessorContext } from "obsidian";
import { findMatchingStyle } from "lib/domains/folder-link-styles";
import type { FolderLinkStyle } from "settings";

export interface FolderLinkProcessorDeps {
  app: App;
  /** Returns the active style list. A getter (not a captured array) so
   *  a settings save takes effect on the next render without needing
   *  the processor to be re-registered. */
  getStyles: () => readonly FolderLinkStyle[];
}

export function buildFolderLinkProcessor(deps: FolderLinkProcessorDeps) {
  const { app, getStyles } = deps;
  return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    // Initial pass: catches every link rendered synchronously by the
    // markdown → HTML conversion.
    tagAllInSubtree(app, el, ctx.sourcePath, getStyles());

    // Late-arrival pass: character / entity blocks mount React
    // components INSIDE the element the post-processor just handled,
    // and React paints them asynchronously — so the anchors rendered
    // inside a `rpg character.spells` fence don't exist yet when the
    // initial pass ran. A scoped MutationObserver catches those
    // additions (plus any downstream re-renders) and tags them with
    // the same contract the initial pass uses.
    const observer = new MutationObserver((mutations) => {
      const styles = getStyles();
      if (styles.length === 0) return;
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLElement) {
            tagAllInSubtree(app, node, ctx.sourcePath, styles);
          }
        }
      }
    });
    observer.observe(el, { childList: true, subtree: true });

    const child = new (class extends MarkdownRenderChild {
      onunload(): void {
        observer.disconnect();
      }
    })(el);
    ctx.addChild(child);
  };
}

function tagAllInSubtree(
  app: App,
  root: HTMLElement,
  sourcePath: string,
  styles: readonly FolderLinkStyle[]
): void {
  if (styles.length === 0) return;
  // Include the root itself in case React mounted a bare anchor as the
  // root of an added subtree — `querySelectorAll` alone would miss it.
  if (root.matches?.("a.internal-link[data-href]")) {
    tagAnchor(app, root as HTMLAnchorElement, sourcePath, styles);
  }
  const anchors = root.querySelectorAll<HTMLAnchorElement>("a.internal-link[data-href]");
  for (const anchor of Array.from(anchors)) {
    tagAnchor(app, anchor, sourcePath, styles);
  }
}

export function tagAnchor(
  app: App,
  anchor: HTMLAnchorElement,
  sourcePath: string,
  styles: readonly FolderLinkStyle[]
): void {
  const dataHref = anchor.getAttribute("data-href");
  if (!dataHref) return;
  // Strip a `#heading` or `#^block` suffix before resolution — Obsidian
  // keeps those on `data-href` for anchor links but the metadata cache
  // expects a bare linkpath.
  const linkpath = dataHref.split("#")[0];
  if (!linkpath) return;
  const target = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
  if (!target) return;
  const style = findMatchingStyle(target.path, styles);
  // Clear previously applied folder-link classes so a setting change or
  // a repointed link drops the stale styling on re-render. Classes
  // assigned by other code (`internal-link`, `data-link-path`, …) are
  // untouched because we only target our own `rpg-folder-link--*`
  // namespace.
  clearFolderLinkClasses(anchor);
  if (!style) return;
  anchor.classList.add("rpg-folder-link");
  anchor.classList.add(`rpg-folder-link--${style.id}`);
}

function clearFolderLinkClasses(anchor: HTMLAnchorElement): void {
  const toRemove: string[] = [];
  anchor.classList.forEach((cls) => {
    if (cls === "rpg-folder-link" || cls.startsWith("rpg-folder-link--")) {
      toRemove.push(cls);
    }
  });
  for (const cls of toRemove) anchor.classList.remove(cls);
}
