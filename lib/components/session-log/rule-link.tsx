/**
 * A link to a rules note in the vault: a click opens it (a new tab with Cmd/Ctrl), a hover previews it, as
 * any internal link does.
 */

import * as React from "react";
import type { App } from "obsidian";

const appOf = (): App | undefined => (globalThis as unknown as { app?: App }).app;

export interface RuleLinkProps {
  /** The note's path in the vault, without `.md`. */
  note: string;
  /** The note the link is in, so the link resolves from it. */
  sourcePath: string;
  children: React.ReactNode;
}

export function RuleLink({ note, sourcePath, children }: RuleLinkProps) {
  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    void appOf()?.workspace.openLinkText(note, sourcePath, e.metaKey || e.ctrlKey);
  };
  const preview = (e: React.MouseEvent) => {
    appOf()?.workspace.trigger("hover-link", {
      event: e.nativeEvent,
      source: "preview",
      hoverParent: { hoverPopover: null },
      targetEl: e.currentTarget,
      linktext: note,
      sourcePath,
    });
  };
  return (
    <a
      className="internal-link placeholder-rule-link"
      href={note}
      data-href={note}
      onClick={open}
      onMouseOver={preview}
    >
      {children}
    </a>
  );
}
