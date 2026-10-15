/**
 * Log Sidebar
 *
 * The right rail for the log block. Lists every mechanical lonelog entry as a
 * small icon | content | dateline table via the shared `SidebarEntry` renderer
 * (so the example showcase in a feature card renders identically). Clicking an
 * entry scrolls the prose to the matching passage; the provenance dot in the
 * prose opens and highlights the corresponding entry here. Scene consequences
 * and dice/thresholds are editable inline (write-back wired through `edit`).
 *
 * A host can group a run of entries into a SECTION with a head of its own — a
 * fight under its battle map. The head sticks under the Log heading while its
 * entries scroll past, and lets go when they end. Scrolling reports the entry
 * being read: the one just under whatever sticks at the top.
 */

import * as React from "react";
import { SidebarEntry, type SidebarEditContext, type SceneEditValue } from "./sidebar-entry";
import type { SidebarItem } from "lib/domains/session-log/prose-model";

export type { SceneEditValue };

export interface LogSidebarProps {
  items: SidebarItem[];
  selectedId: number | null;
  onSelect?: (id: number) => void;
  registerAnchor?: (id: number, el: HTMLElement | null) => void;
  sourcePath: string;
  /** Pending scene edits keyed by the scene's original `=>` text. */
  sceneEdits?: Record<string, SceneEditValue>;
  onSceneChange?: (original: string, next: SceneEditValue) => void;
  /** Pending die-value edits keyed by `dieEditKey(source, raw, slot)`. */
  dieEdits?: Record<string, string>;
  onDieChange?: (source: string, raw: string, slot: number, value: string) => void;
  onResultChange?: (source: string, value: string) => void;
  /** Swap a token on a source line — powers the list-consult picker. */
  onTokenChange?: (source: string, from: string, to: string, nth: number) => void;
  /** A GM step dropdown pick — inserts the chosen step line into the note. */
  onChoice?: (selected: string) => void;
  /** Runs of entries (by id, inclusive) grouped under a sticky head. */
  sections?: SidebarSection[];
  /** The entry being read changed as the Log scrolled. */
  onReading?: (id: number) => void;
  /** Bring an entry up to just under the sticky heads (`n` repeats a request). */
  follow?: { id: number; n: number } | null;
  /** Close the Log — its ✕ sits in the header, which sticks as the Log scrolls. */
  onClose?: () => void;
}

export interface SidebarSection {
  key: string;
  start: number;
  /** The last entry in it; absent, it runs to the end of the log. */
  end?: number;
  head: React.ReactNode;
}

const inSection = (s: SidebarSection, id: number) => id >= s.start && (s.end == null || id <= s.end);

export function LogSidebar({
  items,
  selectedId,
  onSelect,
  registerAnchor,
  sourcePath,
  sceneEdits,
  onSceneChange,
  dieEdits,
  onDieChange,
  onResultChange,
  onTokenChange,
  onChoice,
  sections = [],
  onReading,
  follow,
  onClose,
}: LogSidebarProps) {
  const asideRef = React.useRef<HTMLElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const entries = React.useRef(new Map<number, HTMLElement>());

  // Where the sticky heads are measured from: the bottom of the Log heading,
  // kept as a CSS variable so a section's head sticks right under it.
  React.useLayoutEffect(() => {
    const aside = asideRef.current;
    const header = headerRef.current;
    if (!aside || !header) return;
    const measure = () => {
      const top = parseFloat(getComputedStyle(header).top) || 0;
      aside.style.setProperty("--lonelog-sidebar-head-h", `${top + header.offsetHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  /** The line entries are read at: under the Log heading and any stuck head. */
  const readingLine = React.useCallback((): number => {
    const aside = asideRef.current;
    if (!aside) return 0;
    let line = headerRef.current?.getBoundingClientRect().bottom ?? aside.getBoundingClientRect().top;
    for (const head of Array.from(aside.querySelectorAll<HTMLElement>(".lonelog-sidebar-section-head"))) {
      const r = head.getBoundingClientRect();
      const section = head.parentElement?.getBoundingClientRect();
      // Stuck: pinned at the line while its section still runs below it.
      if (section && r.top <= line + 1 && section.bottom > r.bottom) line = Math.max(line, r.bottom);
    }
    return line;
  }, []);

  // Report the entry being read as the Log scrolls: the last one whose top has
  // reached the line (a little below it, so an entry counts once it shows).
  // Reported on every scroll, not only on change: the prose may have moved
  // the reading position meanwhile, and the Log scrolling takes it back.
  React.useEffect(() => {
    const aside = asideRef.current;
    if (!aside || !onReading) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = readingLine() + 24;
        let found: number | null = null;
        for (const [id, el] of [...entries.current].sort((a, b) => a[0] - b[0])) {
          if (el.getBoundingClientRect().top <= line) found = id;
        }
        if (found != null) onReading(found);
      });
    };
    aside.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      aside.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [onReading, readingLine]);

  // Follow a request (the map's timeline): scroll the entry up to the line.
  React.useEffect(() => {
    const aside = asideRef.current;
    if (!aside || !follow) return;
    const ids = [...entries.current.keys()].filter((k) => k <= follow.id).sort((a, b) => b - a);
    const el = entries.current.get(ids[0]);
    if (!el) return;
    const delta = el.getBoundingClientRect().top - readingLine() - 4;
    aside.scrollBy({ top: delta, behavior: "smooth" });
  }, [follow, readingLine]);

  const entryRef = (id: number) => (el: HTMLElement | null) => {
    if (el) entries.current.set(id, el);
    else entries.current.delete(id);
    registerAnchor?.(id, el);
  };

  // Editable only when write-back handlers are wired (the live log); a read-only
  // host (a feature.gm body) passes none, so entries render static.
  const edit: SidebarEditContext | undefined =
    onSceneChange || onDieChange || onResultChange || onTokenChange
      ? {
          sceneEdits: sceneEdits ?? {},
          onSceneChange: onSceneChange ?? (() => {}),
          dieEdits: dieEdits ?? {},
          onDieChange: onDieChange ?? (() => {}),
          onResultChange: onResultChange ?? (() => {}),
          onTokenChange,
        }
      : undefined;

  return (
    <aside ref={asideRef} className="lonelog-sidebar lonelog-entries" aria-label="Session log">
      <div ref={headerRef} className="lonelog-sidebar-header">
        Log
        {onClose && (
          <button
            type="button"
            className="lonelog-log-toggle"
            aria-pressed={true}
            aria-label="Close log"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="lonelog-sidebar-empty">No log entries.</div>
      ) : (
        groupIntoSections(items, sections).map((run) => {
          const rows = run.items.map((item) => (
            <SidebarEntry
              key={item.id}
              item={item}
              sourcePath={sourcePath}
              edit={edit}
              selected={selectedId === item.id}
              onSelect={onSelect}
              anchorRef={entryRef(item.id)}
              onChoice={onChoice}
            />
          ));
          if (!run.section) return <React.Fragment key={`run-${run.items[0]?.id}`}>{rows}</React.Fragment>;
          return (
            <section key={run.section.key} className="lonelog-sidebar-section">
              <div className="lonelog-sidebar-section-head">{run.section.head}</div>
              {rows}
            </section>
          );
        })
      )}
    </aside>
  );
}

/** Items in order, cut into runs: those inside a section, and those between. */
function groupIntoSections(
  items: SidebarItem[],
  sections: SidebarSection[]
): Array<{ section?: SidebarSection; items: SidebarItem[] }> {
  const runs: Array<{ section?: SidebarSection; items: SidebarItem[] }> = [];
  for (const item of items) {
    const section = sections.find((s) => inSection(s, item.id));
    const last = runs[runs.length - 1];
    if (last && last.section === section) last.items.push(item);
    else runs.push({ ...(section ? { section } : {}), items: [item] });
  }
  return runs;
}
