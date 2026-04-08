import * as React from "react";
import type { App } from "obsidian";
import { AlertCircle } from "lucide-react";

export interface ConditionPillProps {
  /** Raw condition value from frontmatter (string, wikilink, array, object) */
  value: unknown;
  /** Resolved display label */
  label: string;
  /** Resolved linkpath for vault navigation */
  linkpath: string | null;
}

export function ConditionPill({ label, linkpath }: ConditionPillProps) {
  const handleClick = React.useCallback(() => {
    if (!linkpath) return;
    const app = (globalThis as any).app as App | undefined;
    if (!app) return;
    const sourcePath = app.workspace.getActiveFile()?.path ?? "";
    app.workspace.openLinkText(linkpath, sourcePath);
  }, [linkpath]);

  return (
    <button
      aria-details="Condition Pill"
      onClick={linkpath ? handleClick : undefined}
      data-linked={linkpath ? "true" : "false"}
      title={label}
    >
      <AlertCircle size={11} />
      <span>{label}</span>
    </button>
  );
}
