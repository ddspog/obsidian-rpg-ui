import type { App } from "obsidian";

/**
 * getFileTitle
 * Extracts the active file's basename from the running Obsidian `app` if available.
 */
export function getFileTitle(app: App | undefined): string | undefined {
  try {
    const file = app?.workspace?.getActiveFile?.();
    if (file && typeof file.basename === "string") return file.basename;
  } catch {
    // ignore
  }
  return undefined;
}

export default getFileTitle;
