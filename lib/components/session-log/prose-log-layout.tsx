/**
 * Prose + margin-log layout.
 *
 * The shared reading-mode layout for lonelog content: narrated prose in the main
 * column with a toggleable "Log" panel that invades the page margin (measured to
 * fit, stacking below when there's too little room). Provenance dots in the prose
 * open + scroll the matching sidebar entry. Read-only here — the live `rpg log`
 * (SessionLogView) keeps its own editable copy; a `feature.gm` body uses this to
 * render exactly like the log without editing.
 */

import * as React from "react";
import { ProseView } from "./prose-view";
import { LogSidebar } from "./log-sidebar";
import type { ProseScene } from "lib/domains/session-log/prose-model";
import type { SidebarItem } from "lib/domains/session-log/prose-model";
import type { ChoiceAt } from "lib/domains/session-log/choice";
import { scrollBehavior } from "lib/utils/scroll-behavior";

export function ProseLogLayout({
  scenes,
  sidebarItems,
  sourcePath,
  initialSidebarOpen = false,
  onChoice,
  dieEdits,
  onDieChange,
  onResultChange,
  onTokenChange,
}: {
  scenes: ProseScene[];
  sidebarItems: SidebarItem[];
  sourcePath: string;
  initialSidebarOpen?: boolean;
  onChoice?: (selected: string, at?: ChoiceAt) => void;
  /** When wired, the Log sidebar's dice become editable — used by a `feature.gm`
   *  body to let the reader roll and re-resolve a scratch copy of the log. */
  dieEdits?: Record<string, string>;
  onDieChange?: (source: string, raw: string, slot: number, value: string) => void;
  onResultChange?: (source: string, value: string) => void;
  /** Swap a token on a source line — powers the list-consult picker. */
  onTokenChange?: (source: string, from: string, to: string, nth: number) => void;
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(initialSidebarOpen);
  const [selection, setSelection] = React.useState<{ id: number; side: "prose" | "sidebar"; n: number } | null>(null);
  const [sidebarPx, setSidebarPx] = React.useState<number | null>(null);
  const [stacked, setStacked] = React.useState(false);

  const layoutRef = React.useRef<HTMLDivElement>(null);
  const proseAnchors = React.useRef(new Map<number, HTMLElement>());
  const sidebarAnchors = React.useRef(new Map<number, HTMLElement>());
  const clickTick = React.useRef(0);

  // The sidebar invades the page margin — measure the free margin the enclosing
  // Obsidian column has and size the invasion to fit; stack below when too small.
  React.useEffect(() => {
    const layout = layoutRef.current;
    const container = layout?.parentElement;
    if (!layout || !container) return;

    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const desiredPx = 24 * remPx;
    const minSidebarPx = 13 * remPx;
    const view = layout.closest(".markdown-preview-view, .markdown-source-view, .cm-sizer") as HTMLElement | null;

    const measure = () => {
      const c = container.getBoundingClientRect();
      let room: number;
      if (view) {
        const v = view.getBoundingClientRect();
        const vs = getComputedStyle(view);
        const leftRoom = c.left - (v.left + (parseFloat(vs.paddingLeft) || 0));
        const rightRoom = v.right - (parseFloat(vs.paddingRight) || 0) - c.right;
        room = Math.max(0, Math.min(leftRoom, rightRoom));
      } else {
        room = Math.max(0, (window.innerWidth - c.width) / 2 - remPx);
      }
      const fits = Math.min(desiredPx, room * 2);
      if (fits < minSidebarPx) {
        setStacked(true);
        setSidebarPx(null);
      } else {
        setStacked(false);
        setSidebarPx(Math.round(fits));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    if (view) ro.observe(view);
    return () => ro.disconnect();
  }, []);

  const registerAnchor =
    (map: React.MutableRefObject<Map<number, HTMLElement>>) => (id: number, el: HTMLElement | null) => {
      if (el) map.current.set(id, el);
      else map.current.delete(id);
    };
  const registerProse = React.useMemo(() => registerAnchor(proseAnchors), []);
  const registerSidebar = React.useMemo(() => registerAnchor(sidebarAnchors), []);

  React.useEffect(() => {
    if (!selection) return;
    const map = selection.side === "sidebar" ? sidebarAnchors.current : proseAnchors.current;
    map.get(selection.id)?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
  }, [selection]);

  const handleDotClick = (id: number) => {
    setSidebarOpen(true);
    clickTick.current += 1;
    setSelection({ id, side: "sidebar", n: clickTick.current });
  };
  const handleSidebarClick = (id: number) => {
    clickTick.current += 1;
    setSelection({ id, side: "prose", n: clickTick.current });
  };

  const selectedId = selection?.id ?? null;

  return (
    <div
      ref={layoutRef}
      className={`lonelog-prose-layout ${sidebarOpen ? "with-sidebar" : ""} ${stacked ? "is-stacked" : ""}`}
      style={sidebarPx != null ? ({ "--log-sidebar-width": `${sidebarPx}px` } as React.CSSProperties) : undefined}
    >
      {sidebarItems.length > 0 && (
        <div className="lonelog-log-controls">
          <button
            type="button"
            className="lonelog-log-toggle"
            aria-pressed={sidebarOpen}
            aria-label={sidebarOpen ? "Close log" : "Open log"}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? "✕" : "Log"}
          </button>
        </div>
      )}
      <div className="lonelog-prose-main">
        {sidebarItems.length > 0 && <span className="lonelog-log-notch" aria-hidden="true" />}
        <ProseView
          scenes={scenes}
          sourcePath={sourcePath}
          selectedId={selectedId}
          onSelectSource={handleDotClick}
          registerAnchor={registerProse}
        />
      </div>
      {sidebarOpen && (
        <LogSidebar
          items={sidebarItems}
          selectedId={selectedId}
          onSelect={handleSidebarClick}
          registerAnchor={registerSidebar}
          sourcePath={sourcePath}
          onChoice={onChoice}
          dieEdits={dieEdits}
          onDieChange={onDieChange}
          onResultChange={onResultChange}
          onTokenChange={onTokenChange}
        />
      )}
    </div>
  );
}
