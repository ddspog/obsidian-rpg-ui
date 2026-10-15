/**
 * Inline markdown renderer.
 *
 * Renders a short markdown string inline via Obsidian's MarkdownRenderer so
 * `[[wikilinks]]` and inline formatting resolve. Obsidian wraps rendered output
 * in a `<p>`; we unwrap a lone wrapping paragraph so the content flows inline
 * (and `++`-joined conclusions can share one line, sidebar cells stay tight).
 */

import * as React from "react";
import { Component, MarkdownRenderer } from "obsidian";
import { findActionCalls } from "lib/domains/session-log/action-call";
import { ActionCallView } from "./action-call";

export interface InlineMarkdownProps {
  source: string;
  sourcePath: string;
  className?: string;
}

/** Markdown that needs Obsidian's renderer: wikilinks, embeds, or inline formatting. */
const NEEDS_RENDER = /\[\[|!\[|`|\*|_|~~|==|\[[^\]]*\]\(/;

export function InlineMarkdown({ source, sourcePath, className }: InlineMarkdownProps) {
  // An action called on its actor's page (`@[[Kobold, Elite]].action(…)`) is
  // drawn here, not by Obsidian — which would read its `[[…]]` as a plain link.
  const calls = findActionCalls(source);
  if (calls.length > 0) {
    const parts: React.ReactNode[] = [];
    // The actor shows once a line: a second action of theirs (`… with Mystic
    // Mark`) is named alone.
    const shown = new Set<string>();
    let at = 0;
    calls.forEach((call, i) => {
      const before = source.slice(at, call.start);
      if (before) parts.push(<InlineMarkdown key={`t${i}`} source={before} sourcePath={sourcePath} />);
      const key = call.page.toLowerCase();
      parts.push(<ActionCallView key={`c${i}`} call={call} sourcePath={sourcePath} showActor={!shown.has(key)} />);
      shown.add(key);
      at = call.end;
    });
    const rest = source.slice(at);
    if (rest) parts.push(<InlineMarkdown key="rest" source={rest} sourcePath={sourcePath} />);
    return <span className={className}>{parts}</span>;
  }
  // Fast path: plain text (most sidebar rows) skips the MarkdownRenderer +
  // Component machinery entirely, which matters when a long log mounts dozens
  // of these at once.
  if (!NEEDS_RENDER.test(source)) {
    return <span className={className}>{source}</span>;
  }
  return <RenderedMarkdown source={source} sourcePath={sourcePath} className={className} />;
}

function RenderedMarkdown({ source, sourcePath, className }: InlineMarkdownProps) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    if (!source) return;

    const component = new Component();
    component.load();

    const app = (globalThis as unknown as { app?: unknown }).app;
    const renderer = MarkdownRenderer as unknown as {
      render?: (app: unknown, md: string, el: HTMLElement, path: string, c: Component) => Promise<void>;
      renderMarkdown?: (md: string, el: HTMLElement, path: string, c: Component) => Promise<void>;
    };

    const promise =
      typeof renderer.render === "function" && app
        ? renderer.render(app, source, el, sourcePath, component)
        : renderer.renderMarkdown?.(source, el, sourcePath, component);

    Promise.resolve(promise)
      .then(() => {
        const onlyP = el.querySelector(":scope > p");
        if (onlyP && el.childElementCount === 1) {
          while (onlyP.firstChild) el.insertBefore(onlyP.firstChild, onlyP);
          onlyP.remove();
        }
      })
      .catch((err) => console.error("rpg-ui-toolkit InlineMarkdown: render failed", err));

    return () => component.unload();
  }, [source, sourcePath]);

  return <span ref={ref} className={className} />;
}
