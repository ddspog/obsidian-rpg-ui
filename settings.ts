import { THEMES } from "lib/themes";

/**
 * Folder-to-system mapping entry
 */
export interface SystemMapping {
  folderPaths: string[];
  systemFolderPath: string;
}

/**
 * Per-folder link style. A wikilink whose resolved target sits under
 * any of `folderPaths` (recursive prefix match) gets tagged with the
 * generated CSS class `rpg-folder-link--<id>` so the generated
 * stylesheet can restyle it. `id` is assigned once at entry creation
 * and stays stable so adding or removing paths doesn't invalidate the
 * emitted class name (and any downstream caches keyed on it).
 */
export interface FolderLinkStyle {
  id: string;
  folderPaths: string[];
  label?: string;
  color?: string;
  background?: string;
  borderStyle?: "none" | "solid" | "dashed" | "dotted" | "underline";
  borderColor?: string;
  iconPrefix?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface DndUIToolkitSettings {
  statePath: string;
  selectedTheme: string;

  // System mappings: folder path → system definition folder path
  // Empty folder path ("") represents the root/default for the entire vault
  systemMappings: SystemMapping[];

  /** Per-folder wikilink styling. Resolved link targets whose path
   *  starts with any entry in `folderPaths` get tagged with
   *  `rpg-folder-link--<id>`; the generated stylesheet drives the
   *  actual appearance. Longest prefix wins across ALL configured
   *  paths (not per-entry) when multiple entries or paths match. */
  folderLinkStyles: FolderLinkStyle[];

  /** Total time window (ms) the scroll-restore loop keeps re-applying
   *  the saved scroll position after a YAML-driven block rerender.
   *  `block-language-rpg` post-processors mount React asynchronously,
   *  growing scrollHeight after the initial paint — the loop ticks
   *  every animation frame inside this window, re-applying the saved
   *  scrollTop whenever the browser caps it short. Increase if button
   *  toggles still jump near the top of long sheets. */
  scrollRestoreDelayMs: number;

  // Color variables
  colorBgPrimary: string;
  colorBgSecondary: string;
  colorBgTertiary: string;
  colorBgHover: string;
  colorBgDarker: string;
  colorBgGroup: string;
  colorBgProficient: string;

  colorTextPrimary: string;
  colorTextSecondary: string;
  colorTextSublabel: string;
  colorTextBright: string;
  colorTextMuted: string;
  colorTextGroup: string;

  colorBorderPrimary: string;
  colorBorderActive: string;
  colorBorderFocus: string;

  colorAccentTeal: string;
  colorAccentRed: string;
  colorAccentPurple: string;
}

export const DEFAULT_SETTINGS: DndUIToolkitSettings = {
  statePath: ".dnd-ui-toolkit-state.json",
  selectedTheme: "default",
  systemMappings: [],
  folderLinkStyles: [],
  scrollRestoreDelayMs: 600,

  ...THEMES.default.colors,
};
