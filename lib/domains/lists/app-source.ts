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
      // Recurse into subfolders so a parent target (e.g. `bestiary/`, whose
      // direct children are subfolders like `families/` and `monsters/`) sweeps
      // every `.md` beneath it — not just direct children. Mirrors the inline
      // folder-call behaviour (`collectMarkdownFiles`).
      const out: ListFile[] = [];
      const walk = (dir: TFolder): void => {
        for (const child of dir.children) {
          if (child instanceof TFile && child.extension === "md") {
            out.push({ path: child.path, basename: child.basename });
          } else if (child instanceof TFolder) {
            walk(child);
          }
        }
      };
      walk(folder);
      return out.sort((a, b) => a.basename.localeCompare(b.basename));
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
      return app.metadataCache.getCache(path)?.frontmatter as Record<string, unknown> | undefined;
    },
  };
}
