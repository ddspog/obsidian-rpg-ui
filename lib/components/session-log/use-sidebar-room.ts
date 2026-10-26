import * as React from "react";

/**
 * How wide the Log sidebar may be beside a prose layout. The sidebar invades
 * the page margin: this measures how much free margin the surrounding Obsidian
 * column actually has and sizes the invasion to fit (up to the desired width);
 * when there's too little room, the panel stacks below the prose instead of
 * being clipped off the edge.
 */
export function useSidebarRoom(layoutRef: React.RefObject<HTMLElement | null>): {
  sidebarPx: number | null;
  stacked: boolean;
} {
  const [sidebarPx, setSidebarPx] = React.useState<number | null>(null);
  const [stacked, setStacked] = React.useState(false);

  React.useEffect(() => {
    const layout = layoutRef.current;
    const container = layout?.parentElement;
    if (!layout || !container) return;

    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const desiredPx = 24 * remPx;
    const minSidebarPx = 13 * remPx;
    const view = layout.closest(".markdown-preview-view, .markdown-source-view, .cm-sizer") as HTMLElement | null;

    const measure = () => {
      const c = container.getBoundingClientRect();
      let room: number;
      if (view) {
        const v = view.getBoundingClientRect();
        const vs = getComputedStyle(view);
        const leftRoom = c.left - (v.left + (parseFloat(vs.paddingLeft) || 0));
        const rightRoom = v.right - (parseFloat(vs.paddingRight) || 0) - c.right;
        room = Math.max(0, Math.min(leftRoom, rightRoom));
      } else {
        room = Math.max(0, (window.innerWidth - c.width) / 2 - remPx);
      }
      const fits = Math.min(desiredPx, room * 2); // invasion spends `room` on each side
      if (fits < minSidebarPx) {
        setStacked(true);
        setSidebarPx(null);
      } else {
        setStacked(false);
        setSidebarPx(Math.round(fits));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    if (view) ro.observe(view);
    return () => ro.disconnect();
  }, [layoutRef]);

  return { sidebarPx, stacked };
}
