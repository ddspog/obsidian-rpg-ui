import { App, MarkdownRenderChild, setIcon } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Markdown } from "lib/components/markdown";
import type { RuleTabBlock } from "./types";

const TAB_CLASS = "rpg-rule-tab";
const GROUP_CLASS = "rpg-rule-tab-group";

const BARE_CALL_RE = /(?<!`)(@\[\[[^\]\n]+\]\]\.[A-Za-z_][\w-]*\([^)\n]*\))(?!`)/g;

function wrapBareCalls(source: string): string {
  return source.replace(BARE_CALL_RE, "`$1`");
}

const tabDataStore = new WeakMap<HTMLElement, RuleTabBlock>();
const tabSourcePathStore = new WeakMap<HTMLElement, string>();

const pendingMerges = new WeakSet<HTMLElement>();

function TabGroupView({
  tabs,
  sourcePath,
  heading,
}: {
  tabs: RuleTabBlock[];
  sourcePath: string;
  heading?: string;
}) {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [isStuck, setIsStuck] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const stickyRef = React.useRef<HTMLDivElement>(null);
  const active = tabs[activeIdx];

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const stuck = !entry.isIntersecting;
        setIsStuck(stuck);
        if (stuck && stickyRef.current) {
          const scrollContainer = stickyRef.current.closest(
            ".markdown-preview-view"
          ) as HTMLElement | null;
          if (scrollContainer) {
            const padTop = parseFloat(
              getComputedStyle(scrollContainer).paddingTop
            ) || 0;
            const hasHeading = stickyRef.current.querySelector(
              ".rpg-rule-tab-group__stuck-heading"
            );
            const offset = hasHeading ? padTop : Math.min(padTop, 20);
            stickyRef.current.style.top = `${-offset}px`;
          }
        } else if (stickyRef.current) {
          stickyRef.current.style.top = "0px";
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (tabs.length === 0) {
    return <div className="notice">rpg rule.tab: no tabs found</div>;
  }

  return (
    <section data-rpg-rule="tab">
      <div ref={sentinelRef} className="rpg-rule-tab-group__sentinel" />
      <div ref={stickyRef} className={`rpg-rule-tab-group__sticky-bar ${isStuck ? "rpg-rule-tab-group__sticky-bar--stuck" : ""}`}>
        {isStuck && heading ? (
          <div className="rpg-rule-tab-group__stuck-heading">{heading}</div>
        ) : null}
        <menu role="tablist" className="rpg-rule-tab-group__tabs">
          <span className="rpg-rule-tab-group__diamond rpg-rule-tab-group__diamond--left" />
          <span className="rpg-rule-tab-group__diamond rpg-rule-tab-group__diamond--right" />
          {tabs.map((tab, i) => (
            <TabButton
              key={i}
              tab={tab}
              active={i === activeIdx}
              onClick={() => setActiveIdx(i)}
            />
          ))}
        </menu>
      </div>
      {active ? (
        <article
          key={activeIdx}
          role="tabpanel"
          className="rpg-rule-tab-group__panel"
        >
          <Markdown source={wrapBareCalls(active.body)} sourcePath={sourcePath} />
        </article>
      ) : null}
    </section>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: RuleTabBlock;
  active: boolean;
  onClick: () => void;
}) {
  const iconRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = iconRef.current;
    if (!el || !tab.icon) return;
    el.innerHTML = "";
    const looksLikeLucide = /^[a-z][a-z0-9-]*$/i.test(tab.icon);
    if (looksLikeLucide) {
      try {
        setIcon(el, tab.icon);
      } catch {
        el.textContent = tab.icon;
      }
    } else {
      el.textContent = tab.icon;
    }
  }, [tab.icon]);

  const style: React.CSSProperties = {};
  if (tab.color) {
    (style as Record<string, string>)["--rpg-tab-color"] = tab.color;
  }

  return (
    <button
      role="tab"
      aria-selected={active}
      className={`rpg-rule-tab-group__tab ${active ? "rpg-rule-tab-group__tab--active" : ""}`}
      onClick={onClick}
      style={style}
    >
      {tab.icon ? (
        <span ref={iconRef} className="rpg-rule-tab-group__tab-icon" aria-hidden="true" />
      ) : null}
      <span className="rpg-rule-tab-group__tab-label">{tab.name}</span>
    </button>
  );
}

function getElPre(tabEl: HTMLElement): HTMLElement | null {
  return (tabEl.closest(".el-pre") ??
    tabEl.closest("[class*='block-language-']")) as HTMLElement | null;
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

function scheduleMerge(tabEl: HTMLElement): void {
  const sizer = tabEl.closest(".markdown-preview-sizer") as HTMLElement | null;
  if (!sizer) return;
  if (pendingMerges.has(sizer)) return;
  pendingMerges.add(sizer);
  setTimeout(() => {
    pendingMerges.delete(sizer);
    runMerge(sizer);
  }, 150);
}

function runMerge(sizer: HTMLElement): void {
  const allTabs = Array.from(
    sizer.querySelectorAll(`.${TAB_CLASS}`)
  ) as HTMLElement[];
  if (allTabs.length === 0) return;

  const groups: HTMLElement[][] = [];
  let current: HTMLElement[] = [allTabs[0]];

  for (let i = 1; i < allTabs.length; i++) {
    const prevW = getElPre(allTabs[i - 1]);
    const currW = getElPre(allTabs[i]);
    if (prevW && currW && areAdjacentBlocks(prevW, currW)) {
      current.push(allTabs[i]);
    } else {
      groups.push(current);
      current = [allTabs[i]];
    }
  }
  groups.push(current);

  for (const group of groups) {
    renderGroup(group);
  }
}

function renderGroup(tabEls: HTMLElement[]): void {
  const leader = tabEls[0];
  if (leader.classList.contains(GROUP_CLASS)) return;

  const tabs: RuleTabBlock[] = [];
  let sourcePath = "";

  for (const el of tabEls) {
    const data = tabDataStore.get(el);
    if (!data) continue;
    tabs.push(data);
    if (!sourcePath) sourcePath = tabSourcePathStore.get(el) ?? "";
  }

  if (tabs.length === 0) return;

  const heading = findPrecedingHeadingText(leader);

  leader.innerHTML = "";
  leader.classList.remove(TAB_CLASS);
  leader.classList.add(GROUP_CLASS);

  const root = ReactDOM.createRoot(leader);
  root.render(<TabGroupView tabs={tabs} sourcePath={sourcePath} heading={heading} />);
  (leader as any).__rpgTabRoot = root;

  for (let i = 1; i < tabEls.length; i++) {
    const wrapper = getElPre(tabEls[i]);
    if (wrapper) {
      wrapper.remove();
    } else {
      tabEls[i].remove();
    }
  }
}

function findPrecedingHeadingText(leader: HTMLElement): string | undefined {
  const wrapper = getElPre(leader);
  if (!wrapper) return undefined;

  let prev: Element | null = wrapper.previousElementSibling;
  while (prev && !prev.textContent?.trim()) {
    prev = prev.previousElementSibling;
  }

  if (prev) {
    const h = prev.querySelector("h1, h2, h3, h4, h5, h6");
    if (h) return h.textContent?.trim() || undefined;
    if (/^H[1-6]$/.test(prev.tagName)) return prev.textContent?.trim() || undefined;
  }

  const section = wrapper.parentElement;
  const prevSection = section?.previousElementSibling as HTMLElement | null;
  if (prevSection) {
    const last = prevSection.lastElementChild as HTMLElement | null;
    if (last) {
      const h = last.querySelector("h1, h2, h3, h4, h5, h6");
      if (h) return h.textContent?.trim() || undefined;
      if (/^H[1-6]$/.test(last.tagName)) return last.textContent?.trim() || undefined;
    }
  }

  return undefined;
}

export class RuleTabRenderChild extends MarkdownRenderChild {
  constructor(
    el: HTMLElement,
    private readonly _app: App,
    private readonly block: RuleTabBlock,
    private readonly sourcePath: string
  ) {
    super(el);
  }

  onload(): void {
    this.containerEl.classList.add(TAB_CLASS);
    this.containerEl.setAttribute("data-rpg-rule", "tab");
    tabDataStore.set(this.containerEl, this.block);
    tabSourcePathStore.set(this.containerEl, this.sourcePath);
    scheduleMerge(this.containerEl);
  }

  onunload(): void {
    const root = (this.containerEl as any).__rpgTabRoot as
      | ReactDOM.Root
      | undefined;
    if (root) {
      try {
        root.unmount();
      } catch (e) {
        console.error("rpg rule.tab: unmount failed", e);
      }
      (this.containerEl as any).__rpgTabRoot = undefined;
    }
    tabDataStore.delete(this.containerEl);
    tabSourcePathStore.delete(this.containerEl);
  }
}
