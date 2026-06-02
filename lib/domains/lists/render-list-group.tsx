/**
 * Merge engine + render child for `rpg list.*` fences.
 *
 * Structurally ported from `render-tab-group.tsx`: each list fence renders a
 * placeholder carrying its serialized {@link ListBlock}; a debounced
 * `scheduleListMerge` finds consecutive list items, groups them by adjacency,
 * and renders ONE `RpgListView` (with all the group's blocks) into the leader
 * — removing the other wrappers. A `MutationObserver` on the preview sizer
 * re-runs the merge when Obsidian's virtualization adds/removes nodes, guarded
 * by a `mergingNow` WeakSet to avoid infinite loops; `absorbIntoGroup` folds
 * late-appearing siblings into an existing rendered group.
 *
 * A single list fence (no adjacent siblings) is a group of one and still
 * renders through the same path.
 */

import { App, MarkdownRenderChild } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { RpgListView } from "lib/components/rpg-list";
import type { ListBlock } from "./types";

const LIST_ITEM_CLASS = "rpg-list-item";
const LIST_GROUP_CLASS = "rpg-list-group";

const listDataStore = new WeakMap<HTMLElement, ListBlock>();
const listSourcePathStore = new WeakMap<HTMLElement, string>();
const groupBlocksStore = new WeakMap<HTMLElement, { blocks: ListBlock[]; sourcePath: string }>();
const pendingMerges = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const observedSizers = new WeakSet<HTMLElement>();
const mergingNow = new WeakSet<HTMLElement>();

/* ── Adjacency helpers (shared shape with render-tab-group.tsx) ─────────── */

function getElPre(el: HTMLElement): HTMLElement | null {
  return (el.closest(".el-pre") ??
    el.closest("[class*='block-language-']") ??
    el) as HTMLElement | null;
}

function isSiblingAdjacent(a: Element, b: Element): boolean {
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

function isLastContentChild(el: Element): boolean {
  let node: Node | null = el.nextSibling;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node = node.nextSibling;
      continue;
    }
    return false;
  }
  return true;
}

function isFirstContentChild(el: Element): boolean {
  let node: Node | null = el.previousSibling;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node = node.previousSibling;
      continue;
    }
    return false;
  }
  return true;
}

function areAdjacentBlocks(a: HTMLElement, b: HTMLElement): boolean {
  if (a.parentElement === b.parentElement) {
    return isSiblingAdjacent(a, b);
  }
  const sectionA = a.parentElement;
  const sectionB = b.parentElement;
  if (!sectionA || !sectionB) return false;
  if (!isLastContentChild(a)) return false;
  if (!isFirstContentChild(b)) return false;
  return isSiblingAdjacent(sectionA, sectionB);
}

/* ── Scheduling + merge ─────────────────────────────────────────────────── */

export function scheduleListMerge(listEl: HTMLElement, retries = 8): void {
  if (!listEl.isConnected) {
    if (retries > 0) setTimeout(() => scheduleListMerge(listEl, retries - 1), 150);
    return;
  }
  const sizer = (listEl.closest(".markdown-preview-sizer") ??
    listEl.closest(".rpg-rule-tab-group__panel") ??
    listEl.closest("[data-rpg-rule='tab']")) as HTMLElement | null;
  if (!sizer) {
    if (retries > 0) setTimeout(() => scheduleListMerge(listEl, retries - 1), 150);
    return;
  }

  const existing = pendingMerges.get(sizer);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pendingMerges.delete(sizer);
    runListMerge(sizer);
  }, 200);
  pendingMerges.set(sizer, timer);

  if (!observedSizers.has(sizer)) {
    observedSizers.add(sizer);
    const observer = new MutationObserver(() => {
      if (mergingNow.has(sizer)) return;
      if (sizer.querySelector(`.${LIST_ITEM_CLASS}`)) {
        const ex = pendingMerges.get(sizer);
        if (ex) clearTimeout(ex);
        const t = setTimeout(() => {
          pendingMerges.delete(sizer);
          runListMerge(sizer);
        }, 300);
        pendingMerges.set(sizer, t);
      }
    });
    observer.observe(sizer, { childList: true, subtree: true });
  }
}

function runListMerge(sizer: HTMLElement): void {
  if (mergingNow.has(sizer)) return;
  mergingNow.add(sizer);

  try {
    const allItems = Array.from(sizer.querySelectorAll(`.${LIST_ITEM_CLASS}`)) as HTMLElement[];
    if (allItems.length === 0) return;

    const groups: HTMLElement[][] = [];
    let current: HTMLElement[] = [allItems[0]];
    for (let i = 1; i < allItems.length; i++) {
      const prevW = getElPre(allItems[i - 1]);
      const currW = getElPre(allItems[i]);
      if (prevW && currW && areAdjacentBlocks(prevW, currW)) {
        current.push(allItems[i]);
      } else {
        groups.push(current);
        current = [allItems[i]];
      }
    }
    groups.push(current);

    for (const group of groups) {
      const firstW = getElPre(group[0]);
      if (firstW) {
        const existingGroup = findAdjacentGroup(firstW, sizer);
        if (existingGroup) {
          absorbIntoGroup(existingGroup, group);
          continue;
        }
      }
      renderGroup(group);
    }
  } finally {
    queueMicrotask(() => mergingNow.delete(sizer));
  }
}

function collectBlock(el: HTMLElement): ListBlock | undefined {
  let data = listDataStore.get(el);
  if (!data) {
    const json = el.getAttribute("data-rpg-list-json");
    if (json) {
      try {
        data = JSON.parse(json) as ListBlock;
      } catch {
        /* ignore */
      }
    }
  }
  return data;
}

function renderGroup(listEls: HTMLElement[]): void {
  const leader = listEls[0];
  if (leader.classList.contains(LIST_GROUP_CLASS)) return;

  const blocks: ListBlock[] = [];
  let sourcePath = "";
  for (const el of listEls) {
    const data = collectBlock(el);
    if (!data) continue;
    blocks.push(data);
    if (!sourcePath) {
      sourcePath = listSourcePathStore.get(el) ?? el.getAttribute("data-rpg-list-source") ?? "";
    }
  }
  if (blocks.length === 0) return;

  leader.innerHTML = "";
  leader.classList.remove(LIST_ITEM_CLASS);
  leader.classList.add(LIST_GROUP_CLASS);
  groupBlocksStore.set(leader, { blocks, sourcePath });

  const root = ReactDOM.createRoot(leader);
  root.render(<RpgListView blocks={blocks} sourcePath={sourcePath} />);
  (leader as unknown as { __rpgListRoot?: ReactDOM.Root }).__rpgListRoot = root;

  for (let i = 1; i < listEls.length; i++) {
    const wrapper = getElPre(listEls[i]);
    if (wrapper) wrapper.remove();
    else listEls[i].remove();
  }
}

function findAdjacentGroup(itemWrapper: HTMLElement, _sizer: HTMLElement): HTMLElement | null {
  let prev: Element | null = itemWrapper.previousElementSibling;
  while (prev) {
    if (prev.nodeType === Node.TEXT_NODE) {
      prev = prev.previousElementSibling;
      continue;
    }
    const group =
      prev.querySelector(`.${LIST_GROUP_CLASS}`) ??
      (prev.classList?.contains(LIST_GROUP_CLASS) ? prev : null);
    if (group) return group as HTMLElement;
    break;
  }

  const section = itemWrapper.parentElement;
  if (!section || !isFirstContentChild(itemWrapper)) return null;
  const prevSection = section.previousElementSibling;
  if (!prevSection) return null;
  const lastChild = prevSection.lastElementChild;
  if (!lastChild) return null;
  const group =
    lastChild.querySelector(`.${LIST_GROUP_CLASS}`) ??
    (lastChild.classList?.contains(LIST_GROUP_CLASS) ? lastChild : null);
  if (group && isLastContentChild(lastChild)) return group as HTMLElement;
  return null;
}

function absorbIntoGroup(groupEl: HTMLElement, newItemEls: HTMLElement[]): void {
  const existing = groupBlocksStore.get(groupEl);
  if (!existing) return;

  const existingIds = new Set(existing.blocks.map((b) => b.id));
  const newBlocks: ListBlock[] = [];
  for (const el of newItemEls) {
    const data = collectBlock(el);
    if (data && !existingIds.has(data.id)) newBlocks.push(data);
  }
  if (newBlocks.length === 0) {
    for (const el of newItemEls) {
      const wrapper = getElPre(el);
      if (wrapper) wrapper.remove();
      else el.remove();
    }
    return;
  }

  const allBlocks = [...existing.blocks, ...newBlocks];
  groupBlocksStore.set(groupEl, { blocks: allBlocks, sourcePath: existing.sourcePath });

  const holder = groupEl as unknown as { __rpgListRoot?: ReactDOM.Root };
  if (holder.__rpgListRoot) {
    try {
      holder.__rpgListRoot.unmount();
    } catch {
      /* ignore */
    }
  }
  const root = ReactDOM.createRoot(groupEl);
  root.render(<RpgListView blocks={allBlocks} sourcePath={existing.sourcePath} />);
  holder.__rpgListRoot = root;

  for (const el of newItemEls) {
    const wrapper = getElPre(el);
    if (wrapper) wrapper.remove();
    else el.remove();
  }
}

/* ── Render child ───────────────────────────────────────────────────────── */

export class ListRenderChild extends MarkdownRenderChild {
  constructor(
    el: HTMLElement,
    private readonly _app: App,
    private readonly block: ListBlock,
    private readonly sourcePath: string
  ) {
    super(el);
  }

  onload(): void {
    this.containerEl.classList.add(LIST_ITEM_CLASS);
    this.containerEl.setAttribute("data-rpg-list", "item");
    this.containerEl.setAttribute("data-rpg-list-json", JSON.stringify(this.block));
    this.containerEl.setAttribute("data-rpg-list-source", this.sourcePath);
    listDataStore.set(this.containerEl, this.block);
    listSourcePathStore.set(this.containerEl, this.sourcePath);
    scheduleListMerge(this.containerEl);
  }

  onunload(): void {
    const holder = this.containerEl as unknown as { __rpgListRoot?: ReactDOM.Root };
    if (holder.__rpgListRoot) {
      try {
        holder.__rpgListRoot.unmount();
      } catch (e) {
        console.error("rpg list.*: unmount failed", e);
      }
      holder.__rpgListRoot = undefined;
    }
    listDataStore.delete(this.containerEl);
    listSourcePathStore.delete(this.containerEl);
  }
}

/* ── Global unfold observer ─────────────────────────────────────────────── */

let globalListUnfoldObserver: MutationObserver | null = null;

/** Re-trigger merges when a collapsed section / fold containing list items is
 *  expanded, or when new list items are added to the DOM. Mirrors
 *  `installUnfoldObserver` in render-tab-group.tsx. */
export function installListUnfoldObserver(): void {
  if (globalListUnfoldObserver) return;
  globalListUnfoldObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const target = mutation.target as HTMLElement;
        if (
          (mutation.attributeName === "class" && !target.classList.contains("is-collapsed")) ||
          (mutation.attributeName === "open" && (target as HTMLDetailsElement).open)
        ) {
          for (const item of Array.from(
            target.querySelectorAll(`.${LIST_ITEM_CLASS}`)
          ) as HTMLElement[]) {
            scheduleListMerge(item);
          }
        }
      }
      for (const added of Array.from(mutation.addedNodes)) {
        if (!(added instanceof HTMLElement)) continue;
        for (const item of Array.from(
          added.querySelectorAll(`.${LIST_ITEM_CLASS}`)
        ) as HTMLElement[]) {
          scheduleListMerge(item);
        }
      }
    }
  });
  const root = document.querySelector(".app-container") ?? document.body;
  globalListUnfoldObserver.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "open"],
  });
}

export { LIST_ITEM_CLASS, LIST_GROUP_CLASS };
