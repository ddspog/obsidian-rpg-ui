/**
 * An overworld hex map, drawn: tiles in painter's order, place names, the
 * hovered hex outlined with a tooltip. Drag to pan; zoom with the buttons or
 * Ctrl/Cmd + scroll (a plain scroll still scrolls the note). Clicking a place
 * (or a marker or label linked to a note) opens its note. Markers draw over
 * the map, and labels' banners over them.
 *
 * In paint mode (`editing`), presses go to the editor instead: links don't
 * open, empty hexes around the map are outlined to paint into, and the view
 * stays where it is as the map changes. Space-drag or middle-drag still pans.
 */

import * as React from "react";
import { type Axial, hexCenter, hexPoints, pixelToAxial, pixelToHex, type Side } from "lib/domains/hexmap/axial";
import { LucideIcon } from "lib/components/session-log/lucide-icon";
import {
  type DrawFilter,
  type DrawStroke,
  hexAt,
  type HexInfo,
  type HexLayout,
  MARKER_CAPTION,
  regionCase,
} from "lib/domains/hexmap/layout";
import { arcPath } from "lib/domains/hexmap/labels";
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
  /** Paint mode. */
  editing?: HexMapEditing;
  /** Paint mode's bar above the map, and its sidebar beside it. */
  toolbar?: React.ReactNode;
  sidebar?: React.ReactNode;
  /** SVG drawn under the tiles (a detail map's parent, a reference picture) and over the labels (grids). */
  backdrop?: React.ReactNode;
  overlay?: React.ReactNode;
  /** SVG drawn over the hex under the pointer (a way into its detail), outside paint mode's strokes. */
  hoverOverlay?: (hex: HexInfo) => React.ReactNode;
  /** SVG drawn over the tiles, under the labels and markers (the level below, as this one shows it). */
  overTiles?: React.ReactNode;
  /** Shows ✎ in the controls, to start paint mode. */
  onEdit?: () => void;
  /** Play mode: presses it claims (a piece, a measuring drag) go to it instead of panning. */
  play?: HexMapPlay;
  /** Inside the map, over it (Play mode's controls). */
  hud?: React.ReactNode;
  /** In the corner controls, instead of ✎ (the mode switch). */
  modeSwitch?: React.ReactNode;
  /** A corner button that opens the map in a window of its own over the page, or puts it back. */
  float?: { open: boolean; onToggle: () => void };
  /** Corner buttons that hide markers and labels, or region outlines, while working on the rest. */
  shown?: { points: boolean; regions: boolean; onPoints: () => void; onRegions: () => void };
  /** Over the map, whatever the mode: where in the block's levels this map is. */
  crumbs?: React.ReactNode;
  /** More room the view takes in (a detail map: the parent hexes it covers). */
  frame?: ViewBox;
  /** Where the view starts, and told when it moves (kept across re-renders). */
  initialView?: ViewBox;
  /** The fitted map, zoomed closer by `zoom` and centred on `at` (a hex; unset: the middle) whenever it is fitted. */
  startZoom?: { zoom: number; at?: [number, number] };
  onViewChange?: (view: ViewBox) => void;
  /** Semantic zoom (design §13.9): zooming far enough in or out asks for the level below or above. */
  levels?: HexMapLevels;
  /** A view to show now (a level switch), once for each new `n`. */
  showView?: { box: ViewBox; n: number };
  /** A fine grid of empty hexes drawn over this area (a level's, all over the level above). */
  gridArea?: ViewBox;
}

export interface HexMapLevels {
  canIn: boolean;
  canOut: boolean;
  /** The view zoomed to, at this level: the block shows the next level there. */
  onLevel: (dir: 1 | -1, view: ViewBox) => void;
}

/** A press in paint mode: the hex under it and the exact point, in axial units. */
export interface PaintPointer {
  phase: "down" | "move" | "up";
  button: number;
  alt: boolean;
  shift: boolean;
  hex: Axial;
  point: Axial;
}

export interface HexMapPlay {
  /** Whether a press starts a gesture of Play's (else it pans as usual). */
  claims: (p: PaintPointer) => boolean;
  onPointer: (p: PaintPointer) => void;
}

export interface HexMapEditing {
  /** Empty hexes to outline, so there's somewhere to paint new ones. */
  ghosts: Axial[];
  /** The pan tool: every drag pans. */
  pan: boolean;
  /** Saving, or the last problem, for the status line. */
  status?: string;
  onPointer: (p: PaintPointer) => void;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 12;
/** With levels: a hex this wide on screen (px) shows the level below, this narrow the level above. */
const LEVEL_IN_PX = 240;
const LEVEL_OUT_PX = 22;
/** With levels the zoom is kept to hexes of these widths (px), whatever the map's size. */
const HEX_PX_MIN = 3;
const HEX_PX_MAX = 600;

const SIDE_ANGLE: Record<Side, number> = { N: -90, NE: -30, SE: 30, S: 90, SW: 150, NW: 210 };

/** A joined path with no tile: from the centre to the middle of each side it joins. */
function Stroke({ item, R, clipId }: { item: DrawStroke; R: number; clipId: string }) {
  const apothem = (Math.sqrt(3) / 2) * R;
  const filter = item.filter ? `url(#${clipId}-f-${item.filter})` : undefined;
  if (item.sides.length === 0) {
    return (
      <circle
        cx={item.cx}
        cy={item.cy}
        r={R * 0.12}
        fill={item.color}
        filter={filter}
        className="rpg-hexmap-stroke-end"
      />
    );
  }
  const d = item.sides
    .map((side) => {
      const a = (SIDE_ANGLE[side] * Math.PI) / 180;
      return `M${item.cx},${item.cy}L${item.cx + Math.cos(a) * apothem},${item.cy + Math.sin(a) * apothem}`;
    })
    .join("");
  return <path d={d} stroke={item.color} strokeWidth={R * 0.16} filter={filter} className="rpg-hexmap-stroke" />;
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
      {layout.items.map((item, i) =>
        item.kind === "tile" ? (
          item.crop ? (
            // Terrain that hides its baked-in base: only the face shows, over the hex's own base.
            <g key={item.key}>
              <clipPath id={`${clipId}-crop-${i}`}>
                <polygon points={hexPoints(item.crop.cx, item.crop.cy, R)} />
              </clipPath>
              <image
                href={item.url}
                x={item.x}
                y={item.y}
                width={item.w}
                height={item.h}
                preserveAspectRatio="none"
                clipPath={`url(#${clipId}-crop-${i})`}
                filter={
                  item.faint ? `url(#${clipId}-faint)` : item.filter ? `url(#${clipId}-f-${item.filter})` : undefined
                }
              />
            </g>
          ) : item.below !== undefined ? (
            // A raised hex's own tile again, a step lower: only its slab, under the face, shows.
            <g key={item.key}>
              <clipPath id={`${clipId}-below-${i}`}>
                <rect x={item.x} y={item.below} width={item.w} height={Math.max(0, item.y + item.h - item.below)} />
              </clipPath>
              <image
                href={item.url}
                x={item.x}
                y={item.y}
                width={item.w}
                height={item.h}
                preserveAspectRatio="none"
                clipPath={`url(#${clipId}-below-${i})`}
                filter={
                  item.faint ? `url(#${clipId}-faint)` : item.filter ? `url(#${clipId}-f-${item.filter})` : undefined
                }
              />
            </g>
          ) : (
            <image
              key={item.key}
              href={item.url}
              x={item.x}
              y={item.y}
              width={item.w}
              height={item.h}
              preserveAspectRatio={item.clip ? "xMidYMid slice" : "none"}
              clipPath={item.clip ? `url(#${clipId})` : undefined}
              filter={
                item.faint ? `url(#${clipId}-faint)` : item.filter ? `url(#${clipId}-f-${item.filter})` : undefined
              }
              transform={
                item.flipX !== undefined
                  ? `translate(${2 * item.flipX} 0) scale(-1 1)`
                  : item.rotate
                    ? `rotate(${item.rotate.deg} ${item.rotate.cx} ${item.rotate.cy})`
                    : undefined
              }
            />
          )
        ) : item.kind === "stroke" ? (
          <Stroke key={item.key} item={item} R={R} clipId={clipId} />
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

/** Text on several lines, centred on its point: each line a tspan at `x`, 1.05 em apart. */
function Lines({ x, lines }: { x: number; lines: string[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={`${i === 0 ? (-(lines.length - 1) / 2) * 1.05 : 1.05}em`}>
          {l}
        </tspan>
      ))}
    </>
  );
}

/** A region's fill: its colour, or its `tint`, at its strength. */
function RegionFill({ g }: { g: DrawRegion }) {
  return (
    <path
      d={g.fill}
      className="rpg-hexmap-region-fill"
      style={
        g.tint || g.tintOpacity !== undefined
          ? {
              ...(g.tint ? { color: g.tint } : {}),
              ...(g.tintOpacity !== undefined ? { fillOpacity: g.tintOpacity } : {}),
            }
          : undefined
      }
    />
  );
}

function Regions({ layout, labelScale, faintFilter }: { layout: HexLayout; labelScale: number; faintFilter: string }) {
  const { R } = layout;
  const uid = React.useId().replace(/:/g, "");
  if (layout.regions.length === 0) return null;
  const shape = (g: DrawRegion) => (
    <g key={g.name} className={`rpg-hexmap-region depth-${Math.min(g.depth, 3)}`} style={{ color: g.color }}>
      {g.demark !== "outline" && g.demark !== "none" && <RegionFill g={g} />}
      {g.demark !== "fill" && g.demark !== "none" && (
        <path d={g.edge} className="rpg-hexmap-region-edge" strokeWidth={R * (g.depth > 0 ? 0.06 : 0.1)} />
      )}
    </g>
  );
  const faint = layout.regions.filter((g) => g.faint);
  return (
    <g className="rpg-hexmap-regions">
      {/* A faint neighbour's regions, dimmed as its tiles are, under the map's own. */}
      {faint.length > 0 && <g filter={`url(#${faintFilter})`}>{faint.map(shape)}</g>}
      {layout.regions.filter((g) => !g.faint).map(shape)}
      {layout.regions
        .filter((g) => g.title)
        .map((g, i) => {
          const look = g.labelLook ?? {};
          const font = g.labelFont;
          const border = g.labelAt === "border" || g.labelAt === "bottom";
          const x = g.label.x + (look.offset?.[0] ?? 0) * R;
          const y = (border ? g.label.y : g.label.y - R * 0.15) + (look.offset?.[1] ?? 0) * R;
          const halo = look.halo === false ? "none" : (look.halo ?? font?.halo);
          // UPPER unless a lettering style is used (its own letters), or the label says.
          const kase = regionCase(look, !!font);
          const fontSize = R * (border ? 0.24 : g.depth > 0 ? 0.42 : 0.55) * (look.size ?? 1) * labelScale;
          const style: React.CSSProperties = {
            fontSize,
            fill: g.labelColor ?? font?.color ?? g.color,
            ...(font ? { fontFamily: font.family, fontWeight: font.weight } : {}),
            ...(font?.italic ? { fontStyle: "italic" } : {}),
            ...(halo ? { stroke: halo } : {}),
            textTransform:
              kase === "upper"
                ? "uppercase"
                : kase === "title"
                  ? "capitalize"
                  : kase === "lower"
                    ? "lowercase"
                    : "none",
            ...(look.spacing !== undefined ? { letterSpacing: `${look.spacing}em` } : {}),
          };
          const className = ["rpg-hexmap-region-label", border ? "is-border" : "", g.faint ? "is-faint" : ""]
            .filter(Boolean)
            .join(" ");
          const transform = look.rot ? `rotate(${look.rot} ${x} ${y})` : undefined;
          if (look.arc) {
            // Bent: along an arc as long as the name, measured in its font, case and spacing.
            const width = (g.labelEm ?? g.title.length * (kase === "upper" ? 0.84 : 0.62)) * fontSize;
            const bend = arcPath(width, look.arc);
            const pathId = `rpg-hexmap-rlabel-${uid}-${i}`;
            return (
              <g key={`label:${g.name}`} transform={`${transform ?? ""} translate(${x} ${y})`}>
                <path id={pathId} d={bend.d} fill="none" />
                <text className={className} style={style}>
                  <textPath href={`#${pathId}`} startOffset="50%">
                    {g.title}
                  </textPath>
                </text>
              </g>
            );
          }
          return (
            <text key={`label:${g.name}`} x={x} y={y} transform={transform} className={className} style={style}>
              {g.labelLines ? <Lines x={x} lines={g.labelLines} /> : g.title}
            </text>
          );
        })}
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

/** Markers: each image standing on its point, with its name under it. */
function Markers({ layout, labelScale, anchors }: { layout: HexLayout; labelScale: number; anchors?: boolean }) {
  const { R } = layout;
  const uid = React.useId().replace(/:/g, "");
  if (layout.markers.length === 0) return null;
  return (
    <g className="rpg-hexmap-markers">
      {layout.markers.map((m) => (
        <g
          key={m.key}
          className={["rpg-hexmap-marker", m.link ? "is-place" : "", m.faint ? "is-faint" : ""]
            .filter(Boolean)
            .join(" ")}
          data-link={m.link}
        >
          {m.url ? (
            <image href={m.url} x={m.box.x} y={m.box.y} width={m.box.w} height={m.box.h} preserveAspectRatio="none" />
          ) : (
            // No tile for its spec: a plain pin.
            <>
              <line x1={m.x} y1={m.y} x2={m.x} y2={m.box.y + m.box.w / 2} className="rpg-hexmap-marker-plain" />
              <circle cx={m.x} cy={m.box.y + m.box.w / 2} r={m.box.w / 2} className="rpg-hexmap-marker-plain" />
            </>
          )}
          {anchors && <circle cx={m.x} cy={m.y} r={R * 0.05} className="rpg-hexmap-marker-anchor" />}
        </g>
      ))}
      {/* Names after every picture, so a neighbouring marker never hides one. */}
      {layout.markers.map((m, i) => {
        if (!m.text) return null;
        const c = m.caption;
        if (!c) {
          return (
            <text
              key={`${m.key}:name`}
              x={m.x}
              y={m.y + R * 0.2}
              className={m.faint ? "rpg-hexmap-label is-faint" : "rpg-hexmap-label"}
              style={{ fontSize: R * MARKER_CAPTION * labelScale }}
            >
              {m.text}
            </text>
          );
        }
        // A styled caption: its lettering style's letters, where it was put, bent when asked.
        const style: React.CSSProperties = {
          fontSize: c.size * labelScale,
          fontFamily: c.font,
          fontWeight: c.weight,
          ...(c.italic ? { fontStyle: "italic" } : {}),
          ...(c.color ? { fill: c.color } : {}),
          ...(c.halo === false ? { stroke: "none" } : c.halo ? { stroke: c.halo, strokeWidth: c.size * 0.14 } : {}),
          ...(c.case
            ? {
                textTransform:
                  c.case === "upper"
                    ? "uppercase"
                    : c.case === "title"
                      ? "capitalize"
                      : c.case === "lower"
                        ? "lowercase"
                        : "none",
              }
            : {}),
          ...(c.spacing ? { letterSpacing: `${c.spacing}em` } : {}),
        };
        const turn = c.rot ? `rotate(${c.rot} ${c.x} ${c.y})` : "";
        const pathId = `rpg-hexmap-cap-${uid}-${i}`;
        return c.arc ? (
          <g key={`${m.key}:name`} transform={`${turn} translate(${c.x} ${c.y})`}>
            <path id={pathId} d={c.arc} fill="none" />
            <text
              className={m.faint ? "rpg-hexmap-label is-styled is-faint" : "rpg-hexmap-label is-styled"}
              style={style}
            >
              <textPath href={`#${pathId}`} startOffset="50%">
                {m.text}
              </textPath>
            </text>
          </g>
        ) : (
          <text
            key={`${m.key}:name`}
            x={c.x}
            y={c.y}
            transform={turn || undefined}
            className={m.faint ? "rpg-hexmap-label is-styled is-faint" : "rpg-hexmap-label is-styled"}
            style={style}
          >
            {c.lines ? <Lines x={c.x} lines={c.lines} /> : m.text}
          </text>
        );
      })}
    </g>
  );
}

/** Labels: each banner's pieces in its own pixels, turned and scaled onto the map, its text centred in its box.
 *  Lettering is the text alone, in its style's font, bent along its arc when it has one. */
function Banners({ layout }: { layout: HexLayout }) {
  const uid = React.useId().replace(/:/g, "");
  if (layout.banners.length === 0) return null;
  return (
    <g className="rpg-hexmap-banners">
      {layout.banners.map((b, i) => {
        const l = b.lettering;
        const style: React.CSSProperties = { fontSize: b.text.size, fontFamily: b.text.font, fill: b.text.color };
        if (l) {
          style.fontWeight = l.weight;
          if (l.italic) style.fontStyle = "italic";
          if (l.spacing) style.letterSpacing = `${l.spacing}em`;
          if (l.halo) {
            style.stroke = l.halo;
            style.strokeWidth = b.text.size * 0.14;
          }
        }
        const pathId = `rpg-hexmap-arc-${uid}-${i}`;
        return (
          <g
            key={b.key}
            className={[
              "rpg-hexmap-banner",
              l ? "is-lettering" : "",
              b.link ? "is-place" : "",
              b.faint ? "is-faint" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-link={b.link}
            transform={`translate(${b.cx} ${b.cy}) rotate(${b.rot}) scale(${b.scale}) translate(${-b.w / 2} ${-b.h / 2})`}
          >
            {l ? (
              // A box to point at: letters alone leave holes between them.
              <rect width={b.w} height={b.h} className="rpg-hexmap-lettering-hit" />
            ) : b.pieces.length ? (
              b.pieces.map((p, j) => (
                <image key={j} href={p.url} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="none" />
              ))
            ) : (
              <rect width={b.w} height={b.h} rx={b.h * 0.2} className="rpg-hexmap-banner-plain" />
            )}
            {l?.arc ? (
              <>
                <path id={pathId} d={l.arc} transform={`translate(${b.text.x} ${b.text.y})`} fill="none" />
                <text className="rpg-hexmap-banner-text" style={style}>
                  <textPath href={`#${pathId}`} startOffset="50%">
                    {b.text.value}
                  </textPath>
                </text>
              </>
            ) : (
              <text x={b.text.x} y={b.text.y} className="rpg-hexmap-banner-text" style={style}>
                {l?.lines ? <Lines x={b.text.x} lines={l.lines} /> : b.text.value}
              </text>
            )}
          </g>
        );
      })}
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
                    {g?.title || name}
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

/** A map's tiles as a group of another map's drawing (a detail map's parent underneath). */
export function HexLayoutGroup({ layout }: { layout: HexLayout }) {
  const uid = React.useId().replace(/:/g, "");
  return (
    <g>
      <HexDefs
        clipId={`rpg-hexmap-clip-${uid}`}
        hatchId={`rpg-hexmap-hatch-${uid}`}
        R={layout.R}
        filters={layout.filters}
      />
      <Tiles layout={layout} clipId={`rpg-hexmap-clip-${uid}`} hatchId={`rpg-hexmap-hatch-${uid}`} />
    </g>
  );
}

/** The map without its frame or interaction — for previews (settings); `anchors` dots where each marker stands. */
export function HexMapStatic({
  layout,
  labelScale = 1,
  anchors,
  view,
  overlay,
  className,
}: {
  layout: HexLayout;
  labelScale?: number;
  anchors?: boolean;
  /** The part of the map shown (a minimap's window on it); the whole map if unset. */
  view?: ViewBox;
  /** Drawn over the map (trails, a step's outline). */
  overlay?: React.ReactNode;
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, "");
  const b = view ?? layout.bounds;
  return (
    <svg
      viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
      className={className ?? "rpg-hexmap-static"}
      preserveAspectRatio={view ? "xMidYMid slice" : undefined}
    >
      <HexDefs
        clipId={`rpg-hexmap-clip-${uid}`}
        hatchId={`rpg-hexmap-hatch-${uid}`}
        R={layout.R}
        filters={layout.filters}
      />
      <Tiles layout={layout} clipId={`rpg-hexmap-clip-${uid}`} hatchId={`rpg-hexmap-hatch-${uid}`} />
      <Regions layout={layout} labelScale={labelScale} faintFilter={`rpg-hexmap-clip-${uid}-faint`} />
      <Labels layout={layout} coords="off" labelScale={labelScale} />
      {overlay}
      <Markers layout={layout} labelScale={labelScale} anchors={anchors} />
      <Banners layout={layout} />
    </svg>
  );
}

function HexDefs({
  clipId,
  hatchId,
  R,
  filters = [],
}: {
  clipId: string;
  hatchId: string;
  R: number;
  filters?: DrawFilter[];
}) {
  return (
    <defs>
      {filters.map((f) => (
        <filter key={f.key} id={`${clipId}-f-${f.key}`} colorInterpolationFilters="sRGB">
          {f.hue !== 0 && <feColorMatrix type="hueRotate" values={String(f.hue)} />}
          {f.sat !== 1 && <feColorMatrix type="saturate" values={String(f.sat)} />}
          {f.bright !== 1 && (
            <feComponentTransfer>
              <feFuncR type="linear" slope={f.bright} />
              <feFuncG type="linear" slope={f.bright} />
              <feFuncB type="linear" slope={f.bright} />
            </feComponentTransfer>
          )}
        </filter>
      ))}
      {/* A faint neighbour's tiles: greyer and darker, still opaque (CSS filters don't reach SVG images). */}
      <filter id={`${clipId}-faint`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0.45" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="0.6" />
          <feFuncG type="linear" slope="0.6" />
          <feFuncB type="linear" slope="0.6" />
        </feComponentTransfer>
      </filter>
      <clipPath id={clipId} clipPathUnits="objectBoundingBox">
        <polygon points="0,0.5 0.25,0 0.75,0 1,0.5 0.75,1 0.25,1" />
      </clipPath>
      <pattern id={hatchId} width={R / 4} height={R / 4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2={R / 4} className="rpg-hexmap-hatch" strokeWidth={R / 16} />
      </pattern>
    </defs>
  );
}

/** Empty hexes all over an area, as one tiled pattern (a level can have thousands under its parent). */
function FineGrid({ area, R, id }: { area: ViewBox; R: number; id: string }) {
  const h = Math.sqrt(3) * R;
  const centres: Array<[number, number]> = [
    [0, 0],
    [3 * R, 0],
    [0, h],
    [3 * R, h],
    [1.5 * R, h / 2],
  ];
  return (
    <g className="rpg-hexmap-fine-grid">
      <defs>
        <pattern id={id} width={3 * R} height={h} patternUnits="userSpaceOnUse">
          {centres.map(([x, y]) => (
            <polygon key={`${x},${y}`} points={hexPoints(x, y, R)} fill="none" strokeWidth={R / 24} />
          ))}
        </pattern>
      </defs>
      <rect x={area.x} y={area.y} width={area.w} height={area.h} fill={`url(#${id})`} />
    </g>
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
  editing,
  toolbar,
  sidebar,
  backdrop,
  overlay,
  overTiles,
  hoverOverlay,
  onEdit,
  play,
  hud,
  modeSwitch,
  float,
  shown,
  crumbs,
  frame,
  initialView,
  startZoom,
  onViewChange,
  levels,
  showView,
  gridArea,
}: HexMapViewProps) {
  const uid = React.useId().replace(/:/g, "");
  const clipId = `rpg-hexmap-clip-${uid}`;
  const hatchId = `rpg-hexmap-hatch-${uid}`;
  const R = layout.R;
  const ghosts = editing?.ghosts;
  const hasHud = !!hud;
  // In paint mode the map's room takes in the empty hexes around it.
  const base = React.useMemo(() => {
    const b = layout.bounds;
    // Play's controls run along the foot: room for them under the map.
    const foot = hasHud ? R * 1.2 : 0;
    if (!ghosts?.length && !frame && !foot) return b;
    let [x0, y0, x1, y1] = [b.x, b.y, b.x + b.w, b.y + b.h + foot];
    if (frame) {
      x0 = Math.min(x0, frame.x);
      y0 = Math.min(y0, frame.y);
      x1 = Math.max(x1, frame.x + frame.w);
      y1 = Math.max(y1, frame.y + frame.h);
    }
    const halfH = (Math.sqrt(3) / 2) * R;
    for (const g of ghosts ?? []) {
      const c = hexCenter(g.q, g.r, R);
      x0 = Math.min(x0, c.x - R);
      x1 = Math.max(x1, c.x + R);
      y0 = Math.min(y0, c.y - halfH);
      y1 = Math.max(y1, c.y + halfH);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [layout.bounds, ghosts, frame, R, hasHud]);
  /** The fitted map, or closer to it as the block's `view:` asks. */
  const startBox = React.useMemo((): ViewBox => {
    if (!startZoom || startZoom.zoom <= 1) return base;
    const w = base.w / startZoom.zoom;
    const h = base.h / startZoom.zoom;
    const c = startZoom.at
      ? hexCenter(startZoom.at[0], startZoom.at[1], R)
      : { x: base.x + base.w / 2, y: base.y + base.h / 2 };
    return { x: c.x - w / 2, y: c.y - h / 2, w, h };
  }, [base, startZoom?.zoom, startZoom?.at?.[0], startZoom?.at?.[1], R]);
  const [view, setView] = React.useState<ViewBox>(initialView ?? startBox);
  const [hovered, setHovered] = React.useState<HexInfo | null>(null);
  // A label linked to a note, under the pointer: it wins over the hex below it.
  const [overBanner, setOverBanner] = React.useState<string | null>(null);
  const [tip, setTip] = React.useState<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ x: number; y: number; view: ViewBox; moved: boolean } | null>(null);
  const painting = React.useRef(false);
  const playing = React.useRef(false);
  // Painting: the grid cell under the pointer, drawn or not.
  const [cell, setCell] = React.useState<Axial | null>(null);
  const space = React.useRef(false);
  const editingRef = React.useRef(editing);
  editingRef.current = editing;

  // A new map fits the view, except while painting it.
  // A new map (or level): what was under the pointer is gone.
  React.useEffect(() => {
    setHovered(null);
    setTip(null);
  }, [layout]);

  // A level switch's view stands: the new level's map doesn't refit it.
  const shownView = React.useRef(0);
  const switching = React.useRef(false);
  React.useEffect(() => {
    if (!editingRef.current && !shownView.current) setView(startBox);
  }, [layout, startBox]);
  React.useEffect(() => {
    if (!showView) return;
    shownView.current = showView.n;
    switching.current = false;
    stopGlide();
    setView(showView.box);
  }, [showView?.n]);
  React.useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  // Space held while painting: drags pan.
  React.useEffect(() => {
    if (!editing && !play) return;
    const down = (e: KeyboardEvent) => {
      if (e.key !== " " || (e.target as HTMLElement).closest?.("input, textarea, [contenteditable]")) return;
      if (viewportRef.current?.matches(":hover")) e.preventDefault();
      space.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") space.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [editing, play]);

  const toSvg = React.useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(ctm.inverse());
  }, []);

  const viewRef = React.useRef(view);
  viewRef.current = view;
  // A button's zoom eases to its view; a gesture (drag, wheel) stops it where it is.
  const glide = React.useRef<{ frame: number; to: ViewBox; done: number } | null>(null);
  const stopGlide = React.useCallback(() => {
    if (glide.current) {
      cancelAnimationFrame(glide.current.frame);
      window.clearTimeout(glide.current.done);
    }
    glide.current = null;
  }, []);
  const glideTo = React.useCallback(
    (to: ViewBox) => {
      stopGlide();
      const from = viewRef.current;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 180);
        const k = 1 - Math.pow(1 - t, 3);
        setView({
          x: from.x + (to.x - from.x) * k,
          y: from.y + (to.y - from.y) * k,
          w: from.w + (to.w - from.w) * k,
          h: from.h + (to.h - from.h) * k,
        });
        if (t < 1 && glide.current) glide.current.frame = requestAnimationFrame(step);
        else stopGlide();
      };
      // Frames held back (a hidden window): it still gets there.
      const done = window.setTimeout(() => {
        stopGlide();
        setView(to);
      }, 400);
      glide.current = { frame: requestAnimationFrame(step), to, done };
    },
    [stopGlide]
  );
  React.useEffect(() => stopGlide, [stopGlide]);
  const zoomAt = React.useCallback(
    (factor: number, cx?: number, cy?: number, ease = false) => {
      // Waiting for the level asked for: the gesture's further steps are dropped.
      if (switching.current) return;
      // Pressed again mid-glide: from where the last press was going.
      const v = (ease && glide.current?.to) || viewRef.current;
      if (!ease) stopGlide();
      const px = cx ?? v.x + v.w / 2;
      const py = cy ?? v.y + v.h / 2;
      const next = { x: px - (px - v.x) / factor, y: py - (py - v.y) / factor, w: v.w / factor, h: v.h / factor };
      const el = viewportRef.current;
      if (levels && el && el.clientWidth && el.clientHeight) {
        const hexPx = 2 * R * Math.min(el.clientWidth / next.w, el.clientHeight / next.h);
        const dir =
          factor > 1 && levels.canIn && hexPx > LEVEL_IN_PX
            ? 1
            : factor < 1 && levels.canOut && hexPx < LEVEL_OUT_PX
              ? -1
              : 0;
        if (dir) {
          stopGlide();
          switching.current = true;
          // Should the level not come, zooming works again.
          window.setTimeout(() => (switching.current = false), 1500);
          levels.onLevel(dir, next);
          return;
        }
        if (hexPx < HEX_PX_MIN || hexPx > HEX_PX_MAX) return;
      } else {
        const zoom = base.w / next.w;
        if (zoom < MIN_ZOOM || zoom > MAX_ZOOM) return;
      }
      if (ease) glideTo(next);
      else setView(next);
    },
    [base, levels, R, glideTo, stopGlide]
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

  /** Keep getting the pointer's moves outside the map; a pointer the browser doesn't track can't be captured. */
  const capture = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Not an active pointer (a scripted one): moves still arrive while it's over the map.
    }
  };

  /** The hex a press means: a drawn (maybe raised) hex under it, else the grid cell. */
  const paintPointer = (e: React.PointerEvent, phase: PaintPointer["phase"]): PaintPointer | null => {
    const p = toSvg(e.clientX, e.clientY);
    if (!p) return null;
    const drawn = hexAt(layout, p.x, p.y);
    const hex = drawn ? { q: drawn.q, r: drawn.r } : pixelToHex(p.x, p.y, R);
    return { phase, button: e.button, alt: e.altKey, shift: e.shiftKey, hex, point: pixelToAxial(p.x, p.y, R) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editing && play && !space.current && (e.button === 0 || e.button === 2)) {
      const p = paintPointer(e, "down");
      if (p && play.claims(p)) {
        e.preventDefault();
        capture(e);
        playing.current = true;
        play.onPointer(p);
        return;
      }
    }
    if (editing && !editing.pan && !space.current && (e.button === 0 || e.button === 2)) {
      e.preventDefault();
      capture(e);
      painting.current = true;
      const p = paintPointer(e, "down");
      if (p) editing.onPointer(p);
      return;
    }
    if (e.button !== 0 && !(editing && e.button === 1)) return;
    if (editing) e.preventDefault();
    stopGlide();
    drag.current = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (playing.current && play) {
      const p = paintPointer(e, "move");
      if (p) play.onPointer(p);
    }
    if (painting.current && editing) {
      const p = paintPointer(e, "move");
      if (p) editing.onPointer({ ...p, button: e.buttons & 2 ? 2 : 0 });
    }
    const d = drag.current;
    const ctm = svgRef.current?.getScreenCTM();
    if (d && ctm) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 3) {
        d.moved = true;
        capture(e);
      }
      if (d.moved) {
        setView({ ...d.view, x: d.view.x - dx / ctm.a, y: d.view.y - dy / ctm.d });
        setTip(null);
        return;
      }
    }
    const bannerLink = (e.target as Element).closest?.("[data-link]")?.getAttribute("data-link") ?? null;
    if (bannerLink !== overBanner) {
      setOverBanner(bannerLink);
      if (bannerLink && onHoverLink && viewportRef.current) onHoverLink(bannerLink, e.nativeEvent, viewportRef.current);
    }
    const p = toSvg(e.clientX, e.clientY);
    if (!p) return;
    const hex = hexAt(layout, p.x, p.y);
    if (editing) {
      const c = pixelToHex(p.x, p.y, R);
      if (!cell || c.q !== cell.q || c.r !== cell.r) setCell(c);
    }
    if (hex !== hovered) {
      setHovered(hex);
      if (hex?.link && onHoverLink && viewportRef.current) onHoverLink(hex.link, e.nativeEvent, viewportRef.current);
    }
    const rect = viewportRef.current?.getBoundingClientRect();
    setTip(hex && rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (playing.current) {
      playing.current = false;
      const p = paintPointer(e, "up");
      if (p && play) play.onPointer(p);
      return;
    }
    if (painting.current) {
      painting.current = false;
      const p = paintPointer(e, "up");
      if (p && editing) editing.onPointer(p);
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (d?.moved || editing) return;
    // What's under the press first: a mark drawn on hover may not have had a move over it yet.
    const under = (e.target as Element).closest?.("[data-link]")?.getAttribute("data-link");
    const link = under ?? overBanner ?? hovered?.link;
    if (link && onOpenLink) onOpenLink(link, e.nativeEvent);
  };

  const onPointerLeave = () => {
    if (drag.current?.moved) return;
    setHovered(null);
    setOverBanner(null);
    setTip(null);
    setCell(null);
  };

  const tiles = React.useMemo(
    () => <Tiles layout={layout} clipId={clipId} hatchId={hatchId} gridLines={gridLines} />,
    [layout, clipId, hatchId, gridLines]
  );
  const labels = React.useMemo(
    () => (
      <>
        {shown?.regions !== false && (
          <Regions layout={layout} labelScale={labelScale} faintFilter={`${clipId}-faint`} />
        )}
        <Labels layout={layout} coords={coords} labelScale={labelScale} />
        {shown?.points !== false && (
          <>
            <Markers layout={layout} labelScale={labelScale} />
            <Banners layout={layout} />
          </>
        )}
      </>
    ),
    [layout, coords, labelScale, shown?.points, shown?.regions]
  );
  const viewport = (
    <div
      ref={viewportRef}
      className={`rpg-hexmap-viewport${!editing && (hovered?.link || overBanner) ? " is-over-place" : ""}${editing?.pan ? " is-panning" : ""}`}
      // Small maps keep their hexes a readable size instead of filling the note;
      // painting, the map takes the room it's given.
      style={
        editing
          ? { height: "var(--rpg-hexpaint-h)" }
          : {
              aspectRatio: `${base.w} / ${base.h}`,
              maxWidth: `${Math.round(base.w * 1.25)}px`,
              maxHeight: `${maxHeight}vh`,
            }
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onDoubleClick={() => !editing && glideTo(base)}
      onContextMenu={(e) => editing && e.preventDefault()}
    >
      <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet">
        <HexDefs clipId={clipId} hatchId={hatchId} R={R} filters={layout.filters} />
        {backdrop}
        {gridArea && <FineGrid area={gridArea} R={R} id={`${clipId}-fine`} />}
        {ghosts && (
          <g className="rpg-hexmap-ghosts">
            {ghosts.map((g) => {
              const c = hexCenter(g.q, g.r, R);
              return <polygon key={`${g.q},${g.r}`} points={hexPoints(c.x, c.y, R)} className="rpg-hexmap-ghost" />;
            })}
          </g>
        )}
        {tiles}
        {overTiles}
        {labels}
        {overlay}
        {hovered && (
          <polygon points={hexPoints(hovered.cx, hovered.cy, R)} className="rpg-hexmap-hover" strokeWidth={R / 14} />
        )}
        {hovered && !drag.current?.moved && hoverOverlay?.(hovered)}
        {editing && !hovered && cell && (
          <polygon
            points={hexPoints(hexCenter(cell.q, cell.r, R).x, hexCenter(cell.q, cell.r, R).y, R)}
            className="rpg-hexmap-hover is-empty"
            strokeWidth={R / 14}
          />
        )}
      </svg>
      <menu className="rpg-hexmap-controls">
        {modeSwitch && !editing && <li className="rpg-hexmap-mode-switch">{modeSwitch}</li>}
        {onEdit && !modeSwitch && !editing && (
          <li>
            <button
              type="button"
              aria-label="Paint the map"
              title="Paint the map"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onEdit}
            >
              <LucideIcon name="paintbrush" size={13} />
            </button>
          </li>
        )}
        {shown && (
          <>
            <li>
              <button
                type="button"
                aria-label={shown.points ? "Hide markers and labels" : "Show markers and labels"}
                title={shown.points ? "Hide markers and labels" : "Show markers and labels"}
                className={shown.points ? undefined : "is-on"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={shown.onPoints}
              >
                <LucideIcon name={shown.points ? "map-pin" : "map-pin-off"} size={13} />
              </button>
            </li>
            <li>
              <button
                type="button"
                aria-label={shown.regions ? "Hide region outlines" : "Show region outlines"}
                title={shown.regions ? "Hide region outlines" : "Show region outlines"}
                className={shown.regions ? undefined : "is-on"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={shown.onRegions}
              >
                <LucideIcon name={shown.regions ? "land-plot" : "square-dashed-bottom"} size={13} />
              </button>
            </li>
          </>
        )}
        {float && (
          <li>
            <button
              type="button"
              aria-label={float.open ? "Put the map back in the note (Esc)" : "Open the map in a window"}
              title={float.open ? "Put the map back in the note (Esc)" : "Open the map in a window"}
              className={float.open ? "is-on" : undefined}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={float.onToggle}
            >
              <LucideIcon name={float.open ? "minimize-2" : "app-window"} size={13} />
            </button>
          </li>
        )}
      </menu>
      <menu className="rpg-hexmap-zoom" aria-label="Zoom">
        <li>
          <button
            type="button"
            aria-label="Zoom in"
            title={levels?.canIn ? "Zoom in (further shows the level below)" : "Zoom in"}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={() => zoomAt(1.5, undefined, undefined, true)}
          >
            <LucideIcon name="plus" size={14} />
          </button>
        </li>
        <li>
          <button
            type="button"
            aria-label="Zoom out"
            title={levels?.canOut ? "Zoom out (further shows the level above)" : "Zoom out"}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={() => zoomAt(1 / 1.5, undefined, undefined, true)}
          >
            <LucideIcon name="minus" size={14} />
          </button>
        </li>
        <li>
          <button
            type="button"
            aria-label="Fit map"
            title="Fit the map (or double-click it)"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={() => glideTo(base)}
          >
            <LucideIcon name="scan" size={14} />
          </button>
        </li>
      </menu>
      {hud}
      {hovered && tip && coords !== "off" && !editing && (
        <div className="rpg-hexmap-tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <Tooltip hex={hovered} scale={scale} regions={layout.regions} />
        </div>
      )}
    </div>
  );

  // What's under the pointer while painting, said in the status line.
  const under = hovered
    ? `(${hovered.q}, ${hovered.r})${hovered.height ? ` · ${hovered.height} m` : ""}${
        hovered.label || hovered.link ? ` · ${hovered.label ?? hovered.link}` : ""
      } · ${hovered.specs
        .filter((sp) => sp.spec)
        .map((sp) => sp.spec)
        .join(", ")}`
    : cell
      ? `(${cell.q}, ${cell.r}) · empty`
      : "";

  return (
    <figure
      className={editing ? "rpg-hexmap is-editing" : "rpg-hexmap"}
      style={editing ? ({ "--rpg-hexpaint-h": `${Math.round(maxHeight * 0.85)}vh` } as React.CSSProperties) : undefined}
    >
      {crumbs}
      {editing ? (
        <>
          {toolbar}
          <div className="rpg-hexpaint-body">
            {viewport}
            {sidebar}
          </div>
          <footer className="rpg-hexpaint-status">
            <span className="rpg-hexpaint-under">{under}</span>
            {editing.status && <output>{editing.status}</output>}
          </footer>
        </>
      ) : (
        viewport
      )}
      {title && !editing && <figcaption>{title}</figcaption>}
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
