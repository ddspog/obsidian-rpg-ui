import * as React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  countText,
  facetChoices,
  fieldLabel,
  filterItems,
  pageCount,
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

interface PageNavProps {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  /** Where the nav sits, for its accessible name. */
  place: "top" | "bottom";
}

/** `‹ Page 2 of 21 ▾ ›`: arrows either side of a page picker, as the table pager has. */
function PageNav({ page, pages, onPage, place }: PageNavProps) {
  return (
    <nav
      className={`rpg-folder-pager__pages rpg-folder-pager__pages--${place}`}
      aria-label={place === "top" ? "Pages" : "Pages, bottom"}
    >
      <button
        type="button"
        className="rpg-folder-pager__arrow"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        ‹
      </button>
      <label className="rpg-folder-pager__pick">
        <span className="rpg-folder-pager__label" aria-hidden="true">
          Page {page + 1} of {pages} ▾
        </span>
        <select
          className="rpg-folder-pager__page-select"
          aria-label={`Page ${page + 1} of ${pages}`}
          value={page}
          onChange={(e) => onPage(Number(e.target.value))}
        >
          {Array.from({ length: pages }, (_, i) => (
            <option key={i} value={i}>
              {`Page ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="rpg-folder-pager__arrow"
        aria-label="Next page"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
      >
        ›
      </button>
    </nav>
  );
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

  useEffect(() => {
    onRendered?.();
  });

  // After a page change from the bottom, the reader is left at the end of the new page: take
  // them to its start (only when the pager's top is above the screen).
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
    <div className="rpg-folder-pager" ref={root}>
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
        {size > 0 && pages > 1 && <PageNav page={current} pages={pages} onPage={goTo} place="top" />}
      </div>
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
      {size > 0 && pages > 1 && <PageNav page={current} pages={pages} onPage={goTo} place="bottom" />}
    </div>
  );
}
