/**
 * Production {@link ListSource} adapter backed by the Obsidian vault.
 *
 * Folder resolution mirrors `render-tab-group.tsx::expandFolderHeading`
 * (exact path or path-suffix match against loaded folders); files are read
 * through `cachedRead`; fallback fields come from the metadata cache.
 *
 * Kept separate from `resolve-entries.ts` so the resolver core stays
 * Obsidian-free and unit-testable.
 */

import { App, TFile, TFolder } from "obsidian";
import type { ListFile, ListSource } from "./resolve-entries";

export function appListSource(app: App): ListSource {
  return {
    listFolderFiles(folderTarget: string): ListFile[] {
      const clean = folderTarget.replace(/^\/+/, "").replace(/\/+$/, "");
      let folder: TFolder | null = null;
      const exact = app.vault.getAbstractFileByPath(clean);
      if (exact instanceof TFolder) {
        folder = exact;
      } else {
        const suffix = "/" + clean;
        for (const f of app.vault.getAllLoadedFiles()) {
          if (f instanceof TFolder && (f.path === clean || f.path.endsWith(suffix))) {
            folder = f;
            break;
          }
        }
      }
      if (!folder) return [];
      return folder.children
        .filter((f): f is TFile => f instanceof TFile && f.extension === "md")
        .sort((a, b) => a.basename.localeCompare(b.basename))
        .map((f) => ({ path: f.path, basename: f.basename }));
    },

    resolveFile(target: string, sourcePath: string): ListFile | null {
      const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
      return file instanceof TFile ? { path: file.path, basename: file.basename } : null;
    },

    async read(path: string): Promise<string | null> {
      const file = app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return null;
      try {
        return await app.vault.cachedRead(file);
      } catch {
        return null;
      }
    },

    frontmatter(path: string): Record<string, unknown> | undefined {
      return app.metadataCache.getCache(path)?.frontmatter as
        | Record<string, unknown>
        | undefined;
    },
  };
}
