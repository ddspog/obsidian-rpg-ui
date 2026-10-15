/**
 * An overworld hex map, drawn: tiles in painter's order, place names, the
 * hovered hex outlined with a tooltip. Drag to pan; zoom with the buttons or
 * Ctrl/Cmd + scroll (a plain scroll still scrolls the note). Clicking a place
 * opens its note.
 */

import * as React from "react";
import { hexPoints, pixelToHex, type Side } from "lib/domains/hexmap/axial";
import type { DrawStroke, HexInfo, HexLayout } from "lib/domains/hexmap/layout";
import type { DrawRegion } from "lib/domains/hexmap/regions";
import type { CoordMode, HexMapError } from "lib/domains/hexmap/parse-hex-map";

export interface HexMapViewProps {
  layout: HexLayout;
  title?: string;
  scale?: string;
  coords: CoordMode;
  errors: HexMapError[];
  /** Outline every hex. */
  gridLines?: boolean;
  /** Multiplier on place and region label size. */
  labelScale?: number;
  /** Tallest the map gets, in % of the window height. */
  maxHeight?: number;
  onOpenLink?: (link: string, evt: MouseEvent) => void;
  onHoverLink?: (link: string, evt: MouseEvent, targetEl: HTMLElement) => void;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 12;

const SIDE_ANGLE: Record<Side, number> = { N: -90, NE: -30, SE: 30, S: 90, SW: 150, NW: 210 };

/** A joined path with no tile: from the centre to the middle of each side it joins. */
function Stroke({ item, R }: { item: DrawStroke; R: number }) {
  const apothem = (Math.sqrt(3) / 2) * R;
  if (item.sides.length === 0) {
    return <circle cx={item.cx} cy={item.cy} r={R * 0.12} fill={item.color} className="rpg-hexmap-stroke-end" />;
  }
  const d = item.sides
    .map((side) => {
      const a = (SIDE_ANGLE[side] * Math.PI) / 180;
      return `M${item.cx},${item.cy}L${item.cx + Math.cos(a) * apothem},${item.cy + Math.sin(a) * apothem}`;
    })
    .join("");
  return <path d={d} stroke={item.color} strokeWidth={R * 0.16} className="rpg-hexmap-stroke" />;
}

function Tiles({
  layout,
  clipId,
  hatchId,
  gridLines,
}: {
  layout: HexLayout;
  clipId: string;
  hatchId: string;
  gridLines?: boolean;
}) {
  const { R } = layout;
  return (
    <g className="rpg-hexmap-tiles">
      {layout.items.map((item) =>
        item.kind === "tile" ? (
          <image
            key={item.key}
            href={item.url}
            x={item.x}
            y={item.y}
            width={item.w}
            height={item.h}
            preserveAspectRatio={item.clip ? "xMidYMid slice" : "none"}
            clipPath={item.clip ? `url(#${clipId})` : undefined}
          />
        ) : item.kind === "stroke" ? (
          <Stroke key={item.key} item={item} R={R} />
        ) : (
          <g key={item.key}>
            <polygon points={hexPoints(item.cx, item.cy, R)} fill={item.color} className="rpg-hexmap-fill" />
            {item.missing && <polygon points={hexPoints(item.cx, item.cy, R)} fill={`url(#${hatchId})`} />}
          </g>
        )
      )}
      {gridLines &&
        [...layout.hexes.values()].map((h) => (
          <polygon key={`grid:${h.q},${h.r}`} points={hexPoints(h.cx, h.cy, R)} className="rpg-hexmap-grid" />
        ))}
      {layout.borders.map((b) => (
        <polygon
          key={`border:${b.key}`}
          points={hexPoints(b.cx, b.cy, R)}
          className="rpg-hexmap-border"
          strokeWidth={b.width}
        />
      ))}
    </g>
  );
}

function Regions({ layout, labelScale }: { layout: HexLayout; labelScale: number }) {
  const { R } = layout;
  if (layout.regions.length === 0) return null;
  return (
    <g className="rpg-hexmap-regions">
      {layout.regions.map((g) => (
        <g key={g.name} className={`rpg-hexmap-region depth-${Math.min(g.depth, 3)}`} style={{ color: g.color }}>
          <path d={g.fill} className="rpg-hexmap-region-fill" />
          <path d={g.edge} className="rpg-hexmap-region-edge" strokeWidth={R * (g.depth > 0 ? 0.06 : 0.1)} />
        </g>
      ))}
      {layout.regions.map((g) => (
        <text
          key={`label:${g.name}`}
          x={g.label.x}
          y={g.label.y - R * 0.15}
          className="rpg-hexmap-region-label"
          style={{ fontSize: R * (g.depth > 0 ? 0.42 : 0.55) * labelScale, fill: g.color }}
        >
          {g.name}
        </text>
      ))}
    </g>
  );
}

function Labels({ layout, coords, labelScale }: { layout: HexLayout; coords: CoordMode; labelScale: number }) {
  const { R } = layout;
  return (
    <g className="rpg-hexmap-labels" style={{ fontSize: R * 0.34 * labelScale }}>
      {layout.labels.map((l) => (
        <text key={l.key} x={l.x} y={l.y} className={l.link ? "rpg-hexmap-label is-place" : "rpg-hexmap-label"}>
          {l.text}
        </text>
      ))}
      {coords === "always" &&
        [...layout.hexes.values()].map((h) => (
          <text
            key={`c:${h.q},${h.r}`}
            x={h.cx}
            y={h.cy - R * 0.55}
            className="rpg-hexmap-coord"
            style={{ fontSize: R * 0.24 }}
          >
            {h.q},{h.r}
          </text>
        ))}
    </g>
  );
}

function Tooltip({ hex, scale, regions }: { hex: HexInfo; scale?: string; regions: DrawRegion[] }) {
  return (
    <>
      <strong>
        ({hex.q}, {hex.r}){hex.height ? ` · ${hex.height} m` : ""}
      </strong>
      {(hex.label || hex.link) && <div className="rpg-hexmap-tooltip-place">{hex.label ?? hex.link}</div>}
      <dl>
        {hex.specs
          .filter((s) => s.spec)
          .map((s) => (
            <React.Fragment key={`${s.layer}:${s.line}`}>
              <dt>{s.layer}</dt>
              <dd>
                {s.spec}
                {s.mask !== undefined && (
                  <span className="rpg-hexmap-tooltip-file"> ({s.mask || "no neighbours"})</span>
                )}
                {s.file && <span className="rpg-hexmap-tooltip-file"> — {s.file.split("/").pop()}</span>}
              </dd>
            </React.Fragment>
          ))}
        {hex.regions.length > 0 && (
          <>
            <dt>region</dt>
            <dd>
              {hex.regions.map((name) => {
                const g = regions.find((x) => x.name === name);
                return (
                  <div key={name}>
                    {name}
                    {g && (
                      <span className="rpg-hexmap-tooltip-file">
                        {" "}
                        — {g.hexes} hex{g.hexes === 1 ? "" : "es"}
                        {g.coast ? ` · ${g.coast} coast` : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </dd>
          </>
        )}
      </dl>
      {scale && <div className="rpg-hexmap-tooltip-scale">1 hex = {scale}</div>}
    </>
  );
}

/** The map without its frame or interaction — for previews (settings). */
export function HexMapStatic({ layout, labelScale = 1 }: { layout: HexLayout; labelScale?: number }) {
  const uid = React.useId().replace(/:/g, "");
  const b = layout.bounds;
  return (
    <svg viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} className="rpg-hexmap-static">
      <HexDefs clipId={`rpg-hexmap-clip-${uid}`} hatchId={`rpg-hexmap-hatch-${uid}`} R={layout.R} />
      <Tiles layout={layout} clipId={`rpg-hexmap-clip-${uid}`} hatchId={`rpg-hexmap-hatch-${uid}`} />
      <Regions layout={layout} labelScale={labelScale} />
      <Labels layout={layout} coords="off" labelScale={labelScale} />
    </svg>
  );
}

function HexDefs({ clipId, hatchId, R }: { clipId: string; hatchId: string; R: number }) {
  return (
    <defs>
      <clipPath id={clipId} clipPathUnits="objectBoundingBox">
        <polygon points="0,0.5 0.25,0 0.75,0 1,0.5 0.75,1 0.25,1" />
      </clipPath>
      <pattern id={hatchId} width={R / 4} height={R / 4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2={R / 4} className="rpg-hexmap-hatch" strokeWidth={R / 16} />
      </pattern>
    </defs>
  );
}

export function HexMapView({
  layout,
  title,
  scale,
  coords,
  errors,
  gridLines,
  labelScale = 1,
  maxHeight = 75,
  onOpenLink,
  onHoverLink,
}: HexMapViewProps) {
  const uid = React.useId().replace(/:/g, "");
  const clipId = `rpg-hexmap-clip-${uid}`;
  const hatchId = `rpg-hexmap-hatch-${uid}`;
  const base = layout.bounds;
  const [view, setView] = React.useState<ViewBox>(base);
  const [hovered, setHovered] = React.useState<HexInfo | null>(null);
  const [tip, setTip] = React.useState<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ x: number; y: number; view: ViewBox; moved: boolean } | null>(null);

  React.useEffect(() => setView(layout.bounds), [layout]);

  const toSvg = React.useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(ctm.inverse());
  }, []);

  const zoomAt = React.useCallback(
    (factor: number, cx?: number, cy?: number) => {
      setView((v) => {
        const zoom = base.w / (v.w / factor);
        if (zoom < MIN_ZOOM || zoom > MAX_ZOOM) return v;
        const px = cx ?? v.x + v.w / 2;
        const py = cy ?? v.y + v.h / 2;
        const w = v.w / factor;
        const h = v.h / factor;
        return { x: px - (px - v.x) / factor, y: py - (py - v.y) / factor, w, h };
      });
    },
    [base]
  );

  // Ctrl/Cmd + scroll (and trackpad pinch) zooms; needs a non-passive listener.
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * 0.01), p?.x, p?.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toSvg, zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const ctm = svgRef.current?.getScreenCTM();
    if (d && ctm) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 3) {
        d.moved = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      if (d.moved) {
        setView({ ...d.view, x: d.view.x - dx / ctm.a, y: d.view.y - dy / ctm.d });
        setTip(null);
        return;
      }
    }
    const p = toSvg(e.clientX, e.clientY);
    if (!p) return;
    const h = pixelToHex(p.x, p.y, layout.R);
    const hex = layout.hexes.get(`${h.q},${h.r}`) ?? null;
    if (hex !== hovered) {
      setHovered(hex);
      if (hex?.link && onHoverLink && viewportRef.current) onHoverLink(hex.link, e.nativeEvent, viewportRef.current);
    }
    const rect = viewportRef.current?.getBoundingClientRect();
    setTip(hex && rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) return;
    if (hovered?.link && onOpenLink) onOpenLink(hovered.link, e.nativeEvent);
  };

  const onPointerLeave = () => {
    if (drag.current?.moved) return;
    setHovered(null);
    setTip(null);
  };

  const tiles = React.useMemo(
    () => <Tiles layout={layout} clipId={clipId} hatchId={hatchId} gridLines={gridLines} />,
    [layout, clipId, hatchId, gridLines]
  );
  const labels = React.useMemo(
    () => (
      <>
        <Regions layout={layout} labelScale={labelScale} />
        <Labels layout={layout} coords={coords} labelScale={labelScale} />
      </>
    ),
    [layout, coords, labelScale]
  );
  const R = layout.R;

  return (
    <figure className="rpg-hexmap">
      <div
        ref={viewportRef}
        className={`rpg-hexmap-viewport${hovered?.link ? " is-over-place" : ""}`}
        // Small maps keep their hexes a readable size instead of filling the note.
        style={{
          aspectRatio: `${base.w} / ${base.h}`,
          maxWidth: `${Math.round(base.w * 1.25)}px`,
          maxHeight: `${maxHeight}vh`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={() => setView(base)}
      >
        <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet">
          <HexDefs clipId={clipId} hatchId={hatchId} R={R} />
          {tiles}
          {labels}
          {hovered && (
            <polygon points={hexPoints(hovered.cx, hovered.cy, R)} className="rpg-hexmap-hover" strokeWidth={R / 14} />
          )}
        </svg>
        <menu className="rpg-hexmap-controls">
          <li>
            <button
              type="button"
              aria-label="Zoom in"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => zoomAt(1.4)}
            >
              +
            </button>
          </li>
          <li>
            <button
              type="button"
              aria-label="Zoom out"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => zoomAt(1 / 1.4)}
            >
              −
            </button>
          </li>
          <li>
            <button
              type="button"
              aria-label="Fit map"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setView(base)}
            >
              ⤢
            </button>
          </li>
        </menu>
        {hovered && tip && coords !== "off" && (
          <div className="rpg-hexmap-tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
            <Tooltip hex={hovered} scale={scale} regions={layout.regions} />
          </div>
        )}
      </div>
      {title && <figcaption>{title}</figcaption>}
      {errors.length > 0 && (
        <details className="rpg-hexmap-errors">
          <summary>
            {errors.length} problem{errors.length === 1 ? "" : "s"} in this map
          </summary>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>
                line {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </figure>
  );
}
