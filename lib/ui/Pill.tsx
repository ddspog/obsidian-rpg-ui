import * as React from "react";
import type { App } from "obsidian";
import { resolveWikiFile } from "lib/utils/wiki-file";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  link?: string; // wiki-style file reference (e.g. "Poisoned" or "folder/Note")
  children?: React.ReactNode;
}

/**
 * Pill
 * Renders a small clickable pill. If `link` is provided the pill will try to
 * resolve it to a vault path and open the file when clicked (honours cmd/ctrl
 * to open in new tab).
 */
export function Pill({ link, children, className, ...rest }: PillProps) {
  const app = (globalThis as any).app as App | undefined;

  const onClick = async (evt?: React.MouseEvent) => {
    if (!link || !app) return;
    try {
      // Normalize and resolve the wiki-style reference to a vault path
      const desc = await resolveWikiFile(app.vault as any, String(link));
      const target = typeof desc.$path === "string" ? desc.$path : String(link);
      const isNewTab = Boolean(evt && (evt.metaKey || evt.ctrlKey));
      // Use Obsidian API to open the link text (handles internal linking correctly)
      void app.workspace.openLinkText(target, "", isNewTab);
    } catch (e) {
      // Swallow errors — no-op if resolution/opening fails
    }
  };

  const classes = ["rpg-pill", className].filter(Boolean).join(" ");

  return (
    <span
      role={link ? "button" : undefined}
      tabIndex={link ? 0 : undefined}
      className={classes}
      onClick={link ? onClick : undefined}
      onKeyDown={link ? (e) => { if (e.key === "Enter") void onClick(e as any); } : undefined}
      {...rest}
    >
      <span className="rpg-pill__content">{children}</span>
    </span>
  );
}

export default Pill;
