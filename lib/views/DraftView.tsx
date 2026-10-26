/**
 * `rpg draft` — the GM's drafting block (lib/components/draft/draft-block.tsx).
 */

import { MarkdownPostProcessorContext } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { DraftBlock } from "lib/components/draft/draft-block";
import { BaseView } from "lib/views/BaseView";
import { ReactMarkdown } from "lib/views/ReactMarkdown";

export class DraftView extends BaseView {
  public codeblock = "draft";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    ctx.addChild(new DraftMarkdown(el, source, this, ctx.sourcePath));
  }
}

class DraftMarkdown extends ReactMarkdown {
  constructor(
    el: HTMLElement,
    private source: string,
    private view: DraftView,
    private sourcePath: string
  ) {
    super(el);
  }

  onload() {
    this.reactRoot = ReactDOM.createRoot(this.containerEl);
    this.reactRoot.render(
      React.createElement(DraftBlock, { source: this.source, app: this.view.app, sourcePath: this.sourcePath })
    );
  }
}
