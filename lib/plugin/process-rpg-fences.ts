/**
 * Scans a container for unprocessed `rpg` code fences (rendered as
 * `<pre><code class="language-rpg ...">`) and processes them into
 * live plugin components.
 *
 * Used in two places:
 *   1. main.ts multi-backtick post-processor (4+ backtick fences)
 *   2. Markdown component post-render (nested fences inside tab bodies
 *      or other rpg blocks that MarkdownRenderer.render() left as raw
 *      `<pre><code>` blocks)
 */

import { App, Component, MarkdownRenderChild, parseYaml } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import {
  subtypeFromMeta,
  parseRuleContent,
  parseRuleSide,
  parseRuleRelated,
  parseRuleNotes,
  parseRuleTab,
} from "lib/domains/rules/parse-rule-block";
import { RuleContentRenderChild } from "lib/domains/rules/render-rule-block";
import { RuleRelatedRenderChild } from "lib/domains/rules/render-related";
import { RuleNotesRenderChild } from "lib/domains/rules/render-notes";
import { RuleTabRenderChild } from "lib/domains/rules/render-tab-group";
import { parseTableBlock } from "lib/domains/tables/parse-table-block";
import { renderTableBlock } from "lib/domains/tables/render-table-block";
import { splitFenceBody } from "lib/utils/fence-split";
import { detectMetaFromSource } from "lib/utils/meta-extractor";
import type { SystemRegistry } from "lib/systems/registry";

let _registry: SystemRegistry | null = null;

export function setProcessFencesRegistry(registry: SystemRegistry): void {
  _registry = registry;
}

export function processUnrenderedRpgFences(
  container: HTMLElement,
  app: App,
  sourcePath: string,
  parent: Component
): void {
  const codeBlocks = container.querySelectorAll("pre > code[class*='language-rpg']");
  for (const code of Array.from(codeBlocks)) {
    const pre = code.parentElement;
    if (!pre) continue;
    if (pre.querySelector("[data-rpg-rule], .rpg-table-wrapper, .notice")) continue;

    const source = code.textContent ?? "";

    // Try to get meta from class (e.g. "language-rpg rule.side" → "rule.side")
    // Obsidian adds internal classes like "is-loaded" — validate the captured
    // word looks like a rpg meta identifier before accepting it.
    const classMatch = code.className.match(/language-rpg\s+(\S+)/);
    let meta: string | null = null;
    if (classMatch && /^[a-z][\w]*\.[a-z][\w-]*$/i.test(classMatch[1])) {
      meta = classMatch[1];
    }

    // Fallback: detect meta from source content when class only has "language-rpg"
    if (!meta) {
      meta = detectMetaFromSource(source);
    }
    if (!meta) continue;

    const wrapper = pre.ownerDocument.createElement("div");
    wrapper.classList.add("el-pre");
    const el = pre.ownerDocument.createElement("div");
    el.classList.add("block-language-rpg");
    wrapper.appendChild(el);
    pre.replaceWith(wrapper);

    // Handle table blocks
    if (meta === "table" || meta.startsWith("table.")) {
      const blockName = meta.startsWith("table.") ? meta.slice("table.".length) : "unnamed";
      try {
        const def = parseTableBlock(blockName, source);
        const disposers = renderTableBlock(el, def, { filePath: sourcePath });
        if (disposers.length > 0) {
          const child = new (class extends MarkdownRenderChild {
            onunload(): void {
              for (const d of disposers) d();
            }
          })(el);
          parent.addChild(child);
        }
      } catch (err) {
        el.innerHTML = `<div class="notice">Error rendering rpg ${meta}</div>`;
      }
      continue;
    }

    const ruleSubtype = subtypeFromMeta(meta);
    if (ruleSubtype) {
      try {
        if (ruleSubtype === "content" || ruleSubtype === "side") {
          const block = ruleSubtype === "content" ? parseRuleContent(source) : parseRuleSide(source);
          const child = new RuleContentRenderChild(el, app, block, sourcePath);
          parent.addChild(child);
        } else if (ruleSubtype === "related") {
          const block = parseRuleRelated(source);
          const child = new RuleRelatedRenderChild(el, app, block, sourcePath);
          parent.addChild(child);
        } else if (ruleSubtype === "notes") {
          const block = parseRuleNotes(source);
          const child = new RuleNotesRenderChild(el, app, block, sourcePath);
          parent.addChild(child);
        } else if (ruleSubtype === "tab") {
          const block = parseRuleTab(source);
          const child = new RuleTabRenderChild(el, app, block, sourcePath);
          parent.addChild(child);
        }
      } catch (err) {
        el.innerHTML = `<div class="notice">Error rendering rpg ${meta}</div>`;
      }
      continue;
    }

    // Entity blocks (feature.details, feature.level, etc.) — read-only render
    const dotIndex = meta.indexOf(".");
    if (dotIndex > 0 && _registry) {
      const entityType = meta.slice(0, dotIndex);
      const blockName = meta.slice(dotIndex + 1);
      const system = _registry.getSystemForFile(sourcePath);
      const blockDef = system?.entities?.[entityType]?.blocks?.[blockName];
      if (blockDef) {
        try {
          const { yaml, text } = splitFenceBody(source);
          const parsed = parseYaml(yaml);
          const fm = app.metadataCache.getCache(sourcePath)?.frontmatter ?? {};
          const blockParsed: Record<string, unknown> =
            parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : {};
          const self: Record<string, unknown> = { ...(fm as Record<string, unknown>), ...blockParsed };
          if (text !== undefined && !("text" in blockParsed)) {
            self.text = text;
          }
          const Comp = blockDef as unknown as React.FC<Record<string, unknown>>;
          const systemCtx = {
            skills: system.skills ?? [],
            attributes: system.attributes ?? [],
            conditions: system.conditions ?? [],
            traits: system.traits ?? [],
          };
          const root = ReactDOM.createRoot(el);
          root.render(
            React.createElement(Comp, {
              self,
              sourcePath,
              app,
              system: systemCtx,
              trigger: () => {},
              blocks: { codeBlocks: new Map() },
            })
          );
          const child = new (class extends MarkdownRenderChild {
            onunload(): void {
              try { root.unmount(); } catch { /* ignore */ }
            }
          })(el);
          parent.addChild(child);
        } catch (err) {
          el.innerHTML = `<div class="notice">Error rendering rpg ${meta}</div>`;
        }
        continue;
      }
    }
  }
}
