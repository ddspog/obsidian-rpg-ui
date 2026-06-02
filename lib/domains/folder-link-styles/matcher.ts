import type { FolderLinkStyle } from "settings";

/**
 * Normalize a folder path for prefix matching — strips leading/trailing
 * slashes and collapses backslashes. Mirrors the form produced by the
 * settings UI so both sides agree on the canonical representation.
 */
export function normalizeFolderPath(folderPath: string): string {
  return folderPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

/**
 * Find the style whose configured folder path is the longest prefix of
 * the resolved link target. Longest-prefix wins so a more specific
 * entry (e.g. `People/Villains`) beats a looser ancestor (`People`)
 * when both apply — and the comparison is *across* entries, not just
 * within one, so splitting the two into separate entries (with
 * different styling) still resolves correctly.
 *
 * Empty folder paths are ignored deliberately — the user explicitly
 * opted out of a default/root catch-all, so the theme can own the
 * fallback style for unmatched links. Returns `null` when no entry
 * matches.
 */
export function findMatchingStyle(targetPath: string, styles: readonly FolderLinkStyle[]): FolderLinkStyle | null {
  const path = normalizeFolderPath(targetPath);
  let best: FolderLinkStyle | null = null;
  let bestLen = -1;
  for (const style of styles) {
    for (const raw of style.folderPaths) {
      const folder = normalizeFolderPath(raw);
      if (!folder) continue;
      const prefix = folder + "/";
      if (path === folder || path.startsWith(prefix)) {
        if (folder.length > bestLen) {
          best = style;
          bestLen = folder.length;
        }
      }
    }
  }
  return best;
}
