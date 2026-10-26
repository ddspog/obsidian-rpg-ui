/**
 * A square battle map, drawn: terrain, the grid and its chessboard labels, and
 * the tokens on it — with what a turn adds on top (a move's path, an attack's
 * line). Shared by the `rpg map` block and the session log's map pane.
 */

import * as React from "react";
import {
  colLetters,
  fitToImage,
  squareName,
  terrainColor,
  type Square,
  type SquareMap,
} from "../../domains/battlemap/square-map";

export interface MapToken {
  /** As the log writes it (`Talon`, `Fat [[Kobold, A]]`). */
  name: string;
  at: Square;
  side: "pc" | "foe" | "npc";
  hp?: number;
  max?: number;
  /** Out of the fight (dead, fled, at 0 HP). */
  down?: boolean;
  conditions?: string[];
  /** The creature acting on the turn shown. */
  active?: boolean;
  /** An emoji drawn large on the token (`🏹`), its initials small below. */
  icon?: string;
  /** Knocked out — at 0 HP — on the turn shown. */
  ko?: boolean;
  /** A picture drawn in the disc (`token_image:` in its note), as a URL. */
  image?: string;
}

export interface MapArrow {
  /** `move` before the action, `after` a move made after it, `attack` a strike. */
  kind: "move" | "after" | "attack";
  /** The squares it passes through, in order (two or more). */
  path: Square[];
  /** An attack's outcome, once rolled: a hit (with the damage it did) or a miss. */
  result?: "hit" | "miss";
  /** What to say at its end (`−6`, `miss`). */
  note?: string;
}

/** A window onto the map, in squares (fractions allowed): from column `col`,
 *  row `row`, `cols` wide and `rows` tall — any shape; past the map's edge
 *  it shows nothing. */
export interface MapView {
  col: number;
  row: number;
  cols: number;
  rows: number;
  /** Follow the view at once, with no glide (a hand panning or zooming it). */
  instant?: boolean;
}

interface SquareMapViewProps {
  map: SquareMap;
  tokens?: MapToken[];
  arrows?: MapArrow[];
  /** Pixels per square. */
  cell?: number;
  /** Show only this part of the map, eased into as it changes. */
  view?: MapView;
  className?: string;
  /** Tokens can be picked (the Setup frame): called with the token's name. */
  onTokenClick?: (name: string) => void;
  /** Squares can be picked (placing a token): called with the square. */
  onSquareClick?: (square: Square) => void;
  /** The picked token, drawn picked. */
  selected?: string;
  /** Right-click on a token: called with its name and the click. */
  onTokenContextMenu?: (name: string, event: MouseEvent) => void;
  /** Tokens can be dragged to a square (editing a map's start): called with the token's name and where it was dropped. */
  onTokenMove?: (name: string, to: Square) => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Glide from one box to the next (straight there if motion is unwanted). */
function useEasedBox(target: Box, instant = false): Box {
  const [box, setBox] = React.useState(target);
  const current = React.useRef(target);
  const key = `${target.x},${target.y},${target.w},${target.h}`;
  React.useEffect(() => {
    const from = current.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || instant) {
      current.current = target;
      setBox(target);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 380);
      const e = 1 - Math.pow(1 - t, 3);
      const next = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      };
      current.current = next;
      setBox(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key, instant]);
  return box;
}

/** A name as shown: links read as their text (`Fat [[Kobold, A]]` → `Fat Kobold, A`). */
export const shownName = (name: string): string =>
  name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();

/** Up to two initials for a token: `Talon` → `Ta`, `Fat Kobold, A` → `FA`. */
function initials(name: string): string {
  const words = shownName(name).replace(/[,]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const GUTTER = 14;

/** Pictures' sizes, kept once known: a map drawn again (the Log opened, the
 *  page re-rendered) shows at once instead of waiting for its picture. */
const imageSizes = new Map<string, { width: number; height: number }>();

/** A picture's own size, once it has loaded (null until then). */
function useImageSize(url: string | undefined): { width: number; height: number } | null {
  const [size, setSize] = React.useState(() => (url ? (imageSizes.get(url) ?? null) : null));
  React.useEffect(() => {
    const known = url ? imageSizes.get(url) : undefined;
    setSize(known ?? null);
    if (!url || known) return;
    const img = new Image();
    img.onload = () => {
      const found = { width: img.naturalWidth, height: img.naturalHeight };
      imageSizes.set(url, found);
      setSize(found);
    };
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [url]);
  return size;
}

export function SquareMapView({
  map: written,
  tokens = [],
  arrows = [],
  cell = 28,
  view,
  className,
  onTokenClick,
  onSquareClick,
  selected,
  onTokenContextMenu,
  onTokenMove,
}: SquareMapViewProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9-]/g, "");
  const picture = written.image?.url ? written.image : undefined;
  const natural = useImageSize(picture?.url);
  const map = picture && natural ? fitToImage(written, natural.width, natural.height) : written;
  // The window shown: the whole map with its labels' gutter, or the view (its
  // labels then drawn over its edges).
  const fullW = GUTTER + map.cols * cell;
  const fullH = GUTTER + map.rows * cell;
  const box = useEasedBox(
    view && map.cols > 0
      ? { x: GUTTER + view.col * cell, y: GUTTER + view.row * cell, w: view.cols * cell, h: view.rows * cell }
      : { x: 0, y: 0, w: fullW, h: fullH },
    view?.instant
  );
  // Zoomed, the labels are sized from the map's width on screen, so they read
  // the same however close the view is (and however small the pane).
  const svgRef = React.useRef<SVGSVGElement>(null);
  // Dragging a token (editing a map's start): what is held, and where it is now.
  const press = React.useRef<{ name: string; id: number; x: number; y: number; moved: boolean } | null>(null);
  const [drag, setDrag] = React.useState<{ name: string; x: number; y: number } | null>(null);
  const suppressClick = React.useRef(false);
  const [screenW, setScreenW] = React.useState(0);
  React.useEffect(() => {
    const el = svgRef.current;
    if (!el || !view) return;
    const ro = new ResizeObserver(() => setScreenW(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view != null]);
  if (picture && map.cols === 0) return null;
  const unitsPerPx = view && screenW > 0 ? box.w / screenW : 0;
  // The labels' strip and size: on screen, 13px and 9px when zoomed; else the gutter.
  const gutter = unitsPerPx ? 13 * unitsPerPx : GUTTER;
  const labelSize = unitsPerPx ? 9 * unitsPerPx : 7;
  // The picture, scaled so its squares are this map's squares.
  const scale = picture ? cell / picture.cell : 1;

  const width = GUTTER + map.cols * cell;
  const height = GUTTER + map.rows * cell;
  const center = (sq: Square) => ({ x: GUTTER + sq.col * cell + cell / 2, y: GUTTER + sq.row * cell + cell / 2 });

  // Dragging a token: it follows the pointer, and a square under it shows where it will land.
  const toMap = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  };
  const squareAt = (pt: { x: number; y: number }): Square => ({
    col: Math.max(0, Math.min(map.cols - 1, Math.floor((pt.x - GUTTER) / cell))),
    row: Math.max(0, Math.min(map.rows - 1, Math.floor((pt.y - GUTTER) / cell))),
  });
  const dropSquare = drag ? squareAt(drag) : null;
  const endDrag = (e: React.PointerEvent, commit: boolean) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (svgRef.current?.hasPointerCapture(p.id)) svgRef.current.releasePointerCapture(p.id);
    if (p.moved) {
      const pt = toMap(e);
      if (commit && pt) onTokenMove?.(p.name, squareAt(pt));
      // The click that follows a drag is not a pick.
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
    }
    setDrag(null);
  };

  return (
    <svg
      ref={svgRef}
      className={`rpg-battlemap${picture ? " has-image" : ""}${onSquareClick ? " is-placing" : ""}${onTokenMove ? " is-editing" : ""}${className ? ` ${className}` : ""}`}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      {...(onTokenMove
        ? {
            onPointerMove: (e: React.PointerEvent) => {
              const p = press.current;
              if (!p || e.pointerId !== p.id) return;
              if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
              if (!p.moved) {
                p.moved = true;
                svgRef.current?.setPointerCapture(e.pointerId);
              }
              const pt = toMap(e);
              if (pt) setDrag({ name: p.name, x: pt.x, y: pt.y });
            },
            onPointerUp: (e: React.PointerEvent) => endDrag(e, true),
            onPointerCancel: (e: React.PointerEvent) => endDrag(e, false),
          }
        : {})}
      role="img"
      aria-label={map.title ? `Battle map: ${map.title}` : "Battle map"}
    >
      <defs>
        {/* One head per kind: a marker doesn't take its line's colour. */}
        {(["move", "after", "attack", "miss"] as const).map((kind) => (
          <marker
            key={kind}
            id={`rpg-bm-arrow-${kind}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" className={`rpg-battlemap-arrowhead is-${kind}`} />
          </marker>
        ))}
      </defs>

      {/* The picture the map is played on, cut to its squares */}
      {picture && natural && (
        <>
          <clipPath id={`rpg-bm-clip-${map.cols}x${map.rows}-${cell}`}>
            <rect x={GUTTER} y={GUTTER} width={map.cols * cell} height={map.rows * cell} />
          </clipPath>
          <image
            href={picture.url}
            x={GUTTER - picture.offsetX * scale}
            y={GUTTER - picture.offsetY * scale}
            width={natural.width * scale}
            height={natural.height * scale}
            preserveAspectRatio="none"
            clipPath={`url(#rpg-bm-clip-${map.cols}x${map.rows}-${cell})`}
          />
        </>
      )}

      {/* Terrain (over a picture, only the squares' names and rules — no paint) */}
      <g className="rpg-battlemap-terrain">
        {map.cells.map((row, r) =>
          row.map((key, c) => {
            const t = map.legend[key];
            return (
              <rect
                key={`${c}-${r}`}
                x={GUTTER + c * cell}
                y={GUTTER + r * cell}
                width={cell}
                height={cell}
                fill={picture ? "transparent" : terrainColor(t, key)}
                {...(onSquareClick ? { onClick: () => onSquareClick({ col: c, row: r }) } : {})}
                className={[t?.blocks && "is-blocking", t?.difficult && "is-difficult", t?.cover && "has-cover"]
                  .filter(Boolean)
                  .join(" ")}
              >
                <title>{`${squareName({ col: c, row: r })}${t?.terrain ? ` — ${t.terrain}` : ""}${t?.cover ? `, ${t.cover} cover` : ""}${t?.difficult ? ", difficult" : ""}`}</title>
              </rect>
            );
          })
        )}
      </g>

      {/* Difficult ground and cover, marked on the square */}
      <g className="rpg-battlemap-marks" aria-hidden="true">
        {map.cells.map((row, r) =>
          row.map((key, c) => {
            const t = map.legend[key];
            const x = GUTTER + c * cell;
            const y = GUTTER + r * cell;
            return (
              <React.Fragment key={`m${c}-${r}`}>
                {t?.difficult && (
                  <path d={`M${x + 4} ${y + cell - 4} L${x + cell - 4} ${y + 4}`} className="rpg-battlemap-difficult" />
                )}
                {t?.cover && <circle cx={x + cell - 6} cy={y + 6} r={2.5} className="rpg-battlemap-cover" />}
                {t?.label && (
                  <text x={x + cell / 2} y={y + cell / 2} className="rpg-battlemap-label">
                    {t.label}
                  </text>
                )}
              </React.Fragment>
            );
          })
        )}
      </g>

      {/* Grid lines and chessboard labels */}
      <g className="rpg-battlemap-grid" aria-hidden="true">
        {Array.from({ length: map.cols + 1 }, (_, c) => (
          <line key={`v${c}`} x1={GUTTER + c * cell} y1={GUTTER} x2={GUTTER + c * cell} y2={height} />
        ))}
        {Array.from({ length: map.rows + 1 }, (_, r) => (
          <line key={`h${r}`} x1={GUTTER} y1={GUTTER + r * cell} x2={width} y2={GUTTER + r * cell} />
        ))}
      </g>

      {/* Where a dragged token will land */}
      {dropSquare && (
        <rect
          className="rpg-battlemap-drop"
          x={GUTTER + dropSquare.col * cell}
          y={GUTTER + dropSquare.row * cell}
          width={cell}
          height={cell}
        />
      )}

      {/* Tokens */}
      <g className="rpg-battlemap-tokens">
        {tokens.map((t, ti) => {
          const dragging = drag?.name === t.name;
          const { x, y } = dragging && drag ? drag : center(t.at);
          const r = cell * 0.4;
          const frac = t.hp != null && t.max ? Math.max(0, Math.min(1, t.hp / t.max)) : null;
          const ring = 2 * Math.PI * (r + 1.5);
          return (
            <g
              key={t.name}
              className={`rpg-battlemap-token is-${t.side}${dragging ? " is-dragging" : ""}${t.down ? " is-down" : ""}${t.active ? " is-active" : ""}${t.ko ? " is-ko" : ""}${
                selected === t.name ? " is-selected" : ""
              }${onTokenClick ? " is-pickable" : ""}`}
              transform={`translate(${x} ${y})`}
              {...(onTokenMove
                ? {
                    onPointerDown: (e: React.PointerEvent) => {
                      if (e.button !== 0) return;
                      press.current = { name: t.name, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
                    },
                  }
                : {})}
              {...(onTokenContextMenu
                ? {
                    onContextMenu: (e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTokenContextMenu(t.name, e.nativeEvent);
                    },
                  }
                : {})}
              {...(onTokenClick
                ? {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": `${shownName(t.name)} — ${squareName(t.at)}`,
                    "aria-pressed": selected === t.name,
                    onClick: (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (suppressClick.current) return;
                      onTokenClick(t.name);
                    },
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onTokenClick(t.name);
                      }
                    },
                  }
                : {})}
            >
              <title>
                {[
                  `${shownName(t.name)} — ${squareName(t.at)}`,
                  t.hp != null ? `HP ${t.hp}${t.max != null ? `/${t.max}` : ""}` : "",
                  ...(t.conditions ?? []),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </title>
              {onTokenMove && <circle r={cell * 0.75} className="rpg-battlemap-token-hit" />}
              <circle r={r} className="rpg-battlemap-token-disc" />
              {frac != null && (
                <circle
                  r={r + 1.5}
                  className="rpg-battlemap-token-hp"
                  strokeDasharray={`${ring * frac} ${ring}`}
                  transform="rotate(-90)"
                />
              )}
              {t.image ? (
                <>
                  <clipPath id={`rpg-bm-token-${uid}-${ti}`}>
                    <circle r={r - 0.6} />
                  </clipPath>
                  <image
                    className="rpg-battlemap-token-image"
                    href={t.image}
                    x={-r}
                    y={-r}
                    width={r * 2}
                    height={r * 2}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#rpg-bm-token-${uid}-${ti})`}
                  />
                  <circle r={r} className="rpg-battlemap-token-rim" />
                </>
              ) : t.icon ? (
                <>
                  <text className="rpg-battlemap-token-icon" y={-r * 0.16} style={{ fontSize: `${r * 1.05}px` }}>
                    {t.icon}
                  </text>
                  <text className="rpg-battlemap-token-text is-small" y={r * 0.6} style={{ fontSize: `${r * 0.46}px` }}>
                    {initials(t.name)}
                  </text>
                </>
              ) : (
                <text className="rpg-battlemap-token-text">{initials(t.name)}</text>
              )}
              {(t.conditions?.length ?? 0) > 0 && (
                <circle cx={r * 0.8} cy={-r * 0.8} r={3} className="rpg-battlemap-token-condition" />
              )}
              {t.ko && (
                <g className="rpg-battlemap-token-ko" transform={`translate(0 ${r * 1.05})`}>
                  <rect x={-r * 0.62} y={-r * 0.3} width={r * 1.24} height={r * 0.6} rx={r * 0.18} />
                  <text style={{ fontSize: `${r * 0.46}px` }}>KO</text>
                </g>
              )}
            </g>
          );
        })}
      </g>

      {/* The turn: a move's path, an attack's line — stopped short of the token
          it reaches (and an attack, of the one it leaves), so its head shows. */}
      <g className="rpg-battlemap-arrows">
        {arrows.map((a, i) => {
          const points = a.path.map(center);
          const gap = cell * 0.45;
          const trim = (from: { x: number; y: number }, to: { x: number; y: number }) => {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy) || 1;
            return { x: to.x - (dx / len) * gap, y: to.y - (dy / len) * gap };
          };
          if (points.length > 1) {
            points[points.length - 1] = trim(points[points.length - 2], points[points.length - 1]);
            if (a.kind === "attack") points[0] = trim(points[1], points[0]);
          }
          // A move after the action often retraces the one before it (in to
          // strike, back to cover): drawn a little to one side, so both show.
          if (a.kind === "after" && points.length > 1) {
            const first = points[0];
            const last = points[points.length - 1];
            const len = Math.hypot(last.x - first.x, last.y - first.y) || 1;
            const nx = -(last.y - first.y) / len;
            const ny = (last.x - first.x) / len;
            const shift = cell * 0.14;
            for (let k = 0; k < points.length; k++)
              points[k] = { x: points[k].x + nx * shift, y: points[k].y + ny * shift };
          }
          const end = points[points.length - 1];
          return (
            <g key={i}>
              <polyline
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                className={`rpg-battlemap-arrow is-${a.kind}${a.result ? ` is-${a.result}` : ""}`}
                markerEnd={`url(#rpg-bm-arrow-${a.result === "miss" ? "miss" : a.kind})`}
              />
              {a.note && end && (
                <text
                  className={`rpg-battlemap-arrow-note${a.result ? ` is-${a.result}` : ""}`}
                  x={end.x}
                  y={end.y - cell * 0.42}
                  style={{ fontSize: `${cell * 0.34}px` }}
                >
                  {a.note}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Chessboard labels, on the edges of what's shown */}
      <g className="rpg-battlemap-coords" aria-hidden="true" style={{ fontSize: `${labelSize}px` }}>
        {view && (
          <>
            <rect className="rpg-battlemap-gutter" x={box.x} y={box.y} width={box.w} height={gutter} />
            <rect className="rpg-battlemap-gutter" x={box.x} y={box.y} width={gutter} height={box.h} />
          </>
        )}
        {Array.from({ length: map.cols }, (_, c) => (
          <text key={`c${c}`} x={GUTTER + c * cell + cell / 2} y={box.y + gutter / 2}>
            {colLetters(c)}
          </text>
        ))}
        {Array.from({ length: map.rows }, (_, r) => (
          <text key={`r${r}`} x={box.x + gutter / 2} y={GUTTER + r * cell + cell / 2}>
            {r + 1}
          </text>
        ))}
      </g>
    </svg>
  );
}
