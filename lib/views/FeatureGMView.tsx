/**
 * feature.gm view — in-place render for `rpg feature.gm` blocks.
 *
 * GM Screen files declare GM features as `rpg feature.gm` fences. Those blocks
 * are primarily DATA (parsed by the session log into GM cards, where their
 * oracle/roll/etc. aspects define the appended log snippet), but when the
 * screen file is opened directly each fence renders like a `feature.details`
 * compendium card so the page reads as prose rather than the "unknown block"
 * fallback. Mounts React live so the feature's `text` renders as full markdown.
 */

import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { ReactMarkdown } from "./ReactMarkdown";
import { parseGMFeatureBlock } from "lib/domains/features/parse-source-doc";
import { GMFeatureCard } from "lib/components/session-log/gm-feature-card";

class FeatureGMRenderChild extends ReactMarkdown {
  constructor(
    el: HTMLElement,
    private source: string,
    private sourcePath: string
  ) {
    super(el);
  }

  onload(): void {
    const feature = parseGMFeatureBlock(this.source);
    if (!feature) {
      this.containerEl.innerHTML = '<div class="notice">Invalid feature.gm block</div>';
      return;
    }
    this.reactRoot = ReactDOM.createRoot(this.containerEl);
    this.reactRoot.render(<GMFeatureCard feature={feature} sourcePath={this.sourcePath} />);
  }
}

export class FeatureGMView extends BaseView {
  public codeblock = "feature.gm";

  // Mount React directly rather than the BaseView string path (the card body
  // needs Obsidian's async MarkdownRenderer, like feature.details).
  public register(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    ctx.addChild(new FeatureGMRenderChild(el, source, ctx.sourcePath));
  }

  // Unused — `register` handles mounting. Declared to satisfy BaseView.
  public render(): void {}
}
