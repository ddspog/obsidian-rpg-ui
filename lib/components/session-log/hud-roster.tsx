/**
 * The roster: who the drawer's cards are for, as faces — a portrait with its
 * hit points under it, the one picked lit, and in a fight the order they act
 * in (whoever's up next marked). The party and its foes are two sides; the GM
 * and the Party's own cards sit above as small chips.
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
  /** The GM and Party chips — not faces. */
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
        <img className="hud-face-img" src={info.portrait} alt="" draggable={false} decoding="async" />
      </CardFrame>
    );
  }
  if (info?.portrait)
    return <img className="hud-face-img" src={info.portrait} alt="" draggable={false} decoding="async" />;
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
  return (
    // One card: the GM / Party chips and the side switch on top, the portraits below.
    <aside className="hud-roster hud-roster-card">
      <header className="hud-roster-head">
        {specials.length > 0 && (
          <div className="hud-specials">
            {specials.map((sp) => (
              <button
                key={sp.name}
                type="button"
                className={`actor-chip${sp.name === active ? " is-active" : ""}`}
                onClick={() => onPick(sp.name)}
              >
                {sp.label}
              </button>
            ))}
          </div>
        )}
        {sides.length > 1 && (
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
        )}
      </header>
      <ul className="hud-faces" aria-label="Characters">
        {shown.map((a) => {
          const info = hudOf(a.name);
          const hp = hpOf(a.log ?? a.name);
          const next = order.length > 0 && rank(a) === 0;
          const pct = hp && hp.max > 0 ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : undefined;
          return (
            <li key={a.name} className="hud-card">
              <button
                type="button"
                className={`hud-face${a.name === active ? " is-active" : ""}${foe ? " is-foe" : ""}${next ? " is-next" : ""}`}
                aria-pressed={a.name === active}
                aria-label={`${a.name}${hp ? `, ${hp.current} of ${hp.max} hit points` : ""}${next ? ", up next" : ""}`}
                onClick={() => onPick(a.name)}
              >
                <span className="hud-face-frame">
                  <Face info={info} name={a.name} />
                  {next && <span className="hud-face-next" aria-hidden="true" />}
                  <span className="hud-face-name" title={a.name}>
                    {a.name}
                  </span>
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
              {onStudio && (
                <button
                  type="button"
                  className="hud-card-studio"
                  title={`Make ${a.name}'s picture in the image studio`}
                  aria-label={`Make ${a.name}'s picture in the image studio`}
                  onClick={() => onStudio(a.name)}
                >
                  <LucideIcon name="ImagePlus" size="0.8rem" strokeWidth={1.8} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
