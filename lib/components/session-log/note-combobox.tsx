/**
 * A text field that finds notes as you type — like an Obsidian link's
 * suggestions: matching notes listed under it, the arrows to move, Enter or
 * Tab to pick. What's typed stays as it is when no note matches (a thing
 * without a note of its own).
 */

import * as React from "react";
import { useId, useMemo, useState } from "react";

/** A note to offer: its name, and the folder it sits in. */
export interface NoteOption {
  name: string;
  folder: string;
}

interface NoteComboboxProps {
  value: string;
  /** What's typed, and the note when one was picked (or typed exactly). */
  onChange: (value: string, note?: NoteOption) => void;
  options: NoteOption[];
  placeholder?: string;
  className?: string;
  /** How many matches to list. */
  limit?: number;
}

/** The notes whose names hold every typed word — those starting with it first. */
export function matchNotes(options: NoteOption[], query: string, limit = 8): NoteOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return options
    .filter((o) => words.every((w) => o.name.toLowerCase().includes(w)))
    .sort((a, b) => {
      const as = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return as - bs || a.name.length - b.name.length || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function NoteCombobox({ value, onChange, options, placeholder, className, limit = 8 }: NoteComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => matchNotes(options, value, limit), [options, value, limit]);
  const shown = open && matches.length > 0 && !(matches.length === 1 && matches[0].name === value);

  const pick = (note: NoteOption) => {
    onChange(note.name, note);
    setOpen(false);
  };

  return (
    <span className={`rpg-note-combobox ${className ?? ""}`}>
      <input
        className="placeholder-input"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        {...(shown ? { "aria-activedescendant": `${listId}-${active}` } : {})}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const typed = e.target.value;
          const exact = options.find((o) => o.name.toLowerCase() === typed.trim().toLowerCase());
          onChange(typed, exact);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        // Late enough that a click on a suggestion lands first.
        onBlur={() => {
          // Typed as a note's name (`sling`): it takes the note's own (`Sling`).
          const exact = options.find((o) => o.name.toLowerCase() === value.trim().toLowerCase());
          if (exact && exact.name !== value) onChange(exact.name, exact);
          setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(matches[active] ?? matches[0]);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {shown && (
        <ul id={listId} role="listbox" className="suggestion-container rpg-note-combobox-list">
          {matches.map((m, i) => (
            <li
              key={`${m.folder}/${m.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`suggestion-item mod-complex${i === active ? " is-selected" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
            >
              <div className="suggestion-content">
                <div className="suggestion-title">{m.name}</div>
                <div className="suggestion-note">{m.folder}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
