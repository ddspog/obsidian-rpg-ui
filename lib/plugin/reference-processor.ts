/**
 * Markdown post-processor that turns `@[[File]].path` inline references
 * into resolved, live-updating DOM nodes.
 *
 *   Original text → `…, cost is @[[Longsword]].item.element.cost, …`
 *   Rendered HTML → `…, cost is <span class="rpg-ref" …>15 gp</span>, …`
 *
 * The post-processor walks every `#text` node in the rendered region
 * (skipping content inside `<pre>`, `<code>`, `<a>`, and our own
 * `.rpg-ref` spans so we don't overwrite Obsidian's native wikilink
 * anchors or pre-rendered code). Matches get swapped for a span the
 * ReferenceRegistry tracks — live updates flow through `register()`'s
 * `render` callback.
 */

import { App, MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from "obsidian";
import { matchAllReferences, type ParsedRef, type ResolveResult } from "lib/domains/references";
import type { FileRefCache } from "lib/domains/references";
import { resolveReference } from "lib/domains/references";
import type { ReferenceRegistry } from "./reference-registry";

export interface ReferenceProcessorDeps {
  app: App;
  cache: FileRefCache;
  registry: ReferenceRegistry;
}

/** Skip these tag names when walking text nodes so we don't clobber
 *  pre-rendered wikilink anchors, code blocks, or previously
 *  post-processed reference spans (on secondary runs). `<code>` is
 *  intentionally absent — inline code spans (` `` `) are the author's
 *  escape hatch for writing references without markdown interpreting
 *  the `[[…]]` as a wikilink. We handle them via `unwrapRefCodeSpans`
 *  below so the rendered output reads as a plain value. */
const SKIP_TAGS = new Set(["A", "PRE"]);
const REF_CLASS = "rpg-ref";

/** Matches an inline-code element whose entire text content is a
 *  single `@[[…]].path` reference. We use this to strip the code
 *  wrapper so the rendered value isn't typeset as monospaced text. */
const WHOLE_REF_PATTERN = /^\s*@\[\[[^\]\n]+\]\](?:\.[A-Za-z_][\w-]*|\[[^\]\n]+\])+\s*$/;

/** Factory returning the post-processor callback. */
export function buildReferenceProcessor(deps: ReferenceProcessorDeps) {
  return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    // First pass: unwrap `<code>` spans that hold exactly one reference.
    // Authors wrap refs in backticks to stop markdown from auto-linking
    // the `[[…]]`; the code wrapper is purely to survive parsing, not
    // a styling choice.
    unwrapRefCodeSpans(el);

    const found: Array<{ node: Text; match: ReturnType<typeof matchAllReferences>[number] }> = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Reject nodes that sit inside tags we don't touch. Walks up
        // via parentElement — the tree walker itself doesn't filter
        // by element ancestry, so we do it here.
        let p: HTMLElement | null = (node as Text).parentElement;
        while (p) {
          if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.classList?.contains(REF_CLASS)) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const textNode = node as Text;
      const matches = matchAllReferences(textNode.data);
      for (const m of matches) found.push({ node: textNode, match: m });
    }

    if (found.length === 0) return;

    // Group matches by host text node so we can safely splice each in
    // a single reverse pass (later matches first — indices stay valid).
    const byNode = new Map<Text, (typeof found)[number][]>();
    for (const f of found) {
      const arr = byNode.get(f.node) ?? [];
      arr.push(f);
      byNode.set(f.node, arr);
    }

    const child = new MarkdownRenderChild(el);
    ctx.addChild(child);

    for (const [node, matches] of byNode) {
      matches.sort((a, b) => b.match.start - a.match.start);
      for (const m of matches) {
        replaceRange(node, m.match.start, m.match.end, m.match, deps, ctx, child);
      }
    }
  };
}

/** Splice a single `@[[…]]` run out of a text node, replacing it with
 *  a freshly-minted `.rpg-ref` span that the registry tracks. */
function replaceRange(
  node: Text,
  start: number,
  end: number,
  ref: ParsedRef,
  deps: ReferenceProcessorDeps,
  ctx: MarkdownPostProcessorContext,
  child: MarkdownRenderChild
): void {
  const after = node.splitText(end);
  const middle = node.splitText(start);
  // `middle` now holds exactly the reference substring; we replace
  // it with a placeholder span and kick off the async resolve.
  const span = document.createElement("span");
  span.classList.add(REF_CLASS);
  span.classList.add("rpg-ref--pending");
  span.setAttribute("data-ref", ref.source);
  span.setAttribute("aria-label", ref.source);
  span.textContent = ref.source;
  middle.parentNode?.replaceChild(span, middle);
  void after; // silence unused — splitText returns the tail we keep in-place

  const targetPath = resolveLinkToPath(deps.app, ref.target, ctx.sourcePath);
  if (!targetPath) {
    renderResult(
      {
        kind: "missing",
        value: undefined,
        trace: ref.source,
        reason: `Cannot resolve wikilink [[${ref.target}]]`,
      },
      span,
      deps
    );
    return;
  }

  const render = (result: ResolveResult, el: HTMLElement) => renderResult(result, el, deps);
  const detach = deps.registry.register(span, { ref, targetPath, render });
  child.register(detach);

  // First render — resolve against the (possibly cached) view.
  void deps.cache.get(targetPath).then((view) => {
    if (!span.isConnected) return;
    const result = view
      ? resolveReference(ref, view)
      : {
          kind: "missing" as const,
          value: undefined,
          trace: ref.source,
          reason: `File not found: ${targetPath}`,
        };
    renderResult(result, span, deps);
  });
}

function resolveLinkToPath(app: App, link: string, sourcePath: string): string | null {
  // Strip a `|alias` suffix before handing to metadataCache — aliases
  // don't affect file resolution.
  const clean = link.split("|")[0].trim();
  const file = app.metadataCache.getFirstLinkpathDest(clean, sourcePath);
  return file instanceof TFile ? file.path : null;
}

/**
 * Swap a span's content to reflect the newest ResolveResult. Shared
 * between first render and live updates so style + data-state stay in
 * lockstep with whatever the registry last handed us.
 */
function renderResult(result: ResolveResult, el: HTMLElement, deps: ReferenceProcessorDeps): void {
  el.classList.remove("rpg-ref--pending");
  el.classList.remove("rpg-ref--missing");
  el.classList.remove("rpg-ref--invalid");
  el.classList.remove("rpg-ref--scalar");
  el.classList.remove("rpg-ref--object");
  el.classList.remove("rpg-ref--array");

  switch (result.kind) {
    case "missing":
      el.classList.add("rpg-ref--missing");
      el.textContent = `[missing: ${result.trace || el.getAttribute("data-ref") || "?"}]`;
      if (result.reason) el.setAttribute("title", result.reason);
      return;
    case "invalid":
      el.classList.add("rpg-ref--invalid");
      el.textContent = `[invalid: ${result.trace || el.getAttribute("data-ref") || "?"}]`;
      if (result.reason) el.setAttribute("title", result.reason);
      return;
    case "scalar":
      el.classList.add("rpg-ref--scalar");
      renderScalar(el, result.value, deps);
      return;
    case "array":
      el.classList.add("rpg-ref--array");
      renderArray(el, result.value as unknown[], deps);
      return;
    case "object":
      el.classList.add("rpg-ref--object");
      el.textContent = compactObject(result.value as Record<string, unknown>);
      return;
  }
}

/** Scalars: numbers / booleans → toString, strings → mixed plain text
 *  + internal-link anchors for any `[[Wikilink]]` embedded within. So
 *  `"[[Cumbersome]] (STR 13)"` surfaces both the clickable "Cumbersome"
 *  link and the trailing plain text. */
function renderScalar(el: HTMLElement, value: unknown, deps: ReferenceProcessorDeps): void {
  while (el.firstChild) el.removeChild(el.firstChild);
  if (typeof value === "string") {
    renderInlineMarkdown(el, value);
    return;
  }
  el.textContent = String(value);
  void deps;
}

/** Split a plain string into text segments interleaved with `<a>`
 *  anchors for every `[[Wikilink]]` substring. Shared-shape with the
 *  inventory-row notes renderer so values coming through a reference
 *  behave the same as inline-authored notes. */
function renderInlineMarkdown(el: HTMLElement, text: string): void {
  const re = /\[\[([^\]\n]+)\]\]/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) {
      el.appendChild(document.createTextNode(text.slice(cursor, m.index)));
    }
    const inner = m[1];
    const pipe = inner.indexOf("|");
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
    const a = document.createElement("a");
    a.className = "internal-link";
    a.setAttribute("href", target);
    a.setAttribute("data-href", target);
    a.textContent = label;
    el.appendChild(a);
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    el.appendChild(document.createTextNode(text.slice(cursor)));
  }
  // Pure text fast path — avoids an empty wikilink regex run on every
  // plain string (the `while` above exits immediately anyway but this
  // keeps the happy-path shape clear to a reader).
  if (cursor === 0 && el.childNodes.length === 0) {
    el.textContent = text;
  }
}

/** Arrays: comma-join scalars, collapse mixed content to compact JSON. */
function renderArray(el: HTMLElement, arr: unknown[], deps: ReferenceProcessorDeps): void {
  while (el.firstChild) el.removeChild(el.firstChild);
  const allScalar = arr.every((v) => typeof v !== "object" || v === null);
  if (allScalar) {
    arr.forEach((v, i) => {
      if (i > 0) el.appendChild(document.createTextNode(", "));
      const child = document.createElement("span");
      child.className = "rpg-ref__item";
      renderScalar(child, v, deps);
      el.appendChild(child);
    });
    return;
  }
  el.textContent = JSON.stringify(arr);
}

function compactObject(o: Record<string, unknown>): string {
  try {
    return JSON.stringify(o);
  } catch {
    return "[object]";
  }
}

/**
 * Unwrap every inline `<code>` element whose text content is exactly
 * one `@[[File]].path` reference. Replaces `<code>@[[X]].y</code>` with
 * a plain text node containing the same reference text — the regular
 * text walker below then splices the actual ref span in place. Authors
 * use backticks to keep markdown from auto-linking the wikilink; we
 * honour that intent while peeling the code styling off.
 */
function unwrapRefCodeSpans(root: HTMLElement): void {
  // Only inline code is targeted — `<pre><code>` code blocks stay
  // untouched (their author wanted literal code text, not a live ref).
  const codes = Array.from(root.querySelectorAll("code"));
  for (const code of codes) {
    if (code.parentElement?.tagName === "PRE") continue;
    const text = code.textContent ?? "";
    if (!WHOLE_REF_PATTERN.test(text)) continue;
    const replacement = document.createTextNode(text.trim());
    code.parentNode?.replaceChild(replacement, code);
  }
}
