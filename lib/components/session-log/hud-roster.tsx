/**
 * The roster: who the drawer's cards are for, as faces — a portrait with its
 * hit points under it, the one picked lit, and in a fight the order they act
 * in (whoever's up next marked). The party and its foes are two sides; the GM
 * and the Party's own cards come first, a sigil for their face.
 */

import * as React from "react";
import type { Health } from "../../domains/session-log/health";
import type { HudInfo } from "../../domains/session-log/hud";
import { CardFrame } from "../card-frame/CardFrame";
import { LucideIcon } from "./lucide-icon";

export interface RosterSide {
  id: string;
  label: string;
  count: number;
  foe?: boolean;
}

export interface RosterActor {
  /** As the drawer names them. */
  name: string;
  /** As the log does, for hit points and turn order. */
  log?: string;
}

interface HudRosterProps {
  sides: RosterSide[];
  sideId: string;
  onSide: (id: string) => void;
  foe: boolean;
  /** The GM and Party: faces of their own, a sigil for a portrait. */
  specials: Array<{ name: string; label: string }>;
  actors: RosterActor[];
  active: string | undefined;
  onPick: (name: string) => void;
  hudOf: (name: string) => HudInfo | undefined;
  hpOf: (log: string) => Health | undefined;
  /** In a fight: the order from whoever is up next, as the log writes the names. */
  order: string[];
  radioName: string;
  /** Make (or remake) a character's picture in the image studio. */
  onStudio?: (name: string) => void;
}

/** The party by first name (`Jacqui`), unless two share one; foes keep the whole name. */
function shortName(name: string, all: RosterActor[]): string {
  const first = name.split(/\s+/)[0];
  return all.filter((o) => o.name.split(/\s+/)[0] === first).length > 1 ? name : first;
}

const initial = (name: string) =>
  name
    .replace(/\[\[|\]\]/g, "")
    .trim()
    .charAt(0)
    .toUpperCase();

/** A face: the picture, else the token emoji, else the initial. */
export function Face({ info, name }: { info?: HudInfo | undefined; name: string }) {
  if (info?.portrait && info.framed) {
    // The art alone: framed here, in a slim version of the card frame.
    return (
      <CardFrame kind="portrait" name="none" className="is-mini">
        <img className="hud-face-img" src={info.portrait} alt="" draggable={false} />
      </CardFrame>
    );
  }
  if (info?.portrait) return <img className="hud-face-img" src={info.portrait} alt="" draggable={false} />;
  return <span className="hud-face-token">{info?.token ?? initial(name)}</span>;
}

export function HudRoster({
  sides,
  sideId,
  onSide,
  foe,
  specials,
  actors,
  active,
  onPick,
  hudOf,
  hpOf,
  order,
  radioName,
  onStudio,
}: HudRosterProps) {
  // In a fight, the order they act in; out of one, as they are.
  const rank = (a: RosterActor) => {
    const i = order.findIndex((o) => o.toLowerCase() === (a.log ?? a.name).toLowerCase());
    return i < 0 ? Infinity : i;
  };
  const shown = order.length > 0 ? [...actors].sort((a, b) => rank(a) - rank(b)) : actors;
  // The face that takes focus (arrow keys move from it): whoever is up next in a fight, else who acts.
  const nextName = order.length > 0 ? shown.find((a) => rank(a) === 0)?.name : undefined;
  const focusName =
    nextName ??
    ([...specials.map((x) => x.name), ...shown.map((a) => a.name)].includes(active ?? "")
      ? active
      : (specials[0]?.name ?? shown[0]?.name));
  // ←/→ (and ↑/↓) move between the faces, Home and End go to the ends.
  const onFacesKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const faces = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button.hud-face"));
    const i = faces.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const to =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? faces.length - 1
          : (i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + faces.length) % faces.length;
    faces.forEach((f, j) => (f.tabIndex = j === to ? 0 : -1));
    faces[to].focus();
  };
  const studioFor = onStudio && active && shown.some((a) => a.name === active) ? active : undefined;
  return (
    // One card: the side switch on top, the faces below: the GM · Party first, as a face of its own.
    <aside className={`hud-roster hud-roster-card${foe ? " is-foe-side" : ""}`}>
      {sides.length > 1 && (
        <header className="hud-roster-head">
          <fieldset className="actions-sides">
            <legend className="actions-sides-legend">Side</legend>
            {sides.map((s) => (
              <label
                key={s.id}
                className={`actions-side${s.id === sideId ? " is-active" : ""}${s.foe ? " is-foe" : ""}`}
              >
                <input
                  type="radio"
                  name={radioName}
                  value={s.id}
                  checked={s.id === sideId}
                  onChange={() => onSide(s.id)}
                />
                <span>{s.label}</span>
                <data value={s.count} className="actions-side-count">
                  {s.count}
                </data>
              </label>
            ))}
          </fieldset>
        </header>
      )}
      <ul className="hud-faces" aria-label="Who acts" onKeyDown={onFacesKey}>
        {specials.map((sp, i) => (
          <li key={sp.name} className="hud-card is-special" style={{ "--i": i } as React.CSSProperties}>
            <button
              type="button"
              className={`hud-face is-special${sp.name === active ? " is-active" : ""}`}
              aria-pressed={sp.name === active}
              tabIndex={sp.name === focusName ? 0 : -1}
              {...(sp.name === focusName ? { "data-autofocus": "" } : {})}
              title={sp.label}
              onClick={() => onPick(sp.name)}
            >
              <span className="hud-face-frame hud-face-sigil">
                <SigilFace name={sp.name} />
              </span>
              <span className="hud-face-name">{sp.label}</span>
            </button>
          </li>
        ))}
        {shown.map((a, i) => {
          const info = hudOf(a.name);
          const hp = hpOf(a.log ?? a.name);
          const next = a.name === nextName;
          const down = !!hp && hp.max > 0 && hp.current <= 0;
          const pct = hp && hp.max > 0 ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : undefined;
          return (
            <li
              key={a.name}
              className="hud-card"
              style={{ "--i": Math.min(i + specials.length, 6) } as React.CSSProperties}
            >
              <button
                type="button"
                className={`hud-face${a.name === active ? " is-active" : ""}${foe ? " is-foe" : ""}${next ? " is-next" : ""}${down ? " is-down" : ""}`}
                aria-pressed={a.name === active}
                tabIndex={a.name === focusName ? 0 : -1}
                {...(a.name === focusName ? { "data-autofocus": "" } : {})}
                title={hp ? `${a.name}: ${hp.current}/${hp.max} hit points` : a.name}
                aria-label={`${a.name}${hp ? `, ${hp.current} of ${hp.max} hit points` : ""}${next ? ", up next" : ""}`}
                onClick={() => onPick(a.name)}
              >
                <span className="hud-face-frame">
                  <Face info={info} name={a.name} />
                </span>
                {next && <span className="hud-face-next" aria-hidden="true" />}
                <span className="hud-face-name" title={a.name}>
                  {foe ? a.name : shortName(a.name, shown)}
                </span>
                {hp && (
                  <span className="hud-face-hp">
                    <span className="hud-hpbar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <small>
                      {hp.current}/{hp.max}
                    </small>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {studioFor && onStudio && (
        // Off the faces, so it never takes a tap meant for one: the picture of whoever acts.
        <button
          type="button"
          className="hud-roster-studio"
          title={`Make ${studioFor}'s picture in the image studio`}
          onClick={() => onStudio(studioFor)}
        >
          <LucideIcon name="ImagePlus" size="0.8rem" strokeWidth={1.8} />
          <span>Make {foe ? studioFor : shortName(studioFor, shown)}&rsquo;s picture</span>
        </button>
      )}
    </aside>
  );
}

/** The GM (and the Party) as a face: a sigil, not a portrait. */
export function SigilFace({ name }: { name: string }) {
  return (
    <span className="hud-face-token hud-sigil" aria-hidden="true">
      <LucideIcon name={/party/i.test(name) ? "Users" : "Crown"} size="55%" strokeWidth={1.5} />
    </span>
  );
}
