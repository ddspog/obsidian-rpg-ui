/**
 * A run of Log entries mixed into the prose, under the passage they led to. Used when the page
 * has no margin for the Log: one quiet line ("▸ 3 entries · Search · Loot") that opens to the
 * same entry cards the Log shows, dice, edits and picks included.
 */

import * as React from "react";
import { LogSidebar, type LogSidebarProps } from "./log-sidebar";
import type { SidebarItem } from "lib/domains/session-log/prose-model";

/** A few words for an entry: its first line, without markup. */
function entryWords(item: SidebarItem): string {
  const row = item.rows.find((r) => r.content || r.scene);
  const text = row?.scene ? `Scene ${row.scene.number}` : (row?.content ?? "");
  return (
    text
      .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
      // `@Kobold, Tinkerer.action("Parts-Filled Sling")` reads "Parts-Filled Sling"
      .replace(/@?[^@"()]*?\.\w+\("([^"]+)"\)/g, "$1")
      .replace(/@\(([^)]*)\)\s*/g, "")
      // and its tags (`[Mv: J15]`) are left to the card
      .replace(/\[[^\]]*\]\s*/g, "")
      .replace(/[*_`~#>@]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 4)
      .join(" ")
  );
}

export function LogTrail({
  items,
  open,
  onToggle,
  ...sidebar
}: Omit<LogSidebarProps, "items" | "bare"> & {
  items: SidebarItem[];
  open: boolean;
  onToggle: () => void;
}) {
  const summary = items.map(entryWords).filter(Boolean).slice(0, 2).join(" · ");
  const id = React.useId();
  return (
    <div className={`lonelog-trail${open ? " is-open" : ""}`}>
      <button type="button" className="lonelog-trail-head" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className="lonelog-trail-caret" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <span className="lonelog-trail-count">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
        {summary && <span className="lonelog-trail-summary">{summary}</span>}
      </button>
      {open && (
        <div id={id}>
          <LogSidebar {...sidebar} items={items} bare />
        </div>
      )}
    </div>
  );
}
