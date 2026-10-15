/**
 * The turn column at the HUD's right: End Turn (the next in initiative order
 * is up), Rest (short or long), and — in a fight — the opportunity attack a
 * move just provoked, offered as a reaction, with a switch to be warned of it
 * or not (it stays on the bar either way).
 */

import * as React from "react";
import { useState } from "react";
import { LucideIcon } from "./lucide-icon";

interface HudTurnProps {
  inCombat: boolean;
  /** Whether the actor shown rests (the party does; foes don't). */
  canRest?: boolean;
  onEndTurn?: () => void;
  onRest: (kind: "short-rest" | "long-rest") => void;
  /** Whoever the last move provoked an opportunity attack from this actor against. */
  provoked?: string | undefined;
  onOpportunity?: () => void;
  warn: boolean;
  onWarn: (on: boolean) => void;
}

export function HudTurn({
  inCombat,
  canRest = true,
  onEndTurn,
  onRest,
  provoked,
  onOpportunity,
  warn,
  onWarn,
}: HudTurnProps) {
  const [resting, setResting] = useState(false);
  return (
    <aside className="hud-turn" aria-label="Turn and rest">
      {inCombat && onEndTurn && (
        <button
          type="button"
          className="hud-endturn"
          onClick={onEndTurn}
          title="End the turn — the next in initiative order is up"
        >
          <LucideIcon name="Hourglass" size="1.4rem" strokeWidth={1.5} />
          <span>End turn</span>
        </button>
      )}
      {canRest && (
        <div className="hud-rest">
          <button
            type="button"
            className="hud-rest-btn"
            aria-haspopup="menu"
            aria-expanded={resting}
            onClick={() => setResting((r) => !r)}
            title="Rest — short or long"
          >
            <LucideIcon name="Flame" size="1.2rem" strokeWidth={1.5} />
            <span>Rest</span>
          </button>
          {resting && (
            <menu className="hud-rest-menu" aria-label="Rest">
              <li>
                <button type="button" onClick={() => (setResting(false), onRest("short-rest"))}>
                  Short rest <small>1 hour</small>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => (setResting(false), onRest("long-rest"))}>
                  Long rest <small>8 hours</small>
                </button>
              </li>
            </menu>
          )}
        </div>
      )}
      {inCombat && (
        <div className="hud-reactions">
          {provoked && warn && onOpportunity && (
            <button
              type="button"
              className="hud-opportunity"
              onClick={onOpportunity}
              title={`Opportunity attack against ${provoked} — a move just provoked it, and it takes your reaction`}
              aria-label={`Opportunity attack against ${provoked}`}
            >
              <LucideIcon name="Swords" size="1.1rem" strokeWidth={1.7} />
            </button>
          )}
          <button
            type="button"
            className="hud-warn"
            aria-pressed={warn}
            aria-label="Warn me of opportunity attacks"
            title={
              warn
                ? "Warned of opportunity attacks — click to stop (they stay on the bar either way)"
                : "Not warned of opportunity attacks — click to be told when a move provokes one"
            }
            onClick={() => onWarn(!warn)}
          >
            <LucideIcon name={warn ? "BellRing" : "BellOff"} size="0.95rem" strokeWidth={1.7} />
          </button>
        </div>
      )}
    </aside>
  );
}
