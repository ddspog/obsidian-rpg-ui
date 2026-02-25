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

  // also try to surface any `banner` frontmatter for quick visual debugging
  let bannerValue: string | undefined = undefined;
  try {
    const file = app?.workspace?.getActiveFile?.();
    const cache = file ? app?.metadataCache?.getFileCache?.(file) : undefined;
    const fm = cache?.frontmatter as Record<string, unknown> | undefined;
    if (fm && typeof fm.banner === "string") bannerValue = fm.banner;
  } catch {
    // ignore
  }

  return (
    <div className="rpg-title-anchor" {...rest}>
      {title || children || null}
      {bannerValue ? <div className="rpg-title-banner">{bannerValue}</div> : null}
    </div>
  );
}

export default TitleAnchor;
