import * as React from "react";
import type { App } from "obsidian";
import { HANDS, type Hand, type Loadout } from "../../domains/session-log/loadouts";
import { loadoutGlyph, loadoutIconName } from "../../domains/session-log/hud";
import { buildIconIndex } from "../../services/icon-index";
import { LucideIcon } from "../session-log/lucide-icon";

export interface LoadoutCardsProps {
  loadouts: Loadout[];
  /** Whether a loadout is the one in hand now. */
  isHeld: (loadout: Loadout) => boolean;
  /** Put a loadout in hand; without it the cards only show. */
  onEquip?: (loadout: Loadout) => void;
  /** Hotbar icon art by name; the vault's `Icons/` folders when not given. */
  iconFor?: (name: string) => string | undefined;
}

const HAND_LABELS: Record<Hand, string> = {
  main_hand: "Main hand",
  off_hand: "Off hand",
  shield: "Shield",
  light: "Light",
  instrument: "Instrument",
};

/** `[[Crossbow, light|Crossbow]]` → `Crossbow`; `[[Longbow]]` → `Longbow`. */
const shown = (n: string) =>
  n
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")
    .pop()!
    .trim();

/** `[[Items/Longbow|bow]]` → `Longbow` — the name its icon is saved under. */
const stem = (n: string) =>
  n
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")[0]
    .split("/")
    .pop()!
    .trim();

/**
 * A loadout's art: its own hotbar icon (`Maul loadout.webp`), else the icon
 * of the first thing it holds (`Glaive.webp`), else none — the card then
 * draws the hotbar's glyph for it.
 */
function loadoutArt(l: Loadout, iconFor: (name: string) => string | undefined): string | undefined {
  const own = iconFor(loadoutIconName(l.name));
  if (own) return own;
  for (const h of HANDS) {
    const item = l.hands[h];
    const art = item ? iconFor(stem(item)) : undefined;
    if (art) return art;
  }
  return undefined;
}

/**
 * A sheet's loadouts as cards: the hotbar icon big on the left, the name
 * above what each hand holds on the right. Click one to put it in hand.
 */
export function LoadoutCards({ loadouts, isHeld, onEquip, iconFor }: LoadoutCardsProps) {
  const lookup = React.useMemo(() => {
    if (iconFor) return iconFor;
    const app = (globalThis as { app?: App }).app;
    return app ? buildIconIndex(app.vault) : () => undefined;
  }, [iconFor]);

  if (loadouts.length === 0) return null;
  return (
    <section className="rpg-loadouts" aria-label="Loadouts">
      <header className="rpg-loadouts-label">In hand</header>
      <menu>
        {loadouts.map((l) => {
          const held = isHeld(l);
          const art = loadoutArt(l, lookup);
          return (
            <li key={l.name}>
              <button
                type="button"
                className={`rpg-loadout${held ? " is-held" : ""}`}
                aria-pressed={held}
                disabled={!onEquip || held}
                onClick={() => onEquip?.(l)}
              >
                <span className="rpg-loadout-icon" aria-hidden="true">
                  {art ? (
                    <img src={art} alt="" draggable={false} />
                  ) : (
                    <LucideIcon name={loadoutGlyph(l)} size="1.6rem" strokeWidth={1.6} />
                  )}
                </span>
                <span className="rpg-loadout-body">
                  <span className="rpg-loadout-name">{l.name}</span>
                  {HANDS.flatMap((h) => {
                    const held = l.hands[h];
                    if (!held) return [];
                    // A loadout named for the one thing it holds ("Glaive" holding the Glaive) says the hand only.
                    const same = shown(held).toLowerCase() === l.name.trim().toLowerCase();
                    return [
                      <span key={h} className="rpg-loadout-hand">
                        <small>{HAND_LABELS[h]}</small>
                        {same ? "" : ` ${shown(held)}`}
                      </span>,
                    ];
                  })}
                </span>
              </button>
            </li>
          );
        })}
      </menu>
    </section>
  );
}
