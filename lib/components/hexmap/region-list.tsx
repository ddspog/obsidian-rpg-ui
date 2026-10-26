/**
 * The Regions mode's list (design §15): every region on the map — the one
 * the map is of first, then the ones inside it, its own and imported — to
 * pick one to paint and style, and a field to name a new one.
 */

import * as React from "react";
import { SidebarSection } from "lib/components/hexmap/hex-paint-bar";

export interface RegionEntry {
  id: string;
  /** Its name as drawn (or its tag spaced out). */
  title: string;
  color?: string;
  hexes: number;
  /** How deep inside other regions it is. */
  depth: number;
  /** The region this map is of (linked to its note). */
  main?: boolean;
  /** The note it's imported from: its own map declares it. */
  from?: string;
  /** This map changes it there (`override: true`). */
  overridden?: boolean;
}

export function RegionList({
  entries,
  selected,
  onSelect,
  onNew,
}: {
  entries: RegionEntry[];
  selected: string;
  onSelect: (id: string) => void;
  /** A new region, by name (its tag is the name without spaces). */
  onNew: (name: string) => void;
}) {
  const [name, setName] = React.useState("");
  const add = () => {
    const n = name.trim();
    if (!n) return;
    onNew(n);
    setName("");
  };
  return (
    <SidebarSection title="Regions" aside={<span className="rpg-hexpaint-look-where">{entries.length}</span>}>
      {entries.length === 0 ? (
        <p className="rpg-hexpaint-empty">No regions yet: name one below, then paint its hexes.</p>
      ) : (
        <menu className="rpg-hexpaint-regions">
          {entries.map((e) => (
            <li key={e.id} style={{ paddingInlineStart: `${Math.min(e.depth, 4) * 0.75}rem` }}>
              <button
                type="button"
                aria-pressed={e.id === selected}
                className={e.id === selected ? "is-selected" : undefined}
                onClick={() => onSelect(e.id)}
                title={e.from ? `From ${e.from}${e.overridden ? ", changed on this map" : ""}` : undefined}
              >
                <span className="rpg-hexpaint-regions-dot" style={{ background: e.color }} />
                <span className="rpg-hexpaint-regions-name">{e.title}</span>
                <small>
                  {[
                    e.main ? "this map" : undefined,
                    // Where it's from, when its name doesn't say (a duchy's own map is named for it).
                    e.from && e.from !== e.title ? `from ${e.from}` : e.from ? "imported" : undefined,
                    e.overridden ? "changed" : undefined,
                    String(e.hexes),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </button>
            </li>
          ))}
        </menu>
      )}
      <form
        className="rpg-hexpaint-regions-new"
        onSubmit={(ev) => {
          ev.preventDefault();
          add();
        }}
      >
        <input
          type="text"
          aria-label="New region's name"
          placeholder="New region, e.g. The Clodgate"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
        />
        <button type="submit" className="rpg-hexpaint-button" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </SidebarSection>
  );
}
