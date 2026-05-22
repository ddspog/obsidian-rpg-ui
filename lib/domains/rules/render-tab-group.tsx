import { App, MarkdownRenderChild, setIcon } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Markdown } from "lib/components/markdown";
import { parseRuleTab } from "./parse-rule-block";
import type { RuleTabBlock } from "./types";

const TAB_CLASS = "rpg-rule-tab";
const GROUP_CLASS = "rpg-rule-tab-group";

const BARE_CALL_RE = /(?<!`)(@\[\[[^\]\n]+\]\]\.[A-Za-z_][\w-]*\([^)\n]*\))(?!`)/g;

function wrapBareCalls(source: string): string {
  return source.replace(BARE_CALL_RE, "`$1`");
}

const tabDataStore = new WeakMap<HTMLElement, RuleTabBlock>();
const tabSourcePathStore = new WeakMap<HTMLElement, string>();
const groupTabsStore = new WeakMap<HTMLElement, { tabs: RuleTabBlock[]; sourcePath: string }>();

const pendingMerges = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function TabGroupView({
  tabs,
  sourcePath,
  heading,
}: {
  tabs: RuleTabBlock[];
  sourcePath: string;
  heading?: string;
}) {
  const nestDetectRef = React.useRef<HTMLDivElement>(null);
  const [isNested, setIsNested] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (nestDetectRef.current?.closest(".rpg-rule-tab-group__panel")) {
      setIsNested(true);
    } else {
      setIsNested(false);
    }
  }, []);

  if (isNested === null) {
    return <div ref={nestDetectRef} className="rpg-rule-tab-group--detecting" />;
  }

  if (isNested) {
    return <SubTabGroupView tabs={tabs} sourcePath={sourcePath} />;
  }

  return <HorizontalTabGroupView tabs={tabs} sourcePath={sourcePath} heading={heading} />;
}

function SubTabGroupView({
  tabs,
  sourcePath,
}: {
  tabs: RuleTabBlock[];
  sourcePath: string;
}) {
  const storageKey = `rpg-subtab:${sourcePath}:${tabs.map(t => t.name).join("|")}`;
  const [activeIdx, setActiveIdx] = React.useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const idx = parseInt(saved, 10);
        if (idx >= 0 && idx < tabs.length) return idx;
      }
    } catch { /* ignore */ }
    return 0;
  });

  React.useEffect(() => {
    try { localStorage.setItem(storageKey, String(activeIdx)); } catch { /* ignore */ }
  }, [activeIdx, storageKey]);

  const active = tabs[activeIdx];

  if (tabs.length === 0) return null;

  return (
    <section className="rpg-subtab-group" data-rpg-rule="subtab">
      <nav className="rpg-subtab-group__nav">
        {tabs.map((tab, i) => {
          const distance = i - activeIdx;
          const absDistance = Math.abs(distance);
          const isActive = i === activeIdx;
          if (isActive) {
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                className="rpg-subtab-group__btn rpg-subtab-group__btn--active"
                onClick={() => setActiveIdx(i)}
                onKeyDown={(e) => { if (e.key === "Enter") setActiveIdx(i); }}
              >
                {tab.name}
              </div>
            );
          }
          const scale = Math.pow(0.75, absDistance);
          const lineHpx = 1.8 * scale;
          let cumulativeOffset = 0;
          for (let d = 1; d < absDistance; d++) {
            cumulativeOffset += 1.8 * Math.pow(0.75, d);
          }
          const isAbove = distance < 0;
          const posStyle: React.CSSProperties = isAbove
            ? { bottom: `calc(100% + ${cumulativeOffset}rem)` }
            : { top: `calc(100% + ${cumulativeOffset}rem)` };
          const radiusStyle: React.CSSProperties = isAbove
            ? { borderRadius: "0 24px 0 0" }
            : { borderRadius: "0 0 24px 0" };
          const widthVar = absDistance === 1 ? "var(--subtab-w1, 40%)" : absDistance === 2 ? "var(--subtab-w2, 18%)" : "var(--subtab-w3, 13.5%)";
          const padding = 12 * Math.pow(0.75, absDistance);
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              className="rpg-subtab-group__btn"
              style={{
                opacity: scale,
                height: `${lineHpx}rem`,
                lineHeight: `${lineHpx}rem`,
                fontSize: `${scale * 0.85}rem`,
                width: widthVar,
                padding: `0 ${padding}px`,
                ...posStyle,
                ...radiusStyle,
              }}
              onClick={() => setActiveIdx(i)}
              onKeyDown={(e) => { if (e.key === "Enter") setActiveIdx(i); }}
            >
              {tab.name}
            </div>
          );
        })}
      </nav>
      {active && (
        <article className="rpg-subtab-group__panel">
          <Markdown source={wrapBareCalls(active.body)} sourcePath={sourcePath} />
        </article>
      )}
    </section>
  );
}

function HorizontalTabGroupView({
  tabs,
  sourcePath,
  heading,
}: {
  tabs: RuleTabBlock[];
  sourcePath: string;
  heading?: string;
}) {
  const storageKey = `rpg-tab:${sourcePath}:${tabs.map(t => t.name).join("|")}`;
  const [activeIdx, setActiveIdx] = React.useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const idx = parseInt(saved, 10);
        if (idx >= 0 && idx < tabs.length) return idx;
      }
    } catch { /* ignore */ }
    return 0;
  });
  const [isStuck, setIsStuck] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const stickyRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const tabButtonsRef = React.useRef<(HTMLButtonElement | null)[]>([]);
  const active = tabs[activeIdx];

  // Persist selection
  React.useEffect(() => {
    try { localStorage.setItem(storageKey, String(activeIdx)); } catch { /* ignore */ }
  }, [activeIdx, storageKey]);

  // Center active tab when not hovering
  React.useEffect(() => {
    if (isHovering) return;
    const timer = setTimeout(() => {
      const scrollEl = scrollRef.current;
      const btn = tabButtonsRef.current[activeIdx];
      if (!scrollEl || !btn) return;
      const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
      const scrollTarget = btnCenter - scrollEl.clientWidth / 2;
      scrollEl.scrollTo({ left: scrollTarget, behavior: "smooth" });
    }, 600);
    return () => clearTimeout(timer);
  }, [activeIdx, isHovering]);

  const panelRef = React.useRef<HTMLElement>(null);

  function handleTabClick(idx: number) {
    const sentinel = sentinelRef.current;
    const scrollContainer = sentinel?.closest(
      ".markdown-preview-view"
    ) as HTMLElement | null;

    // Only scroll if the tab bar is stuck (user scrolled past the tabs)
    const shouldScroll = isStuck && sentinel && scrollContainer;
    let scrollOffset: number | null = null;
    if (shouldScroll) {
      const wrapper = sentinel.closest(".el-pre") as HTMLElement | null;
      const scrollTarget = wrapper ?? sentinel;
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = scrollTarget.getBoundingClientRect();
      scrollOffset = targetRect.top - containerRect.top + scrollContainer.scrollTop;
      // Overshoot upward to force Obsidian to de-virtualize the heading
      scrollOffset = Math.max(0, scrollOffset - 300);
    }

    // Lock the panel's current height so Obsidian's virtualization doesn't
    // detach the section when content shrinks during the switch.
    const panel = panelRef.current;
    if (panel) {
      panel.style.minHeight = `${panel.offsetHeight}px`;
    }
    setActiveIdx(idx);

    if (scrollOffset !== null && scrollContainer) {
      const sc = scrollContainer;
      setTimeout(() => {
        // Step 1: scroll up to de-virtualize the heading
        sc.scrollTo({ top: scrollOffset!, behavior: "instant" });
        // Step 2: after Obsidian renders the heading, scroll precisely to it
        requestAnimationFrame(() => {
          const wrapper = sentinel!.closest(".el-pre") as HTMLElement | null;
          if (!wrapper) { if (panel) panel.style.minHeight = ""; return; }
          let heading: HTMLElement | null = null;
          let prev = wrapper.previousElementSibling as HTMLElement | null;
          while (prev) {
            const h = prev.querySelector("h1, h2, h3, h4, h5, h6") as HTMLElement | null;
            if (h) { heading = h; break; }
            if (/^H[1-6]$/.test(prev.tagName)) { heading = prev; break; }
            prev = prev.previousElementSibling as HTMLElement | null;
          }
          if (heading) {
            const containerRect = sc.getBoundingClientRect();
            const headingRect = heading.getBoundingClientRect();
            const precise = headingRect.top - containerRect.top + sc.scrollTop;
            sc.scrollTo({ top: precise, behavior: "instant" });
          }
          if (panel) panel.style.minHeight = "";
        });
      }, 50);
    } else if (panel) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          panel.style.minHeight = "";
        });
      });
    }
  }

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

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function updateMask() {
      if (!el) return;
      const hasOverflow = el.scrollWidth > el.clientWidth + 1;
      if (!hasOverflow) {
        el.style.maskImage = "none";
        el.style.webkitMaskImage = "none";
        return;
      }
      const atStart = el.scrollLeft < 2;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
      const left = atStart ? "black" : "transparent";
      const right = atEnd ? "black" : "transparent";
      const mask = `linear-gradient(to right, ${left} 0px, black 1.5rem, black calc(100% - 1.5rem), ${right} 100%)`;
      el.style.maskImage = mask;
      el.style.webkitMaskImage = mask;
    }

    updateMask();
    el.addEventListener("scroll", updateMask, { passive: true });
    const ro = new ResizeObserver(updateMask);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateMask);
      ro.disconnect();
    };
  }, [tabs.length]);

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
          <div
            ref={scrollRef}
            className="rpg-rule-tab-group__tabs-scroll"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            {tabs.map((tab, i) => (
              <TabButton
                key={i}
                ref={(el) => { tabButtonsRef.current[i] = el; }}
                tab={tab}
                active={i === activeIdx}
                onClick={() => handleTabClick(i)}
              />
            ))}
          </div>
        </menu>
      </div>
      {active ? (
        <article
          ref={panelRef}
          key={activeIdx}
          role="tabpanel"
          className="rpg-rule-tab-group__panel"
        >
          <TabPanelContent body={active.body} sourcePath={sourcePath} />
        </article>
      ) : null}
    </section>
  );
}

function extractNestedTabs(body: string): { intro: string; tabs: RuleTabBlock[] } | null {
  const fenceRe = /```rpg\s+rule\.tab\s*\n([\s\S]*?)```/g;
  const tabs: RuleTabBlock[] = [];
  let firstIdx = -1;

  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(body)) !== null) {
    if (firstIdx < 0) firstIdx = m.index;
    const tabSource = m[1];
    tabs.push(parseRuleTab(tabSource));
  }

  if (tabs.length === 0) return null;
  const intro = body.slice(0, firstIdx).replace(/\n+$/, "");
  return { intro, tabs };
}

function TabPanelContent({ body, sourcePath }: { body: string; sourcePath: string }) {
  const nested = React.useMemo(() => extractNestedTabs(body), [body]);

  if (nested && nested.tabs.length > 0) {
    return (
      <>
        {nested.intro && <Markdown source={wrapBareCalls(nested.intro)} sourcePath={sourcePath} />}
        <SubTabGroupView tabs={nested.tabs} sourcePath={sourcePath} />
      </>
    );
  }

  return <Markdown source={wrapBareCalls(body)} sourcePath={sourcePath} />;
}

const TabButton = React.forwardRef<HTMLButtonElement, {
  tab: RuleTabBlock;
  active: boolean;
  onClick: () => void;
}>(function TabButton({ tab, active, onClick }, ref) {
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
      ref={ref}
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
});

function getElPre(tabEl: HTMLElement): HTMLElement | null {
  return (tabEl.closest(".el-pre") ??
    tabEl.closest("[class*='block-language-']") ??
    tabEl) as HTMLElement | null;
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

const observedSizers = new WeakSet<HTMLElement>();
const mergingNow = new WeakSet<HTMLElement>();

function scheduleMerge(tabEl: HTMLElement, retries = 8): void {
  if (!tabEl.isConnected) {
    if (retries > 0) {
      setTimeout(() => scheduleMerge(tabEl, retries - 1), 150);
    } else {
    }
    return;
  }
  const sizer = (tabEl.closest(".markdown-preview-sizer") ??
    tabEl.closest(".rpg-rule-tab-group__panel") ??
    tabEl.closest("[data-rpg-rule='tab']")) as HTMLElement | null;
  if (!sizer) {
    if (retries > 0) {
      setTimeout(() => scheduleMerge(tabEl, retries - 1), 150);
    }
    return;
  }
  const existing = pendingMerges.get(sizer);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pendingMerges.delete(sizer);
    runMerge(sizer);
  }, 200);
  pendingMerges.set(sizer, timer);

  if (!observedSizers.has(sizer)) {
    observedSizers.add(sizer);
    const observer = new MutationObserver(() => {
      if (mergingNow.has(sizer)) return;
      if (sizer.querySelector(`.${TAB_CLASS}`)) {
        const ex = pendingMerges.get(sizer);
        if (ex) clearTimeout(ex);
        const t = setTimeout(() => {
          pendingMerges.delete(sizer);
          runMerge(sizer);
        }, 300);
        pendingMerges.set(sizer, t);
      }
    });
    observer.observe(sizer, { childList: true, subtree: true });
  }
}

function runMerge(sizer: HTMLElement): void {
  if (mergingNow.has(sizer)) return;
  mergingNow.add(sizer);

  try {
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
      // Check if first tab is adjacent to an existing rendered group
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

function renderGroup(tabEls: HTMLElement[]): void {
  const leader = tabEls[0];
  if (leader.classList.contains(GROUP_CLASS)) return;

  const tabs: RuleTabBlock[] = [];
  let sourcePath = "";

  for (const el of tabEls) {
    let data = tabDataStore.get(el);
    if (!data) {
      const json = el.getAttribute("data-rpg-tab-json");
      if (json) {
        try { data = JSON.parse(json) as RuleTabBlock; } catch { /* ignore */ }
      }
    }
    if (!data) continue;
    tabs.push(data);
    if (!sourcePath) sourcePath = tabSourcePathStore.get(el) ?? el.getAttribute("data-rpg-tab-source") ?? "";
  }

  if (tabs.length === 0) return;

  const heading = findPrecedingHeadingText(leader);

  leader.innerHTML = "";
  leader.classList.remove(TAB_CLASS);
  leader.classList.add(GROUP_CLASS);

  groupTabsStore.set(leader, { tabs, sourcePath });

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

/**
 * Find an existing rendered GROUP_CLASS element adjacent to the given
 * tab wrapper. Checks the preceding sibling (or preceding section's
 * last child) for a group.
 */
function findAdjacentGroup(tabWrapper: HTMLElement, sizer: HTMLElement): HTMLElement | null {
  // Check direct preceding sibling
  let prev: Element | null = tabWrapper.previousElementSibling;
  while (prev) {
    if (prev.nodeType === Node.TEXT_NODE) {
      prev = prev.previousElementSibling;
      continue;
    }
    const group = prev.querySelector(`.${GROUP_CLASS}`) ?? (prev.classList?.contains(GROUP_CLASS) ? prev : null);
    if (group) return group as HTMLElement;
    break;
  }

  // Check across section boundaries
  const section = tabWrapper.parentElement;
  if (!section || !isFirstContentChild(tabWrapper)) return null;
  const prevSection = section.previousElementSibling;
  if (!prevSection) return null;
  // Look for a group in the last child of the previous section
  const lastChild = prevSection.lastElementChild;
  if (!lastChild) return null;
  const group = lastChild.querySelector(`.${GROUP_CLASS}`) ?? (lastChild.classList?.contains(GROUP_CLASS) ? lastChild : null);
  if (group && isLastContentChild(lastChild)) return group as HTMLElement;
  return null;
}

/**
 * Absorb new tab elements into an existing rendered group.
 * Re-renders the group with the combined tab list, skipping duplicates.
 */
function absorbIntoGroup(groupEl: HTMLElement, newTabEls: HTMLElement[]): void {
  const existing = groupTabsStore.get(groupEl);
  if (!existing) return;

  const existingNames = new Set(existing.tabs.map(t => t.name));
  const newTabs: RuleTabBlock[] = [];
  for (const el of newTabEls) {
    let data = tabDataStore.get(el);
    if (!data) {
      const json = el.getAttribute("data-rpg-tab-json");
      if (json) {
        try { data = JSON.parse(json) as RuleTabBlock; } catch { /* ignore */ }
      }
    }
    if (data && !existingNames.has(data.name)) newTabs.push(data);
  }
  if (newTabs.length === 0) {
    // All tabs already in group — just remove the duplicate wrappers
    for (const el of newTabEls) {
      const wrapper = getElPre(el);
      if (wrapper) wrapper.remove(); else el.remove();
    }
    return;
  }

  const allTabs = [...existing.tabs, ...newTabs];
  groupTabsStore.set(groupEl, { tabs: allTabs, sourcePath: existing.sourcePath });

  // Re-render the group with combined tabs
  const oldRoot = (groupEl as any).__rpgTabRoot as ReactDOM.Root | undefined;
  if (oldRoot) {
    try { oldRoot.unmount(); } catch { /* ignore */ }
  }
  const heading = findPrecedingHeadingText(groupEl);
  const root = ReactDOM.createRoot(groupEl);
  root.render(<TabGroupView tabs={allTabs} sourcePath={existing.sourcePath} heading={heading} />);
  (groupEl as any).__rpgTabRoot = root;

  // Remove the new tab wrappers
  for (const el of newTabEls) {
    const wrapper = getElPre(el);
    if (wrapper) {
      wrapper.remove();
    } else {
      el.remove();
    }
  }
}

function findPrecedingHeadingEl(el: HTMLElement): HTMLElement | null {
  const wrapper = el.closest(".el-pre") ?? el.closest("[class*='block-language-']") ?? el.closest(`.${GROUP_CLASS}`)?.closest(".el-pre");
  if (!wrapper) return null;

  let prev: Element | null = wrapper.previousElementSibling;
  while (prev) {
    const h = prev.querySelector("h1, h2, h3, h4, h5, h6");
    if (h) return h as HTMLElement;
    if (/^H[1-6]$/.test(prev.tagName)) return prev as HTMLElement;
    prev = prev.previousElementSibling;
  }

  const section = wrapper.parentElement;
  let prevSection = section?.previousElementSibling as HTMLElement | null;
  while (prevSection) {
    const children = Array.from(prevSection.children);
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i] as HTMLElement;
      const h = child.querySelector("h1, h2, h3, h4, h5, h6");
      if (h) return h as HTMLElement;
      if (/^H[1-6]$/.test(child.tagName)) return child as HTMLElement;
    }
    prevSection = prevSection.previousElementSibling as HTMLElement | null;
  }

  return null;
}

function findPrecedingHeadingText(leader: HTMLElement): string | undefined {
  const wrapper = getElPre(leader);
  if (!wrapper) return undefined;
  const el = findPrecedingHeadingEl(wrapper);
  return el?.textContent?.trim() || undefined;
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
    this.containerEl.setAttribute("data-rpg-tab-json", JSON.stringify(this.block));
    this.containerEl.setAttribute("data-rpg-tab-source", this.sourcePath);
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

let globalUnfoldObserver: MutationObserver | null = null;

export function installUnfoldObserver(): void {
  if (globalUnfoldObserver) return;
  globalUnfoldObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const target = mutation.target as HTMLElement;
        if (
          (mutation.attributeName === "class" && !target.classList.contains("is-collapsed")) ||
          (mutation.attributeName === "open" && (target as HTMLDetailsElement).open)
        ) {
          const tabs = target.querySelectorAll(`.${TAB_CLASS}`);
          if (tabs.length > 0) {
            for (const tab of Array.from(tabs) as HTMLElement[]) {
              scheduleMerge(tab);
            }
          }
        }
      }
      for (const added of Array.from(mutation.addedNodes)) {
        if (!(added instanceof HTMLElement)) continue;
        const tabs = added.querySelectorAll(`.${TAB_CLASS}`);
        for (const tab of Array.from(tabs) as HTMLElement[]) {
          scheduleMerge(tab);
        }
      }
    }
  });
  const body = document.querySelector(".app-container") ?? document.body;
  globalUnfoldObserver.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "open"],
  });
}
