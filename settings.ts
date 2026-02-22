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

  ...THEMES.default.colors,
};
