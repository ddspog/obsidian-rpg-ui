import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  facetChoices,
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

/**
 * The notes of a folder call, a page at a time, with a search box and a select per field.
 * With few notes and no options of its own, it draws them all and no controls.
 */
export function FolderPager({ items, options, onRendered }: FolderPagerProps) {
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);

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

  useEffect(() => {
    onRendered?.();
  });

  if (!controls) return <>{items.map((it) => it.node)}</>;

  return (
    <div className="rpg-folder-pager">
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
        {choices.map(({ field, values }) => (
          <select
            key={field}
            className="rpg-folder-pager__facet dropdown"
            aria-label={field}
            value={chosen[field] ?? ""}
            onChange={(e) => {
              setChosen({ ...chosen, [field]: e.target.value });
              setPage(0);
            }}
          >
            <option value="">{`Any ${field.length <= 2 ? field.toUpperCase() : field}`}</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
        <span className="rpg-folder-pager__count">
          {shown.length === items.length ? `${items.length}` : `${shown.length} of ${items.length}`}
        </span>
      </div>
      {visible.length ? (
        visible.map((it) => <React.Fragment key={it.key}>{it.node}</React.Fragment>)
      ) : (
        <p className="rpg-folder-pager__empty">Nothing matches.</p>
      )}
      {size > 0 && pages > 1 && (
        <nav className="rpg-folder-pager__pages" aria-label="Pages">
          <button
            type="button"
            className="rpg-folder-pager__arrow"
            aria-label="Previous page"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            ‹
          </button>
          <span className="rpg-folder-pager__label">
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            className="rpg-folder-pager__arrow"
            aria-label="Next page"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
}
