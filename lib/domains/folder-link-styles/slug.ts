/**
 * Stable CSS-safe id for a folder path.
 *
 * The id is used as the second half of the class name
 * `rpg-folder-link--<id>` that the reading-mode post-processor and
 * Live Preview extension attach to styled anchors, and that the
 * generated stylesheet targets. It is a pure function of the folder
 * path so two entries pointing at the same folder would clash — the
 * UI de-dupes before persisting.
 */
export function slugifyFolderPath(folderPath: string): string {
  const normalized = folderPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) return "root";
  return (
    normalized
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "root"
  );
}
