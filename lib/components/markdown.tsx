/**
 * Thin React wrapper around Obsidian's MarkdownRenderer so feature card bodies
 * (the `text` field in `rpg feature.details`) can render full Obsidian
 * markdown — wikilinks resolve, embeds load, callouts work, etc.
 *
 * Renders into a div ref via useEffect, creating a short-lived `Component`
 * for the lifetime of the rendered output so Obsidian can attach event
 * listeners and clean up properly when the source changes or the React
 * element unmounts.
 */

import * as React from "react";
import { Component, MarkdownRenderer } from "obsidian";

export interface MarkdownProps {
  /** Source markdown text. */
  source: string;
  /**
   * Path used to resolve relative wikilinks. Defaults to empty string —
   * wikilinks still work for absolute targets but won't resolve sibling links.
   */
  sourcePath?: string;
  /** Optional className applied to the rendered container. */
  className?: string;
}

export function Markdown({
  source,
  sourcePath = "",
  className,
}: MarkdownProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.empty?.();
    container.innerHTML = "";
    if (!source) return;

    const component = new Component();
    component.load();

    // Use the modern API when available (newer Obsidian builds), otherwise
    // fall back to the deprecated renderMarkdown shim. Both accept the same
    // (source, container, sourcePath, component) tail.
    const app = (globalThis as unknown as { app?: unknown }).app as
      | { workspace?: unknown }
      | undefined;
    const renderer = MarkdownRenderer as unknown as {
      render?: (
        app: unknown,
        markdown: string,
        el: HTMLElement,
        sourcePath: string,
        component: Component,
      ) => Promise<void>;
      renderMarkdown?: (
        markdown: string,
        el: HTMLElement,
        sourcePath: string,
        component: Component,
      ) => Promise<void>;
    };

    const promise =
      typeof renderer.render === "function" && app
        ? renderer.render(app, source, container, sourcePath, component)
        : renderer.renderMarkdown?.(source, container, sourcePath, component);

    Promise.resolve(promise).catch((err) => {
      console.error("rpg-ui-toolkit Markdown: render failed", err);
    });

    return () => {
      component.unload();
    };
  }, [source, sourcePath]);

  return <div ref={ref} className={className} />;
}

export default Markdown;
