import * as React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CompactTabNav, NextTabLink } from "lib/components/compact-tab-nav";
import {
  countText,
  facetChoices,
  fieldLabel,
  filterItems,
  pageCount,
  pageNames,
  pageOf,
  type PagerItem,
  type PagerOptions,
} from "lib/domains/references/folder-pager";

export interface FolderPagerProps {
  items: Array<PagerItem & { node: React.ReactNode }>;
  options: PagerOptions;
  /** Called after each page is drawn (to mark highlighted entries and the like). */
  onRendered?: () => void;
}

/**
 * The notes of a folder call, a page at a time, with a search box and a select per field.
 * With few notes and no options of its own, it draws them all and no controls.
 */
export function FolderPager({ items, options, onRendered }: FolderPagerProps) {
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  // The page row docks at the top of the screen once it scrolls away, as a rule tab's part row does.
  const [docked, setDocked] = useState(false);
  // Set when the page changes, so the list's top is brought back into view after it is drawn.
  const reveal = useRef(false);

  const choices = useMemo(
    () =>
      options.facets.map((field) => ({ field, values: facetChoices(items, field) })).filter((f) => f.values.length > 1),
    [items, options.facets]
  );
  const shown = useMemo(() => filterItems(items, search, chosen), [items, search, chosen]);
  const size = options.size;
  const { items: visible, page: current } = pageOf(shown, page, size);
  const pages = pageCount(shown.length, size);
  const controls = (size > 0 && items.length > size) || (options.explicit && choices.length > 0);
  const filtered = search.trim() !== "" || Object.values(chosen).some(Boolean);
  const names = useMemo(() => pageNames(shown, size), [shown, size]);
  const paged = size > 0 && pages > 1;

  useEffect(() => {
    onRendered?.();
  });

  useEffect(() => {
    const el = row.current;
    if (!el || typeof IntersectionObserver !== "function") {
      setDocked(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => setDocked(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [paged]);

  // A page opened from its end, the docked row or the picker opens at its top, as a rule tab's
  // part does (only when the pager's top is above the screen).
  useLayoutEffect(() => {
    if (!reveal.current) return;
    reveal.current = false;
    const el = root.current;
    if (!el) return;
    const scroller = el.closest(".markdown-preview-view, .cm-scroller") as HTMLElement | null;
    const top = scroller ? scroller.getBoundingClientRect().top : 0;
    if (el.getBoundingClientRect().top < top) el.scrollIntoView({ block: "start" });
  }, [current]);

  if (!controls) return <>{items.map((it) => it.node)}</>;

  const goTo = (p: number) => {
    reveal.current = true;
    setPage(p);
  };
  const clear = () => {
    setSearch("");
    setChosen({});
    setPage(0);
  };
  const [, plural] = options.noun;

  return (
    <div className={`rpg-folder-pager${docked && paged ? " is-docked" : ""}`} ref={root}>
      <div className="rpg-folder-pager__filters">
        <input
          type="search"
          className="rpg-folder-pager__search"
          placeholder="Search by name"
          aria-label="Search by name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        {choices.map(({ field, values }) => {
          const label = fieldLabel(field);
          const value = chosen[field] ?? "";
          return (
            <select
              key={field}
              className={`rpg-folder-pager__facet dropdown${value ? " rpg-folder-pager__facet--set" : ""}`}
              aria-label={`Filter by ${label}`}
              value={value}
              onChange={(e) => {
                setChosen({ ...chosen, [field]: e.target.value });
                setPage(0);
              }}
            >
              <option value="">{`Any ${label}`}</option>
              {values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          );
        })}
      </div>
      <div className="rpg-folder-pager__status">
        <span className="rpg-folder-pager__count" role="status" aria-live="polite">
          {countText(shown.length, items.length, options.noun)}
        </span>
        {filtered && (
          <button type="button" className="rpg-folder-pager__clear" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {paged && (
        <>
          <div className="rpg-folder-pager__row" ref={row}>
            <CompactTabNav names={names} activeIdx={current} onPick={goTo} label="Page" part tag="Page" />
          </div>
          <div className="rpg-folder-pager__dock">
            {docked && <CompactTabNav names={names} activeIdx={current} onPick={goTo} label="Page" part tag="Page" />}
          </div>
        </>
      )}
      {visible.length ? (
        visible.map((it) => <React.Fragment key={it.key}>{it.node}</React.Fragment>)
      ) : (
        <div className="rpg-folder-pager__empty">
          <p>{search.trim() ? `No ${plural} match “${search.trim()}”.` : `No ${plural} match these filters.`}</p>
          <button type="button" className="rpg-folder-pager__clear-all" onClick={clear}>
            Clear filters
          </button>
        </div>
      )}
      {paged && <NextTabLink names={names.map((n, i) => `Page ${i + 1} · ${n}`)} activeIdx={current} onPick={goTo} />}
    </div>
  );
}
