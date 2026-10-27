import * as React from "react";
import type { App, TFile } from "obsidian";

/** The note a block is rendered from. In a hover preview or an embed that is not the active note. */
export const SourcePathContext = React.createContext<string | undefined>(undefined);

/** The file behind the block: its own note when the renderer said which, else the active note. */
export function useSourceFile(): TFile | null {
  const sourcePath = React.useContext(SourcePathContext);
  const app = (globalThis as { app?: App }).app;
  try {
    const own = sourcePath ? app?.vault.getAbstractFileByPath(sourcePath) : null;
    if (own && "basename" in own) return own as TFile;
    return app?.workspace.getActiveFile() ?? null;
  } catch {
    return null;
  }
}
