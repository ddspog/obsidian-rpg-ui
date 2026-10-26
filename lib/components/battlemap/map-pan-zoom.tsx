/**
 * A battle map to look around: drag it to pan, pinch or use the wheel (or the
 * buttons) to zoom, Fit to see all of it. It fills its box; what it draws is
 * the caller's — a function of the window (`MapView`) it is showing.
 */

import * as React from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import type { SquareMap } from "lib/domains/battlemap/square-map";
import type { MapView } from "./square-map-view";

const MAX_ZOOM = 8;

export function MapPanZoom({
  map,
  children,
}: {
  map: SquareMap;
  children: (view: MapView | undefined) => React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [z, setZ] = React.useState(1);
  const [centre, setCentre] = React.useState({ col: map.cols / 2, row: map.rows / 2 });

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pixels per square when the whole map fits, and at this zoom.
  const fit = size.w > 0 && size.h > 0 ? Math.min(size.w / map.cols, size.h / map.rows) : 0;
  const ppx = fit * z;
  const visCols = ppx ? size.w / ppx : map.cols;
  const visRows = ppx ? size.h / ppx : map.rows;

  /** The centre kept so the window stays on the map (centred when it is wider than the map). */
  const clamp = (c: { col: number; row: number }, cols = visCols, rows = visRows) => ({
    col: cols >= map.cols ? map.cols / 2 : Math.max(cols / 2, Math.min(map.cols - cols / 2, c.col)),
    row: rows >= map.rows ? map.rows / 2 : Math.max(rows / 2, Math.min(map.rows - rows / 2, c.row)),
  });

  /** Zoom by a factor, keeping the square under (x, y) — pixels in the box — where it is. */
  const zoomAt = (factor: number, x = size.w / 2, y = size.h / 2) => {
    const next = Math.max(1, Math.min(MAX_ZOOM, z * factor));
    if (next === z || !fit) return;
    const under = { col: centre.col - visCols / 2 + x / ppx, row: centre.row - visRows / 2 + y / ppx };
    const nppx = fit * next;
    setZ(next);
    setCentre(
      clamp(
        {
          col: under.col - x / nppx + size.w / nppx / 2,
          row: under.row - y / nppx + size.h / nppx / 2,
        },
        size.w / nppx,
        size.h / nppx
      )
    );
  };
  const reset = () => {
    setZ(1);
    setCentre({ col: map.cols / 2, row: map.rows / 2 });
  };

  // Gestures: one finger or the mouse pans; two fingers pinch.
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const moved = React.useRef(false);
  const pinch = React.useRef(0);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest(".rpg-battlemap-token, button")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    pinch.current = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p || !fit) return;
    const rect = box.current!.getBoundingClientRect();
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [na, nb] = [...pointers.current.values()];
      const was = Math.hypot(a.x - b.x, a.y - b.y);
      const now = Math.hypot(na.x - nb.x, na.y - nb.y);
      if (was > 0 && now > 0) zoomAt(now / was, (na.x + nb.x) / 2 - rect.left, (na.y + nb.y) / 2 - rect.top);
      moved.current = true;
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!moved.current && Math.hypot(dx, dy) < 5) return;
    if (!moved.current) box.current!.setPointerCapture(e.pointerId);
    moved.current = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setCentre((c) => clamp({ col: c.col - dx / ppx, row: c.row - dy / ppx }));
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (box.current?.hasPointerCapture(e.pointerId)) box.current.releasePointerCapture(e.pointerId);
    // The click that ends a pan is not a tap on a square.
    if (moved.current) window.setTimeout(() => (moved.current = false), 0);
  };
  // Not a passive listener: the wheel zooms the map, not the page.
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // Whole: the map as it is drawn, fitted in the box. Zoomed: a window onto it.
  const view: MapView | undefined =
    z > 1
      ? {
          col: centre.col - visCols / 2,
          row: centre.row - visRows / 2,
          cols: visCols,
          rows: visRows,
          instant: true,
        }
      : undefined;

  return (
    <div
      ref={box}
      className="rpg-map-pz"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClickCapture={(e) => {
        if (moved.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {fit > 0 && children(view)}
      <menu className="rpg-map-pz-controls" aria-label="Zoom">
        <li>
          <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.5)}>
            <Plus size={16} aria-hidden="true" />
          </button>
        </li>
        <li>
          <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.5)}>
            <Minus size={16} aria-hidden="true" />
          </button>
        </li>
        <li>
          <button type="button" aria-label="Fit the map" onClick={reset} disabled={z === 1}>
            <Maximize size={16} aria-hidden="true" />
          </button>
        </li>
      </menu>
    </div>
  );
}
