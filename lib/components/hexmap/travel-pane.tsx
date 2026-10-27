/**
 * Journeys on their overworld map, in the session log (hex-map-design §14.2):
 *
 * - `TravelMinimap` — a round minimap in the log's top corner (like Baldur's
 *   Gate 3's), there with or without the Log: the journey being read, centred
 *   on whoever just moved, with the trails walked and the marks standing. It
 *   goes on showing through a fight inside the journey, and after arriving.
 * - `TravelFullscreen` — the whole map over the page: stepping through the
 *   journey, Fog, and who is in which group.
 *
 * Groups and lone characters are drawn as party figures, the journey's marks
 * as their markers; the map's own Play pieces are left out (the log says where
 * people are).
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { type Drawn, drawHexMap } from "lib/components/hexmap/draw-hex-map";
import { HexMapStatic, HexMapView } from "lib/components/hexmap/hex-map-view";
import { IconButton } from "lib/components/hexmap/hex-paint-bar";
import { LucideIcon } from "lib/components/session-log/lucide-icon";
import { hexCenter, hexKey, hexPoints } from "lib/domains/hexmap/axial";
import { formatCoord } from "lib/domains/hexmap/edit-hex-map";
import { isPiece, parseHexMap } from "lib/domains/hexmap/parse-hex-map";
import { explored } from "lib/domains/hexmap/play";
import { trackAt, type TravelFrame, type TravelTrack } from "lib/domains/session-log/travel";

const TRAIL_COLORS = ["#e0b84a", "#5fb0e8", "#e86a5f", "#7fd17a", "#c58be8"];

/** The map's text with the frame's tokens and marks as marker lines (drawn with the
 *  pack's art) — and without the map's own pieces. */
function withTravellers(body: string, frame: TravelFrame): string {
  const pieces = new Set(
    parseHexMap(body)
      .markers.filter(isPiece)
      .map((m) => m.line)
  );
  const own = body
    .split("\n")
    .filter((_, i) => !pieces.has(i + 1))
    .join("\n");
  const lines: string[] = [];
  for (const [name, [q, r]] of Object.entries(frame.positions)) {
    const members = frame.groups[name];
    const caption = members ? `${name} · ${members.length}` : name;
    // A group stands as a party pair, a lone character as one figure.
    lines.push(`m(${q},${r}): party[${members && members.length !== 1 ? 1 : 2}] (${caption.replace(/[()]/g, "")})`);
  }
  for (const m of frame.marks) {
    lines.push(
      `m(${formatCoord(m.at[0])},${formatCoord(m.at[1])}): ${m.spec ?? "pin[red]"} (${m.name.replace(/[()]/g, "")})`
    );
  }
  return lines.length ? `${own.replace(/\n+$/, "")}\n${lines.join("\n")}` : own;
}

/** A map's name as its link and level read: `Caulkin coast (1,0)`. */
export function mapTitle(map: string | undefined, level?: Array<[number, number]>): string {
  const name = (map ?? "Map")
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")
    .pop()!;
  // `[TRAVEL: [[Map]] level 2]` names a depth (its path is all zeros); an older path names its hexes.
  if (level?.length && level.every(([q, r]) => q === 0 && r === 0)) return `${name} · level ${level.length}`;
  return `${name}${level?.map(([q, r]) => ` (${q},${r})`).join("") ?? ""}`;
}

/** The travel at an entry: its frame, every step, the drawing, and a colour per name. */
function useTravel(track: TravelTrack, bodyOf: (frame: TravelFrame) => string | undefined, readingId: number | null) {
  const frame = trackAt(track, readingId ?? track.from ?? 0) ?? track.frames[0];
  const body = frame ? bodyOf(frame) : undefined;
  const [drawn, setDrawn] = React.useState<Drawn | null>(null);
  const source = body && frame ? withTravellers(body, frame) : undefined;
  React.useEffect(() => {
    if (!source) return;
    let alive = true;
    void drawHexMap(source).then((d) => alive && setDrawn(d));
    return () => {
      alive = false;
    };
  }, [source]);
  const steps = track.frames.filter((f) => f.moved.length > 0);
  const at = frame ? steps.reduce((n, f, i) => (f.id <= frame.id ? i : n), -1) : -1;
  // One colour per name for the whole log, in the order they first stand on the map.
  const names = React.useMemo(
    () => [...new Set(track.frames.flatMap((f) => [...Object.keys(f.positions), ...Object.keys(f.trails)]))],
    [track]
  );
  const colourOf = (name: string) => TRAIL_COLORS[Math.max(0, names.indexOf(name)) % TRAIL_COLORS.length];
  // A journey that went somewhere (or says how it ended); one only setting out the map hasn't "arrived".
  const arrived =
    !!frame &&
    !frame.travelling &&
    track.journeys.some((j) => j.end != null && j.end <= frame.id && (j.frames.length > 0 || !!j.summary));
  return { frame, body, drawn, steps, at, colourOf, arrived, title: mapTitle(frame?.map, frame?.level) };
}

/** A special move, drawn by its kind: a teleport arcs from where it vanished to
 *  where it appears; a ship or a flight follows its waypoints, dashed its own way. */
function Jump({ points, via, colour, R }: { points: Array<[number, number]>; via: string; colour: string; R: number }) {
  const at = points.map(([q, r]) => hexCenter(q, r, R));
  if (at.length < 2) return null;
  if (via === "teleport" || at.length === 2) {
    const [a, b] = [at[0], at[at.length - 1]];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.3;
    return (
      <g className={`rpg-hexmap-jump via-${via}`} style={{ color: colour }}>
        <path d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`} strokeWidth={R / 12} />
        <circle cx={a.x} cy={a.y} r={R * 0.22} />
        <circle cx={b.x} cy={b.y} r={R * 0.32} />
      </g>
    );
  }
  return (
    <g className={`rpg-hexmap-jump via-${via}`} style={{ color: colour }}>
      <polyline points={at.map((c) => `${c.x},${c.y}`).join(" ")} strokeWidth={R / 12} />
    </g>
  );
}

/** Trails walked, the step just taken, and (with Fog) what nobody has seen. */
function JourneyOverlay({
  frame,
  layout,
  colourOf,
  fog,
}: {
  frame: TravelFrame;
  layout: Drawn["layout"];
  colourOf: (name: string) => string;
  fog?: boolean;
}) {
  const R = layout.R;
  const seen = fog
    ? explored(
        Object.values(frame.trails)
          .flat()
          .concat(Object.values(frame.positions))
          .map(([q, r]) => ({ q, r })),
        1
      )
    : null;
  return (
    <g className="rpg-hexmap-play">
      {seen && (
        <g className="rpg-hexmap-fog">
          {[...layout.hexes.values()]
            .filter((h) => !seen.has(hexKey(h.q, h.r)))
            .map((h) => (
              <polygon key={`fog:${h.q},${h.r}`} points={hexPoints(h.cx, h.cy, R * 1.02)} />
            ))}
        </g>
      )}
      {Object.keys(frame.trails).map((name) => {
        const trail = frame.trails[name];
        if (!trail || trail.length < 2) return null;
        const points = trail
          .map(([q, r]) => hexCenter(q, r, R))
          .map((c) => `${c.x},${c.y}`)
          .join(" ");
        return (
          <polyline
            key={`trail:${name}`}
            points={points}
            className="rpg-hexmap-trail"
            stroke={colourOf(name)}
            strokeWidth={R / 10}
          />
        );
      })}
      {(frame.jumps ?? []).map((j, i) => (
        <Jump key={`jump:${i}`} points={j.points} via={j.via} colour={colourOf(j.token)} R={R} />
      ))}
      {frame.moved.map((name) => {
        const at = frame.positions[name];
        if (!at) return null;
        const c = hexCenter(at[0], at[1], R);
        return (
          <polygon
            key={`moved:${name}`}
            points={hexPoints(c.x, c.y, R)}
            className="rpg-hexmap-picked"
            strokeWidth={R / 12}
          />
        );
      })}
    </g>
  );
}

/** The circle in the corner. */
export function TravelMinimap({
  track,
  bodyOf,
  readingId,
  onExpand,
}: {
  track: TravelTrack;
  bodyOf: (frame: TravelFrame) => string | undefined;
  readingId: number | null;
  onExpand: () => void;
}) {
  const { frame, drawn, colourOf, arrived, title } = useTravel(track, bodyOf, readingId);
  // On a phone the disc starts as its small button: it would cover a third of the reading column.
  const [small, setSmall] = React.useState(() => document.body.classList.contains("is-mobile"));
  if (!frame) return null;
  if (small) {
    return (
      <button
        type="button"
        className="lonelog-minimap is-small"
        title={`${title}: show the map`}
        aria-label={`Show the map of ${title}`}
        onClick={() => setSmall(false)}
      >
        <LucideIcon name="map" size={16} />
      </button>
    );
  }
  const layout = drawn?.layout;
  // Centred on whoever just moved, else the first token, else the map's middle.
  const focus = frame.positions[frame.moved[0]] ?? Object.values(frame.positions)[0];
  const R = layout?.R ?? 40;
  const c = focus ? hexCenter(focus[0], focus[1], R) : null;
  const span = R * 7;
  const view =
    layout && c
      ? { x: c.x - span / 2, y: c.y - span / 2, w: span, h: span }
      : layout
        ? {
            x: layout.bounds.x + layout.bounds.w / 2 - span / 2,
            y: layout.bounds.y + layout.bounds.h / 2 - span / 2,
            w: span,
            h: span,
          }
        : undefined;
  return (
    <figure className={`lonelog-minimap${arrived ? " is-arrived" : ""}`} aria-label={`Map: ${title}`}>
      <div
        role="button"
        tabIndex={0}
        className="lonelog-minimap-disc"
        title={`${title} — open the full map`}
        aria-label={`Open the full map of ${title}`}
        onClick={onExpand}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onExpand())}
      >
        {layout && view ? (
          <HexMapStatic
            layout={layout}
            view={view}
            className="lonelog-minimap-svg"
            overlay={
              <>
                {/* The map dimmed, so the party reads at a glance; markers draw over this. */}
                <rect
                  className="lonelog-minimap-veil"
                  x={view.x - view.w}
                  y={view.y - view.h}
                  width={view.w * 3}
                  height={view.h * 3}
                />
                <JourneyOverlay frame={frame} layout={layout} colourOf={colourOf} />
              </>
            }
          />
        ) : (
          <LucideIcon name="map" size={22} />
        )}
      </div>
      <span className="lonelog-minimap-north" aria-hidden="true">
        N
      </span>
      <figcaption className="lonelog-minimap-caption">{arrived ? `${title} · arrived` : title}</figcaption>
      <menu className="lonelog-minimap-tools">
        <li>
          <IconButton icon="maximize" label="Full screen" onClick={onExpand} />
        </li>
        <li>
          <IconButton icon="minus" label="Make the map small" onClick={() => setSmall(true)} />
        </li>
      </menu>
    </figure>
  );
}

/** The whole map over the page. */
export function TravelFullscreen({
  track,
  bodyOf,
  readingId,
  onSeek,
  onClose,
}: {
  track: TravelTrack;
  bodyOf: (frame: TravelFrame) => string | undefined;
  readingId: number | null;
  onSeek: (id: number) => void;
  onClose: () => void;
}) {
  const { frame, body, drawn, steps, at, colourOf, title } = useTravel(track, bodyOf, readingId);
  const [fog, setFog] = React.useState(false);
  const paneRef = React.useRef<HTMLElement>(null);
  const open = !!frame;
  // A dialog takes focus, keeps it while open, and gives it back to what opened it.
  React.useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    paneRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !paneRef.current) return;
    const stops = Array.from(
      paneRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex='0']")
    );
    if (stops.length === 0) return;
    const [first, last] = [stops[0], stops[stops.length - 1]];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === paneRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && at > 0) onSeek(steps[at - 1].id);
      else if (e.key === "ArrowRight" && at < steps.length - 1) onSeek(steps[at + 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onSeek, steps, at]);
  const go = (i: number) => {
    const target = steps[Math.max(0, Math.min(steps.length - 1, i))];
    if (target) onSeek(target.id);
  };
  if (!frame) return null;
  const tokens = Object.keys(frame.positions);
  const layout = drawn?.layout;
  // On a phone the whole map is too small to read: open on the party, a few hexes across.
  const onPhone = document.body.classList.contains("is-mobile");
  const phoneView = (() => {
    if (!layout || !onPhone) return undefined;
    const at = frame.positions[frame.moved[0]] ?? Object.values(frame.positions)[0] ?? frame.marks[0]?.at;
    if (!at) return undefined;
    const c = hexCenter(at[0], at[1], layout.R);
    const [w, h] = [layout.R * 14, layout.R * 18];
    return { x: c.x - w / 2, y: c.y - h / 2, w, h };
  })();
  return ReactDOM.createPortal(
    <div
      className="lonelog-travel-full"
      role="dialog"
      aria-modal="true"
      aria-label={`Map: ${title}`}
      onClick={onClose}
      onKeyDown={trapTab}
    >
      <section ref={paneRef} tabIndex={-1} className="lonelog-travel-pane" onClick={(e) => e.stopPropagation()}>
        <header className="lonelog-travel-head">
          <LucideIcon name="footprints" size={13} />
          <span className="lonelog-travel-title">{title}</span>
          <span className="lonelog-travel-where">
            {steps.length ? `${Math.max(0, at) + 1} / ${steps.length}` : "no moves yet"}
            {frame.actor ? ` · ${frame.actor}` : ""}
          </span>
          <menu className="lonelog-travel-controls">
            <li>
              <IconButton icon="skip-back" label="The first move" disabled={at <= 0} onClick={() => go(0)} />
            </li>
            <li>
              <IconButton icon="chevron-left" label="Back a step (←)" disabled={at <= 0} onClick={() => go(at - 1)} />
            </li>
            <li>
              <IconButton
                icon="chevron-right"
                label="On a step (→)"
                disabled={at >= steps.length - 1}
                onClick={() => go(at + 1)}
              />
            </li>
            <li>
              <IconButton
                icon={fog ? "eye-off" : "cloud-fog"}
                label={fog ? "Show the whole map" : "Darken what nobody has seen"}
                className={fog ? "is-on" : undefined}
                onClick={() => setFog(!fog)}
              />
            </li>
            <li>
              <IconButton icon="x" label="Close (Esc)" onClick={onClose} />
            </li>
          </menu>
        </header>
        {!body ? (
          <p className="lonelog-travel-missing">No hex map found for {frame.map ?? "this journey"}.</p>
        ) : layout ? (
          <HexMapView
            layout={layout}
            coords="hover"
            errors={[]}
            {...(phoneView
              ? { initialView: phoneView }
              : onPhone
                ? // Nobody on the map yet: open zoomed in on its middle, not the whole of it at 2px a label.
                  { startZoom: { zoom: 2.5 } }
                : {})}
            overlay={<JourneyOverlay frame={frame} layout={layout} colourOf={colourOf} fog={fog} />}
            maxHeight={78}
          />
        ) : (
          <div className="rpg-hexmap rpg-hexmap--loading">Drawing the map…</div>
        )}
        <ul className="lonelog-travel-groups">
          {tokens.map((name) => (
            <li key={name} style={{ "--trail": colourOf(name) } as React.CSSProperties}>
              <strong>{name}</strong>
              {frame.groups[name] && <span>{frame.groups[name].join(", ") || "nobody"}</span>}
              <span className="lonelog-travel-at">
                ({frame.positions[name][0]},{frame.positions[name][1]})
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>,
    document.body
  );
}
