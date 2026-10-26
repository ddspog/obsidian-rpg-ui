/**
 * Room for a block to grow into the page's margins, as the session log's
 * sidebar does: up to `wantPx` wider than its column, half on each side, as
 * far as the note's view leaves room. Measured on mount and whenever the
 * column or the view changes size; `active` off gives no extra width.
 */

import * as React from "react";

export function useMarginSpill(ref: React.RefObject<HTMLElement>, active: boolean, wantRem = 24): number {
  const [spill, setSpill] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    const column = el?.parentElement;
    if (!active || !el || !column) {
      setSpill(0);
      return;
    }
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const view = el.closest(".markdown-preview-view, .markdown-source-view") as HTMLElement | null;
    const measure = () => {
      const c = column.getBoundingClientRect();
      let room: number;
      if (view) {
        const v = view.getBoundingClientRect();
        const vs = getComputedStyle(view);
        const left = c.left - (v.left + (parseFloat(vs.paddingLeft) || 0));
        const right = v.right - (parseFloat(vs.paddingRight) || 0) - c.right;
        room = Math.max(0, Math.min(left, right));
      } else {
        room = Math.max(0, (window.innerWidth - c.width) / 2 - remPx);
      }
      // `room` is spent on each side.
      setSpill(Math.round(Math.min(wantRem * remPx, room * 2)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(column);
    if (view) ro.observe(view);
    return () => ro.disconnect();
  }, [ref, active, wantRem]);
  return spill;
}
