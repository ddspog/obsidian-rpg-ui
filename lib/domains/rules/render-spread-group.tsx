/**
 * Spread-group merge system for `rpg rule.side` with `kind: spread`.
 *
 * Follows the exact architecture of `render-tab-group.tsx`: each spread
 * block's RenderChild calls `scheduleSpreadMerge(el)` on load, which
 * retries until connected, finds the sizer, debounces 200ms, then calls
 * `runSpreadMerge(sizer)`. A MutationObserver on the sizer re-triggers
 * the merge when Obsidian's virtualization adds/removes elements,
 * guarded by a `mergingNow` WeakSet to prevent infinite loops.
 *
 * Unlike tabs, spread merge doesn't replace content — it just wraps
 * consecutive spread items in a `<div class="rpg-rule-side-spread-group">`
 * flex container and hides intervening headings.
 */

const SPREAD_ITEM_CLASS = "rpg-rule-side-spread-item";
const SPREAD_GROUP_CLASS = "rpg-rule-side-spread-group";

const pendingSpreadMerges = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const observedSpreadSizers = new WeakSet<HTMLElement>();
const mergingNow = new WeakSet<HTMLElement>();

/**
 * Find the `.el-pre` or `.block-language-rpg` wrapper around a spread item,
 * or the element itself if no wrapper is found.
 */
function getElPre(el: HTMLElement): HTMLElement | null {
  return (el.closest(".el-pre") ??
    el.closest("[class*='block-language-']") ??
    el) as HTMLElement | null;
}

/**
 * Check if two elements are adjacent siblings, skipping whitespace text
 * nodes and heading elements (el-h*).
 */
function isSiblingAdjacent(a: Element, b: Element): boolean {
  let node: Node | null = a.nextSibling;
  while (node) {
    if (node === b) return true;
    // Skip whitespace text nodes
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node = node.nextSibling;
      continue;
    }
    // Skip heading elements (el-h1 through el-h6)
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (/^el-h[1-6]$/i.test(el.className?.split?.(" ")?.[0] ?? "") ||
          el.className?.match?.(/\bel-h[1-6]\b/)) {
        node = node.nextSibling;
        continue;
      }
    }
    return false;
  }
  return false;
}

/**
 * Check if the element is the last meaningful content child (ignoring
 * trailing whitespace and headings).
 */
function isLastContentChild(el: Element): boolean {
  let node: Node | null = el.nextSibling;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node = node.nextSibling;
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const htmlEl = node as HTMLElement;
      if (/^el-h[1-6]$/i.test(htmlEl.className?.split?.(" ")?.[0] ?? "") ||
          htmlEl.className?.match?.(/\bel-h[1-6]\b/)) {
        node = node.nextSibling;
        continue;
      }
    }
    return false;
  }
  return true;
}

/**
 * Check if the element is the first meaningful content child (ignoring
 * preceding whitespace and headings).
 */
function isFirstContentChild(el: Element): boolean {
  let node: Node | null = el.previousSibling;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node = node.previousSibling;
      continue;
    }
    // Skip heading elements
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (/^el-h[1-6]$/i.test(el.className?.split?.(" ")?.[0] ?? "") ||
          el.className?.match?.(/\bel-h[1-6]\b/)) {
        node = node.previousSibling;
        continue;
      }
    }
    return false;
  }
  return true;
}

/**
 * Check if two wrapper blocks are adjacent — either direct siblings
 * (skipping headings) or across section boundaries where the first is
 * last child and second is first child.
 * Fallback: if both share the same parent, treat as adjacent regardless
 * (Obsidian's DOM sometimes prevents sibling traversal).
 */
function areAdjacentBlocks(a: HTMLElement, b: HTMLElement): boolean {
  if (a.parentElement === b.parentElement) {
    if (isSiblingAdjacent(a, b)) return true;
    // Fallback: same parent means they're siblings — Obsidian's
    // virtualized DOM sometimes has null nextSibling even for real siblings
    return true;
  }
  const sectionA = a.parentElement;
  const sectionB = b.parentElement;
  if (!sectionA || !sectionB) return false;
  if (!isLastContentChild(a)) return false;
  if (!isFirstContentChild(b)) return false;
  return isSiblingAdjacent(sectionA, sectionB);
}

/**
 * Schedule a spread merge. Retries until the element is connected and
 * a sizer container can be found, then debounces 200ms before running.
 */
export function scheduleSpreadMerge(spreadEl: HTMLElement, retries = 8): void {
  if (!spreadEl.isConnected) {
    if (retries > 0) {
      setTimeout(() => scheduleSpreadMerge(spreadEl, retries - 1), 150);
    }
    return;
  }

  const sizer = (spreadEl.closest(".markdown-preview-sizer") ??
    spreadEl.closest(".rpg-rule-side__body")) as HTMLElement | null;
  if (!sizer) {
    if (retries > 0) {
      setTimeout(() => scheduleSpreadMerge(spreadEl, retries - 1), 150);
    }
    return;
  }

  const existing = pendingSpreadMerges.get(sizer);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pendingSpreadMerges.delete(sizer);
    runSpreadMerge(sizer);
  }, 200);
  pendingSpreadMerges.set(sizer, timer);

  if (!observedSpreadSizers.has(sizer)) {
    observedSpreadSizers.add(sizer);
    const observer = new MutationObserver(() => {
      if (mergingNow.has(sizer)) return;
      if (sizer.querySelector(`.${SPREAD_ITEM_CLASS}`)) {
        const ex = pendingSpreadMerges.get(sizer);
        if (ex) clearTimeout(ex);
        const t = setTimeout(() => {
          pendingSpreadMerges.delete(sizer);
          runSpreadMerge(sizer);
        }, 300);
        pendingSpreadMerges.set(sizer, t);
      }
    });
    observer.observe(sizer, { childList: true, subtree: true });
  }
}

/**
 * Run the spread merge: find all spread items in the sizer, group
 * consecutive ones by adjacency, and wrap each group in a flex container.
 */
function runSpreadMerge(sizer: HTMLElement): void {
  if (mergingNow.has(sizer)) return;
  mergingNow.add(sizer);

  try {
    const allItems = Array.from(
      sizer.querySelectorAll(`.${SPREAD_ITEM_CLASS}`)
    ) as HTMLElement[];
    if (allItems.length === 0) return;

    // Get wrappers for each spread item
    const wrappers: HTMLElement[] = [];
    for (const item of allItems) {
      const w = getElPre(item);
      if (w) wrappers.push(w);
    }
    if (wrappers.length === 0) return;

    // Remove existing spread groups that are now stale (Obsidian may have
    // re-virtualized and broken them apart)
    const existingGroups = sizer.querySelectorAll(`.${SPREAD_GROUP_CLASS}`);
    for (const group of Array.from(existingGroups)) {
      // Move children back out before removing the group wrapper
      const parent = group.parentElement;
      if (parent) {
        while (group.firstChild) {
          parent.insertBefore(group.firstChild, group);
        }
        group.remove();
      }
    }

    // Re-query after unwrapping — positions may have changed
    const freshItems = Array.from(
      sizer.querySelectorAll(`.${SPREAD_ITEM_CLASS}`)
    ) as HTMLElement[];
    if (freshItems.length === 0) return;

    const freshWrappers: HTMLElement[] = [];
    for (const item of freshItems) {
      const w = getElPre(item);
      if (w && !freshWrappers.includes(w)) freshWrappers.push(w);
    }
    if (freshWrappers.length === 0) return;

    // Group consecutive wrappers by adjacency
    const groups: HTMLElement[][] = [];
    let current: HTMLElement[] = [freshWrappers[0]];

    for (let i = 1; i < freshWrappers.length; i++) {
      if (areAdjacentBlocks(freshWrappers[i - 1], freshWrappers[i])) {
        current.push(freshWrappers[i]);
      } else {
        groups.push(current);
        current = [freshWrappers[i]];
      }
    }
    groups.push(current);

    // Wrap each group of 2+ items in a flex container
    for (const group of groups) {
      if (group.length < 2) continue;

      // Already wrapped? Skip.
      if (group[0].parentElement?.classList.contains(SPREAD_GROUP_CLASS)) continue;

      const container = document.createElement("div");
      container.className = SPREAD_GROUP_CLASS;

      // Collect intervening headings between group items to move into container
      const firstWrapper = group[0];
      const parent = firstWrapper.parentElement;
      if (!parent) continue;

      // Insert the container before the first wrapper
      parent.insertBefore(container, firstWrapper);

      // Move each wrapper (and any headings between them) into the container
      for (let i = 0; i < group.length; i++) {
        const wrapper = group[i];

        // Collect heading nodes between previous wrapper and this one
        if (i > 0) {
          const prevWrapper = group[i - 1];
          let node: Node | null = prevWrapper.nextSibling;
          while (node && node !== wrapper) {
            const next: Node | null = node.nextSibling;
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (el.className?.match?.(/\bel-h[1-6]\b/) ||
                  /^el-h[1-6]$/i.test(el.className?.split?.(" ")?.[0] ?? "")) {
                container.appendChild(el);
              }
            }
            node = next;
          }
        }

        container.appendChild(wrapper);
      }
    }
  } finally {
    queueMicrotask(() => mergingNow.delete(sizer));
  }
}

export { SPREAD_ITEM_CLASS, SPREAD_GROUP_CLASS };
