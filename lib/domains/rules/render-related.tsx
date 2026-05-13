/**
 * React renderer for `rpg rule.related`.
 *
 * Body shape: a `<section data-rpg-rule="related">` containing one entry
 * per parsed item. Each entry is either:
 *   - `<embed>` only (just the Markdown component rendering `![[file]]`)
 *   - `<heading><embed>` pair when the entry had a `Heading: ![[link]]`
 *     prefix
 *
 * The heading level is configurable per block (`level: 1–6` in the YAML
 * body); default 3.
 *
 * Strip-on-import: NOT handled here. The Phase-3 `@[[file]].fn()` call
 * processor will pre-strip `rule.related` fences from the source string
 * before passing it to a view function. Native Obsidian `![[ ]]` embeds
 * still render the related block.
 */

import { App, MarkdownRenderChild } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Markdown } from "lib/components/markdown";
import type { RuleRelatedBlock } from "./types";

function RuleRelatedView({
  block,
  sourcePath,
}: {
  block: RuleRelatedBlock;
  sourcePath: string;
}) {
  const Heading = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return (
    <section className="rpg-rule-related" data-rpg-rule="related">
      {block.entries.map((entry, i) => (
        <React.Fragment key={i}>
          {entry.heading ? <Heading className="rpg-rule-related__heading">{entry.heading}</Heading> : null}
          <Markdown source={entry.embed} sourcePath={sourcePath} />
        </React.Fragment>
      ))}
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
