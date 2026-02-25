import * as React from "react";
import type { App } from "obsidian";

export interface TitleAnchorProps extends React.HTMLAttributes<HTMLElement> {
  // aria-label or other attributes may be passed through
}

/**
 * TitleAnchor
 * Small helper component that reserves a prominent heading area and
 * displays the current file's title (vault basename) when available.
 */
export function TitleAnchor(props: TitleAnchorProps) {
  const { children, ...rest } = props;

  // Try to read the current file title from the running Obsidian `app` if available.
  const app = (globalThis as any).app as App | undefined;
  let title = "";
  try {
    const file = app?.workspace?.getActiveFile?.();
    if (file && typeof file.basename === "string") {
      title = file.basename;
    }
  } catch {
    // ignore — fall back to children or empty
  }

  return (
    <div className="rpg-title-anchor" {...rest}>
      {title || children || null}
    </div>
  );
}

export default TitleAnchor;
