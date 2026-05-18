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

import { App, MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { matchAllCalls, type ParsedCall, CALL_PATTERN } from "lib/domains/references/parse-call";
import { extractAllRpgFences } from "lib/domains/references/fence-scan";
import type { FileRefCache } from "lib/domains/references";
import { parseRuleContent } from "lib/domains/rules/parse-rule-block";
import type { SystemRegistry } from "lib/systems/registry";
import type { RuleViewCtx, RuleViewEntry, RuleViewMode } from "lib/systems/rule-views";

export interface RuleCallProcessorDeps {
  app: App;
  cache: FileRefCache;
  registry: SystemRegistry;
}

const SKIP_TAGS = new Set(["A", "PRE"]);
const CALL_CLASS = "rpg-call";

/** Matches an inline-code element whose entire text content is exactly
 *  one `@[[file]].fn(args)` token. Authors wrap calls in backticks so
 *  the markdown parser doesn't mangle the `[[…]]` as a wikilink. */
const WHOLE_CALL_PATTERN = /^\s*@\[\[[^\]\n]+\]\]\.[A-Za-z_][\w-]*\([^)\n]*\)\s*$/;

export function buildRuleCallProcessor(deps: RuleCallProcessorDeps) {
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
      // Verify target resolves to a real file — skip documentation
      // placeholders like `@[[file]].fn()`.
      const targetPath = resolveLinkToPath(deps.app, parsed.target, ctx.sourcePath);
      if (!targetPath) continue;
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
  const targetPath = resolveLinkToPath(deps.app, call.target, ctx.sourcePath);
  if (!targetPath) {
    renderError(span, `Cannot resolve wikilink [[${call.target}]]`);
    return;
  }

  const mappedSystemPath = deps.registry.findSystemFolderForFile(ctx.sourcePath);
  void Promise.all([
    deps.app.vault.adapter.read(targetPath),
    mappedSystemPath ? deps.registry.loadSystemAsync(mappedSystemPath) : Promise.resolve(null),
  ])
    .then(([raw, _]) => {
      if (isUnloaded()) return;

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

      const cleaned = stripLocalFences(raw);
      const fenced = extractContentBlocks(cleaned);
      const fileName = targetPath.split("/").pop()?.replace(/\.md$/, "") ?? targetPath;
      const fileFm = (deps.app.metadataCache.getCache(targetPath)?.frontmatter as
        | Record<string, unknown>
        | undefined) ?? {};

      let viewArgs = call.args;
      let matching: HarvestedBlock[] = fenced;
      let wholeFile = false;
      const firstArg = call.args[0];
      if (typeof firstArg === "string") {
        const filtered = fenced.filter((b) => b.frontmatter.id === firstArg);
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
          wholeFileBody = stripFileFrontmatter(cleaned);
          // When Obsidian's "Show inline title" is OFF, the source file's
          // first H1 is redundant (the view function adds its own heading).
          // Strip it so the import doesn't double the title.
          if (shouldStripFirstHeading(deps.app)) {
            wholeFileBody = stripFirstHeading(wholeFileBody);
          }
        }
        const node = renderByMode(
          view, matching, viewArgs, fileName, targetPath,
          wholeFileBody, fileFm
        );
        root.render(<>{node}</>);
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
    if (f.entity !== "rule" || f.block !== "content") continue;
    // Re-extract the raw fence body (fence-scan parses pure YAML, but
    // rule.content uses YAML + `---` + markdown). Slice from the host
    // text using the fence offsets.
    const inner = sliceFenceBody(text, f.start, f.end);
    const parsed = parseRuleContent(inner);
    out.push({ body: parsed.body, frontmatter: parsed.frontmatter });
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

function renderError(span: HTMLElement, message: string): void {
  span.classList.remove("rpg-call--pending");
  span.classList.add("rpg-call--error");
  span.textContent = `[call error: ${message}]`;
  span.setAttribute("title", message);
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

/** Remove the first `# Heading` line from a markdown body. */
function stripFirstHeading(body: string): string {
  return body.replace(/^#\s+[^\n]*\n?/, "");
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
      // Remove the now-empty wrapper span (and any preceding <br>).
      const wrapper = donor.closest(`.${CALL_CLASS}`);
      if (wrapper) {
        let prev: Node | null = wrapper.previousSibling;
        while (
          prev &&
          ((prev.nodeType === Node.ELEMENT_NODE && (prev as Element).tagName === "BR") ||
            (prev.nodeType === Node.TEXT_NODE && !prev.textContent?.trim()))
        ) {
          const toRemove = prev;
          prev = prev.previousSibling;
          toRemove.parentNode?.removeChild(toRemove);
        }
        wrapper.remove();
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
  // This per-section version is a no-op — table merging is handled by
  // the global MutationObserver (setupGlobalTableMerger) which has
  // access to the full page DOM and fires the instant React commits.
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

          // Case 1: call is INSIDE a table cell (inline row syntax).
          // Replace the host <tr> with the rendered rows.
          const hostTd = callSpan.closest("td");
          if (hostTd) {
            const hostTr = hostTd.closest("tr");
            if (hostTr) {
              const sourceBody = reactTable.querySelector("tbody") ?? reactTable;
              const rows = Array.from(sourceBody.querySelectorAll("tr"));
              for (const row of rows) {
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
          for (const row of rows) targetBody.appendChild(row);
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
