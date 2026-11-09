/**
 * Play mode (design §14): trying the map out at the table's pace. Pieces
 * (markers flagged `piece`, or party figures) are dragged hex to hex or sent
 * with a click; Measure walks a straight line and says how far and how long;
 * the route each piece took can be traced, and Fog darkens what no piece has
 * seen. A sandbox: nothing is written to the note, and Reset puts it back. Real
 * positions belong to the session log (§14.2).
 */

import * as React from "react";
import { IconButton, Segmented } from "lib/components/hexmap/hex-paint-bar";
import type { PaintPointer } from "lib/components/hexmap/hex-map-view";
import { LucideIcon } from "lib/components/session-log/lucide-icon";
import { type Axial, hexCenter, hexKey, hexPoints, pixelToHex } from "lib/domains/hexmap/axial";
import { applyHexEdits, type HexEdit } from "lib/domains/hexmap/edit-hex-map";
import type { HexLayout } from "lib/domains/hexmap/layout";
import { isPiece, type ParsedHexMap } from "lib/domains/hexmap/parse-hex-map";
import { explored, hexDistance, hexLine, travel, travelText } from "lib/domains/hexmap/play";
import {
  emptyGrid,
  type Pace,
  routeSteps,
  routeText,
  summarizeRoute,
  type TerrainGrid,
  type Tracking,
  type TravelOptions,
  type TravelStep,
  WEATHER,
  WEATHER_IDS,
  type WeatherId,
} from "lib/domains/hexmap/terrain";

export type PlayTool = "move" | "measure";

/** One level's sandbox, kept by the map block's session. */
export interface PlayState {
  /** Where each piece (by its marker's line) stands now. */
  pieces: Record<number, Axial>;
  /** The hexes each piece went through, its start first. */
  trails: Record<number, Axial[]>;
  tool: PlayTool;
  fog: boolean;
  trail: boolean;
  /** The pace moves and Measure count at; unset: normal. */
  pace?: Pace;
  /** The day's weather; unset: agreeable. */
  weather?: WeatherId;
}

export const newPlayState = (): PlayState => ({ pieces: {}, trails: {}, tool: "move", fog: false, trail: true });

const METRES_PER_MILE = 1609.344;

/** A route's steps across the map's ground, when it has a scale and knows any hex's terrain. */
export function stepsOf(
  route: Axial[],
  grid: TerrainGrid,
  pace: Pace,
  hexMetres?: number,
  options: TravelOptions = {}
): TravelStep[] | null {
  if (!hexMetres || grid.terrain.size === 0) return null;
  return routeSteps(route, grid, pace, hexMetres / METRES_PER_MILE, options);
}

/** "4 hexes · 24 mi · Normal · 1 d 2 h · 2 difficult", or without terrain "4 hexes · 24 mi · 1 day". */
export function routeReadout(
  route: Axial[],
  grid: TerrainGrid,
  pace: Pace,
  hexMetres?: number,
  options: TravelOptions = {}
): string {
  const steps = stepsOf(route, grid, pace, hexMetres, options);
  if (!steps) return travelText(travel([route[0], route[route.length - 1]], hexMetres));
  return routeText(summarizeRoute(steps, pace, hexMetres! / METRES_PER_MILE, options.weather), pace);
}

/** The level's text with the pieces where Play put them (drawn, never written). */
export function withPieces(view: string, state: PlayState): string {
  const edits: HexEdit[] = Object.entries(state.pieces).map(([line, at]) => ({
    kind: "move",
    line: Number(line),
    q: at.q,
    r: at.r,
  }));
  return edits.length ? applyHexEdits(view, edits) : view;
}

interface Drag {
  kind: "piece" | "measure";
  line?: number;
  from: Axial;
  to: Axial;
}

const EMPTY_GRID = emptyGrid();

const TRAIL_COLORS = ["#e0b84a", "#5fb0e8", "#e86a5f", "#7fd17a", "#c58be8"];

export function usePlay({
  state,
  onState,
  map,
  layout,
  hexMetres,
  grid = EMPTY_GRID,
  tracking = "miles",
  active,
}: {
  state: PlayState;
  onState: (next: PlayState) => void;
  map: ParsedHexMap;
  layout: HexLayout | undefined;
  hexMetres?: number;
  /** The map's ground, for travel times across it. */
  grid?: TerrainGrid;
  /** `travel: hexes` in the map's head: whole hexes a day. */
  tracking?: Tracking;
  active: boolean;
}) {
  const pace = state.pace ?? "normal";
  const options: TravelOptions = { weather: state.weather ?? "agreeable", tracking };
  const readoutFor = (from: Axial, to: Axial) => routeReadout(hexLine(from, to), grid, pace, hexMetres, options);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [readout, setReadout] = React.useState<string | null>(null);
  const R = layout?.R ?? 40;
  const pieces = React.useMemo(() => map.markers.filter(isPiece), [map]);
  const startOf = React.useCallback(
    (line: number): Axial | null => {
      const m = pieces.find((p) => p.line === line);
      if (!m) return null;
      return state.pieces[line] ?? pixelToHex(hexCenter(m.q, m.r, 1).x, hexCenter(m.q, m.r, 1).y, 1);
    },
    [pieces, state.pieces]
  );

  const pieceAt = (p: PaintPointer): number | null => {
    if (!layout) return null;
    const x = 1.5 * R * p.point.q;
    const y = Math.sqrt(3) * R * (p.point.r + p.point.q / 2);
    let best: number | null = null;
    let bestD = R * 0.7;
    for (const m of layout.markers) {
      if (!pieces.some((pc) => pc.line === m.line)) continue;
      const d = Math.hypot(m.x - x, m.y - h(m) - y);
      if (d < bestD) {
        bestD = d;
        best = m.line;
      }
    }
    return best;
  };
  const h = (m: HexLayout["markers"][number]) => m.box.h * 0.45;

  const moveTo = (line: number, from: Axial, to: Axial) => {
    if (from.q === to.q && from.r === to.r) return;
    const trail = state.trails[line] ?? [from];
    const steps = hexLine(from, to).slice(1);
    onState({
      ...state,
      pieces: { ...state.pieces, [line]: to },
      trails: { ...state.trails, [line]: [...trail, ...steps] },
    });
    const name = pieces.find((pc) => pc.line === line)?.text ?? "Piece";
    setReadout(`${name}: ${readoutFor(from, to)}`);
  };

  const claims = (p: PaintPointer): boolean => {
    if (p.button !== 0) return false;
    if (state.tool === "measure") return true;
    return pieceAt(p) !== null || selected !== null;
  };

  const onPointer = (p: PaintPointer) => {
    if (p.phase === "down") {
      if (state.tool === "measure") {
        setDrag({ kind: "measure", from: p.hex, to: p.hex });
        return;
      }
      const line = pieceAt(p);
      if (line !== null) {
        const from = startOf(line);
        if (from) setDrag({ kind: "piece", line, from, to: from });
        return;
      }
      // A piece chosen with a click goes where the next click is.
      if (selected !== null) {
        const from = startOf(selected);
        if (from) moveTo(selected, from, p.hex);
        setSelected(null);
      }
      return;
    }
    if (!drag) return;
    if (p.phase === "move") {
      if (p.hex.q !== drag.to.q || p.hex.r !== drag.to.r) setDrag({ ...drag, to: p.hex });
      return;
    }
    setDrag(null);
    if (drag.kind === "measure") {
      setReadout(readoutFor(drag.from, p.hex));
      setDrag({ ...drag, to: p.hex, kind: "measure" });
      return;
    }
    if (drag.line === undefined) return;
    if (hexDistance(drag.from, p.hex) === 0) {
      setSelected(selected === drag.line ? null : drag.line);
      setReadout(null);
    } else moveTo(drag.line, drag.from, p.hex);
  };

  const centre = (a: Axial) => hexCenter(a.q, a.r, R);
  const linePoints = (hexes: Axial[]) =>
    hexes
      .map((a) => centre(a))
      .map((c) => `${c.x},${c.y}`)
      .join(" ");

  // Fog: every drawn hex no piece has seen (each sees its hex and the ring around it).
  const seen = React.useMemo(() => {
    const stood: Axial[] = [];
    for (const pc of pieces) {
      const now = startOf(pc.line);
      if (now) stood.push(now);
      stood.push(...(state.trails[pc.line] ?? []));
    }
    return explored(stood, 1);
  }, [pieces, state.trails, startOf]);

  const overlay = active && layout && (
    <g className="rpg-hexmap-play">
      {state.fog && pieces.length > 0 && (
        <g className="rpg-hexmap-fog">
          {[...layout.hexes.values()]
            .filter((x) => !seen.has(hexKey(x.q, x.r)))
            .map((x) => (
              <polygon key={`fog:${x.q},${x.r}`} points={hexPoints(x.cx, x.cy, R * 1.02)} />
            ))}
        </g>
      )}
      {state.trail &&
        pieces.map((pc, i) => {
          const trail = state.trails[pc.line];
          if (!trail || trail.length < 2) return null;
          return (
            <polyline
              key={`trail:${pc.line}`}
              points={linePoints(trail)}
              className="rpg-hexmap-trail"
              stroke={TRAIL_COLORS[i % TRAIL_COLORS.length]}
              strokeWidth={R / 10}
            />
          );
        })}
      {selected !== null && startOf(selected) && (
        <polygon
          points={hexPoints(centre(startOf(selected)!).x, centre(startOf(selected)!).y, R)}
          className="rpg-hexmap-picked"
          strokeWidth={R / 12}
        />
      )}
      {drag && hexDistance(drag.from, drag.to) > 0 && (
        <g className="rpg-hexmap-measure">
          {(() => {
            const line = hexLine(drag.from, drag.to);
            const steps = stepsOf(line, grid, pace, hexMetres, options);
            return line.map((a, i) => {
              const step = i > 0 ? steps?.[i - 1] : undefined;
              const cls = step?.impassable
                ? "is-water"
                : step?.difficult
                  ? "is-difficult"
                  : step?.road
                    ? "is-road"
                    : undefined;
              return (
                <polygon
                  key={`m:${a.q},${a.r}`}
                  className={cls}
                  points={hexPoints(centre(a).x, centre(a).y, R * 0.9)}
                />
              );
            });
          })()}
          <polyline points={linePoints([drag.from, drag.to])} strokeWidth={R / 14} />
          <text
            x={(centre(drag.from).x + centre(drag.to).x) / 2}
            y={(centre(drag.from).y + centre(drag.to).y) / 2 - R * 0.35}
            style={{ fontSize: R * 0.3 }}
          >
            {readoutFor(drag.from, drag.to)}
          </text>
        </g>
      )}
    </g>
  );

  const hud = active && (
    <div className="rpg-hexmap-hud" onPointerDown={(e) => e.stopPropagation()}>
      <Segmented<PlayTool>
        legend="Play tool"
        value={state.tool}
        onChange={(tool) => {
          setDrag(null);
          onState({ ...state, tool });
        }}
        options={[
          {
            value: "move",
            title: "Drag a piece (a party figure, or a marker marked piece), or click one then a hex",
            label: (
              <>
                <LucideIcon name="footprints" size={13} /> <span>Move</span>
              </>
            ),
          },
          {
            value: "measure",
            title: "Drag from hex to hex: distance and travel time",
            label: (
              <>
                <LucideIcon name="ruler" size={13} /> <span>Measure</span>
              </>
            ),
          },
        ]}
      />
      {hexMetres && grid.terrain.size > 0 && (
        <Segmented<Pace>
          legend="Travel pace"
          value={pace}
          onChange={(next) => {
            onState({ ...state, pace: next });
            setReadout(null);
          }}
          options={[
            {
              value: "slow",
              title: "Slow: 18 mi a day; can move stealthily, +5 to navigate",
              label: <span>Slow</span>,
            },
            { value: "normal", title: "Normal: 24 mi a day", label: <span>Normal</span> },
            {
              value: "fast",
              title: "Fast: 30 mi a day; −5 passive Perception, navigation DC +5, can't forage",
              label: <span>Fast</span>,
            },
          ]}
        />
      )}
      {hexMetres && grid.terrain.size > 0 && (
        <label className="rpg-hexmap-hud-weather" title={WEATHER[state.weather ?? "agreeable"].examples}>
          <LucideIcon name="cloud-sun" size={13} />
          <select
            aria-label="The day's weather"
            value={state.weather ?? "agreeable"}
            onChange={(e) => {
              onState({ ...state, weather: e.target.value as WeatherId });
              setReadout(null);
            }}
          >
            {WEATHER_IDS.map((id) => (
              <option key={id} value={id}>
                {WEATHER[id].name}
              </option>
            ))}
          </select>
        </label>
      )}
      <IconButton
        icon="footprints"
        label={state.trail ? "Hide the routes taken" : "Show the routes taken"}
        className={state.trail ? "is-on" : undefined}
        onClick={() => onState({ ...state, trail: !state.trail })}
      >
        <span>Trail</span>
      </IconButton>
      <IconButton
        icon={state.fog ? "eye-off" : "cloud-fog"}
        label={state.fog ? "Show the whole map" : "Darken what no piece has seen"}
        className={state.fog ? "is-on" : undefined}
        onClick={() => onState({ ...state, fog: !state.fog })}
      >
        <span>Fog</span>
      </IconButton>
      <IconButton
        icon="rotate-ccw"
        label="Put every piece back where the map has it"
        disabled={Object.keys(state.pieces).length === 0 && Object.keys(state.trails).length === 0}
        onClick={() => {
          setSelected(null);
          setReadout(null);
          onState({
            ...newPlayState(),
            tool: state.tool,
            fog: state.fog,
            trail: state.trail,
            pace: state.pace,
            weather: state.weather,
          });
        }}
      >
        <span>Reset</span>
      </IconButton>
      <output className="rpg-hexmap-hud-readout">
        {readout ??
          (pieces.length === 0
            ? "No pieces: add piece to a marker's line, or use a party figure"
            : selected !== null
              ? "Click a hex to send it there"
              : `${pieces.length} piece${pieces.length === 1 ? "" : "s"} · sandbox, not saved`)}
      </output>
    </div>
  );

  return { claims, onPointer, overlay, hud };
}
