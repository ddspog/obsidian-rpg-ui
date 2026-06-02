/**
 * `RpgListView` — presentational renderer for `rpg list.*` blocks.
 *
 * Takes one or more parsed {@link ListBlock}s (the merge engine fuses
 * consecutive fences into one view), resolves each block's entries to
 * markdown lines, then flows the headings + lines through a responsive,
 * full-pane-width CSS multi-column container. Each entry renders via
 * `<Markdown>` so `[[wikilinks]]` and inline markup work.
 *
 * The column count is **content-driven**: all rows are measured once in a
 * hidden single-column box, then `computeLayout` picks how many columns to use
 * (up to the block's `columns:` cap) so each balanced column stays at least
 * `--rpg-list-min-col-height` tall — a short list collapses 3→2→1 instead of
 * leaving empty columns. The box width tracks that count (fewer columns =
 * narrower box). Columns are balanced (equal height), not filled sequentially.
 *
 * Pagination (`paginate: true`/`auto`): when content can't fit in the chosen
 * columns of the `100vh − reserve` box, it splits into viewport-height pages.
 * Re-fits on pane resize via `ResizeObserver`. A pill bar (one pill per list,
 * the page's leading list active) jumps to the page where each list begins;
 * a page that opens mid-list gets a "(cont.)" heading.
 */

import * as React from "react";
import type { App } from "obsidian";
import { Markdown } from "lib/components/markdown";
import { resolveListLines, type ListSource } from "lib/domains/lists/resolve-entries";
import { officialSourcesForPath } from "lib/domains/lists/official-sources";
import { appListSource } from "lib/domains/lists/app-source";
import type { ListBlock, ListColumns, ResolvedList } from "lib/domains/lists/types";
import {
  buildRows,
  computeLayout,
  withContinuations,
  groupIntoSections,
  firstPageByList,
  sameBoundaries,
  type Layout,
  type Section,
} from "lib/domains/lists/paginate-fit";

function maxColsOf(columns: ListColumns): number {
  return columns === 1 ? 1 : columns === 2 ? 2 : 3;
}

function SectionView({ section, sourcePath }: { section: Section; sourcePath: string }) {
  const headingCls = "rpg-list__heading" + (section.cont ? " rpg-list__heading--cont" : "");
  return (
    <section className="rpg-list__section" data-list-id={section.listId}>
      {section.name ? (
        <hgroup className={headingCls}>
          {/* h3 so the bars nest beneath the document's own h1/h2 outline. */}
          <h3>
            {section.name}
            {section.cont ? " (cont.)" : ""}
          </h3>
          {section.subtitle && !section.cont ? (
            <p>
              <small>{section.subtitle}</small>
            </p>
          ) : null}
        </hgroup>
      ) : null}
      {section.lines.length > 0 ? (
        <ul className="rpg-list__entries">
          {section.lines.map((line) => (
            <li
              className={"rpg-list__entry" + (line.highlight ? " rpg-list__entry--hl" : "")}
              key={line.key}
              style={
                line.highlight?.color
                  ? ({ ["--rpg-list-hl" as string]: line.highlight.color } as React.CSSProperties)
                  : undefined
              }
            >
              <Markdown source={line.markdown} sourcePath={sourcePath} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rpg-list__empty">No entries.</p>
      )}
    </section>
  );
}

/* ── Root view ──────────────────────────────────────────────────────────── */

export interface RpgListViewProps {
  /** One block (standalone) or several (merged group, in DOM order). */
  blocks: ListBlock[];
  /** Host note path, for relative wikilink resolution. */
  sourcePath: string;
  /** Injected IO (tests / Storybook); defaults to the live vault. */
  source?: ListSource;
}

export function RpgListView({ blocks, sourcePath, source }: RpgListViewProps) {
  const [resolved, setResolved] = React.useState<ResolvedList[] | null>(null);
  const [page, setPage] = React.useState(0);
  const [layout, setLayout] = React.useState<Layout | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const chipsRef = React.useRef<HTMLMenuElement>(null);
  const chipRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  React.useEffect(() => {
    const app = (globalThis as unknown as { app?: App }).app;
    const src = source ?? (app ? appListSource(app) : null);
    if (!src) {
      setResolved(blocks.map((b) => ({ block: b, lines: [] })));
      return;
    }
    let cancelled = false;
    const official = officialSourcesForPath(sourcePath);
    Promise.all(
      blocks.map(async (b) => ({
        block: b,
        lines: await resolveListLines(b, sourcePath, src, official),
      }))
    )
      .then((r) => {
        if (!cancelled) setResolved(r);
      })
      .catch((err) => {
        console.error("rpg list.*: entry resolution failed", err);
        if (!cancelled) setResolved(blocks.map((b) => ({ block: b, lines: [] })));
      });
    return () => {
      cancelled = true;
    };
  }, [blocks, sourcePath, source]);

  const columns = blocks[0]?.columns ?? "auto";
  const paginated = React.useMemo(() => !!blocks.find((b) => b.paginate), [blocks]);
  const rows = React.useMemo(() => (resolved ? buildRows(resolved) : []), [resolved]);
  const byId = React.useMemo(
    () => new Map((resolved ?? []).map((r) => [r.block.id, r.block])),
    [resolved]
  );

  // Measure every row's height in a hidden single-column box (one column
  // wide), then pick a column count + page split via computeLayout. Runs for
  // all lists (column count is content-driven, not just for pagination).
  React.useEffect(() => {
    if (rows.length === 0) {
      setLayout(null);
      return;
    }
    if (typeof ResizeObserver === "undefined") return;

    function recompute() {
      const box = boxRef.current;
      const measure = measureRef.current;
      if (!box || !measure) return;
      const cs = getComputedStyle(box);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const colWidth = 17 * rem;
      const gap = parseFloat(cs.columnGap) || 32;
      const maxH = parseFloat(cs.maxHeight);
      const H = Number.isFinite(maxH) && maxH > 0 ? maxH : window.innerHeight - 18 * rem;
      const minRaw = cs.getPropertyValue("--rpg-list-min-col-height").trim();
      let minColHeight = 14 * rem;
      if (minRaw.endsWith("px")) minColHeight = parseFloat(minRaw) || minColHeight;
      else if (minRaw.endsWith("rem")) minColHeight = (parseFloat(minRaw) || 14) * rem;
      // Cap the column count by how many ~17rem columns fit the PANE width
      // (stable), not the box width — the box width tracks the chosen count, so
      // measuring it would feed back and collapse to 1 column permanently.
      const pane = box.closest(
        ".markdown-preview-view, .markdown-reading-view, .markdown-source-view, .cm-editor"
      ) as HTMLElement | null;
      let availWidth = box.clientWidth;
      if (pane) {
        const pcs = getComputedStyle(pane);
        const padX = (parseFloat(pcs.paddingLeft) || 0) + (parseFloat(pcs.paddingRight) || 0);
        availWidth = Math.max(0, pane.clientWidth - padX);
      }
      const fitCols =
        availWidth > 0
          ? Math.max(1, Math.floor((availWidth + gap) / (colWidth + gap)))
          : maxColsOf(columns);
      const maxCols = Math.min(maxColsOf(columns), fitCols);

      // Measure at exactly one column width (columns are always ~17rem wide,
      // regardless of count, since the box width tracks the column count).
      const wpx = `${colWidth}px`;
      if (measure.style.width !== wpx) {
        measure.style.width = wpx;
        return; // re-fires via the measure observer once content rewraps
      }
      const els = Array.from(
        measure.querySelectorAll<HTMLElement>(".rpg-list__heading, .rpg-list__entry")
      );
      if (els.length === 0 || els.length !== rows.length) return;
      const rects = els.map((e) => e.getBoundingClientRect());
      const consumed = rects.map((r, i) =>
        i < rects.length - 1 ? Math.max(0, rects[i + 1].top - r.top) : r.height
      );
      const next = computeLayout(rows, consumed, {
        maxHeight: H,
        maxCols,
        minColHeight,
        paginate: paginated,
      });
      setLayout((prev) =>
        prev && prev.cols === next.cols && sameBoundaries(prev.pages, next.pages) ? prev : next
      );
    }

    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        raf = requestAnimationFrame(recompute);
      }, 80);
    };
    const roBox = new ResizeObserver(schedule);
    const roMeasure = new ResizeObserver(schedule);
    if (boxRef.current) roBox.observe(boxRef.current);
    if (measureRef.current) roMeasure.observe(measureRef.current);
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(raf);
      roBox.disconnect();
      roMeasure.disconnect();
    };
  }, [rows, columns, paginated]);

  // Carousel: keep the active pill centered in the (scrollable) pill bar, so a
  // click on an edge pill walks the strip toward more distant lists.
  React.useEffect(() => {
    const container = chipsRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(".rpg-list__chip--active");
    if (!active) return;
    const target = active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
  }, [page, layout]);

  if (resolved === null) {
    return <div className="rpg-list rpg-list--loading" aria-busy="true" />;
  }

  const layoutCols = layout?.cols ?? maxColsOf(columns);
  const displayPages = withContinuations(layout?.pages ?? [rows], byId);
  const pageCount = Math.max(1, displayPages.length);
  const current = Math.min(page, pageCount - 1);
  const pageRows = displayPages[current] ?? [];
  const sections = groupIntoSections(pageRows);
  const firstPageOf = firstPageByList(displayPages);
  // Lists that land on the same page collapse into ONE pill. Its label shows
  // just the first and last section names with an ellipsis between (e.g.
  // "Cantrips … 2nd Circle"); a single-list pill shows its name. Lists are in
  // page order, so same-page lists are always consecutive.
  const pillGroups: { page: number; names: string[] }[] = [];
  for (const r of resolved) {
    const p = firstPageOf.get(r.block.id) ?? 0;
    const last = pillGroups[pillGroups.length - 1];
    if (last && last.page === p) last.names.push(r.block.name);
    else pillGroups.push({ page: p, names: [r.block.name] });
  }
  const pills = pillGroups.map((g) => ({
    page: g.page,
    label: g.names.length > 1 ? `${g.names[0]} … ${g.names[g.names.length - 1]}` : g.names[0],
  }));
  // The active pill owns the current page: the last pill whose page <= current
  // (so continuation pages stay attributed to the list that started them).
  let activePill = 0;
  for (let i = 0; i < pills.length; i++) if (pills[i].page <= current) activePill = i;

  // Prev/next shows whenever there's more than one page; the pills only when
  // they'd lead to more than one distinct page.
  const showPager = paginated && pageCount > 1;
  const showChips = showPager && pills.length > 1;

  // ARIA tablist keyboard nav: arrows/Home/End move between pills (and jump to
  // that pill's page), with a roving tabindex.
  function onChipKey(e: React.KeyboardEvent, i: number) {
    let target = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") target = Math.min(pills.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") target = Math.max(0, i - 1);
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = pills.length - 1;
    else return;
    e.preventDefault();
    const pill = pills[target];
    if (pill) setPage(pill.page);
    chipRefs.current[target]?.focus();
  }

  return (
    <div
      className="rpg-list"
      style={{ ["--rpg-list-max-cols" as string]: layoutCols } as React.CSSProperties}
    >
      {/* Hidden single-column measuring box — same markup as the display so
          measured heights match. */}
      <div
        ref={measureRef}
        className="rpg-list-measure"
        aria-hidden="true"
        style={{ position: "absolute", left: "-99999px", top: 0, visibility: "hidden" }}
      >
        {groupIntoSections(rows).map((s, i) => (
          <SectionView key={`m:${s.listId}:${i}`} section={s} sourcePath={sourcePath} />
        ))}
      </div>

      {showChips ? (
        <menu role="tablist" className="rpg-list__chips" ref={chipsRef}>
          {pills.map((p, i) => {
            const active = i === activePill;
            return (
              <button
                key={p.page}
                ref={(el) => {
                  chipRefs.current[i] = el;
                }}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                className={"rpg-list__chip" + (active ? " rpg-list__chip--active" : "")}
                onClick={() => setPage(p.page)}
                onKeyDown={(e) => onChipKey(e, i)}
              >
                {p.label}
              </button>
            );
          })}
        </menu>
      ) : null}

      <div className="rpg-list__columns" ref={boxRef}>
        {sections.map((s, i) => (
          <SectionView key={`${s.listId}:${i}`} section={s} sourcePath={sourcePath} />
        ))}
      </div>

      {showPager ? (
        <menu className="rpg-list__pagination">
          <button
            className="rpg-list__page-arrow"
            disabled={current === 0}
            aria-label="Previous page"
            onClick={() => setPage(current - 1)}
          >
            ‹
          </button>
          <span className="rpg-list__page-indicator">
            <strong>{current + 1}</strong> / {pageCount}
          </span>
          <button
            className="rpg-list__page-arrow"
            disabled={current === pageCount - 1}
            aria-label="Next page"
            onClick={() => setPage(current + 1)}
          >
            ›
          </button>
        </menu>
      ) : null}
    </div>
  );
}

export default RpgListView;
