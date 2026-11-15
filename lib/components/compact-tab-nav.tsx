/**
 * The compact tab row and the "Next" link at the end of a tab, shared by rule tabs
 * (render-tab-group) and the folder-call pager, so moving on looks the same everywhere.
 * Their styles are in rule-compendium.css.
 */
import * as React from "react";

/**
 * The tab row on a phone: the current tab's whole name with ‹ › beside it and how far along it is
 * (`2/9`); tapping the name opens the phone's own list of every tab, names in full. A strip of
 * tabs shows one tab at a time at that width, cut short; this shows where you are and the rest.
 */
export function CompactTabNav({
  names,
  activeIdx,
  onPick,
  label,
  part = false,
  tag = part ? "Part" : undefined,
  listNames = names,
}: {
  names: string[];
  activeIdx: number;
  onPick: (idx: number) => void;
  label: string;
  /** A subtab row: a lighter line, docked under the chapter row while its part is read. */
  part?: boolean;
  /** The word before the name (`Part`, `Page`); a part row has `Part` unless told otherwise. */
  tag?: string;
  /** The names in the list the row opens, when they are longer than the row's (`names`). */
  listNames?: string[];
}) {
  const n = names.length;
  return (
    <nav className={`rpg-tab-compact${part ? " rpg-tab-compact--part" : ""}`} aria-label={label}>
      <button
        type="button"
        className="rpg-tab-compact__arrow"
        aria-label={activeIdx > 0 ? `Previous: ${names[activeIdx - 1]}` : "Previous"}
        disabled={activeIdx === 0}
        onClick={() => onPick(activeIdx - 1)}
      >
        ‹
      </button>
      <span className="rpg-tab-compact__pick">
        {tag ? <span className="rpg-tab-compact__label">{tag}</span> : null}
        <span className="rpg-tab-compact__name">{names[activeIdx]}</span>
        <span className="rpg-tab-compact__count">
          {activeIdx + 1}/{n} ▾
        </span>
        <select
          className="rpg-tab-compact__select"
          aria-label={label}
          value={activeIdx}
          onChange={(e) => onPick(Number(e.target.value))}
        >
          {listNames.map((name, i) => (
            <option key={i} value={i}>
              {`${i + 1}. ${name}`}
            </option>
          ))}
        </select>
      </span>
      <button
        type="button"
        className="rpg-tab-compact__arrow"
        aria-label={activeIdx < n - 1 ? `Next: ${names[activeIdx + 1]}` : "Next"}
        disabled={activeIdx >= n - 1}
        onClick={() => onPick(activeIdx + 1)}
      >
        ›
      </button>
    </nav>
  );
}

/** At the end of a tab (or a page of a folder call): the next one, so reading on does not mean going back up. */
export function NextTabLink({
  names,
  activeIdx,
  onPick,
}: {
  names: string[];
  activeIdx: number;
  onPick: (idx: number) => void;
}) {
  if (activeIdx >= names.length - 1) return null;
  return (
    <button type="button" className="rpg-tab-next" onClick={() => onPick(activeIdx + 1)}>
      <span className="rpg-tab-next__label">Next</span>
      <span className="rpg-tab-next__name">{names[activeIdx + 1]}</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}
