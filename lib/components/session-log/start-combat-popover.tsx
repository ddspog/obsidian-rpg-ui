/**
 * The Start Combat popup: set up a fight — who's in it, rolled for initiative —
 * and append the block that opens it (foes with their HP, the initiative order,
 * `[COMBAT]`, round 1).
 *
 * Everyone's d20 is rolled up front, so the order is ready at a glance; any roll
 * can be re-rolled or typed over (a die rolled at the table). PCs read their
 * Initiative modifier from their sheets, foes theirs — and their HP — from the
 * statblock each line links.
 *
 * The fight can be put on a battle map: one the log keeps in its header, a map
 * note — or a picture from the vault, made into a new map on the spot (its
 * grid found from the picture) and kept in the log's header as the fight
 * starts. Everyone's starting square goes in the initiative list (`@J14`).
 */

import { useEffect, useId, useMemo, useState } from "react";
import { parseLonelog } from "../../domains/lonelog/parser";
import { groupIntoProse } from "../../domains/session-log/prose-grouper";
import { buildSidebarItems, withActorRefs } from "../../domains/session-log/prose-model";
import { cardSummary } from "../../domains/session-log/card-summary";
import type { SessionFeatureCard } from "../../domains/session-log/card-types";
import {
  initiativeTotal,
  parseFoeList,
  rollD20,
  startCombatText,
  SURPRISE_OPENINGS,
  type Combatant,
  type Surprise,
} from "../../domains/session-log/start-combat";
import { SidebarEntry } from "./sidebar-entry";
import { squareName, type SquareMap } from "../../domains/battlemap/square-map";
import type { MapChoice, MapTools } from "../../domains/battlemap/map-tools";
import type { HeaderMap } from "../../domains/session-log";

/** What a foe's statblock says, once looked up. */
export interface CreatureInfo {
  found: boolean;
  hp?: number;
  initiative?: number;
}

interface StartCombatPopoverProps {
  card: SessionFeatureCard;
  /** The PCs, as the log names them (`Talon`). */
  party: string[];
  /** A PC's value for a roll term — its `Initiative` modifier. */
  resolveRef?: (actor: string, name: string) => number | undefined;
  /** Look up a foe's statblock by its link target (`Kobold, Elite`). */
  lookupCreature?: (link: string) => Promise<CreatureInfo>;
  /** The battle maps to choose from, and pictures to make one of. */
  mapTools?: MapTools;
  sourcePath?: string;
  /** The block to append — and a new picture map to keep in the log's header. */
  onResolve: (text: string, headerMap?: HeaderMap) => void;
  onCancel: () => void;
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** The map choice that opens the picture search. */
const PICTURE = "\u0000picture";

/** A picture's file name as a map's name: `kobold-ambush_v2.png` → `Kobold ambush v2`. */
function nameFromPicture(label: string): string {
  const base = label
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base ? base[0].toUpperCase() + base.slice(1) : "Battle map";
}

export function StartCombatPopover({
  card,
  party,
  resolveRef,
  lookupCreature,
  mapTools,
  sourcePath = "",
  onResolve,
  onCancel,
}: StartCombatPopoverProps) {
  const [surprise, setSurprise] = useState<Surprise>("none");
  // The opening line follows the surprise choice until the GM writes their own.
  const [question, setQuestion] = useState(SURPRISE_OPENINGS.none);
  const [questionEdited, setQuestionEdited] = useState(false);
  const surpriseName = useId();
  const [narration, setNarration] = useState("");
  const [inFight, setInFight] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(party.map((p) => [p, true]))
  );
  const [foeText, setFoeText] = useState("");
  const [creatures, setCreatures] = useState<Record<string, CreatureInfo>>({});
  // Each combatant's d20, by name — rolled the moment they join the fight.
  const [faces, setFaces] = useState<Record<string, number>>({});
  // The battle map — chosen from the log's, the notes', or made from a picture —
  // and where each combatant starts on it (by name).
  const [choices, setChoices] = useState<MapChoice[] | null>(null);
  const [mapRef, setMapRef] = useState("");
  // A picture is searched for by name (a vault can hold hundreds), not listed.
  const [pictureQuery, setPictureQuery] = useState("");
  const pictureListId = useId();
  const [map, setMap] = useState<SquareMap | null>(null);
  const [squares, setSquares] = useState<Record<string, string>>({});
  // A new map from a picture: its name, and its grid (found, or typed).
  const [newName, setNewName] = useState("");
  const [grid, setGrid] = useState({ cell: "", x: "0", y: "0" });
  const [gridStatus, setGridStatus] = useState<"finding" | "found" | "none" | "typed">("typed");

  useEffect(() => {
    if (!mapTools) return;
    let live = true;
    void mapTools.list().then((c) => live && setChoices(c));
    return () => {
      live = false;
    };
  }, [mapTools]);

  const chosen =
    mapRef === PICTURE
      ? choices?.find((c) => c.kind === "picture" && (c.label === pictureQuery.trim() || c.ref === pictureQuery.trim()))
      : choices?.find((c) => c.ref === mapRef);
  const isPicture = chosen?.kind === "picture";
  const cell = parseFloat(grid.cell);
  const offX = parseFloat(grid.x) || 0;
  const offY = parseFloat(grid.y) || 0;

  // A picture chosen: name the map after it, and find its grid.
  useEffect(() => {
    if (!mapTools || !chosen || chosen.kind !== "picture") return;
    setNewName(nameFromPicture(chosen.label));
    setGridStatus("finding");
    let live = true;
    void mapTools.detect(chosen.ref).then((g) => {
      if (!live) return;
      if (g) setGrid({ cell: String(g.cell), x: String(g.offsetX), y: String(g.offsetY) });
      setGridStatus(g ? "found" : "none");
    });
    return () => {
      live = false;
    };
  }, [mapTools, chosen?.ref, chosen?.kind]);

  // The map itself, as chosen: its size, and its default spots for the squares.
  useEffect(() => {
    if (!mapTools || !chosen) {
      setMap(null);
      return;
    }
    let live = true;
    const loading = isPicture
      ? cell > 0
        ? mapTools.picture(chosen.ref, cell, offX, offY)
        : Promise.resolve(null)
      : mapTools.lookup(chosen.ref);
    void loading.then((m) => live && setMap(m));
    return () => {
      live = false;
    };
  }, [mapTools, chosen?.ref, isPicture, cell, offX, offY]);

  // How the fight names its map: a note by its link, a header map by its name.
  const takenNames = (choices ?? []).filter((c) => c.kind === "log").map((c) => c.label.toLowerCase());
  const nameClash = isPicture && takenNames.includes(newName.trim().toLowerCase());
  const mapName = !chosen ? "" : isPicture ? newName.trim() : chosen.ref;
  const headerMap: HeaderMap | undefined =
    isPicture && chosen && newName.trim() && cell > 0
      ? { name: newName.trim(), image: chosen.ref, cell, offsetX: offX, offsetY: offY }
      : undefined;
  const mapReady = !isPicture || (!!headerMap && !nameClash);

  const foes = useMemo(() => parseFoeList(foeText), [foeText]);

  // Look up each newly listed foe's statblock (HP, Initiative).
  useEffect(() => {
    if (!lookupCreature) return;
    for (const f of foes) {
      if (!f.link || creatures[f.link]) continue;
      const link = f.link;
      void lookupCreature(link).then((info) => setCreatures((c) => ({ ...c, [link]: info })));
    }
  }, [foes, lookupCreature, creatures]);

  /** A combatant's square: typed in, else the map's default spot for that name. */
  const squareOf = (name: string): string | undefined => {
    if (squares[name] != null) return squares[name] || undefined;
    const spot = map
      ? Object.entries(map.tokens).find(([n]) => n.toLowerCase() === name.toLowerCase())?.[1]
      : undefined;
    return spot ? squareName(spot) : undefined;
  };

  const combatants: Combatant[] = [
    ...party
      .filter((p) => inFight[p])
      .map((p) => ({ name: p, modifier: resolveRef?.(p, "Initiative"), face: faces[p] || undefined, at: squareOf(p) })),
    ...foes.map((f) => {
      const info = f.link ? creatures[f.link] : undefined;
      return {
        name: f.name,
        foe: true,
        modifier: info?.initiative,
        hp: info?.hp,
        face: faces[f.name] || undefined,
        at: squareOf(f.name),
      };
    }),
  ];

  // Everyone who joins gets a d20 straight away; the order is ready to read.
  // (A box the GM cleared holds 0 — not re-rolled over, but not a roll either.)
  const unrolledKey = combatants
    .filter((c) => faces[c.name] == null)
    .map((c) => c.name)
    .join("\u0000");
  useEffect(() => {
    if (!unrolledKey) return;
    const names = unrolledKey.split("\u0000");
    setFaces((f) => ({ ...f, ...Object.fromEntries(names.filter((n) => f[n] == null).map((n) => [n, rollD20()])) }));
  }, [unrolledKey]);

  const text = startCombatText({ question, narration, combatants, surprise, map: mapName.trim() || undefined });
  const items = useMemo(() => {
    const built = buildSidebarItems(groupIntoProse(parseLonelog(text)));
    return resolveRef ? withActorRefs(built, resolveRef) : built;
  }, [text, resolveRef]);

  const reroll = (name: string) => setFaces((f) => ({ ...f, [name]: rollD20() }));
  const rerollAll = () => setFaces((f) => Object.fromEntries(Object.keys(f).map((n) => [n, rollD20()])));
  const summary = cardSummary(card);
  // A cleared d20 (0) still needs a roll before the fight can start.
  const ready = question.trim() !== "" && combatants.length > 0 && combatants.every((c) => !!c.face) && mapReady;

  return (
    <div className="lonelog-placeholder-popover lonelog-combat-popover" role="dialog" aria-label={`Play ${card.name}`}>
      <form
        className="placeholder-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onResolve(text, headerMap);
        }}
      >
        <header className="placeholder-head">
          <strong className="placeholder-title">{card.name}</strong>
          {summary && <p className="placeholder-summary">{summary}</p>}
        </header>

        <fieldset className="combat-surprise">
          <legend className="placeholder-label">Surprise</legend>
          {(
            [
              ["none", "None"],
              ["party", "Party surprised"],
              ["foes", "Foes surprised"],
            ] as Array<[Surprise, string]>
          ).map(([value, label]) => (
            <label key={value} className={`combat-surprise-option${surprise === value ? " is-active" : ""}`}>
              <input
                type="radio"
                name={surpriseName}
                value={value}
                checked={surprise === value}
                onChange={() => {
                  setSurprise(value);
                  if (!questionEdited) setQuestion(SURPRISE_OPENINGS[value]);
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {surprise !== "none" && (
          <p className="combat-surprise-rule">
            Surprised: can't move or take an action on its first turn, and can't take a reaction until that turn ends.
          </p>
        )}

        <label className="placeholder-field">
          <span className="placeholder-label">How it begins</span>
          <input
            className="placeholder-input"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setQuestionEdited(true);
            }}
          />
        </label>
        <label className="placeholder-field">
          <span className="placeholder-label">
            Narration <span className="placeholder-optional">(optional)</span>
          </span>
          <input
            className="placeholder-input"
            value={narration}
            placeholder="Movement rustled through the brush…"
            onChange={(e) => setNarration(e.target.value)}
          />
        </label>

        {mapTools && (
          <label className="placeholder-field">
            <span className="placeholder-label">
              Battle map <span className="placeholder-optional">(optional)</span>
            </span>
            <select className="placeholder-select" value={mapRef} onChange={(e) => setMapRef(e.target.value)}>
              <option value="">{choices ? "No map" : "Finding maps…"}</option>
              {(
                [
                  ["log", "In this log"],
                  ["note", "Map notes"],
                ] as Array<[MapChoice["kind"], string]>
              ).map(([kind, label]) => {
                const group = (choices ?? []).filter((c) => c.kind === kind);
                return group.length > 0 ? (
                  <optgroup key={kind} label={label}>
                    {group.map((c) => (
                      <option key={c.ref} value={c.ref}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
              {choices?.some((c) => c.kind === "picture") && <option value={PICTURE}>New map from a picture…</option>}
            </select>
            {mapRef === PICTURE && (
              <>
                <input
                  className="placeholder-input"
                  list={pictureListId}
                  value={pictureQuery}
                  placeholder="Search the vault's pictures…"
                  aria-label="Picture"
                  onChange={(e) => setPictureQuery(e.target.value)}
                />
                <datalist id={pictureListId}>
                  {(choices ?? [])
                    .filter((c) => c.kind === "picture")
                    .map((c) => (
                      <option key={c.ref} value={c.label} />
                    ))}
                </datalist>
              </>
            )}
            {chosen && (
              <span className="combat-map-status">
                {map
                  ? `${map.cols}×${map.rows} squares — set where each combatant starts below`
                  : isPicture
                    ? "Give the picture's square size to see it as a map"
                    : "No rpg map found there"}
              </span>
            )}
          </label>
        )}

        {isPicture && (
          <fieldset className="combat-new-map">
            <legend className="placeholder-label">New map — kept in this log's header</legend>
            <label className="placeholder-field">
              <span className="placeholder-label">Name</span>
              <input
                className="placeholder-input"
                value={newName}
                aria-invalid={nameClash || !newName.trim()}
                onChange={(e) => setNewName(e.target.value)}
              />
              {nameClash && (
                <small className="placeholder-hint is-invalid">This log already has a map by that name.</small>
              )}
            </label>
            <div className="combat-new-map-grid">
              <label className="placeholder-field">
                <span className="placeholder-label">Square (px)</span>
                <input
                  className="placeholder-input"
                  inputMode="decimal"
                  value={grid.cell}
                  aria-invalid={!(cell > 0)}
                  onChange={(e) => {
                    setGrid((g) => ({ ...g, cell: e.target.value }));
                    setGridStatus("typed");
                  }}
                />
              </label>
              <label className="placeholder-field">
                <span className="placeholder-label">Offset x</span>
                <input
                  className="placeholder-input"
                  inputMode="decimal"
                  value={grid.x}
                  onChange={(e) => setGrid((g) => ({ ...g, x: e.target.value }))}
                />
              </label>
              <label className="placeholder-field">
                <span className="placeholder-label">Offset y</span>
                <input
                  className="placeholder-input"
                  inputMode="decimal"
                  value={grid.y}
                  onChange={(e) => setGrid((g) => ({ ...g, y: e.target.value }))}
                />
              </label>
            </div>
            <small className={`placeholder-hint${gridStatus === "none" ? " is-invalid" : ""}`}>
              {gridStatus === "finding"
                ? "Finding the grid in the picture…"
                : gridStatus === "found"
                  ? `Grid found: ${grid.cell} px squares, first line at ${grid.x}, ${grid.y}. Adjust if it's off.`
                  : gridStatus === "none"
                    ? "No grid found in the picture — measure one square in pixels."
                    : "The picture's grid: pixels per square, and where its first line falls."}
            </small>
          </fieldset>
        )}

        <fieldset className="combat-party">
          <legend className="placeholder-label">Party</legend>
          {party.map((p) => (
            <label key={p} className="combat-party-member">
              <input
                type="checkbox"
                checked={!!inFight[p]}
                onChange={(e) => setInFight((m) => ({ ...m, [p]: e.target.checked }))}
              />
              {p}
            </label>
          ))}
        </fieldset>

        <label className="placeholder-field">
          <span className="placeholder-label">Foes — one per line</span>
          <textarea
            className="placeholder-input combat-foes"
            rows={3}
            value={foeText}
            placeholder={"[[Kobold, Elite]]\nFat [[Kobold, A]]"}
            onChange={(e) => setFoeText(e.target.value)}
          />
        </label>

        {combatants.length > 0 && (
          <table className="combat-initiative">
            <caption>
              Initiative{" "}
              <button type="button" className="combat-reroll-all" onClick={rerollAll}>
                Reroll all
              </button>
            </caption>
            <thead>
              <tr>
                <th scope="col">Combatant</th>
                <th scope="col">d20</th>
                <th scope="col">Mod</th>
                <th scope="col">Total</th>
                {map && <th scope="col">Square</th>}
              </tr>
            </thead>
            <tbody>
              {[...combatants]
                .sort((a, b) => (initiativeTotal(b) ?? -99) - (initiativeTotal(a) ?? -99))
                .map((c) => {
                  const info = c.foe ? creatures[parseFoeList(c.name)[0]?.link ?? ""] : undefined;
                  return (
                    <tr key={c.name} className={c.foe ? "is-foe" : undefined}>
                      <th scope="row">
                        {c.name.replace(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g, "$1")}
                        {c.foe && info && !info.found && <span className="combat-missing"> no statblock</span>}
                        {c.foe && c.hp != null && <span className="combat-hp"> HP {c.hp}</span>}
                      </th>
                      <td>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="combat-face"
                          aria-label={`${c.name} d20`}
                          value={c.face ?? ""}
                          size={2}
                          onChange={(e) => {
                            const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                            setFaces((f) => {
                              const next = { ...f };
                              // A cleared box clears the roll; it can't be told
                              // from an unrolled one, so it isn't re-rolled over.
                              next[c.name] = Number.isFinite(n) ? Math.min(20, Math.max(1, n)) : 0;
                              return next;
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="combat-reroll"
                          title="Reroll"
                          aria-label={`Reroll ${c.name}`}
                          onClick={() => reroll(c.name)}
                        >
                          🎲
                        </button>
                      </td>
                      <td>{c.modifier != null ? signed(c.modifier) : "—"}</td>
                      <td className="combat-total">{initiativeTotal(c) ?? "—"}</td>
                      {map && (
                        <td>
                          <input
                            type="text"
                            className="combat-square"
                            aria-label={`${c.name} starting square`}
                            value={c.at ?? ""}
                            placeholder="C4"
                            size={3}
                            onChange={(e) =>
                              setSquares((s) => ({
                                ...s,
                                [c.name]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                              }))
                            }
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}

        <section className="placeholder-preview" aria-label="Preview">
          <span className="placeholder-preview-label">Adds to the log</span>
          <div className="lonelog-entries placeholder-preview-entries">
            {items.map((item) => (
              <SidebarEntry key={item.id} item={item} sourcePath={sourcePath} />
            ))}
          </div>
          <details className="placeholder-preview-raw">
            <summary>Lonelog</summary>
            <pre>{text}</pre>
          </details>
        </section>

        <div className="placeholder-buttons">
          <button type="submit" disabled={!ready} className="placeholder-submit">
            Start combat
          </button>
          <button type="button" onClick={onCancel} className="placeholder-cancel">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
