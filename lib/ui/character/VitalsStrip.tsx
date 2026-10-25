import * as React from "react";
import { createPortal } from "react-dom";

export interface VitalsStripProps {
  hp: number;
  maxHp: number;
  tempHp?: number;
  ac: number;
  exhaustion?: number;
  /** Condition names; only the count shows. */
  conditions?: string[];
}

/**
 * HP, AC and conditions pinned under the page header once the health block has
 * scrolled out of view, so the numbers a player needs mid-combat never leave
 * the screen. A phone-only helper: it renders nothing above 600px, where the
 * block is still on screen at a glance.
 *
 * The block renders a zero-height sentinel in place; the strip itself is
 * portalled to the body and positioned over the reading pane.
 */
export function VitalsStrip({ hp, maxHp, tempHp = 0, ac, exhaustion = 0, conditions = [] }: VitalsStripProps) {
  const sentinel = React.useRef<HTMLSpanElement>(null);
  const [frame, setFrame] = React.useState<{ top: number; left: number; width: number } | null>(null);

  React.useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const pane = el.closest<HTMLElement>(".markdown-preview-view, .markdown-rendered") ?? document.body;
    const phone = window.matchMedia?.("(max-width: 600px)");
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!phone?.matches) return setFrame(null);
      const paneRect = pane.getBoundingClientRect();
      // Past the top of the pane, and the pane is still the one on screen.
      const passed = el.getBoundingClientRect().top < paneRect.top - 8;
      setFrame(passed ? { top: paneRect.top, left: paneRect.left, width: paneRect.width } : null);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    pane.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      pane.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const state = pct <= 25 ? "low" : pct <= 50 ? "mid" : "ok";

  return (
    <>
      <span ref={sentinel} aria-hidden="true" data-vitals-sentinel />
      {frame &&
        createPortal(
          <aside
            aria-details="Vitals Strip"
            aria-label={`Hit points ${hp} of ${maxHp}, armor class ${ac}`}
            style={{ top: frame.top, left: frame.left, width: frame.width }}
          >
            <div aria-details="Vitals HP" data-state={state}>
              <i style={{ width: `${pct}%` }} />
              <b>
                {hp} / {maxHp}
              </b>
              {tempHp > 0 && <em>+{tempHp}</em>}
            </div>
            <span aria-details="Vitals AC">AC {ac}</span>
            <span aria-details="Vitals Conditions" data-active={conditions.length + exhaustion > 0 ? "true" : "false"}>
              {conditions.length > 0
                ? `${conditions.length} cond.`
                : exhaustion > 0
                  ? `Exh. ${exhaustion}`
                  : "No cond."}
            </span>
          </aside>,
          document.body
        )}
    </>
  );
}
