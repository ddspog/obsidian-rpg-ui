/**
 * The character card at the HUD's left: their portrait with the hit points
 * under it (click it: their sheet opens), what's in hand — main hand and off
 * hand, a light and an instrument beside — and the loadouts as four icons,
 * one for each way they fight: a bow, a pair of blades, a shield, a casting
 * focus. Right-click a hand or a loadout to give it an icon of its own.
 */

import * as React from "react";
import { Menu } from "obsidian";
import type { IconTone } from "../../domains/image-studio/kinds";
import type { Health } from "../../domains/session-log/health";
import { loadoutIconName, type HeldItem, type HudInfo } from "../../domains/session-log/hud";
import { Face } from "./hud-roster";
import { LucideIcon } from "./lucide-icon";

interface HudCharacterProps {
  name: string;
  info: HudInfo;
  hp?: Health | undefined;
  /** Their armor class with what is in hand now (a shield counts while it is wielded). */
  ac?: number | undefined;
  onOpenSheet: () => void;
  onEquip: (loadout: string) => void;
  /** The switches under the loadouts (Move, Gear). */
  extras?: React.ReactNode;
  /** A foe: no hands, light or loadouts to show. */
  foe?: boolean;
  /** Make an icon for a held item or a loadout (right-click it). */
  onMakeIcon?: (what: { name: string; text?: string; tone?: IconTone }) => void;
}

/** A small square that can be given an icon of its own: right-click → the image studio. */
function iconMenu(ev: React.MouseEvent, name: string, onMakeIcon: (() => void) | undefined) {
  if (!onMakeIcon) return;
  ev.preventDefault();
  const menu = new Menu();
  menu.addItem((i) => i.setTitle(`Make an icon for ${name}…`).setIcon("image-plus").onClick(onMakeIcon));
  menu.showAtMouseEvent(ev.nativeEvent);
}

/** One slot: the item's picture or its name, or an empty socket. */
function Slot({
  item,
  label,
  onMakeIcon,
}: {
  item?: HeldItem | undefined;
  label: string;
  onMakeIcon?: ((what: { name: string; text?: string; tone?: IconTone }) => void) | undefined;
}) {
  return (
    <span
      className={`hud-slot${item ? " is-filled" : ""}`}
      title={item ? `${label}: ${item.name}` : `${label}: empty`}
      onContextMenu={(ev) =>
        item &&
        iconMenu(
          ev,
          item.name,
          onMakeIcon && (() => onMakeIcon({ name: item.name, text: `A ${item.name}`, tone: "attack" }))
        )
      }
    >
      {item?.image ? <img src={item.image} alt={item.name} draggable={false} /> : item ? <b>{item.name}</b> : null}
    </span>
  );
}

export function HudCharacter({ name, info, hp, ac, onOpenSheet, onEquip, extras, foe, onMakeIcon }: HudCharacterProps) {
  const pct = hp && hp.max > 0 ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : undefined;
  const hands = info.hands ?? {};
  return (
    <section className="hud-character" aria-label={`${name}'s gear`}>
      {/* The upper half: the face, close, with the hit points under it (click: the sheet). */}
      <button
        type="button"
        className="hud-portrait"
        title={`Open ${name}'s sheet`}
        aria-label={`Open ${name}'s sheet`}
        onClick={onOpenSheet}
      >
        <span className="hud-portrait-frame">
          <Face info={info} name={name} />
        </span>
        {(hp || ac != null) && (
          <span className="hud-portrait-hp">
            {hp && (
              <span className="hud-hpbar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
            )}
            {/* Hit points and armor class on one line. */}
            <span className="hud-portrait-line">
              {hp && (
                <small>
                  {hp.current}/{hp.max}
                </small>
              )}
              {ac != null && (
                <span className="hud-portrait-ac" title={`Armor class ${ac}`} aria-label={`Armor class ${ac}`}>
                  <LucideIcon name="Shield" size="0.7rem" strokeWidth={1.8} />
                  {ac}
                </span>
              )}
            </span>
          </span>
        )}
      </button>
      {/* The lower half: what's in the two hands, the loadouts to change it, the switches. */}
      <div className="hud-gear">
        {!foe && (
          <>
            <div className="hud-hands" role="group" aria-label="In hand">
              <Slot item={hands.main} label="Main hand" {...(onMakeIcon ? { onMakeIcon } : {})} />
              <Slot item={hands.off} label="Off hand" {...(onMakeIcon ? { onMakeIcon } : {})} />
            </div>
            {info.loadouts && info.loadouts.length > 0 && (
              <div className="hud-loadouts" role="group" aria-label="Loadouts">
                {info.loadouts.map((l) => (
                  <button
                    key={l.name}
                    type="button"
                    className={`hud-loadout${l.held ? " is-held" : ""}`}
                    aria-pressed={l.held}
                    title={`${l.name} — ${l.summary}`}
                    aria-label={`${l.name}: ${l.summary}`}
                    onClick={() => onEquip(l.name)}
                    onContextMenu={(ev) =>
                      iconMenu(
                        ev,
                        `${l.name} loadout`,
                        onMakeIcon &&
                          (() => onMakeIcon({ name: loadoutIconName(l.name), text: l.summary, tone: "action" }))
                      )
                    }
                  >
                    {l.image ? (
                      <img src={l.image} alt="" draggable={false} />
                    ) : (
                      <LucideIcon name={l.glyph} size="1rem" strokeWidth={1.7} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {extras && <div className="hud-switches">{extras}</div>}
      </div>
    </section>
  );
}
