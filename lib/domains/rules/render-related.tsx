/**
 * React renderer for `rpg rule.related`.
 *
 * Body shape: a `<section data-rpg-rule="related">` containing one entry
 * per parsed item. Each entry is one of:
 *   - `embed` — Markdown component rendering `![[file]]` (Obsidian transclusion)
 *   - `markdown` — arbitrary markdown, may contain `@[[file]].fn()` call
 *     tokens. Bare call tokens are auto-wrapped in backticks so the call
 *     processor's code-element strategy fires on the rendered DOM.
 *   - optionally prefixed by a `<heading>` when the entry had a key.
 *
 * Heading level: configurable per block (`level: 1–6`); default 3.
 *
 * Strip-on-import: the call processor pre-strips `rule.related` fences
 * from imported file bodies. Native Obsidian `![[ ]]` embeds still
 * render the related block inline.
 */

import { App, MarkdownRenderChild } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Markdown } from "lib/components/markdown";
import type { RuleRelatedBlock, RelatedEntry } from "./types";

const CALL_RE = /@\[\[[^\]\n]+\]\]\.[A-Za-z_][\w-]*\([^)\n]*\)/;

/**
 * If the source is a bare call token (e.g., `@[[Luck]].h2()`), wrap in
 * backticks so the call processor's code-element scan picks it up.
 * Without backticks, Obsidian's markdown parser would split [[…]] into
 * an `<a>` wikilink before the call processor runs.
 */
function prepareMarkdownSource(source: string): string {
  const trimmed = source.trim();
  if (CALL_RE.test(trimmed) && !trimmed.startsWith("`")) {
    return `\`${trimmed}\``;
  }
  return source;
}

function RuleRelatedView({
  block,
  sourcePath,
}: {
  block: RuleRelatedBlock;
  sourcePath: string;
}) {
  const Heading = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  function renderEntry(entry: RelatedEntry, i: number) {
    const source = entry.embed ?? (entry.markdown ? prepareMarkdownSource(entry.markdown) : "");
    return (
      <React.Fragment key={i}>
        {entry.heading ? <Heading className="rpg-rule-related__heading">{entry.heading}</Heading> : null}
        {source ? <Markdown source={source} sourcePath={sourcePath} /> : null}
      </React.Fragment>
    );
  }

  return (
    <section className="rpg-rule-related" data-rpg-rule="related">
      {block.view === "footer" ? <hr /> : null}
      {block.entries.map(renderEntry)}
    </section>
  );
}

export class RuleRelatedRenderChild extends MarkdownRenderChild {
  private root: ReactDOM.Root | null = null;

  constructor(
    el: HTMLElement,
    private readonly _app: App,
    private readonly block: RuleRelatedBlock,
    private readonly sourcePath: string
  ) {
    super(el);
  }

  onload(): void {
    this.root = ReactDOM.createRoot(this.containerEl);
    this.root.render(<RuleRelatedView block={this.block} sourcePath={this.sourcePath} />);
  }

  onunload(): void {
    if (this.root) {
      try {
        this.root.unmount();
      } catch (e) {
        console.error("rpg rule.related: unmount failed", e);
      }
      this.root = null;
    }
  }
}
