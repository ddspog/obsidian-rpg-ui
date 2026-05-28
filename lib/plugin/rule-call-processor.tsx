/**
 * Markdown post-processor that turns `@[[file]].fn(args)` inline calls
 * into rendered React output via the per-system `RuleViewMap`.
 *
 *   Original text → `…some prose `@[[rules/luck]].view()` more prose…`
 *   Rendered HTML → `…some prose <span class="rpg-call">…rendered view…</span> more prose…`
 *
 * Architecture mirrors `reference-processor.ts`:
 *   1. Unwrap inline `<code>` spans whose content is a single call
 *      token (authors backtick-wrap to dodge Obsidian's wikilink parser).
 *   2. Walk text nodes (skipping `<pre>`, `<a>`, and our own
 *      `.rpg-call` spans), find call tokens via `matchAllCalls`.
 *   3. Splice each match out of its host text node, replace with a
 *      placeholder span, and asynchronously resolve.
 *
 * Resolution per call:
 *   a. Resolve target wikilink → file path
 *   b. Read file via `FileRefCache`
 *   c. Strip `rule.related` fences from source (Phase 2 deferred this)
 *   d. Extract `rule.content` fences via `extractAllRpgFences`
 *   e. If `args[0]` matches a content block's `id`, filter to that block
 *      and shift the args array (rest are passed to render)
 *   f. Look up `system.ruleViews[fn]` for the active system at
 *      `ctx.sourcePath`
 *   g. Invoke `entry.render(ctx, args)` per the entry's mode
 *      (join | each | args)
 *   h. Mount returned ReactNode(s) into the placeholder span
 *
 * Render is sync — view functions return ReactNode, not Promise.
 */

import { App, Component, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer, parseYaml, TFile, TFolder } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { matchAllCalls, type ParsedCall, type ChainSegment, CALL_PATTERN } from "lib/domains/references/parse-call";
import { extractAllRpgFences } from "lib/domains/references/fence-scan";
import { parseFilterExpr, evaluateFilter } from "lib/domains/references/filter-expr";
import type { FileRefCache } from "lib/domains/references";
import { parseRuleContent } from "lib/domains/rules/parse-rule-block";
import { TabGroupView } from "lib/domains/rules/render-tab-group";
import type { RuleTabBlock } from "lib/domains/rules/types";
import { Markdown } from "lib/components/markdown";
import { StatblockVehicle } from "lib/components/statblock-vehicle";
import { resolveStatFeatures } from "lib/domains/statblocks/resolve-features";
import type { ResolvedStatFeature } from "lib/domains/statblocks/types";
import type { SystemRegistry } from "lib/systems/registry";
import type { RuleViewCtx, RuleViewEntry, RuleViewMode } from "lib/systems/rule-views";

export interface RuleCallProcessorDeps {
  app: App;
  cache: FileRefCache;
  registry: SystemRegistry;
}

const SKIP_TAGS = new Set(["A", "PRE"]);
const CALL_CLASS = "rpg-call";

/** Normalize a source string for comparison (strip YAML escape artifacts). */
function normalizeSource(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\'/g, "'");
}

/** Extract the `.highlight()` chain segment (if present) and return its args. */
function extractHighlight(chain: ChainSegment[]): { active: boolean; label?: string; color?: string } {
  const seg = chain.find((s) => s.fn === "highlight");
  if (!seg) return { active: false };
  const label = typeof seg.args[0] === "string" ? seg.args[0] : undefined;
  const color = typeof seg.args[1] === "string" ? seg.args[1] : undefined;
  return { active: true, label, color };
}

/** Apply highlight decoration (corners + badge) to a call span. */
function applyHighlight(
  span: HTMLElement,
  highlight: { active: boolean; label?: string; color?: string },
  source: string
): void {
  if (!highlight.active) return;
  span.classList.add("rpg-call-highlight");
  span.removeAttribute("aria-label");
  if (highlight.color) {
    span.style.setProperty("--text-accent", `var(--color-${highlight.color})`);
  }
  const tooltip = source || (highlight.label ?? "Homebrew");
  const badge = span.createEl("span", {
    cls: "rpg-call-highlight__badge",
    attr: {
      "aria-label": tooltip,
    },
  });
  try {
    const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
    setIcon?.(badge, "pen-line");
  } catch {
    badge.textContent = "✦";
  }
}

/** Inject a highlight badge into a magic card's header after React renders. */
function injectMagicHighlightBadge(container: HTMLElement, source: string): void {
  const header = container.querySelector(".rpg-item-magic-card__header");
  if (!header || header.querySelector(".rpg-call-highlight__badge")) return;
  const badge = document.createElement("span");
  badge.className = "rpg-call-highlight__badge";
  badge.setAttribute("aria-label", source || "Homebrew");
  try {
    const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
    setIcon?.(badge, "pen-line");
  } catch {
    badge.textContent = "✦";
  }
  header.appendChild(badge);
}

/** React component for the highlight badge icon. */
function HighlightBadge({ source }: { source: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
      setIcon?.(el, "pen-line");
    } catch {
      el.textContent = "✦";
    }
    // For box views (callout/float): move badge inside the aside so
    // it positions relative to the box and gets tooltip support.
    const aside = el.parentElement?.querySelector(".rpg-rule-side");
    if (aside) {
      aside.appendChild(el);
    }
  }, []);
  return React.createElement("span", {
    ref,
    className: "rpg-call-highlight__badge",
    "aria-label": source || "Homebrew",
  });
}

/** Matches an inline-code element whose entire text content is exactly
 *  one `@[[file]].fn(args)` token. Authors wrap calls in backticks so
 *  the markdown parser doesn't mangle the `[[…]]` as a wikilink. */
const WHOLE_CALL_PATTERN = /^\s*@\[\[[^\]\n]+\]\](?:\.[A-Za-z_][\w-]*\([^)\n]*\))+\s*$/;

export function buildRuleCallProcessor(deps: RuleCallProcessorDeps) {
  storeDeps(deps);
  return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    // ── Strategy 1: scan <code> elements directly ──────────────────
    // Authors wrap calls in backticks so Obsidian's parser leaves [[…]]
    // alone. Instead of unwrapping the <code> into a text node (fragile —
    // the text can be re-consumed by wikilink processing before our walker
    // reaches it), we detect call patterns INSIDE the <code> element and
    // replace the <code> itself with a call span. Robust regardless of
    // post-processor ordering.
    const codeHits: Array<{ code: HTMLElement; call: ParsedCall }> = [];
    const codes = Array.from(el.querySelectorAll("code"));
    for (const code of codes) {
      if (code.parentElement?.tagName === "PRE") continue;
      const text = code.textContent ?? "";
      if (!WHOLE_CALL_PATTERN.test(text)) continue;
      const parsed = matchAllCalls(text)[0];
      if (!parsed) continue;
      // Verify target resolves to a real file or folder — skip
      // documentation placeholders like `@[[file]].fn()`.
      const isFolder = parsed.target.endsWith("/");
      if (!isFolder) {
        const targetPath = resolveLinkToPath(deps.app, parsed.target, ctx.sourcePath);
        if (!targetPath) continue;
      } else {
        const folder = resolveFolderPath(deps.app, parsed.target);
        if (!folder) continue;
      }
      codeHits.push({ code, call: parsed });
    }

    // ── Strategy 2: scan bare text nodes (YAML content fields, etc.) ──
    const found: Array<{ node: Text; match: ParsedCall & { start: number; end: number } }> = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        let p: HTMLElement | null = (node as Text).parentElement;
        while (p) {
          if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.classList?.contains(CALL_CLASS)) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      for (const m of matchAllCalls(text.data)) found.push({ node: text, match: m });
    }

    if (codeHits.length === 0 && found.length === 0) return;

    const child = new MarkdownRenderChild(el);
    ctx.addChild(child);
    let childUnloaded = false;
    child.register(() => { childUnloaded = true; });

    // Track pending calls. When all resolve, merge adjacent <ul> item
    // lists into a single <ul> for proper DOM structure.
    const totalCalls = codeHits.length + found.reduce((n, f) => n + 1, 0);
    let resolved = 0;
    const onCallResolved = () => {
      resolved++;
      if (resolved >= totalCalls && !childUnloaded) {
        // React 18's createRoot.render() is async (concurrent mode).
        // The DOM isn't updated until React's internal scheduler flushes.
        // setTimeout(100) gives React ample time to commit — more reliable
        // than requestAnimationFrame which can fire before React's commit.
        setTimeout(() => {
          if (!childUnloaded) {
            markHighlightedItems(el);
            mergeAdjacentCallTabs(el);
            mergeAdjacentItemLists(el);
            mergeTableRows(el);
            removeBrBetweenSiblingCalls(el);
          }
        }, 100);
      }
    };

    // Process <code> hits — replace the <code> element directly.
    for (const { code, call } of codeHits) {
      const span = document.createElement("span");
      span.classList.add(CALL_CLASS);
      span.classList.add("rpg-call--pending");
      span.setAttribute("data-call", call.source);
      span.textContent = call.source;
      code.parentNode?.replaceChild(span, code);
      resolveCall(span, call, deps, ctx, child, () => childUnloaded, onCallResolved);
    }

    // Process bare text hits (strategy 2).
    const byNode = new Map<Text, (typeof found)[number][]>();
    for (const f of found) {
      const arr = byNode.get(f.node) ?? [];
      arr.push(f);
      byNode.set(f.node, arr);
    }

    for (const [node, matches] of byNode) {
      matches.sort((a, b) => b.match.start - a.match.start);
      for (const m of matches) {
        replaceCall(node, m.match, deps, ctx, child, () => childUnloaded, onCallResolved);
      }
    }
  };
}

/**
 * Shared async resolver for a call span — reads the target file, awaits
 * system load, harvests blocks, invokes the view, mounts React.
 */
function resolveCall(
  span: HTMLElement,
  call: ParsedCall,
  deps: RuleCallProcessorDeps,
  ctx: MarkdownPostProcessorContext,
  child: MarkdownRenderChild,
  isUnloaded: () => boolean,
  onResolved?: () => void
): void {
  // ── Folder target: trailing `/` iterates every .md in the folder ───
  if (call.target.endsWith("/")) {
    resolveFolderCall(span, call, deps, ctx, child, isUnloaded, onResolved);
    return;
  }

  const targetPath = resolveLinkToPath(deps.app, call.target, ctx.sourcePath);
  if (!targetPath) {
    renderError(span, `Cannot resolve wikilink [[${call.target}]]`);
    return;
  }

  // ── Special case: image file targets (banner view) ─────────────────
  // When the target is a binary image file, skip reading it as text.
  // Pass the resolved vault resource URL through ctx.file so the view
  // can render it directly.
  const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
  if (IMAGE_EXTS.test(targetPath)) {
    const mappedSystemPath = deps.registry.findSystemFolderForFile(ctx.sourcePath);
    void (mappedSystemPath ? deps.registry.loadSystemAsync(mappedSystemPath) : Promise.resolve(null))
      .then(() => {
        if (isUnloaded()) return;
        const system = deps.registry.getSystemForFile(ctx.sourcePath);
        const view = system?.ruleViews?.[call.fn];
        if (!view) {
          renderError(span, `View "${call.fn}" not registered`);
          return;
        }
        const root = ReactDOM.createRoot(span);
        child.register(() => { try { root.unmount(); } catch { /* ignore */ } });
        span.classList.remove("rpg-call--pending");
        span.textContent = "";
        const fileName = targetPath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? targetPath;
        const imgCtx: RuleViewCtx = {
          name: fileName,
          content: "",
          frontmatter: {},
          file: targetPath,
        };
        try {
          const node = view.render(imgCtx, call.args);
          root.render(<>{node}</>);
        } catch (err) {
          renderError(span, `View "${call.fn}" threw: ${(err as Error)?.message ?? err}`);
        }
      })
      .finally(() => onResolved?.());
    return;
  }

  const mappedSystemPath = deps.registry.findSystemFolderForFile(ctx.sourcePath);
  void Promise.all([
    deps.app.vault.adapter.read(targetPath),
    mappedSystemPath ? deps.registry.loadSystemAsync(mappedSystemPath) : Promise.resolve(null),
  ])
    .then(([raw, _]) => {
      if (isUnloaded()) return;

      let cleaned = stripLocalFences(raw);
      if (call.section) {
        cleaned = sliceToSection(cleaned, call.section);
      }

      // ── Special case: `table` view extracts rpg table.* fences ──────
      // `@[[file]].table(name)` renders a specific table block.
      // `@[[file]].table()` renders all table blocks from the file.
      if (call.fn === "table") {
        const tables = extractTableBlocks(cleaned);
        const tableName = typeof call.args[0] === "string" ? call.args[0] : null;
        const matched = tableName
          ? tables.filter((t) => t.name === tableName)
          : tables;
        if (matched.length === 0) {
          renderError(span, `No table "${tableName ?? "*"}" found in [[${call.target}]]`);
          return;
        }
        const root = ReactDOM.createRoot(span);
        child.register(() => { try { root.unmount(); } catch { /* ignore */ } });
        span.classList.remove("rpg-call--pending");
        span.removeAttribute("aria-label");
        span.textContent = "";
        const source = matched.map((t) => t.fenceMarkdown).join("\n\n");
        root.render(
          React.createElement(Markdown, { source, sourcePath: targetPath })
        );
        return;
      }

      // ── Special case: `stat` view extracts rpg stat.* fences ─────────
      // `@[[file]].stat()` renders the stat block from the target file.
      // `@[[file]].stat(desc-before)` overrides description placement.
      if (call.fn === "stat") {
        const statSystem = deps.registry.getSystemForFile(ctx.sourcePath);
        const statView = statSystem?.ruleViews?.["stat"];
        if (!statView) {
          renderError(span, `View "stat" not registered`);
          return;
        }
        const chainHeading = call.chain.find((s) => /^h\d$/.test(s.fn));
        const root = ReactDOM.createRoot(span);
        child.register(() => { try { root.unmount(); } catch { /* ignore */ } });
        span.classList.remove("rpg-call--pending");
        span.removeAttribute("aria-label");
        span.textContent = "";
        const fileName = call.section
          ? call.section
          : targetPath.split("/").pop()?.replace(/\.md$/, "") ?? targetPath;
        const fileFm = (deps.app.metadataCache.getCache(targetPath)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};
        const statCtx: RuleViewCtx = {
          name: fileName,
          content: cleaned,
          frontmatter: fileFm,
          file: targetPath,
        };
        try {
          const node = statView.render(statCtx, call.args);
          if (chainHeading) {
            const HeadingTag = chainHeading.fn as keyof React.JSX.IntrinsicElements;
            root.render(<>{React.createElement(HeadingTag, null, fileName)}{node}</>);
          } else {
            root.render(<>{node}</>);
          }
        } catch (err) {
          renderError(span, `View "stat" threw: ${(err as Error)?.message ?? err}`);
        }
        return;
      }

      // ── Special case: `magic` view extracts rpg item.magic fences ─────
      if (call.fn === "magic") {
        const magicSystem = deps.registry.getSystemForFile(ctx.sourcePath);
        const magicView = magicSystem?.ruleViews?.["magic"];
        if (!magicView) {
          renderError(span, `View "magic" not registered`);
          return;
        }
        const root = ReactDOM.createRoot(span);
        child.register(() => { try { root.unmount(); } catch { /* ignore */ } });
        span.classList.remove("rpg-call--pending");
        span.removeAttribute("aria-label");
        span.textContent = "";
        const fileName = call.section
          ? call.section
          : targetPath.split("/").pop()?.replace(/\.md$/, "") ?? targetPath;
        const fileFm = (deps.app.metadataCache.getCache(targetPath)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};
        const magicCtx: RuleViewCtx = {
          name: fileName,
          content: cleaned,
          frontmatter: fileFm,
          file: targetPath,
        };
        try {
          const node = magicView.render(magicCtx, call.args);
          const magicHighlight = extractHighlight(call.chain);
          if (magicHighlight.active) {
            const sourceStr = normalizeSource(String(fileFm.source ?? ""));
            const callerFm = (deps.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter as
              | Record<string, unknown>
              | undefined) ?? {};
            const callerSource = normalizeSource(callerFm.source ? String(callerFm.source) : "");
            if (sourceStr !== callerSource) {
              span.classList.add("rpg-call--magic-highlight");
              if (magicHighlight.color) {
                span.style.setProperty("--text-accent", `var(--color-${magicHighlight.color})`);
              }
              span.setAttribute("data-rpg-highlight-source", sourceStr);
              setTimeout(() => injectMagicHighlightBadge(span, sourceStr), 50);
            }
          }
          root.render(<>{node}</>);
        } catch (err) {
          renderError(span, `View "magic" threw: ${(err as Error)?.message ?? err}`);
        }
        return;
      }

      // ── Terminal heading: `.h3()` renders section content with heading ──
      const hTerminal = call.fn.match(/^h([1-6])$/);
      if (hTerminal) {
        const hLevel = parseInt(hTerminal[1], 10);
        const sectionName = call.section
          ?? targetPath.split("/").pop()?.replace(/\.md$/, "") ?? call.target;
        let body = stripFileFrontmatter(cleaned);
        body = stripFirstHeading(body);
        const source = "#".repeat(hLevel) + " " + sectionName + "\n" + body;
        span.classList.remove("rpg-call--pending");
        span.removeAttribute("aria-label");
        span.textContent = "";
        const comp = new Component();
        comp.load();
        child.register(() => comp.unload());
        const renderer = MarkdownRenderer as any;
        if (typeof renderer.render === "function") {
          renderer.render(deps.app, source, span, targetPath, comp);
        } else if (typeof renderer.renderMarkdown === "function") {
          renderer.renderMarkdown(source, span, targetPath, comp);
        }
        const hlFm = (deps.app.metadataCache.getCache(targetPath)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};
        applyHighlight(span, extractHighlight(call.chain), String(hlFm.source ?? ""));
        return;
      }

      const system = deps.registry.getSystemForFile(ctx.sourcePath);
      const view = system?.ruleViews?.[call.fn];
      if (!view) {
        const sysName = system?.name ?? "(unmapped)";
        const available = system?.ruleViews ? Object.keys(system.ruleViews).join(", ") : "(none)";
        renderError(
          span,
          `View "${call.fn}" not registered for system "${sysName}". ` +
            `Available views: ${available}.`
        );
        return;
      }

      const fenced = extractContentBlocks(cleaned);
      const fileName = call.section
        ? call.section
        : targetPath.split("/").pop()?.replace(/\.md$/, "") ?? targetPath;
      const fileFm = (deps.app.metadataCache.getCache(targetPath)?.frontmatter as
        | Record<string, unknown>
        | undefined) ?? {};

      let viewArgs = call.args;
      let matching: HarvestedBlock[] = fenced;
      let wholeFile = false;
      const firstArg = call.args[0];
      if (typeof firstArg === "number" && Number.isInteger(firstArg) && firstArg >= 0 && firstArg < fenced.length) {
        matching = [fenced[firstArg]];
        viewArgs = call.args.slice(1);
      } else if (typeof firstArg === "string") {
        const filtered = fenced.filter(
          (b) => b.frontmatter.id === firstArg || b.frontmatter.name === firstArg
        );
        if (filtered.length > 0) {
          matching = filtered;
          viewArgs = call.args.slice(1);
        }
      } else {
        wholeFile = true;
      }

      // Table-row injection: instead of injecting here (span may be
      // detached due to Obsidian's virtualization), we let the React
      // fallback render a standalone <table>. The post-render merge pass
      // (setTimeout(100) in onCallResolved) will move its rows into the
      // preceding markdown table if one exists.

      if (view.wrapper === "tab-group") {
        let body = stripFileFrontmatter(cleaned);
        const highlight = extractHighlight(call.chain);
        let homebrew = false;
        if (highlight.active) {
          const sourceStr = normalizeSource(String(fileFm.source ?? ""));
          const callerFm = (deps.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter as
            | Record<string, unknown>
            | undefined) ?? {};
          const callerSource = normalizeSource(callerFm.source ? String(callerFm.source) : "");
          homebrew = sourceStr !== callerSource;
        }
        const tab: RuleTabBlock = {
          kind: "tab",
          name: (fileFm["tab-name"] as string) || fileName,
          icon: fileFm["tab-icon"] as string | undefined,
          color: fileFm["tab-color"] as string | undefined,
          body,
          frontmatter: fileFm,
          ...(homebrew && { homebrew: true }),
        };
        span.classList.remove("rpg-call--pending");
        span.classList.add("rpg-call--tab");
        span.removeAttribute("aria-label");
        span.textContent = "";
        span.setAttribute("data-rpg-call-tab-json", JSON.stringify(tab));
        span.setAttribute("data-rpg-call-tab-source", ctx.sourcePath);
        onResolved?.();
        return;
      }

      const highlight = extractHighlight(call.chain);
      const root = ReactDOM.createRoot(span);
      child.register(() => {
        try { root.unmount(); } catch { /* ignore */ }
      });
      span.classList.remove("rpg-call--pending");
      span.removeAttribute("aria-label");
      span.textContent = "";

      try {
        let wholeFileBody: string | null = null;
        if (wholeFile) {
          if (view.raw) {
            wholeFileBody = stripFileFrontmatter(cleaned);
          } else {
            wholeFileBody = inlineContentFences(stripFileFrontmatter(cleaned));
          }
          if (shouldStripFirstHeading(deps.app)) {
            wholeFileBody = stripFirstHeading(wholeFileBody);
          }
        }
        const node = renderByMode(
          view, matching, viewArgs, fileName, targetPath,
          wholeFileBody, fileFm
        );
        const sourceStr = normalizeSource(String(fileFm.source ?? ""));
        if (highlight.active) {
          // Compare sources: only apply highlight if file source differs from caller
          const callerFm = (deps.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter as
            | Record<string, unknown>
            | undefined) ?? {};
          const callerSource = normalizeSource(callerFm.source ? String(callerFm.source) : "");
          const isHomebrew = sourceStr !== callerSource;

          if (!isHomebrew) {
            // Sources match — render without highlight
            root.render(<>{node}</>);
          } else if (view.wrapper === "ul") {
            // Items: render plain, markHighlightedItems adds per-li styling
            root.render(<>{node}</>);
            span.classList.add("rpg-call-highlight");
            span.setAttribute("data-rpg-highlight-source", sourceStr);
          } else if (view.wrapper === "table") {
            root.render(<>{node}</>);
            span.classList.add("rpg-call-highlight");
            span.setAttribute("data-rpg-highlight-source", sourceStr);
          } else {
            root.render(
              <div className="rpg-call-highlight__inner">
                {node}
                <HighlightBadge source={sourceStr} />
              </div>
            );
            span.classList.add("rpg-call-highlight");
          }
          if (isHomebrew) {
            span.removeAttribute("aria-label");
            if (highlight.color) {
              span.style.setProperty("--text-accent", `var(--color-${highlight.color})`);
            }
          }
        } else {
          root.render(<>{node}</>);
        }
      } catch (err) {
        console.error(`rpg-call ${call.source} render threw`, err);
        renderError(span, `View "${call.fn}" threw: ${(err as Error)?.message ?? err}`);
      }
    })
    .catch((err) => {
      console.error(`rpg-call ${call.source} setup failed`, err);
      renderError(span, `Failed: ${(err as Error)?.message ?? err}`);
    })
    .finally(() => onResolved?.());
}

/** Splice a call token out of a text node (strategy 2 — bare text). */
function replaceCall(
  node: Text,
  call: ParsedCall & { start: number; end: number },
  deps: RuleCallProcessorDeps,
  ctx: MarkdownPostProcessorContext,
  child: MarkdownRenderChild,
  isUnloaded: () => boolean,
  onResolved?: () => void
): void {
  const after = node.splitText(call.end);
  const middle = node.splitText(call.start);
  void after;

  const span = document.createElement("span");
  span.classList.add(CALL_CLASS);
  span.classList.add("rpg-call--pending");
  span.setAttribute("data-call", call.source);
  span.textContent = call.source;
  middle.parentNode?.replaceChild(span, middle);

  resolveCall(span, call, deps, ctx, child, isUnloaded, onResolved);
}

interface HarvestedBlock {
  body: string;
  frontmatter: Record<string, unknown>;
}

function extractContentBlocks(text: string): HarvestedBlock[] {
  const out: HarvestedBlock[] = [];
  const fences = extractAllRpgFences(text);
  for (const f of fences) {
    if (f.entity === "rule" && f.block === "content") {
      const inner = sliceFenceBody(text, f.start, f.end);
      const parsed = parseRuleContent(inner);
      out.push({ body: parsed.body, frontmatter: parsed.frontmatter });
    } else if (f.entity === "rule" && f.block === "side") {
      if (f.body) {
        const fm: Record<string, unknown> = { ...f.body };
        const bodyText = (fm.text as string) ?? "";
        delete fm.text;
        if (typeof fm.title === "string" && !fm.name) fm.name = fm.title;
        out.push({ body: bodyText, frontmatter: fm });
      }
    } else if (f.entity === "item" && f.block === "element") {
      if (f.body) {
        const fm: Record<string, unknown> = { ...f.body };
        const bodyText = (fm.text as string) ?? (fm.desc as string) ?? "";
        delete fm.text;
        if (f.name && !fm.id) fm.id = f.name;
        out.push({ body: bodyText, frontmatter: fm });
      }
    }
  }
  return out;
}

/**
 * Extract `rpg table.<name>` fences from the source text. Returns each
 * as a complete fenced code block string so it can be passed to
 * `<Markdown>` and processed by the registered table code block processor.
 */
function extractTableBlocks(text: string): Array<{ name: string; fenceMarkdown: string }> {
  const out: Array<{ name: string; fenceMarkdown: string }> = [];
  const fences = extractAllRpgFences(text);
  for (const f of fences) {
    if (f.entity !== "table") continue;
    const body = sliceFenceBody(text, f.start, f.end);
    out.push({
      name: f.block,
      fenceMarkdown: "```rpg table." + f.block + "\n" + body + "\n```",
    });
  }
  return out;
}

/**
 * Strip every `rpg rule.related` and `rpg rule.notes` fence from the
 * source text. Used before harvesting so those "local-only" blocks
 * (see-also pointers + author prose) don't follow the file into an
 * import.
 */
function stripLocalFences(text: string): string {
  return text.replace(/```rpg\s+rule\.(related|notes)\s*\n[\s\S]*?```\s*\n?/g, "");
}

/**
 * Replace all `rpg ...` fences with their markdown body (text after
 * the `---` separator). Used for whole-file imports so the view renders
 * prose inline without re-triggering the code block processor (which would
 * add standalone homebrew/special decorations).
 */
function inlineContentFences(text: string): string {
  const FENCE_OPEN = /^(`{3,})rpg\s+([^\n]+)$/gm;
  let result = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_OPEN.exec(text)) !== null) {
    const ticks = m[1].length;
    const fenceType = m[2].trim();
    const headEnd = m.index + m[0].length + 1; // +1 for newline
    const closeRe = new RegExp(`^\\x60{${ticks}}\\s*$`, "m");
    const tail = text.slice(headEnd);
    const closeMatch = closeRe.exec(tail);
    if (!closeMatch) continue;
    const inner = tail.slice(0, closeMatch.index);
    const fenceEnd = headEnd + closeMatch.index + closeMatch[0].length;
    const trailingNewline = text[fenceEnd] === "\n" ? 1 : 0;
    // Preserve fences that need Obsidian's code block processor to render.
    if (fenceType.startsWith("table")) {
      result += text.slice(cursor, fenceEnd + trailingNewline);
      cursor = fenceEnd + trailingNewline;
      FENCE_OPEN.lastIndex = cursor;
      continue;
    }
    result += text.slice(cursor, m.index);
    const sep = inner.indexOf("\n---\n");
    if (sep >= 0) {
      result += inlineContentFences(inner.slice(sep + 5));
    } else {
      const sepEnd = inner.indexOf("\n---");
      if (sepEnd >= 0 && sepEnd + 4 >= inner.length) {
        // body is empty after separator
      } else {
        result += inlineContentFences(inner);
      }
    }
    cursor = fenceEnd + trailingNewline;
    FENCE_OPEN.lastIndex = cursor;
  }
  result += text.slice(cursor);
  return result;
}

function findContentBlockById(text: string, id: string): string | null {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const openMatch = lines[i].match(/^(`{3,})\s*rpg\s+rule\.content\s*$/);
    if (!openMatch) continue;
    const ticks = openMatch[1].length;
    const bodyStart = i + 1;
    let bodyEnd = lines.length;
    for (let j = bodyStart; j < lines.length; j++) {
      if (lines[j].match(new RegExp(`^\`{${ticks}}\\s*$`))) {
        bodyEnd = j;
        break;
      }
    }
    const inner = lines.slice(bodyStart, bodyEnd).join("\n");
    const parsed = parseRuleContent(inner);
    if (parsed.frontmatter.id === id || parsed.frontmatter.name === id) {
      return parsed.body;
    }
  }
  return null;
}

/**
 * Slice file text to just the content under a given heading (up to the
 * next heading of same or higher level). Heading match is case-insensitive.
 */
function sliceToSection(text: string, section: string): string {
  const lines = text.split("\n");
  let startIdx = -1;
  let startLevel = 0;
  const sectionLower = section.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const hMatch = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (!hMatch) continue;
    if (startIdx < 0) {
      if (hMatch[2].trim().toLowerCase() === sectionLower) {
        startLevel = hMatch[1].length;
        startIdx = i + 1;
      }
    } else {
      if (hMatch[1].length <= startLevel) {
        return lines.slice(startIdx, i).join("\n");
      }
    }
  }
  if (startIdx >= 0) return lines.slice(startIdx).join("\n");
  return text;
}

/**
 * Strip the leading YAML frontmatter (between the first two `---` lines)
 * so it doesn't render as a code block when the body is passed back into
 * Obsidian's markdown renderer for whole-file imports.
 */
function stripFileFrontmatter(text: string): string {
  const m = text.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? text.slice(m[0].length) : text;
}

/** Pluck the inner body of a fence given its [start, end) offsets. */
function sliceFenceBody(text: string, start: number, end: number): string {
  const headEnd = text.indexOf("\n", start);
  if (headEnd < 0 || headEnd >= end) return "";
  const body = text.slice(headEnd + 1, end);
  // Strip the closing fence line (a line of only backticks at the end)
  const stripped = body.replace(/\n?`{3,}\s*$/, "");
  return stripped.replace(/\n$/, "");
}

function normalizeStatValueInline(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw == null) return "";
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw) && raw.length === 1 && Array.isArray(raw[0]) && raw[0].length === 1 && typeof raw[0][0] === "string") {
    return `[[${raw[0][0]}]]`;
  }
  return String(raw);
}

function normalizeStatsInline(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = normalizeStatValueInline(value);
  }
  return out;
}

function normalizeAbilitiesInline(raw: unknown) {
  const defaults = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const v = obj[key];
    if (typeof v === "number") defaults[key] = v;
    else if (typeof v === "string") {
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) defaults[key] = n;
    }
  }
  return defaults;
}

function normalizeFeaturesInline(raw: unknown): Array<{ ref: string; [key: string]: unknown }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: unknown) => {
    if (typeof entry === "string") return { ref: entry };
    if (entry && typeof entry === "object" && "ref" in (entry as Record<string, unknown>)) return entry as { ref: string; [key: string]: unknown };
    if (Array.isArray(entry) && entry.length === 1 && Array.isArray(entry[0])) return { ref: `[[${entry[0][0]}]]` };
    return null;
  }).filter((x): x is { ref: string; [key: string]: unknown } => x !== null);
}

function StatblockCallInline({ parsed, body, sourcePath, hideTitle }: {
  parsed: Record<string, unknown>;
  body?: string;
  sourcePath: string;
  hideTitle?: boolean;
}) {
  const [resolved, setResolved] = React.useState<ResolvedStatFeature[]>([]);
  const features = React.useMemo(() => normalizeFeaturesInline(parsed.features), [parsed.features]);
  const name = typeof parsed.name === "string" ? parsed.name : "";

  React.useEffect(() => {
    if (features.length === 0) { setResolved([]); return; }
    let cancelled = false;
    const selfProps = { name: name.toLowerCase(), size: parsed.size, type: parsed.type, dimensions: parsed.dimensions };
    resolveStatFeatures(features, sourcePath, selfProps).then((r) => {
      if (!cancelled) setResolved(r as ResolvedStatFeature[]);
    });
    return () => { cancelled = true; };
  }, [features, name, sourcePath]);

  return React.createElement(StatblockVehicle, {
    name,
    size: typeof parsed.size === "string" ? parsed.size : "",
    type: typeof parsed.type === "string" ? parsed.type : "",
    dimensions: typeof parsed.dimensions === "string" ? parsed.dimensions : undefined,
    stats: normalizeStatsInline(parsed.stats),
    abilities: normalizeAbilitiesInline(parsed.abilities),
    features: resolved,
    body,
    hideTitle,
    sourcePath,
  });
}

/**
 * Apply chain operations to determine if a file should be included
 * and which fence block to use.
 *
 * `.block(specifier)` — selects which fence to read:
 *   - `item.magic` / `stat.vehicle` — entity.block type
 *   - `my-id` — matches fence by name/id
 *   - `0`, `1` — numeric index
 *
 * `.filter(expression)` — evaluates against the selected block's YAML:
 *   - `rarity == Rare`
 *   - `name like /bow/`
 *   - `N prefix name`
 */
interface ChainResult {
  pass: boolean;
  blockSpec?: string;
  headingLevel?: number;
}

function applyChain(
  chain: ChainSegment[],
  fileData: Record<string, unknown>
): ChainResult {
  let pass = true;
  let blockSpec: string | undefined;
  let headingLevel: number | undefined;

  for (const seg of chain) {
    if (seg.fn === "block") {
      blockSpec = typeof seg.args[0] === "string" ? seg.args[0]
        : typeof seg.args[0] === "number" ? String(seg.args[0])
        : undefined;
    } else if (seg.fn === "filter") {
      const exprStr = seg.args.map(String).join(", ");
      const expr = parseFilterExpr(exprStr);
      if (expr && !evaluateFilter(expr, fileData)) {
        pass = false;
        break;
      }
    } else {
      const hMatch = seg.fn.match(/^h(\d)$/);
      if (hMatch) headingLevel = parseInt(hMatch[1], 10);
    }
  }

  return { pass, blockSpec, headingLevel };
}

/**
 * Extract the YAML data from a file for chain filtering. Tries the
 * specified block type first, falls back to file frontmatter + first
 * stat/item fence found.
 */
function extractFileData(
  cleaned: string,
  fileFm: Record<string, unknown>,
  blockSpec?: string
): Record<string, unknown> {
  const fences = extractAllRpgFences(cleaned);

  if (blockSpec) {
    // Numeric index
    const idx = Number(blockSpec);
    if (Number.isFinite(idx) && idx >= 0 && idx < fences.length) {
      return { ...fileFm, ...(fences[idx].body ?? {}) };
    }
    // entity.block type match
    if (blockSpec.includes(".")) {
      const [entity, block] = blockSpec.split(".", 2);
      const match = fences.find((f) => f.entity === entity && f.block === block);
      if (match?.body) return { ...fileFm, ...match.body };
    }
    // id/name match
    const byId = fences.find((f) => f.body?.id === blockSpec || f.body?.name === blockSpec);
    if (byId?.body) return { ...fileFm, ...byId.body };
  }

  // Default: merge first fence body into frontmatter
  if (fences.length > 0 && fences[0].body) {
    return { ...fileFm, ...fences[0].body };
  }
  return fileFm;
}

function renderByMode(
  view: RuleViewEntry,
  blocks: HarvestedBlock[],
  args: unknown[],
  fileName: string,
  filePath: string,
  /** When non-null, the join mode renders THIS body (the whole-file content
   *  minus related fences and minus YAML frontmatter) instead of joining
   *  fenced block bodies. Lets `view()` calls without an id filter pull in
   *  the headings + prose alongside fenced blocks. */
  wholeFileBody: string | null,
  /** File's frontmatter, used for join mode in whole-file form. */
  fileFrontmatter: Record<string, unknown>
): React.ReactNode {
  const mode: RuleViewMode = view.mode;
  if (mode === "join") {
    if (wholeFileBody !== null) {
      const ctx: RuleViewCtx = {
        name: fileName,
        content: wholeFileBody,
        frontmatter: fileFrontmatter,
        file: filePath,
      };
      return view.render(ctx);
    }
    const ctx: RuleViewCtx = {
      name: fileName,
      content: blocks.map((b) => b.body).join("\n\n"),
      frontmatter: blocks[0]?.frontmatter ?? {},
      file: filePath,
    };
    return view.render(ctx);
  }
  if (mode === "each") {
    const items = blocks.map((b, i) =>
      React.createElement(
        React.Fragment,
        { key: i },
        view.render({ name: fileName, content: b.body, frontmatter: b.frontmatter, file: filePath })
      )
    );
    if (view.wrapper) return React.createElement(view.wrapper, null, ...items);
    return items;
  }
  // mode: "args"
  const items = blocks.map((b, i) =>
    React.createElement(
      React.Fragment,
      { key: i },
      view.render({ name: fileName, content: b.body, frontmatter: b.frontmatter, file: filePath }, args)
    )
  );
  if (view.wrapper === "table") {
    // Special case for tables: build a proper <table> with <thead> (using
    // arg names as column headers, capitalized) and <tbody> (rendered rows).
    const thead = React.createElement(
      "thead",
      null,
      React.createElement(
        "tr",
        null,
        args.map((a, i) =>
          React.createElement("th", { key: i }, String(a).charAt(0).toUpperCase() + String(a).slice(1))
        )
      )
    );
    const tbody = React.createElement("tbody", null, ...items);
    return React.createElement("table", { className: "rpg-view--table" }, thead, tbody);
  }
  if (view.wrapper) return React.createElement(view.wrapper, null, ...items);
  return items;
}

function resolveLinkToPath(app: App, link: string, sourcePath: string): string | null {
  const clean = link.split("|")[0].trim();
  const file = app.metadataCache.getFirstLinkpathDest(clean, sourcePath);
  return file instanceof TFile ? file.path : null;
}

function resolveFolderPath(app: App, link: string): TFolder | null {
  const clean = link.replace(/\/+$/, "").split("|")[0].trim();
  const exact = app.vault.getAbstractFileByPath(clean);
  if (exact instanceof TFolder) return exact;
  const suffix = "/" + clean;
  for (const f of app.vault.getAllLoadedFiles()) {
    if (f instanceof TFolder && (f.path === clean || f.path.endsWith(suffix))) {
      return f;
    }
  }
  return null;
}

function resolveFolderCall(
  span: HTMLElement,
  call: ParsedCall,
  deps: RuleCallProcessorDeps,
  ctx: MarkdownPostProcessorContext,
  child: MarkdownRenderChild,
  isUnloaded: () => boolean,
  onResolved?: () => void
): void {
  const folder = resolveFolderPath(deps.app, call.target);
  if (!folder) {
    renderError(span, `Cannot resolve folder [[${call.target}]]`);
    onResolved?.();
    return;
  }

  const files = folder.children
    .filter((f): f is TFile => f instanceof TFile && f.extension === "md")
    .sort((a, b) => a.basename.localeCompare(b.basename));

  if (files.length === 0) {
    renderError(span, `No .md files in [[${call.target}]]`);
    onResolved?.();
    return;
  }

  const mappedSystemPath = deps.registry.findSystemFolderForFile(ctx.sourcePath);
  void Promise.all([
    Promise.all(files.map((f) => deps.app.vault.adapter.read(f.path).then((raw) => ({ file: f, raw })))),
    mappedSystemPath ? deps.registry.loadSystemAsync(mappedSystemPath) : Promise.resolve(null),
  ])
    .then(([entries]) => {
      if (isUnloaded()) return;

      const system = deps.registry.getSystemForFile(ctx.sourcePath);
      const view = system?.ruleViews?.[call.fn];

      // ── Terminal heading for folder: `.h4()` renders each file with heading ──
      const folderHTerminal = call.fn.match(/^h([1-6])$/);
      if (folderHTerminal) {
        const hLevel = parseInt(folderHTerminal[1], 10);
        const blockId = typeof call.args[0] === "string" ? call.args[0] : undefined;
        span.classList.remove("rpg-call--pending");
        span.removeAttribute("aria-label");
        span.textContent = "";
        const wrapper = document.createElement("div");
        wrapper.classList.add("rpg-call-folder-headings");
        span.appendChild(wrapper);
        const comp = new Component();
        comp.load();
        child.register(() => comp.unload());
        const highlight = extractHighlight(call.chain);
        const callerFm = (deps.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};
        const callerSource = normalizeSource(callerFm.source ? String(callerFm.source) : "");
        for (const { file: f, raw } of entries) {
          const cleaned = stripLocalFences(raw);
          if (call.chain.length > 0) {
            const chainFm = (deps.app.metadataCache.getCache(f.path)?.frontmatter as
              | Record<string, unknown>
              | undefined) ?? {};
            const blockSpec = call.chain.find((s) => s.fn === "block");
            const fileData = extractFileData(cleaned, chainFm, blockSpec ? String(blockSpec.args[0] ?? "") : undefined);
            const { pass } = applyChain(call.chain, fileData);
            if (!pass) continue;
          }
          let body: string;
          if (blockId) {
            const match = findContentBlockById(cleaned, blockId);
            if (!match) continue;
            body = match;
          } else {
            body = stripFirstHeading(stripFileFrontmatter(cleaned));
          }
          const section = document.createElement("div");
          section.classList.add("rpg-call-folder-section");
          wrapper.appendChild(section);
          const source = "#".repeat(hLevel) + " " + f.basename + "\n" + body;
          const renderer = MarkdownRenderer as any;
          if (typeof renderer.render === "function") {
            renderer.render(deps.app, source, section, f.path, comp);
          } else if (typeof renderer.renderMarkdown === "function") {
            renderer.renderMarkdown(source, section, f.path, comp);
          }
          if (highlight.active) {
            const entryFm = (deps.app.metadataCache.getCache(f.path)?.frontmatter as
              | Record<string, unknown>
              | undefined) ?? {};
            const entrySource = normalizeSource(entryFm.source ? String(entryFm.source) : "");
            if (entrySource !== callerSource) {
              applyHighlight(section, highlight, entrySource);
            }
          }
        }
        if (wrapper.children.length === 0) {
          renderError(span, `No files rendered from [[${call.target}]] with .${call.fn}()`);
        }
        return;
      }

      if (!view) {
        renderError(span, `View "${call.fn}" not registered`);
        return;
      }

      if (view.wrapper === "tab-group") {
        const tabs: RuleTabBlock[] = [];
        const highlight = extractHighlight(call.chain);
        const callerFm = (deps.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};
        const callerSource = normalizeSource(callerFm.source ? String(callerFm.source) : "");
        for (const { file: f, raw } of entries) {
          const cleaned = stripLocalFences(raw);
          let body = stripFileFrontmatter(cleaned);
          const fileFm = (deps.app.metadataCache.getCache(f.path)?.frontmatter as
            | Record<string, unknown>
            | undefined) ?? {};
          let homebrew = false;
          if (highlight.active) {
            const entrySource = normalizeSource(String(fileFm.source ?? ""));
            homebrew = entrySource !== callerSource;
          }
          tabs.push({
            kind: "tab",
            name: (fileFm["tab-name"] as string) || f.basename,
            icon: fileFm["tab-icon"] as string | undefined,
            color: fileFm["tab-color"] as string | undefined,
            body,
            frontmatter: fileFm,
            ...(homebrew && { homebrew: true }),
          });
        }
        tabs.sort((a, b) => {
          const oa = typeof a.frontmatter["tab-order"] === "number" ? a.frontmatter["tab-order"] : Infinity;
          const ob = typeof b.frontmatter["tab-order"] === "number" ? b.frontmatter["tab-order"] : Infinity;
          return oa - ob;
        });
        span.classList.remove("rpg-call--pending");
        span.removeAttribute("aria-label");
        span.textContent = "";
        const root = ReactDOM.createRoot(span);
        child.register(() => { try { root.unmount(); } catch { /* ignore */ } });
        root.render(<TabGroupView tabs={tabs} sourcePath={ctx.sourcePath} />);
        return;
      }

      const nodes: React.ReactNode[] = [];
      const folderHighlight = extractHighlight(call.chain);
      const folderCallerFm = (deps.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter as
        | Record<string, unknown>
        | undefined) ?? {};
      const folderCallerSource = normalizeSource(folderCallerFm.source ? String(folderCallerFm.source) : "");
      for (const { file: f, raw } of entries) {
        const cleaned = stripLocalFences(raw);

        // Apply chain operations (filter, block)
        let chainHeadingLevel: number | undefined;
        if (call.chain.length > 0) {
          const chainFm = (deps.app.metadataCache.getCache(f.path)?.frontmatter as
            | Record<string, unknown>
            | undefined) ?? {};
          const blockSpec = call.chain.find((s) => s.fn === "block");
          const fileData = extractFileData(cleaned, chainFm, blockSpec ? String(blockSpec.args[0] ?? "") : undefined);
          const { pass, headingLevel } = applyChain(call.chain, fileData);
          if (!pass) continue;
          chainHeadingLevel = headingLevel;
        }

        const fenced = extractContentBlocks(cleaned);

        // When no rule.content blocks exist, try any rpg entity.block fence
        // so views like .magic(), .stat(), .row() can read their YAML.
        if (fenced.length === 0) {
          const anyFenceRe = /```+\s*rpg\s+\w+\.\w+\s*\n([\s\S]*?)```+/;
          const fenceMatch = anyFenceRe.exec(cleaned);
          if (fenceMatch) {
            const fenceRaw = fenceMatch[1];
            const sepIdx = fenceRaw.indexOf("\n---\n");
            const yamlPart = sepIdx >= 0 ? fenceRaw.slice(0, sepIdx) : fenceRaw;
            const bodyText = sepIdx >= 0 ? fenceRaw.slice(sepIdx + 4).replace(/^\n+/, "").replace(/\n+$/, "") : undefined;
            let fenceFm: Record<string, unknown> = {};
            try {
              const parsed = parseYaml(yamlPart);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                fenceFm = parsed as Record<string, unknown>;
              }
            } catch { /* ignore */ }
            const fileFm = (deps.app.metadataCache.getCache(f.path)?.frontmatter as
              | Record<string, unknown>
              | undefined) ?? {};
            const mergedFm = { ...fileFm, ...fenceFm };
            const fileName = f.basename;
            if (view.wrapper === "table") {
              try {
                const row = view.render(
                  { name: fileName, content: cleaned, frontmatter: mergedFm, file: f.path },
                  call.args
                );
                nodes.push(React.createElement(React.Fragment, { key: f.path }, row));
              } catch (err) {
                console.error(`rpg-call folder ${f.path} render threw`, err);
              }
            } else {
              const isStatFence = /```+\s*rpg\s+stat\.\w+/.test(cleaned);
              const hLevel = chainHeadingLevel ?? (call.fn.match(/^h(\d)$/)?.[1] ? parseInt(call.fn.match(/^h(\d)$/)![1], 10) : undefined);
              if (isStatFence) {
                try {
                  const headingEl = hLevel
                    ? React.createElement(`h${hLevel}` as keyof React.JSX.IntrinsicElements, null, fileName)
                    : null;
                  const node = React.createElement(
                    React.Fragment,
                    null,
                    headingEl,
                    React.createElement(StatblockCallInline, {
                      parsed: mergedFm,
                      body: bodyText,
                      sourcePath: f.path,
                    })
                  );
                  nodes.push(React.createElement(React.Fragment, { key: f.path }, node));
                } catch (err) {
                  console.error(`rpg-call folder ${f.path} render threw`, err);
                }
              } else {
                try {
                  const viewCtx: RuleViewCtx = {
                    name: fileName,
                    content: cleaned,
                    frontmatter: mergedFm,
                    file: f.path,
                  };
                  const terminalNode = view.render(viewCtx, call.args);
                  const entrySource = normalizeSource(mergedFm.source ? String(mergedFm.source) : "");
                  const shouldHighlight = folderHighlight.active && entrySource !== folderCallerSource;
                  if (hLevel && call.fn !== `h${hLevel}`) {
                    const headingEl = React.createElement(`h${hLevel}` as keyof React.JSX.IntrinsicElements, null, fileName);
                    if (shouldHighlight) {
                      nodes.push(React.createElement("div", {
                        key: f.path,
                        className: "rpg-call-highlight",
                        style: folderHighlight.color ? { "--text-accent": `var(--color-${folderHighlight.color})` } as React.CSSProperties : undefined,
                      }, React.createElement(HighlightBadge, { source: entrySource }), headingEl, terminalNode));
                    } else {
                      nodes.push(React.createElement(React.Fragment, { key: f.path }, headingEl, terminalNode));
                    }
                  } else if (shouldHighlight && call.fn === "magic") {
                    nodes.push(React.createElement("div", {
                      key: f.path,
                      className: "rpg-call--magic-highlight",
                      style: folderHighlight.color ? { "--text-accent": `var(--color-${folderHighlight.color})` } as React.CSSProperties : undefined,
                      "data-rpg-highlight-source": entrySource,
                    } as React.HTMLAttributes<HTMLDivElement>, terminalNode));
                  } else if (shouldHighlight) {
                    nodes.push(React.createElement("div", {
                      key: f.path,
                      className: "rpg-call-highlight",
                      style: folderHighlight.color ? { "--text-accent": `var(--color-${folderHighlight.color})` } as React.CSSProperties : undefined,
                    }, React.createElement(HighlightBadge, { source: entrySource }), terminalNode));
                  } else {
                    nodes.push(React.createElement(React.Fragment, { key: f.path }, terminalNode));
                  }
                } catch (err) {
                  console.error(`rpg-call folder ${f.path} render threw`, err);
                }
              }
            }
          }
          continue;
        }

        const fileName = f.basename;
        const fileFm = (deps.app.metadataCache.getCache(f.path)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};

        let viewArgs = call.args;
        let matching: HarvestedBlock[] = fenced;
        const firstArg = call.args[0];
        if (typeof firstArg === "number" && Number.isInteger(firstArg) && firstArg >= 0 && firstArg < fenced.length) {
          matching = [fenced[firstArg]];
          viewArgs = call.args.slice(1);
        } else if (typeof firstArg === "string") {
          const filtered = fenced.filter(
            (b) => b.frontmatter.id === firstArg || b.frontmatter.name === firstArg
          );
          if (filtered.length > 0) {
            matching = filtered;
            viewArgs = call.args.slice(1);
          }
        }

        if (view.wrapper === "table") {
          for (const b of matching) {
            try {
              const row = view.render(
                { name: fileName, content: b.body, frontmatter: b.frontmatter, file: f.path },
                viewArgs
              );
              nodes.push(React.createElement(React.Fragment, { key: f.path }, row));
            } catch (err) {
              console.error(`rpg-call folder ${f.path} render threw`, err);
            }
          }
        } else {
          try {
            const entrySource = normalizeSource(fileFm.source ? String(fileFm.source) : "");
            const shouldHighlight = folderHighlight.active && entrySource !== folderCallerSource;
            const node = renderByMode(view, matching, viewArgs, fileName, f.path, null, fileFm);

            if (shouldHighlight && view.wrapper === "ul") {
              // Track which files need highlighting for post-render marking
              if (!(span as any).__rpgHighlightFiles) (span as any).__rpgHighlightFiles = [];
              (span as any).__rpgHighlightFiles.push(entrySource);
              nodes.push(React.createElement(React.Fragment, { key: f.path }, node));
            } else if (shouldHighlight) {
              nodes.push(React.createElement("div", {
                key: f.path,
                className: "rpg-call-highlight",
                style: folderHighlight.color ? { "--text-accent": `var(--color-${folderHighlight.color})` } as React.CSSProperties : undefined,
              }, React.createElement(HighlightBadge, { source: entrySource }), node));
            } else {
              nodes.push(React.createElement(React.Fragment, { key: f.path }, node));
            }
          } catch (err) {
            console.error(`rpg-call folder ${f.path} render threw`, err);
          }
        }
      }

      span.classList.remove("rpg-call--pending");
      span.removeAttribute("aria-label");
      span.textContent = "";

      if (view.wrapper === "table") {
        const hostTd = span.closest("td");
        const hostTr = hostTd?.closest("tr");
        if (hostTr && hostTr.parentElement) {
          const doc = span.ownerDocument;
          const hostIndent = hostTd?.getAttribute("data-indent");
          const viewArgs2 = typeof call.args[0] === "number" ? call.args.slice(1) : call.args;
          const fields = viewArgs2.map((a) => String(a));
          const tableHighlight = extractHighlight(call.chain);
          const tableCallerFm = (deps.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter as
            | Record<string, unknown>
            | undefined) ?? {};
          const tableCallerSource = normalizeSource(tableCallerFm.source ? String(tableCallerFm.source) : "");
          for (const { file: f, raw } of entries) {
            const cleaned = stripLocalFences(raw);

            // Apply chain filter
            if (call.chain.length > 0) {
              const fileFm2 = (deps.app.metadataCache.getCache(f.path)?.frontmatter as
                | Record<string, unknown>
                | undefined) ?? {};
              const blockSpec2 = call.chain.find((s) => s.fn === "block");
              const fileData2 = extractFileData(cleaned, fileFm2, blockSpec2 ? String(blockSpec2.args[0] ?? "") : undefined);
              const { pass: pass2 } = applyChain(call.chain, fileData2);
              if (!pass2) continue;
            }

            const fenced = extractContentBlocks(cleaned);
            let matching: HarvestedBlock[];
            if (fenced.length === 0) {
              const anyFenceRe = /```+\s*rpg\s+\w+\.\w+\s*\n([\s\S]*?)```+/;
              const fenceMatch = anyFenceRe.exec(cleaned);
              if (!fenceMatch) continue;
              const fenceRaw = fenceMatch[1];
              const sepIdx = fenceRaw.indexOf("\n---\n");
              const yamlPart = sepIdx >= 0 ? fenceRaw.slice(0, sepIdx) : fenceRaw;
              let fenceFm: Record<string, unknown> = {};
              try {
                const parsed = parseYaml(yamlPart);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                  fenceFm = parsed as Record<string, unknown>;
                }
              } catch { /* ignore */ }
              const fileFm = (deps.app.metadataCache.getCache(f.path)?.frontmatter as
                | Record<string, unknown>
                | undefined) ?? {};
              matching = [{ body: "", frontmatter: { ...fileFm, ...fenceFm } }];
            } else {
              matching = fenced;
              const firstArg = call.args[0];
              if (typeof firstArg === "number" && firstArg >= 0 && firstArg < fenced.length) {
                matching = [fenced[firstArg]];
              } else if (typeof firstArg === "string") {
                const filtered = fenced.filter(
                  (b) => b.frontmatter.id === firstArg || b.frontmatter.name === firstArg
                );
                if (filtered.length > 0) matching = filtered;
              }
            }
            const fileName = f.basename;
            for (const b of matching) {
              const tr = doc.createElement("tr");
              tr.className = "rpg-view rpg-view--row";
              let isFirst = true;
              for (const field of fields) {
                const td = doc.createElement("td");
                if (isFirst && hostIndent) {
                  td.setAttribute("data-indent", hostIndent);
                  isFirst = false;
                } else {
                  isFirst = false;
                }
                if (field === "link") {
                  const label = (b.frontmatter.name as string) || fileName;
                  const a = doc.createElement("a");
                  a.className = "internal-link";
                  a.href = f.path;
                  a.setAttribute("data-href", f.path);
                  a.textContent = label;
                  td.appendChild(a);
                } else if (field === "name") {
                  td.textContent = (b.frontmatter.name as string) || fileName;
                } else {
                  const v = resolveDotPath(b.frontmatter, field);
                  const text = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
                  renderCellInline(doc, td, text);
                }
                tr.appendChild(td);
              }
              hostTr.parentElement!.insertBefore(tr, hostTr);
              // Apply highlight if source differs
              if (tableHighlight.active) {
                const entryFm = (deps.app.metadataCache.getCache(f.path)?.frontmatter as
                  | Record<string, unknown>
                  | undefined) ?? {};
                const entrySource = normalizeSource(entryFm.source ? String(entryFm.source) : "");
                if (entrySource !== tableCallerSource) {
                  tr.classList.add("rpg-row-highlight");
                  const lastTd = tr.querySelector("td:last-child");
                  if (lastTd) {
                    const badge = doc.createElement("span");
                    badge.className = "rpg-call-highlight__badge";
                    badge.setAttribute("aria-label", entrySource || "Homebrew");
                    try {
                      const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
                      setIcon?.(badge, "pen-line");
                    } catch {
                      badge.textContent = "✦";
                    }
                    lastTd.appendChild(badge);
                  }
                }
              }
            }
          }
          hostTr.remove();
          return;
        }

        const root = ReactDOM.createRoot(span);
        child.register(() => { try { root.unmount(); } catch { /* ignore */ } });
        const viewArgs2 = typeof call.args[0] === "number" ? call.args.slice(1) : call.args;
        const fields = viewArgs2.map((a) => String(a));
        const thead = React.createElement(
          "thead", null,
          React.createElement("tr", null,
            fields.map((a, i) =>
              React.createElement("th", { key: i }, a.charAt(0).toUpperCase() + a.slice(1))
            )
          )
        );
        const tbody = React.createElement("tbody", null, ...nodes);
        root.render(
          React.createElement("table", { className: "rpg-view--table" }, thead, tbody)
        );
      } else {
        const highlight2 = extractHighlight(call.chain);
        const root = ReactDOM.createRoot(span);
        child.register(() => { try { root.unmount(); } catch { /* ignore */ } });
        root.render(<>{nodes}</>);
        // Post-render: inject badges into magic card headers for highlighted items
        if (highlight2.active && call.fn === "magic") {
          setTimeout(() => {
            const cards = span.querySelectorAll(".rpg-call--magic-highlight");
            for (const card of Array.from(cards)) {
              const source = card.getAttribute("data-rpg-highlight-source") || "";
              injectMagicHighlightBadge(card as HTMLElement, source);
            }
          }, 80);
        }
        // Post-render: mark folder item <li> elements that have different source
        if (highlight2.active && view.wrapper === "ul") {
          const highlightFiles: string[] = (span as any).__rpgHighlightFiles || [];
          if (highlightFiles.length > 0) {
            setTimeout(() => {
              const allLis = span.querySelectorAll("li.rpg-view--item");
              // Items are in order — highlighted files were tracked sequentially
              // Mark items by counting: each highlighted file produced one <li>
              let hlIdx = 0;
              let liIdx = 0;
              for (const { file: ef } of entries) {
                if (liIdx >= allLis.length) break;
                const efFm = (deps.app.metadataCache.getCache(ef.path)?.frontmatter as
                  | Record<string, unknown> | undefined) ?? {};
                const efSource = normalizeSource(efFm.source ? String(efFm.source) : "");
                const isHl = folderHighlight.active && efSource !== folderCallerSource;
                if (isHl && allLis[liIdx]) {
                  const li = allLis[liIdx];
                  li.classList.add("rpg-item-highlight");
                  if (!li.querySelector(".rpg-call-highlight__badge")) {
                    const badge = document.createElement("span");
                    badge.className = "rpg-call-highlight__badge";
                    badge.setAttribute("aria-label", efSource || "Homebrew");
                    try {
                      const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
                      setIcon?.(badge, "pen-line");
                    } catch {
                      badge.textContent = "✦";
                    }
                    li.appendChild(badge);
                  }
                }
                liIdx++;
              }
            }, 80);
          }
        }
      }
    })
    .catch((err) => {
      renderError(span, `Folder call failed: ${(err as Error)?.message ?? err}`);
    })
    .finally(() => onResolved?.());
}

function renderError(span: HTMLElement, message: string): void {
  span.classList.remove("rpg-call--pending");
  span.classList.add("rpg-call--error");
  span.textContent = `[call error: ${message}]`;
  span.setAttribute("title", message);
}

function resolveDotPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function renderCellInline(doc: Document, td: HTMLElement, text: string): void {
  const re = /\[\[([^\]\n]+)\]\]/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > 0 && text[m.index - 1] === "@") continue;
    if (m.index > cursor) {
      td.appendChild(doc.createTextNode(text.slice(cursor, m.index)));
    }
    const inner = m[1];
    const pipe = inner.indexOf("|");
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
    const a = doc.createElement("a");
    a.className = "internal-link";
    a.href = target;
    a.setAttribute("data-href", target);
    a.textContent = label;
    td.appendChild(a);
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    td.appendChild(doc.createTextNode(text.slice(cursor)));
  }
  if (td.childNodes.length === 0) {
    td.textContent = text;
  }
}

/**
 * Returns true when Obsidian's "Show inline title" setting is OFF — the
 * user has opted out of displaying the filename-derived H1 at the top of
 * every note. When importing a whole file via a view function, we mirror
 * that preference by stripping the first H1 from the body.
 */
function shouldStripFirstHeading(app: App): boolean {
  try {
    return (app.vault as any).getConfig?.("showInlineTitle") === false;
  } catch {
    return false;
  }
}

/** Remove the first heading (any level) from a markdown body. */
function stripFirstHeading(body: string): string {
  return body.replace(/^\s*#{1,6}\s+[^\n]*\n?/, "");
}

function unwrapCallCodeSpans(root: HTMLElement, deps: RuleCallProcessorDeps, sourcePath: string): void {
  const codes = Array.from(root.querySelectorAll("code"));
  for (const code of codes) {
    if (code.parentElement?.tagName === "PRE") continue;
    const text = code.textContent ?? "";
    if (!WHOLE_CALL_PATTERN.test(text)) continue;
    // Only unwrap when the wikilink target actually resolves to a file —
    // otherwise the user is documenting call syntax (e.g. `@[[file]].fn()`)
    // and we'd turn their docs into broken live calls.
    const parsed = matchAllCalls(text)[0];
    if (!parsed) continue;
    const targetPath = resolveLinkToPath(deps.app, parsed.target, sourcePath);
    if (!targetPath) continue;
    const replacement = document.createTextNode(text.trim());
    code.parentNode?.replaceChild(replacement, code);
  }
  void CALL_PATTERN;
}

/**
 * Before item lists merge, mark <li> elements inside highlighted call
 * spans with a class + badge so they retain styling after the merge
 * moves them into a shared <ul>.
 */
function markHighlightedItems(root: HTMLElement): void {
  const spans = root.querySelectorAll(`.${CALL_CLASS}[data-rpg-highlight-source]`);
  for (const span of Array.from(spans)) {
    const items = span.querySelectorAll("li.rpg-view--item");
    if (items.length === 0) continue;
    const source = span.getAttribute("data-rpg-highlight-source") || "";
    for (const li of Array.from(items)) {
      li.classList.add("rpg-item-highlight");
      if (!li.querySelector(".rpg-call-highlight__badge")) {
        const badge = document.createElement("span");
        badge.className = "rpg-call-highlight__badge";
        badge.setAttribute("aria-label", source || "Homebrew");
        try {
          const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
          setIcon?.(badge, "pen-line");
        } catch {
          badge.textContent = "✦";
        }
        li.appendChild(badge);
      }
    }
  }
}

/**
 * After all calls resolve, merge multiple `<ul>` elements that contain
 * `.rpg-view--item` children AND share the same parent into ONE `<ul>`.
 * Also removes the `<br>` nodes Obsidian inserts between inline elements
 * and the now-empty `.rpg-call` wrapper spans.
 */
function mergeAdjacentItemLists(root: HTMLElement): void {
  const allUls = Array.from(root.querySelectorAll("ul")) as HTMLUListElement[];
  const itemUls = allUls.filter((ul) => ul.querySelector(":scope > .rpg-view--item"));
  if (itemUls.length < 2) return;

  // Group item <ul>s by their .rpg-call span's parent element.
  const byParent = new Map<Element, HTMLUListElement[]>();
  for (const ul of itemUls) {
    const callSpan = ul.closest(`.${CALL_CLASS}`);
    const parent = callSpan?.parentElement;
    if (!parent) continue;
    const group = byParent.get(parent) ?? [];
    group.push(ul);
    byParent.set(parent, group);
  }

  // For each group with multiple <ul>s, merge all into the first.
  for (const [, group] of byParent) {
    if (group.length < 2) continue;
    const target = group[0];
    for (let i = 1; i < group.length; i++) {
      const donor = group[i];
      // Move all <li> from donor into target.
      while (donor.firstChild) target.appendChild(donor.firstChild);
      // Remove the now-empty <ul> and its wrapper span (if it's a
      // DIFFERENT span from the target's — folder calls put multiple
      // <ul>s inside one span, so we must not remove it).
      const donorWrapper = donor.closest(`.${CALL_CLASS}`);
      const targetWrapper = target.closest(`.${CALL_CLASS}`);
      if (donorWrapper && donorWrapper !== targetWrapper) {
        let prev: Node | null = donorWrapper.previousSibling;
        while (
          prev &&
          ((prev.nodeType === Node.ELEMENT_NODE && (prev as Element).tagName === "BR") ||
            (prev.nodeType === Node.TEXT_NODE && !prev.textContent?.trim()))
        ) {
          const toRemove = prev;
          prev = prev.previousSibling;
          toRemove.parentNode?.removeChild(toRemove);
        }
        donorWrapper.remove();
      } else {
        donor.remove();
      }
    }
  }
}

/**
 * Remove `<br>` elements and whitespace text nodes between adjacent
 * `.rpg-call` spans that share the same parent. Obsidian inserts `<br>`
 * when call tokens appear on consecutive lines in source markdown.
 */
function removeBrBetweenSiblingCalls(root: HTMLElement): void {
  const allCalls = Array.from(root.querySelectorAll(`.${CALL_CLASS}`)) as HTMLElement[];
  if (allCalls.length < 2) return;

  for (let i = 0; i < allCalls.length - 1; i++) {
    const a = allCalls[i];
    const b = allCalls[i + 1];
    if (a.parentElement !== b.parentElement) continue;

    let node: Node | null = a.nextSibling;
    while (node && node !== b) {
      const next: Node | null = node.nextSibling;
      if (
        (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "BR") ||
        (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim())
      ) {
        node.parentNode?.removeChild(node);
      } else {
        break;
      }
      node = next;
    }
  }
}

/**
 * After all calls resolve, group adjacent `.rpg-call--tab` spans into
 * a single TabGroupView. Each span stores its tab data as JSON in a
 * data attribute; this pass collects groups, renders one tab view per
 * group, and removes the extra spans.
 */
function mergeAdjacentCallTabs(root: HTMLElement): void {
  const allTabs = Array.from(root.querySelectorAll(".rpg-call--tab")) as HTMLElement[];
  if (allTabs.length === 0) return;

  const groups: HTMLElement[][] = [];
  let current: HTMLElement[] = [allTabs[0]];

  for (let i = 1; i < allTabs.length; i++) {
    if (isCallTabAdjacent(allTabs[i - 1], allTabs[i])) {
      current.push(allTabs[i]);
    } else {
      groups.push(current);
      current = [allTabs[i]];
    }
  }
  groups.push(current);

  for (const group of groups) {
    const tabs: RuleTabBlock[] = [];
    let sourcePath = "";
    for (const el of group) {
      const json = el.getAttribute("data-rpg-call-tab-json");
      if (!json) continue;
      try { tabs.push(JSON.parse(json) as RuleTabBlock); } catch { continue; }
      if (!sourcePath) sourcePath = el.getAttribute("data-rpg-call-tab-source") ?? "";
    }
    if (tabs.length === 0) continue;
    const leader = group[0];
    leader.classList.remove("rpg-call--tab");
    leader.removeAttribute("data-rpg-call-tab-json");
    leader.removeAttribute("data-rpg-call-tab-source");
    const tabRoot = ReactDOM.createRoot(leader);
    tabRoot.render(<TabGroupView tabs={tabs} sourcePath={sourcePath} />);
    for (let i = 1; i < group.length; i++) {
      let prev: Node | null = group[i].previousSibling;
      while (
        prev &&
        ((prev.nodeType === Node.ELEMENT_NODE && (prev as Element).tagName === "BR") ||
          (prev.nodeType === Node.TEXT_NODE && !prev.textContent?.trim()))
      ) {
        const toRemove = prev;
        prev = prev.previousSibling;
        toRemove.parentNode?.removeChild(toRemove);
      }
      group[i].remove();
    }
  }
}

function isCallTabAdjacent(a: HTMLElement, b: HTMLElement): boolean {
  if (a.parentElement !== b.parentElement) return false;
  let node: Node | null = a.nextSibling;
  while (node) {
    if (node === b) return true;
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "BR") {
      node = node.nextSibling;
      continue;
    }
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node = node.nextSibling;
      continue;
    }
    return false;
  }
  return false;
}

/** Check if two sibling elements are adjacent (only whitespace text nodes between). */
function areAdjacent(a: Element, b: Element): boolean {

  let node: Node | null = a.nextSibling;
  while (node) {
    if (node === b) return true;
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node = node.nextSibling;
      continue;
    }
    return false;
  }
  return false;
}

/**
 * Walk backwards from a call span to find the nearest preceding `<table>`
 * element. Looks up through parent containers (`.rpg-call` → `<p>` →
 * `.el-p` → then checks previous siblings for `.el-table > table`).
 */
function findPrecedingTable(span: HTMLElement): HTMLTableElement | null {
  let section: HTMLElement | null = span;
  while (section && !section.classList?.contains("el-p") && section.parentElement) {
    section = section.parentElement;
  }
  if (!section) return null;

  let prev: Element | null = section.previousElementSibling;
  while (prev) {
    if (prev.classList?.contains("el-table")) {
      const table = prev.querySelector("table");
      if (table) return table as HTMLTableElement;
    }
    if (prev.tagName === "TABLE") return prev as HTMLTableElement;
    prev = prev.previousElementSibling;
  }
  return null;
}

/**
 * Post-render pass: find `.rpg-call` spans containing a standalone
 * `<table class="rpg-view--table">` (the React fallback for row() views).
 * If a preceding markdown table exists in the DOM, move the `<tr>` rows
 * from the React table into that markdown table's `<tbody>` and remove
 * the standalone table + call span. Runs after React has committed (in
 * the setTimeout(100) callback alongside item merging).
 */
function mergeTableRows(root: HTMLElement): void {
  const reactTables = root.querySelectorAll("table.rpg-view--table");
  for (const reactTable of Array.from(reactTables)) {
    const callSpan = reactTable.closest(`.${CALL_CLASS}`) as HTMLElement | null;
    if (!callSpan || !callSpan.isConnected) continue;

    const highlightSource = callSpan.getAttribute("data-rpg-highlight-source");

    const hostTd = callSpan.closest("td");
    if (hostTd) {
      const hostTr = hostTd.closest("tr");
      if (hostTr && hostTr.parentElement) {
        const hostIndent = hostTd.getAttribute("data-indent");
        const sourceBody = reactTable.querySelector("tbody") ?? reactTable;
        const rows = Array.from(sourceBody.querySelectorAll("tr"));
        for (const row of rows) {
          if (hostIndent) {
            const firstTd = row.querySelector("td");
            if (firstTd) firstTd.setAttribute("data-indent", hostIndent);
          }
          if (highlightSource !== null) {
            row.classList.add("rpg-row-highlight");
            const lastTd = row.querySelector("td:last-child");
            if (lastTd && !lastTd.querySelector(".rpg-call-highlight__badge")) {
              const badge = document.createElement("span");
              badge.className = "rpg-call-highlight__badge";
              badge.setAttribute("aria-label", highlightSource || "Homebrew");
              try {
                const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
                setIcon?.(badge, "pen-line");
              } catch {
                badge.textContent = "✦";
              }
              lastTd.appendChild(badge);
            }
          }
          hostTr.parentElement.insertBefore(row, hostTr);
        }
        hostTr.remove();
        continue;
      }
    }

    const precedingTable = findPrecedingTable(callSpan);
    if (!precedingTable) continue;
    let targetBody = precedingTable.querySelector("tbody");
    if (!targetBody) {
      targetBody = document.createElement("tbody");
      precedingTable.appendChild(targetBody);
    }
    const sourceBody = reactTable.querySelector("tbody") ?? reactTable;
    const rows = Array.from(sourceBody.querySelectorAll("tr"));
    for (const row of rows) {
      if (highlightSource !== null) {
        row.classList.add("rpg-row-highlight");
        const lastTd = row.querySelector("td:last-child");
        if (lastTd && !lastTd.querySelector(".rpg-call-highlight__badge")) {
          const badge = document.createElement("span");
          badge.className = "rpg-call-highlight__badge";
          badge.setAttribute("aria-label", highlightSource || "Homebrew");
          try {
            const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
            setIcon?.(badge, "pen-line");
          } catch {
            badge.textContent = "✦";
          }
          lastTd.appendChild(badge);
        }
      }
      targetBody.appendChild(row);
    }
    const parent = callSpan.parentElement;
    callSpan.remove();
    if (parent && !parent.textContent?.trim() && parent.tagName !== "DIV") {
      parent.remove();
    }
  }
}

/**
 * Global observer that watches for `.rpg-view--table` elements appearing
 * anywhere in reading views. When one appears AND is connected, finds
 * the preceding markdown table and merges rows into it.
 *
 * Call once at plugin load from main.ts.
 */
export function setupGlobalTableMerger(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        // Check if this added subtree contains a .rpg-view--table
        const tables = node.querySelectorAll
          ? Array.from(node.querySelectorAll("table.rpg-view--table"))
          : [];
        if (node instanceof HTMLTableElement && node.classList.contains("rpg-view--table")) {
          tables.push(node);
        }
        for (const reactTable of tables) {
          const callSpan = reactTable.closest(`.${CALL_CLASS}`) as HTMLElement | null;
          if (!callSpan || !callSpan.isConnected) continue;

          const highlightSource = callSpan.getAttribute("data-rpg-highlight-source");

          // Case 1: call is INSIDE a table cell (inline row syntax).
          // Replace the host <tr> with the rendered rows.
          const hostTd = callSpan.closest("td");
          if (hostTd) {
            const hostTr = hostTd.closest("tr");
            if (hostTr) {
              const hostIndent = hostTd.getAttribute("data-indent");
              const sourceBody = reactTable.querySelector("tbody") ?? reactTable;
              const rows = Array.from(sourceBody.querySelectorAll("tr"));
              for (const row of rows) {
                if (hostIndent) {
                  const firstTd = row.querySelector("td");
                  if (firstTd) firstTd.setAttribute("data-indent", hostIndent);
                }
                if (highlightSource !== null) {
                  row.classList.add("rpg-row-highlight");
                  const lastTd = row.querySelector("td:last-child");
                  if (lastTd && !lastTd.querySelector(".rpg-call-highlight__badge")) {
                    const badge = document.createElement("span");
                    badge.className = "rpg-call-highlight__badge";
                    badge.setAttribute("aria-label", highlightSource || "Homebrew");
                    try {
                      const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
                      setIcon?.(badge, "pen-line");
                    } catch {
                      badge.textContent = "✦";
                    }
                    lastTd.appendChild(badge);
                  }
                }
                hostTr.parentElement?.insertBefore(row, hostTr);
              }
              hostTr.remove();
              continue;
            }
          }

          // Case 2: call is BELOW a table (preceding sibling).
          const precedingTable = findPrecedingTable(callSpan);
          if (!precedingTable) continue;
          // Ensure a <tbody> exists; markdown tables with no data rows
          // render only <thead> without a <tbody>.
          let targetBody = precedingTable.querySelector("tbody");
          if (!targetBody) {
            targetBody = document.createElement("tbody");
            precedingTable.appendChild(targetBody);
          }
          const sourceBody = reactTable.querySelector("tbody") ?? reactTable;
          const rows = Array.from(sourceBody.querySelectorAll("tr"));
          for (const row of rows) {
            if (highlightSource !== null) {
              row.classList.add("rpg-row-highlight");
              const lastTd = row.querySelector("td:last-child");
              if (lastTd && !lastTd.querySelector(".rpg-call-highlight__badge")) {
                const badge = document.createElement("span");
                badge.className = "rpg-call-highlight__badge";
                badge.setAttribute("aria-label", highlightSource || "Homebrew");
                try {
                  const { setIcon } = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
                  setIcon?.(badge, "pen-line");
                } catch {
                  badge.textContent = "✦";
                }
                lastTd.appendChild(badge);
              }
            }
            targetBody.appendChild(row);
          }
          // Remove the call span
          const parent = callSpan.parentElement;
          callSpan.remove();
          if (parent && !parent.textContent?.trim() && parent.tagName !== "DIV") {
            parent.remove();
          }
        }
      }
    }
  });

  // Observe all preview sizers in the workspace
  const attach = () => {
    const sizers = document.querySelectorAll(".markdown-preview-sizer");
    for (const sizer of Array.from(sizers)) {
      if ((sizer as any).__rpgTableObserved) continue;
      (sizer as any).__rpgTableObserved = true;
      observer.observe(sizer, { childList: true, subtree: true });
    }
  };

  // Attach now + re-attach when layout changes (new tabs, split panes)
  attach();
  const interval = setInterval(attach, 2000);
  // Clean up on plugin unload — caller registers the dispose.
  (setupGlobalTableMerger as any).dispose = () => {
    clearInterval(interval);
    observer.disconnect();
  };
}

/**
 * Stored deps for `processCallsInContainer`. Set once when
 * `buildRuleCallProcessor` is called from main.ts plugin init.
 */
let _storedDeps: RuleCallProcessorDeps | null = null;

/** Called by `buildRuleCallProcessor` to stash deps for later use. */
function storeDeps(deps: RuleCallProcessorDeps): void {
  _storedDeps = deps;
}

/**
 * Process `@[[file]].fn(args)` call tokens inside an already-rendered
 * container (e.g., the `<Markdown>` component's output). Mirrors the
 * code-element scan from the main post-processor so call tokens inside
 * rule.related, tab bodies, and other React-rendered markdown resolve.
 */
export function processCallsInContainer(
  container: HTMLElement,
  sourcePath: string,
  parent: { register: (cb: () => void) => void }
): void {
  if (!_storedDeps) return;
  const deps = _storedDeps;

  const codeHits: Array<{ code: HTMLElement; call: ParsedCall }> = [];
  const codes = Array.from(container.querySelectorAll("code"));
  for (const code of codes) {
    if (code.parentElement?.tagName === "PRE") continue;
    const text = code.textContent ?? "";
    if (!WHOLE_CALL_PATTERN.test(text)) continue;
    const parsed = matchAllCalls(text)[0];
    if (!parsed) continue;
    const isFolder = parsed.target.endsWith("/");
    if (!isFolder) {
      const targetPath = resolveLinkToPath(deps.app, parsed.target, sourcePath);
      if (!targetPath) continue;
    } else {
      const folder = resolveFolderPath(deps.app, parsed.target);
      if (!folder) continue;
    }
    codeHits.push({ code, call: parsed });
  }

  if (codeHits.length === 0) return;

  const child = new MarkdownRenderChild(container);
  parent.register(() => child.unload());
  child.load();
  let childUnloaded = false;
  child.register(() => { childUnloaded = true; });

  for (const { code, call } of codeHits) {
    const span = document.createElement("span");
    span.classList.add(CALL_CLASS);
    span.classList.add("rpg-call--pending");
    span.setAttribute("data-call", call.source);
    span.textContent = call.source;
    code.parentNode?.replaceChild(span, code);
    resolveCall(span, call, deps, { sourcePath, addChild: (c: MarkdownRenderChild) => child.addChild(c) } as any, child, () => childUnloaded);
  }
}
