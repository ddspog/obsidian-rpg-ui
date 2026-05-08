/**
 * Inventory view.
 *
 * Dispatches between two renderers based on YAML shape:
 *   - New schema (`items:` + wikilink-resolved frontmatter) → `InventoryBlock`
 *   - Legacy schema (`sections:` + inline item data)        → `Inventory`
 *
 * The new renderer resolves each item's compendium note frontmatter
 * synchronously via `app.metadataCache`, routes items into fixed sections
 * (Weapons / Armor / Visible / Main & Other Containers), and auto-computes
 * encumbrance bands from the character's STR (via the template pipeline).
 */

import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";

import * as Tmpl from "lib/html-templates";
import { BaseView } from "./BaseView";
import { ReactMarkdown } from "./ReactMarkdown";
import { useFileContext } from "./filecontext";
import {
  createTemplateContext,
  hasTemplateVariables,
  processTemplate,
} from "lib/utils/template";
import {
  parseNewInventoryBlock,
  resolveInventory,
  type LookupFn,
  type NewInventoryBlock,
} from "lib/domains/inventory";
import { legacy as LegacyInventoryDomain } from "lib/domains/inventory";
import { InventoryBlock as InventoryBlockComponent } from "lib/components/inventory/InventoryBlock";
import { Inventory as LegacyInventoryComponent } from "lib/components/inventory/Legacy";

export class InventoryView extends BaseView {
  public codeblock = "inventory";

  public render(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): HTMLElement | string | void {
    const newBlock = parseNewInventoryBlock(source);
    if (newBlock) {
      const child = new InventoryBlockMarkdown(el, newBlock, this.app, ctx);
      ctx.addChild(child);
      return;
    }
    return this.renderLegacy(source, el, ctx);
  }

  private renderLegacy(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): string {
    const block = LegacyInventoryDomain.parseInventoryBlock(source);
    const totalWeight = LegacyInventoryDomain.calculateTotalWeight(block.sections || []);

    let capacity: number | undefined;
    if (block.encumbrance?.capacity) {
      const fc = useFileContext(this.app, ctx);
      try {
        if (hasTemplateVariables(block.encumbrance.capacity)) {
          const tctx = createTemplateContext(el, fc);
          const result = processTemplate(block.encumbrance.capacity, tctx);
          const n = Number(result);
          if (!Number.isNaN(n)) capacity = n;
        } else {
          const n = Number(block.encumbrance.capacity);
          if (!Number.isNaN(n)) capacity = n;
        }
      } catch (e) {
        console.error("DnD UI Toolkit: Error evaluating encumbrance capacity:", e);
      }
    }

    return Tmpl.Render(
      LegacyInventoryComponent({
        data: block,
        totalWeight,
        capacity,
      }),
    );
  }
}

// ─── New-schema markdown child ───────────────────────────────────────────────

class InventoryBlockMarkdown extends ReactMarkdown {
  private block: NewInventoryBlock;
  private app: App;
  private ctx: MarkdownPostProcessorContext;

  constructor(
    el: HTMLElement,
    block: NewInventoryBlock,
    app: App,
    ctx: MarkdownPostProcessorContext,
  ) {
    super(el);
    this.block = block;
    this.app = app;
    this.ctx = ctx;
  }

  onload() {
    this.renderNow();

    // Re-render when the character's frontmatter (STR) changes so the
    // encumbrance bar stays live.
    const fc = useFileContext(this.app, this.ctx);
    this.addUnloadFn(fc.onFrontmatterChange(() => this.renderNow()));
  }

  private renderNow() {
    const strength = this.resolveStrength();
    const lookup = buildLookup(this.app);
    const data = resolveInventory({ block: this.block, lookup, strength });

    if (!this.reactRoot) {
      this.reactRoot = ReactDOM.createRoot(this.containerEl);
    }
    this.reactRoot.render(React.createElement(InventoryBlockComponent, { data }));
  }

  private resolveStrength(): number {
    // Prefer explicit override on the block.
    const override = this.block.encumbrance?.strength;
    if (typeof override === "number") return override;

    const fc = useFileContext(this.app, this.ctx);
    try {
      const tctx = createTemplateContext(this.containerEl, fc);
      if (typeof override === "string") {
        const out = processTemplate(override, tctx);
        const n = Number(out);
        if (Number.isFinite(n)) return n;
      }
      // No override: read from template context (attributes block or frontmatter).
      const n = tctx.abilities.strength;
      if (Number.isFinite(n) && n > 0) return n;
      const fm = fc.frontmatter() as Record<string, unknown>;
      if (typeof fm.strength === "number") return fm.strength;
    } catch (e) {
      console.error("DnD UI Toolkit: Error resolving strength for encumbrance:", e);
    }
    return 10; // sensible default so bar isn't all-zero
  }
}

/**
 * Build a synchronous lookup over the vault's metadata cache. Looks up files
 * by exact path and by basename (mirroring Obsidian's wikilink resolution).
 */
function buildLookup(app: App): LookupFn {
  const cache: Map<string, Record<string, unknown> | undefined> = new Map();
  return (target: string): Record<string, unknown> | undefined => {
    if (!target) return undefined;
    if (cache.has(target)) return cache.get(target);

    const fm = findFrontmatter(app, target);
    cache.set(target, fm);
    return fm;
  };
}

function findFrontmatter(
  app: App,
  target: string,
): Record<string, unknown> | undefined {
  // Exact path attempts first.
  const exactAttempts = [target, `${target}.md`];
  for (const p of exactAttempts) {
    const f = app.vault.getAbstractFileByPath(p);
    if (f instanceof TFile) {
      const fm = app.metadataCache.getFileCache(f)?.frontmatter;
      if (fm) return fm as Record<string, unknown>;
    }
  }

  // Basename match across the vault (shortest path wins).
  const stem = target.split("/").pop()!.replace(/\.md$/i, "");
  const files = app.vault.getFiles().filter((f) => f.basename === stem);
  if (files.length === 0) return undefined;
  files.sort((a, b) => a.path.length - b.path.length);
  const fm = app.metadataCache.getFileCache(files[0])?.frontmatter;
  return fm as Record<string, unknown> | undefined;
}
