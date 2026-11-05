/**
 * Who is acting, chosen from the drawer's portrait column when the roster has no margin to sit in:
 * a joined ‹ ▾ › pill under the portrait. ▾ opens the roster (the side switch, the GM's face,
 * the faces) in a pop-up that grows from it, as a sheet from the bottom on a phone; ‹ › step to the
 * previous or next actor on this side, and say who that is. A tap, not hover: a phone has none.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { LucideIcon } from "./lucide-icon";

interface HudPickerProps {
  /** The roster, drawn into the pop-up. */
  roster: React.ReactNode;
  /** Step to the previous (-1) or next (+1) actor. */
  onStep?: (dir: -1 | 1) => void;
  /** Who the steps go to, for their tooltips, and a small face of each to show on hover. */
  prev?: { name: string; face?: React.ReactNode } | undefined;
  next?: { name: string; face?: React.ReactNode } | undefined;
  /** Who acts now, for ▾'s name. */
  current?: string | undefined;
  /** Close the pop-up when a pick is made: the host bumps this. */
  closeSignal?: number;
}

type Phase = "closed" | "open" | "closing";

/** How long the pop-up takes to leave (its CSS exit is a little shorter). */
const EXIT_MS = 110;
/** A downward drag on the phone's sheet past this closes it. */
const DRAG_CLOSE_PX = 60;

const isPhone = () => document.body.classList.contains("is-mobile");

export function HudPicker({ roster, onStep, prev, next, current, closeSignal }: HudPickerProps) {
  const [phase, setPhase] = React.useState<Phase>("closed");
  const [at, setAt] = React.useState<{ left: number; bottom: number; caret: number } | null>(null);
  const anchor = React.useRef<HTMLButtonElement>(null);
  const pop = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const open = phase === "open";

  const close = React.useCallback((refocus = false) => {
    setPhase((p) => (p === "open" ? "closing" : p));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPhase("closed"), EXIT_MS);
    if (refocus) anchor.current?.focus();
  }, []);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  // A pick closes it.
  const firstSignal = React.useRef(closeSignal);
  React.useEffect(() => {
    if (closeSignal !== firstSignal.current) close();
  }, [closeSignal, close]);

  const place = React.useCallback(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const width = pop.current?.offsetWidth ?? Math.min(352, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setAt({
      left,
      bottom: Math.max(8, window.innerHeight - r.top + 10),
      caret: r.left + r.width / 2 - left,
    });
  }, []);

  // Open: placed by the ▾, then focus on the face to pick (the next in a fight, else who acts): once
  // placed, since a pop-up still hidden while it is measured can't take focus.
  const wantFocus = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!open) return;
    wantFocus.current = true;
    place();
  }, [open, place]);
  React.useEffect(() => {
    if (!open || !at || !wantFocus.current) return;
    wantFocus.current = false;
    const el = pop.current;
    const target =
      el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("button, input");
    target?.focus({ preventScroll: true });
  }, [open, at]);

  React.useEffect(() => {
    if (phase === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !anchor.current?.contains(t)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", place);
    // On a phone the page behind the sheet holds still.
    const scroller = isPhone() ? anchor.current?.closest<HTMLElement>(".markdown-preview-view") : null;
    const overflow = scroller?.style.overflow ?? "";
    if (scroller) scroller.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", place);
      if (scroller) scroller.style.overflow = overflow;
    };
  }, [phase, close, place]);

  // Tab stays inside the pop-up while it is open.
  const onPopKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const all = Array.from(pop.current?.querySelectorAll<HTMLElement>("button, input") ?? []).filter(
      (x) => !x.hasAttribute("disabled") && x.getClientRects().length > 0
    );
    // The roster's faces are one stop (arrow keys move between them): Tab visits the one that takes focus.
    const stops = all.filter((x) => !x.closest("ul.hud-faces") || x.tabIndex >= 0);
    if (stops.length === 0) return;
    const i = stops.indexOf(document.activeElement as HTMLElement);
    const to = e.shiftKey ? (i <= 0 ? stops.length - 1 : i - 1) : i === stops.length - 1 ? 0 : i + 1;
    e.preventDefault();
    stops[to].focus();
  };

  // The phone's sheet: drag it down to close.
  const drag = React.useRef<{ y: number; t: number; dy: number } | null>(null);
  const onDragStart = (e: React.PointerEvent) => {
    if (!isPhone()) return;
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !pop.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    pop.current.style.setProperty("--drag", `${d.dy}px`);
  };
  const onDragEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !pop.current) return;
    const fast = d.dy / Math.max(1, e.timeStamp - d.t) > 0.6;
    pop.current.style.removeProperty("--drag");
    if (d.dy > DRAG_CLOSE_PX || (fast && d.dy > 12)) close();
  };

  const step = (dir: -1 | 1, to: HudPickerProps["prev"]) =>
    onStep && (
      <button
        type="button"
        className="hud-picker-step"
        aria-label={to ? `${dir < 0 ? "Previous" : "Next"}: ${to.name}` : dir < 0 ? "Previous actor" : "Next actor"}
        title={to ? `${dir < 0 ? "Previous" : "Next"}: ${to.name}` : dir < 0 ? "Previous actor" : "Next actor"}
        onClick={() => onStep(dir)}
      >
        <LucideIcon name={dir < 0 ? "ChevronLeft" : "ChevronRight"} size="0.85rem" strokeWidth={2} />
        {to?.face && (
          <span className="hud-picker-ghost" aria-hidden="true">
            {to.face}
          </span>
        )}
      </button>
    );

  return (
    <div className="hud-picker">
      {step(-1, prev)}
      <button
        ref={anchor}
        type="button"
        className="hud-picker-open"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Choose who acts"
        aria-label={current ? `${current} — choose who acts` : "Choose who acts"}
        onClick={() => (open ? close() : setPhase("open"))}
      >
        <LucideIcon name="ChevronDown" size="0.85rem" strokeWidth={2} />
      </button>
      {step(1, next)}
      {phase !== "closed" &&
        createPortal(
          <>
            <div
              className="hud-picker-scrim"
              data-state={phase}
              aria-hidden="true"
              onPointerDown={(e) => {
                e.preventDefault();
                close();
              }}
            />
            <div
              ref={pop}
              className="hud-picker-pop"
              role="dialog"
              aria-label="Choose who acts"
              data-state={phase}
              style={
                {
                  visibility: at ? undefined : "hidden",
                  left: `${at?.left ?? 0}px`,
                  bottom: `${at?.bottom ?? 0}px`,
                  "--caret-x": `${at?.caret ?? 24}px`,
                } as React.CSSProperties
              }
              onKeyDown={onPopKey}
            >
              <div
                className="hud-picker-handle"
                aria-hidden="true"
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
              />
              {roster}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
