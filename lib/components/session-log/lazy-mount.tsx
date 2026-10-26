import * as React from "react";

/**
 * Work that can wait for an idle moment: run one at a time, so a page of
 * deferred pieces never lands as a single long task.
 */
const idleQueue: Array<() => void> = [];
let idleScheduled = false;

function runNextIdle(deadline?: { timeRemaining: () => number }) {
  idleScheduled = false;
  // At least one per turn, then more while the browser has time to spare.
  do {
    idleQueue.shift()?.();
  } while (idleQueue.length > 0 && deadline && deadline.timeRemaining() > 8);
  if (idleQueue.length > 0) scheduleIdle();
}

function scheduleIdle() {
  if (idleScheduled) return;
  idleScheduled = true;
  if (typeof requestIdleCallback === "function") requestIdleCallback(runNextIdle, { timeout: 1500 });
  else setTimeout(runNextIdle, 50);
}

/** Queue `job` for an idle moment; the returned function takes it back out. */
function whenIdle(job: () => void): () => void {
  idleQueue.push(job);
  scheduleIdle();
  return () => {
    const i = idleQueue.indexOf(job);
    if (i >= 0) idleQueue.splice(i, 1);
  };
}

/** Heights of pieces already shown, by `kind` — the next one's stand-in is the same. */
const shownHeights = new Map<string, number>();

interface LazyMountProps {
  children: React.ReactNode;
  /** Pieces of the same kind share a stand-in height, learned from the first shown. */
  kind: string;
  /** The stand-in's height before one has been shown (CSS length). */
  height: string;
  /** How far outside the scroller, in px, a piece is drawn from. */
  margin?: number;
}

/**
 * Draws `children` once they are within `margin` of the scroller — or, failing
 * that, at an idle moment shortly after — so the first paint of a long log is
 * only what is on screen. Everything is in the page soon after (nothing is
 * left out for assistive technology, find-in-page or the Latest button), and
 * once drawn, a piece stays.
 */
export function LazyMount({ children, kind, height, margin = 1200 }: LazyMountProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(typeof IntersectionObserver === "undefined");

  React.useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const root = el.closest<HTMLElement>(".markdown-preview-view, .cm-scroller, .lonelog-sidebar");
    const io = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) setShown(true);
      },
      { root, rootMargin: `${margin}px 0px` }
    );
    io.observe(el);
    const cancel = whenIdle(() => setShown(true));
    return () => {
      io.disconnect();
      cancel();
    };
  }, [shown, margin]);

  // Once drawn, remember how tall this kind of piece came out, for the next stand-in.
  const body = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (shown && body.current && body.current.offsetHeight > 0) shownHeights.set(kind, body.current.offsetHeight);
  }, [shown, kind]);

  if (!shown) {
    const known = shownHeights.get(kind);
    return (
      <div
        ref={ref}
        className="lonelog-lazy"
        aria-busy="true"
        style={{ minHeight: known != null ? `${known}px` : height }}
      />
    );
  }
  return (
    <div ref={body} className="lonelog-lazy is-shown">
      {children}
    </div>
  );
}
