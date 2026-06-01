import * as React from "react";
import { useState, useRef, useEffect } from "react";
import type { TableDef, TableRow, FooterRow, FooterCell } from "lib/domains/tables/types";
import type { PaginationConfig, PaginationState } from "lib/domains/tables/pagination";
import { totalPages } from "lib/domains/tables/pagination";
import type { RenderCell, RowRange } from "lib/domains/tables/row-merge";
import { resolveRenderRows } from "lib/domains/tables/row-merge";
import { rollStoreKey } from "lib/domains/tables/roll-store";
import { useRollResult } from "lib/domains/tables/use-roll-result";

export interface RpgTableProps {
  def: TableDef;
  filePath?: string;
  sourcePath?: string;
}

const WIKILINK_RE = /\[\[([^\]\n]+)\]\]/g;

function cleanCellValue(raw: string): string {
  return raw.replace(/`\s*(@\[\[[^\]\n]+\]\](?:\.[A-Za-z_][\w-]*|\[[^\]\n]+\])+)\s*`/g, "$1");
}

function CellContent({ value }: { value: string }) {
  const cleaned = cleanCellValue(value);
  if (!WIKILINK_RE.test(cleaned)) {
    return <>{cleaned}</>;
  }
  WIKILINK_RE.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(cleaned)) !== null) {
    if (m.index > 0 && cleaned[m.index - 1] === "@") continue;
    if (m.index > cursor) {
      parts.push(<React.Fragment key={`t${cursor}`}>{cleaned.slice(cursor, m.index)}</React.Fragment>);
    }
    const inner = m[1];
    const pipe = inner.indexOf("|");
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
    parts.push(
      <a key={`l${m.index}`} className="internal-link" href={target} data-href={target}>
        {label}
      </a>
    );
    cursor = m.index + m[0].length;
  }
  if (cursor < cleaned.length) {
    parts.push(<React.Fragment key={`t${cursor}`}>{cleaned.slice(cursor)}</React.Fragment>);
  }
  return <>{parts}</>;
}

function HeaderRow({ row }: { row: TableRow }) {
  return (
    <tr>
      {row.cells.map((cell, i) => (
        <th key={i} colSpan={cell.colspan && cell.colspan > 1 ? cell.colspan : undefined}>
          {cell.value}
        </th>
      ))}
    </tr>
  );
}

function CategoryRow({ label, columnCount }: { label: string; columnCount: number }) {
  return (
    <tr data-category="true">
      <td colSpan={columnCount}>{label}</td>
    </tr>
  );
}

function BodyRow({ cells }: { cells: RenderCell[] }) {
  return (
    <tr>
      {cells.map((cell, i) => {
        const spanning = cell.rowspan != null && cell.rowspan > 1;
        return (
          <td
            key={i}
            colSpan={cell.colspan && cell.colspan > 1 ? cell.colspan : undefined}
            rowSpan={spanning ? cell.rowspan : undefined}
            data-valign={spanning ? cell.valign : undefined}
            data-indent={cell.indent ? String(cell.indent) : undefined}
            data-merge-carried={cell.carried ? "true" : undefined}
          >
            <CellContent value={cell.value} />
          </td>
        );
      })}
    </tr>
  );
}

function RollCell({
  cell,
  storeKey,
  def,
}: {
  cell: FooterCell;
  storeKey: string;
  def: TableDef;
}) {
  const interactive = cell.segments.some((s) => s.kind === "roll");
  const { values, reroll } = useRollResult(storeKey, def, cell);

  const handleClick = interactive ? reroll : undefined;
  const handleKeyDown = interactive
    ? (ev: React.KeyboardEvent) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          reroll();
        }
      }
    : undefined;

  let rollIdx = 0;
  const content = cell.segments.map((seg, i) => {
    if (seg.kind === "text") {
      return <React.Fragment key={i}>{seg.text}</React.Fragment>;
    }
    const result = values?.[rollIdx] ?? "";
    rollIdx++;
    return (
      <span key={i} className="dice-roller-result">
        {result}
      </span>
    );
  });

  return (
    <span
      className={`dice-roller rpg-table-roll-cell${interactive ? "" : " rpg-table-roll-cell-static"}`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {content}
    </span>
  );
}

function FooterRowView({
  row,
  rowIdx,
  def,
  filePath,
}: {
  row: FooterRow;
  rowIdx: number;
  def: TableDef;
  filePath: string;
}) {
  return (
    <tr className="rpg-table-tfoot__roll-row">
      <td colSpan={def.columns.length || 1}>
        {row.cells.map((cell, cellIdx) => (
          <RollCell
            key={cellIdx}
            cell={cell}
            storeKey={rollStoreKey(filePath, def.name, rowIdx, cellIdx)}
            def={def}
          />
        ))}
      </td>
    </tr>
  );
}

function PaginationControls({
  config,
  state,
  rowCount,
  onChange,
}: {
  config: PaginationConfig;
  state: PaginationState;
  rowCount: number;
  onChange: (s: PaginationState) => void;
}) {
  const pages = totalPages(rowCount, config.size);

  if (config.controls === "show-more") {
    const allShown = config.size * state.visiblePages >= rowCount;
    if (allShown) return null;
    return (
      <tr className="rpg-table-tfoot__pagination-row">
        <td>
          <button
            className="rpg-table-pagination__show-more"
            onClick={() => onChange({ ...state, visiblePages: state.visiblePages + 1 })}
          >
            Show more
          </button>
        </td>
      </tr>
    );
  }

  if (config.controls === "pages") {
    return (
      <tr className="rpg-table-tfoot__pagination-row">
        <td>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              className={`rpg-table-pagination__page${i === state.page ? " rpg-table-pagination__page--active" : ""}`}
              onClick={() => onChange({ ...state, page: i })}
            >
              {i + 1}
            </button>
          ))}
        </td>
      </tr>
    );
  }

  return (
    <tr className="rpg-table-tfoot__pagination-row">
      <td>
        <button
          className="rpg-table-pagination__arrow"
          disabled={state.page <= 0}
          onClick={() => onChange({ ...state, page: state.page - 1 })}
        >
          ‹
        </button>
        <span className="rpg-table-pagination__label">
          {state.page + 1} / {pages}
        </span>
        <button
          className="rpg-table-pagination__arrow"
          disabled={state.page >= pages - 1}
          onClick={() => onChange({ ...state, page: state.page + 1 })}
        >
          ›
        </button>
      </td>
    </tr>
  );
}

export function RpgTable({ def, filePath = "", sourcePath }: RpgTableProps) {
  const [paginationState, setPaginationState] = useState<PaginationState>({
    page: 0,
    visiblePages: 1,
  });

  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const thead = table.querySelector("thead th") as HTMLElement | null;
    if (!thead) return;
    const bg = getComputedStyle(thead).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)") {
      const tfoot = table.querySelector(".rpg-table-tfoot") as HTMLElement | null;
      if (tfoot) tfoot.style.borderBottom = `3px solid ${bg}`;
    }
  }, []);

  const columnCount = def.columns.length || 1;
  const hasFooter = def.footerRows.length > 0 || def.pagination != null;

  // Visible window of body rows, mirroring `sliceRows`. Spans are resolved
  // over this window so a `^` orphaned at a page top re-anchors via carry-down.
  const range: RowRange = (() => {
    const cfg = def.pagination;
    if (!cfg) return { start: 0, end: def.rows.length };
    if (cfg.controls === "show-more") {
      return { start: 0, end: Math.min(def.rows.length, cfg.size * paginationState.visiblePages) };
    }
    const start = cfg.size * paginationState.page;
    return { start, end: Math.min(def.rows.length, start + cfg.size) };
  })();
  const renderRows = resolveRenderRows(def.rows, def.columns.length, range);

  return (
    <div className="el-table rpg-table-wrapper">
      <table className="rpg-table" ref={tableRef}>
        {def.caption && <caption>{def.caption}</caption>}
        <thead>
          {def.headerRows.map((row, i) => (
            <HeaderRow key={i} row={row} />
          ))}
        </thead>
        <tbody>
          {renderRows.map((row, i) =>
            row.category ? (
              <CategoryRow key={i} label={row.categoryLabel ?? ""} columnCount={columnCount} />
            ) : (
              <BodyRow key={i} cells={row.cells} />
            )
          )}
        </tbody>
        {hasFooter && (
          <tfoot className="rpg-table-tfoot">
            {def.footerRows.map((row, i) => (
              <FooterRowView key={i} row={row} rowIdx={i} def={def} filePath={filePath} />
            ))}
            {def.pagination && (
              <PaginationControls
                config={def.pagination}
                state={paginationState}
                rowCount={def.rows.length}
                onChange={setPaginationState}
              />
            )}
          </tfoot>
        )}
        {def.classes.map((cls) => (
          <a key={cls} href={`#${cls}`} hidden aria-hidden="true" />
        ))}
      </table>
    </div>
  );
}
