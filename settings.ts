import { THEMES } from "lib/themes";

/**
 * Folder-to-system mapping entry
 */
export interface SystemMapping {
  folderPaths: string[];
  systemFolderPath: string;
}

export interface DndUIToolkitSettings {
  statePath: string;
  selectedTheme: string;

  // System mappings: folder path → system definition folder path
  // Empty folder path ("") represents the root/default for the entire vault
  systemMappings: SystemMapping[];

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
  scrollRestoreDelayMs: 600,

  ...THEMES.default.colors,
};
