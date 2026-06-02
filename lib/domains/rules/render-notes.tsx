/**
 * React renderer for `rpg rule.notes`.
 *
 * Body shape: `<aside data-rpg-rule="notes" class="rpg-rule-notes">` with
 * the markdown body rendered inside. Semi-transparent styling reflects
 * the "private/author-local" intent — visually distinct from `rule.content`
 * (primary rule text) without hiding it.
 *
 * Strip-on-import: when the rule-call-processor reads a source file for
 * an `@[[file]].fn()` call, `rule.notes` fences are stripped from the
 * text alongside `rule.related` — see `stripLocalFences` in
 * `lib/plugin/rule-call-processor.tsx`.
 */

import { App, MarkdownRenderChild } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Markdown } from "lib/components/markdown";
import type { RuleNotesBlock } from "./types";

function RuleNotesView({
  block,
  sourcePath,
}: {
  block: RuleNotesBlock;
  sourcePath: string;
}) {
  return (
    <aside className="rpg-rule-notes" data-rpg-rule="notes">
      <Markdown source={block.body} sourcePath={sourcePath} />
    </aside>
  );
}

export class RuleNotesRenderChild extends MarkdownRenderChild {
  private root: ReactDOM.Root | null = null;

  constructor(
    el: HTMLElement,
    private readonly _app: App,
    private readonly block: RuleNotesBlock,
    private readonly sourcePath: string
  ) {
    super(el);
  }

  onload(): void {
    this.root = ReactDOM.createRoot(this.containerEl);
    this.root.render(<RuleNotesView block={this.block} sourcePath={this.sourcePath} />);
  }

  onunload(): void {
    if (this.root) {
      try {
        this.root.unmount();
      } catch (e) {
        console.error("rpg rule.notes: unmount failed", e);
      }
      this.root = null;
    }
  }
}
