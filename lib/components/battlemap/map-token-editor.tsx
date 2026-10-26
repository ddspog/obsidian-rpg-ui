/**
 * A battle map in a note, with its tokens editable: drag one (or tap it, then
 * tap a square, or use the arrow keys) to move where it starts, add a party
 * member or a creature from its note, remove one. The changes are kept here
 * and written into the block's `tokens:` when you press Done — writing at once
 * would re-render the block and end the edit.
 */

import { Notice, TFile, type App } from "obsidian";
import * as React from "react";
import { createPortal } from "react-dom";
import { replaceMapBody } from "lib/domains/hexmap/fence-text";
import { freeSquare, writeTokens, type TokenEntry } from "lib/domains/battlemap/edit-tokens";
import { fitToImage, parseSquare, squareName, type Square, type SquareMap } from "lib/domains/battlemap/square-map";
import { LucideIcon } from "lib/components/session-log/lucide-icon";
import { NoteCombobox, type NoteOption } from "lib/components/session-log/note-combobox";
import { MapPanZoom } from "./map-pan-zoom";
import { SquareMapView, shownName, type MapToken, type MapView } from "./square-map-view";

const sideOf = (name: string): MapToken["side"] => (name.includes("[[") ? "foe" : "pc");
const entriesOf = (map: SquareMap): TokenEntry[] => Object.entries(map.tokens).map(([name, at]) => ({ name, at }));
const sameEntries = (a: TokenEntry[], b: TokenEntry[]) =>
  a.length === b.length &&
  a.every((t, i) => t.name === b[i].name && t.at.col === b[i].at.col && t.at.row === b[i].at.row);

export function MapTokenEditor({
  map,
  source,
  sourcePath,
  app,
}: {
  map: SquareMap;
  /** The block's text, as written. */
  source: string;
  sourcePath: string;
  app: App;
}) {
  const [measured, setMeasured] = React.useState(map);
  React.useEffect(() => {
    let alive = true;
    // A picture map's squares are counted from the picture's own size.
    const url = map.image?.url;
    if (!url || (map.cols > 0 && map.rows > 0)) {
      setMeasured(map);
      return;
    }
    const img = new Image();
    img.onload = () => alive && setMeasured(fitToImage(map, img.naturalWidth, img.naturalHeight));
    img.src = url;
    return () => {
      alive = false;
      img.onload = null;
    };
  }, [map]);

  const saved = React.useRef(entriesOf(map));
  const [tokens, setTokens] = React.useState<TokenEntry[]>(saved.current);
  const [editing, setEditing] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<TokenEntry[][]>([]);
  const [side, setSide] = React.useState<"pc" | "foe">("pc");
  const [typed, setTyped] = React.useState("");
  const [picked, setPicked] = React.useState<NoteOption | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const dirty = !sameEntries(tokens, saved.current);
  const options = React.useMemo<NoteOption[]>(
    () => app.vault.getMarkdownFiles().map((f) => ({ name: f.basename, folder: f.parent?.path ?? "" })),
    [app]
  );

  /** Every change goes through here, so Undo has what came before. */
  const change = (next: TokenEntry[]) => {
    setHistory((h) => [...h.slice(-30), tokens]);
    setTokens(next);
  };
  const move = (name: string, at: Square) => {
    if (map.cols > 0 && (at.col < 0 || at.row < 0 || at.col >= measured.cols || at.row >= measured.rows)) return;
    change(tokens.map((t) => (t.name === name ? { ...t, at } : t)));
  };
  const remove = (name: string) => {
    change(tokens.filter((t) => t.name !== name));
    if (selected === name) setSelected(null);
  };
  const add = () => {
    const text = typed.trim();
    if (!text) return;
    const name =
      side === "foe" && !text.includes("[[")
        ? `[[${picked?.name ?? text}]]`
        : picked && side === "pc"
          ? picked.name
          : text;
    if (tokens.some((t) => t.name === name)) {
      setStatus(`${shownName(name)} is on the map already.`);
      return;
    }
    const middle = { col: Math.floor(measured.cols / 2), row: Math.floor(measured.rows / 2) };
    const at = freeSquare(
      middle,
      tokens.map((t) => t.at),
      measured.cols,
      measured.rows
    );
    change([...tokens, { name, at }]);
    setSelected(name);
    setTyped("");
    setPicked(null);
    setStatus(`${shownName(name)} is on ${squareName(at)}. Drag it where it starts.`);
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(history.slice(0, -1));
    setTokens(last);
  };

  const done = async () => {
    if (dirty) {
      const next = writeTokens(source, tokens);
      const file = app.vault.getAbstractFileByPath(sourcePath);
      if (!(file instanceof TFile)) {
        new Notice(`Map: can't find ${sourcePath} to save the tokens in.`);
        return;
      }
      let found = true;
      setStatus("Saving…");
      await app.vault.process(file, (text) => {
        const out = replaceMapBody(text, source, next);
        found = out !== null;
        return out ?? text;
      });
      if (!found) {
        setStatus("Not saved: this map's block isn't in this note (embedded, or changed elsewhere).");
        new Notice("Map: couldn't find this map's block in its note, so the tokens weren't saved.");
        return;
      }
      saved.current = tokens;
    }
    setStatus(null);
    setSelected(null);
    setHistory([]);
    setEditing(false);
  };
  const revert = () => {
    setTokens(saved.current);
    setHistory([]);
    setSelected(null);
    setEditing(false);
    setStatus(null);
  };

  React.useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Escape" && !["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName) && !selected) setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, selected]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!editing || !selected) return;
    const target = e.target as HTMLElement;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = d[e.key];
    const t = tokens.find((x) => x.name === selected);
    if (e.key === "Escape") {
      setSelected(null);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(selected);
      return;
    }
    if (!step || !t) return;
    e.preventDefault();
    move(selected, { col: t.at.col + step[0], row: t.at.row + step[1] });
  };

  const shared = new Set(
    tokens
      .filter((t) => tokens.some((o) => o !== t && o.at.col === t.at.col && o.at.row === t.at.row))
      .map((t) => t.name)
  );
  const mapTokens: MapToken[] = tokens.map((t) => ({ name: t.name, at: t.at, side: sideOf(t.name) }));
  if (!measured.image && (measured.rows === 0 || measured.cols === 0)) {
    return <div className="notice">rpg map: draw the grid below the `---`</div>;
  }

  const handlers = editing
    ? {
        selected: selected ?? undefined,
        onTokenClick: (n: string) => setSelected(selected === n ? null : n),
        onTokenMove: (n: string, to: Square) => {
          setSelected(n);
          move(n, to);
        },
        onSquareClick: (sq: Square) => {
          if (selected) move(selected, sq);
        },
      }
    : {};
  const placeButton = (
    <button
      type="button"
      className="rpg-map-edit"
      aria-label="Edit the tokens' starting squares"
      title="Edit the tokens' starting squares"
      onClick={() => setEditing(true)}
    >
      <LucideIcon name="move" size={14} />
      <span>Place tokens</span>
    </button>
  );
  const panel = (
    <section className="rpg-map-panel" aria-label="Tokens on this map">
      <header>
        <h4>Tokens</h4>
        <p>Drag a token, or tap it and then a square. Arrow keys move the picked one.</p>
        <span className="rpg-map-panel-actions">
          <button type="button" onClick={undo} disabled={history.length === 0}>
            Undo
          </button>
          <button type="button" onClick={revert}>
            Cancel
          </button>
          <button type="button" className="is-primary" onClick={() => void done()}>
            Done
          </button>
        </span>
      </header>
      <ul className="rpg-map-tokens">
        {tokens.map((t) => (
          <li
            key={t.name}
            className={`${selected === t.name ? "is-selected" : ""} is-${sideOf(t.name)}${shared.has(t.name) ? " is-shared" : ""}`}
            {...(shared.has(t.name) ? { title: "Another token is on this square" } : {})}
          >
            <button
              type="button"
              className="rpg-map-token-name"
              onClick={() => setSelected(selected === t.name ? null : t.name)}
            >
              <span className="rpg-map-dot" aria-hidden="true" />
              {shownName(t.name)}
            </button>
            <SquareField value={t.at} onCommit={(sq) => move(t.name, sq)} label={`Square of ${shownName(t.name)}`} />
            <button
              type="button"
              className="rpg-map-remove"
              aria-label={`Remove ${shownName(t.name)}`}
              onClick={() => remove(t.name)}
            >
              ×
            </button>
          </li>
        ))}
        {tokens.length === 0 && <li className="rpg-map-none">No tokens yet. Add the party and the creatures below.</li>}
      </ul>
      <form
        className="rpg-map-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <fieldset className="rpg-map-side" aria-label="Who">
          <label className={side === "pc" ? "is-on" : undefined}>
            <input type="radio" name="side" checked={side === "pc"} onChange={() => setSide("pc")} />
            Party
          </label>
          <label className={side === "foe" ? "is-on" : undefined}>
            <input type="radio" name="side" checked={side === "foe"} onChange={() => setSide("foe")} />
            Creature
          </label>
        </fieldset>
        <NoteCombobox
          value={typed}
          onChange={(v, note) => {
            setTyped(v);
            setPicked(note ?? null);
          }}
          options={options}
          placeholder={side === "foe" ? "Creature's note, e.g. Kobold, Elite" : "Name, as the log writes it"}
          className="rpg-map-combobox"
        />
        <button type="submit" disabled={!typed.trim()}>
          Add
        </button>
      </form>
      {status && (
        <p className="rpg-map-status" role="status">
          {status}
        </p>
      )}
    </section>
  );

  return (
    <figure className={`rpg-map-block${editing ? " is-editing" : ""}`} onKeyDown={onKeyDown}>
      <div className="rpg-map-stage">
        <SquareMapView map={measured} tokens={mapTokens} {...handlers} />
        <span className="rpg-map-stage-tools">
          {!editing && placeButton}
          <button
            type="button"
            className="rpg-map-expand"
            aria-label="Open the map full screen"
            title="Open the map full screen"
            onClick={() => setExpanded(true)}
          >
            <LucideIcon name="maximize-2" size={14} />
            <span>Expand</span>
          </button>
        </span>
      </div>
      {measured.title && <figcaption>{measured.title}</figcaption>}
      {editing && !expanded && panel}
      {expanded &&
        createPortal(
          <div className="rpg-map-full" role="dialog" aria-modal="true" aria-label={measured.title ?? "Battle map"}>
            <header>
              <strong>{measured.title ?? "Battle map"}</strong>
              <span className="rpg-map-full-actions">
                {!editing && placeButton}
                <button type="button" className="rpg-map-close" aria-label="Close" onClick={() => setExpanded(false)}>
                  ×
                </button>
              </span>
            </header>
            <MapPanZoom map={measured}>
              {(view: MapView | undefined) => (
                <SquareMapView map={measured} tokens={mapTokens} {...(view ? { view } : {})} {...handlers} />
              )}
            </MapPanZoom>
            {editing && <div className="rpg-map-full-panel">{panel}</div>}
          </div>,
          document.body
        )}
    </figure>
  );
}

/** A square's name as text (`J14`), applied when it reads as a square on the map. */
function SquareField({ value, onCommit, label }: { value: Square; onCommit: (sq: Square) => void; label: string }) {
  const [text, setText] = React.useState(squareName(value));
  React.useEffect(() => setText(squareName(value)), [value]);
  const parsed = parseSquare(text);
  const commit = () => {
    if (parsed) onCommit(parsed);
    else setText(squareName(value));
  };
  return (
    <input
      type="text"
      className="rpg-map-square"
      aria-label={label}
      aria-invalid={!parsed}
      value={text}
      size={4}
      onChange={(e) => setText(e.target.value.toUpperCase())}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}
