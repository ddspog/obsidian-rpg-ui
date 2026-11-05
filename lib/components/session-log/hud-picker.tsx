/**
 * Who is acting, chosen from the drawer's portrait when the roster has no margin to sit in: a
 * small ‹ ▾ › strip under the portrait (or in its place, for the GM or the Party). ▾ opens the
 * roster — the GM / Party chips, the side switch and the faces — above it, as a sheet from the
 * bottom on a phone; ‹ › step to the previous or next actor. A tap, not hover: a phone has none.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { LucideIcon } from "./lucide-icon";

interface HudPickerProps {
  /** Who is acting now, as the strip names them when there is no portrait (the GM). */
  label?: string;
  /** The roster, drawn into the pop-up. */
  roster: React.ReactNode;
  /** Step to the previous (-1) or next (+1) actor. */
  onStep?: (dir: -1 | 1) => void;
  /** Close the pop-up when a pick is made: the host bumps this. */
  closeSignal?: number;
}

export function HudPicker({ label, roster, onStep, closeSignal }: HudPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [at, setAt] = React.useState<{ left: number; bottom: number } | null>(null);
  const anchor = React.useRef<HTMLButtonElement>(null);
  const pop = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setOpen(false), [closeSignal]);

  const place = React.useCallback(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (r) setAt({ left: Math.max(8, r.left), bottom: Math.max(8, window.innerHeight - r.top + 6) });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        anchor.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !anchor.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  return (
    <div className={`hud-picker${label ? " has-label" : ""}`}>
      {onStep && (
        <button
          type="button"
          className="hud-picker-step"
          aria-label="Previous actor"
          title="Previous actor"
          onClick={() => onStep(-1)}
        >
          <LucideIcon name="ChevronLeft" size="0.85rem" strokeWidth={2} />
        </button>
      )}
      <button
        ref={anchor}
        type="button"
        className="hud-picker-open"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Choose who acts"
        aria-label={label ? `${label} — choose who acts` : "Choose who acts"}
        onClick={() => setOpen((o) => !o)}
      >
        {label && <span className="hud-picker-label">{label}</span>}
        <LucideIcon name="ChevronDown" size="0.85rem" strokeWidth={2} />
      </button>
      {onStep && (
        <button
          type="button"
          className="hud-picker-step"
          aria-label="Next actor"
          title="Next actor"
          onClick={() => onStep(1)}
        >
          <LucideIcon name="ChevronRight" size="0.85rem" strokeWidth={2} />
        </button>
      )}
      {open &&
        at &&
        createPortal(
          <div
            ref={pop}
            className="hud-picker-pop"
            role="dialog"
            aria-label="Choose who acts"
            style={{ left: `${at.left}px`, bottom: `${at.bottom}px` }}
          >
            {roster}
          </div>,
          document.body
        )}
    </div>
  );
}
