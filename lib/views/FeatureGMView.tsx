/**
 * feature.gm view — in-place render for `rpg feature.gm` blocks.
 *
 * GM Screen / gm-tool files declare GM features as `rpg feature.gm` fences.
 * Those blocks are primarily DATA (parsed by the session log into GM cards,
 * where their aspects define the appended log snippet), but when the file is
 * opened directly each fence renders like a `feature.details` compendium card.
 *
 * For an ENTRY feature whose `generator.interpret` results are `@[[link]]`
 * branch refs to STEP blocks on other pages, this view also loads those step
 * blocks (cross-file) so the in-card example can offer their choices as a
 * dropdown. The initial render shows the card immediately; the step blocks are
 * read asynchronously and the card re-renders with them once available.
 */

import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { BaseView } from "./BaseView";
import { ReactMarkdown } from "./ReactMarkdown";
import { parseGMFeatureBlock, parseSourceDoc } from "lib/domains/features/parse-source-doc";
import { GMFeatureCard } from "lib/components/session-log/gm-feature-card";
import type { GMFeature } from "lib/domains/features/types";
import type { TableDef } from "lib/domains/tables/types";
import type { GMStepContext } from "lib/domains/gm/example";
import { parseBranchRef, selectStepBlock } from "lib/domains/gm/steps";

class FeatureGMRenderChild extends ReactMarkdown {
  constructor(
    el: HTMLElement,
    private app: App,
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

    // Load any step blocks this feature's interpret branch links point at, then
    // re-render the card with them so the example dropdowns are populated.
    void this.loadStepCtx(feature).then((stepCtx) => {
      if (this.reactRoot && Object.keys(stepCtx.steps ?? {}).length > 0) {
        this.reactRoot.render(
          <GMFeatureCard feature={feature} sourcePath={this.sourcePath} stepCtx={stepCtx} />
        );
      }
    });
  }

  /** Resolve the feature's `generator.interpret` branch links to step blocks,
   *  plus any tables those steps roll against (for auto-fill on roll). */
  private async loadStepCtx(feature: GMFeature): Promise<GMStepContext> {
    const steps: Record<string, GMFeature> = {};
    const tables: Record<string, TableDef> = {};
    const interpret = feature.generator?.interpret ?? {};
    for (const value of Object.values(interpret)) {
      const ref = parseBranchRef(value);
      if (!ref) continue;
      const file = this.app.metadataCache.getFirstLinkpathDest(ref.target, this.sourcePath);
      if (!(file instanceof TFile)) continue;
      try {
        const content = await this.app.vault.read(file);
        const doc = parseSourceDoc({ $name: file.basename, $contents: content }, "class");
        const step = selectStepBlock(doc.gmFeatures ?? [], ref.block);
        if (step) {
          steps[ref.target] = step;
          await this.loadStepTables(step, tables);
        }
      } catch {
        /* unreadable / unparseable target — skip; the branch just has no dropdown */
      }
    }
    return { steps, tables };
  }

  /** Load each `table`-backed step's linked `rpg table.*` so its roll can
   *  auto-fill the matched row. Keyed by the step's raw `table` ref; the block
   *  id (`@[[file]]#id`) selects the specific table when a page has several. */
  private async loadStepTables(step: GMFeature, into: Record<string, TableDef>): Promise<void> {
    for (const s of step.steps ?? []) {
      if (!s.table || into[s.table]) continue;
      const ref = parseBranchRef(s.table);
      const file = this.app.metadataCache.getFirstLinkpathDest(ref?.target ?? s.table, this.sourcePath);
      if (!(file instanceof TFile)) continue;
      try {
        const content = await this.app.vault.read(file);
        const doc = parseSourceDoc({ $name: file.basename, $contents: content }, "class");
        const table = (ref?.block && doc.tables.find((t) => t.name === ref.block)) || doc.tables[0];
        if (table) into[s.table] = table;
      } catch {
        /* skip an unreadable table — the step just won't auto-fill */
      }
    }
  }
}

export class FeatureGMView extends BaseView {
  public codeblock = "feature.gm";

  // Mount React directly rather than the BaseView string path (the card body
  // needs Obsidian's async MarkdownRenderer, like feature.details).
  public register(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    ctx.addChild(new FeatureGMRenderChild(el, this.app, source, ctx.sourcePath));
  }

  // Unused — `register` handles mounting. Declared to satisfy BaseView.
  public render(): void {}
}
