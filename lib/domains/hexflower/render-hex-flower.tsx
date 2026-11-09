/**
 * `rpg hexflower` drawn as the book draws it: the flower's hexes with their results, Start's dice
 * numbers on its sides, the one-way arrows on the edges — and a token to walk with a Roll button.
 * Click a hex to put the token there. See hex-flower.ts for the block.
 */

import { MarkdownRenderChild } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Markdown } from "lib/components/markdown";
import {
  type Axial,
  hexCenter,
  hexKey,
  hexPoints,
  type Side,
  SIDE_STEP as SIDE_STEP_OF,
  SIDES,
} from "lib/domains/hexmap/axial";
import { getFlower, setFlower, subscribeFlower } from "./flower-store";
import {
  distanceFromStart,
  type FlowerStep,
  type HexFlower,
  parseHexFlower,
  pickDie,
  rollFlower,
  startState,
  TEMPERATURE_NAMES,
} from "./hex-flower";

const R = 50;
/** Where each side's middle is, from the hex centre, as a unit vector (flat-top: N is straight up). */
const SIDE_ANGLE: Record<Side, number> = { N: -90, NE: -30, SE: 30, S: 90, SW: 150, NW: 210 };

function sideVector(side: Side): { x: number; y: number } {
  const a = (SIDE_ANGLE[side] * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/** The totals that move the token to each side (`2-12`, `3-4`), as Start shows them. */
function sideNumbers(f: HexFlower): Record<Side, string> {
  const by: Record<Side, number[]> = { N: [], NE: [], SE: [], S: [], SW: [], NW: [] };
  for (const [total, side] of f.directions) by[side].push(total);
  const out = {} as Record<Side, string>;
  for (const side of SIDES) {
    const t = by[side].sort((a, b) => a - b);
    const run = t.length > 1 && t[t.length - 1] - t[0] === t.length - 1;
    out[side] = run ? `${t[0]}–${t[t.length - 1]}` : t.join(", ");
  }
  return out;
}

/** A cell's text in lines that fit a hex: split at `/`, then long words on their own. */
function cellLines(text: string): string[] {
  const out: string[] = [];
  const parts = text.split("/").map((p) => p.trim());
  parts.forEach((part, i) => {
    let line = "";
    for (const w of part.split(/\s+/).filter(Boolean)) {
      if (line && `${line} ${w}`.length > 11) {
        out.push(line);
        line = w;
      } else line = line ? `${line} ${w}` : w;
    }
    // `Desert/` over `Grassland`, as the book prints a two-in-one hex.
    if (line) out.push(i < parts.length - 1 ? `${line}/` : line);
  });
  return out;
}

function FlowerDiagram({
  flower,
  at,
  last,
  onPlace,
}: {
  flower: HexFlower;
  at: Axial;
  last?: FlowerStep;
  onPlace: (a: Axial) => void;
}) {
  const hexes: Axial[] = [];
  for (let q = -flower.radius; q <= flower.radius; q++)
    for (let r = -flower.radius; r <= flower.radius; r++)
      if (distanceFromStart({ q, r }) <= flower.radius) hexes.push({ q, r });
  const numbers = sideNumbers(flower);
  const pad = R * 0.9;
  const w = (1.5 * flower.radius + 1) * R * 2 + pad;
  const h = Math.sqrt(3) * R * (2 * flower.radius + 1) + pad * 2;
  const centre = (a: Axial) => hexCenter(a.q, a.r, R);
  const token = centre(at);
  const font = R * 0.2;
  return (
    <svg
      className="rpg-hexflower-diagram"
      viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
      role="img"
      aria-label={`${flower.title ?? "Hex flower"} diagram`}
    >
      {hexes.map((a) => {
        const c = centre(a);
        const key = hexKey(a.q, a.r);
        const isStart = a.q === 0 && a.r === 0;
        const cell = flower.cells.get(key);
        const here = a.q === at.q && a.r === at.r;
        const lines = isStart ? ["START"] : cellLines(cell?.text ?? "");
        return (
          <g
            key={key}
            className={`rpg-hexflower-cell${isStart ? " is-start" : ""}${here ? " is-here" : ""}`}
            onClick={() => onPlace(a)}
          >
            <title>
              {isStart
                ? `Start${flower.start === "previous" ? " (repeat the last result)" : `: ${flower.start}`}`
                : cell?.text}
            </title>
            <polygon points={hexPoints(c.x, c.y, R * 0.98)} />
            <text
              x={c.x}
              y={c.y - ((lines.length - 1) * font * 1.1) / 2}
              style={{ fontSize: isStart ? font * 1.25 : font }}
            >
              {lines.map((l, i) => (
                <tspan key={i} x={c.x} dy={i === 0 ? "0.35em" : "1.1em"}>
                  {l.toUpperCase()}
                </tspan>
              ))}
            </text>
            {isStart &&
              SIDES.map((side) => {
                const v = sideVector(side);
                const d = R * 0.6;
                return (
                  <text
                    key={side}
                    className="rpg-hexflower-number"
                    x={c.x + v.x * d}
                    y={c.y + v.y * d}
                    dy="0.35em"
                    style={{ fontSize: font * 0.95 }}
                  >
                    {numbers[side]}
                  </text>
                );
              })}
          </g>
        );
      })}
      {/* The flower's outline: the sides that face no hex, drawn heavier, as the book prints it. */}
      <g className="rpg-hexflower-outline">
        {hexes.flatMap((a) => {
          const c = centre(a);
          return SIDES.filter((side) => {
            const v = SIDE_STEP_OF[side];
            return distanceFromStart({ q: a.q + v.q, r: a.r + v.r }) > flower.radius;
          }).map((side) => {
            // A side's two corners sit 30° either side of its middle, at the circumradius.
            const mid = SIDE_ANGLE[side];
            const p = (deg: number) => ({
              x: c.x + R * 0.98 * Math.cos((deg * Math.PI) / 180),
              y: c.y + R * 0.98 * Math.sin((deg * Math.PI) / 180),
            });
            const [p1, p2] = [p(mid - 30), p(mid + 30)];
            return <line key={`${a.q},${a.r}:${side}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
          });
        })}
      </g>
      {flower.arrows.map((arrow, i) => {
        const from = centre(arrow.from);
        const v = sideVector(arrow.side);
        const edge = { x: from.x + v.x * R * 0.87, y: from.y + v.y * R * 0.87 };
        const out = { x: edge.x + v.x * R * 0.42, y: edge.y + v.y * R * 0.42 };
        const stay = arrow.to.q === arrow.from.q && arrow.to.r === arrow.from.r;
        const to = centre(arrow.to);
        // Out across the edge, then curving back in towards where it sends the token.
        const end = stay
          ? { x: edge.x - v.x * R * 0.05 + v.y * R * 0.22, y: edge.y - v.y * R * 0.05 - v.x * R * 0.22 }
          : { x: edge.x + (to.x - edge.x) * 0.35, y: edge.y + (to.y - edge.y) * 0.35 };
        return (
          <path
            key={`arrow:${i}`}
            className="rpg-hexflower-arrow"
            d={`M ${edge.x} ${edge.y} Q ${out.x} ${out.y} ${end.x} ${end.y}`}
            markerEnd="url(#rpg-hexflower-head)"
          >
            <title>{`${arrow.side} from here: ${stay ? "stay" : "goes there"} (one way)`}</title>
          </path>
        );
      })}
      {last && (last.from.q !== last.to.q || last.from.r !== last.to.r) && (
        <line
          className={`rpg-hexflower-move${last.wrapped ? " is-wrapped" : ""}`}
          x1={centre(last.from).x}
          y1={centre(last.from).y}
          x2={last.wrapped ? centre(last.from).x + sideVector(last.side).x * R : centre(last.to).x}
          y2={last.wrapped ? centre(last.from).y + sideVector(last.side).y * R : centre(last.to).y}
        />
      )}
      <circle className="rpg-hexflower-token" cx={token.x} cy={token.y + R * 0.52} r={R * 0.16} />
      <defs>
        <marker
          id="rpg-hexflower-head"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
    </svg>
  );
}

function stepText(step: FlowerStep): string {
  const how = step.arrow ? " (arrow)" : step.wrapped ? " (wrapped)" : "";
  return `${step.dice.join("+")} = ${step.total} · ${step.side}${how}`;
}

export function HexFlowerView({
  flower,
  storeKey,
  sourcePath,
}: {
  flower: HexFlower;
  storeKey: string;
  sourcePath: string;
}) {
  const record = React.useSyncExternalStore(
    React.useCallback((l) => subscribeFlower(storeKey, l), [storeKey]),
    () => getFlower(storeKey)
  );
  const state = record?.state ?? startState();
  const history = record?.history ?? [];
  const last = history[0];

  const roll = () => {
    const { step, state: next } = rollFlower(flower, state);
    setFlower(storeKey, { state: next, history: [step, ...history].slice(0, 12) });
  };
  const place = (a: Axial) => setFlower(storeKey, { state: { ...state, at: a }, history });

  return (
    <div className="rpg-hexflower">
      {flower.title && <div className="rpg-hexflower-title">{flower.title}</div>}
      {flower.errors.length > 0 && (
        <ul className="rpg-hexflower-errors">
          {flower.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      <FlowerDiagram flower={flower} at={state.at} last={last} onPlace={place} />
      <div className="rpg-hexflower-controls">
        <button className="mod-cta" onClick={roll} type="button">
          Roll {flower.dice.count}d{flower.dice.sides}
        </button>
        {flower.temperature && (
          <span className={`rpg-hexflower-chip is-${TEMPERATURE_NAMES[state.temperature].toLowerCase()}`}>
            {TEMPERATURE_NAMES[state.temperature]}
          </span>
        )}
        <button
          type="button"
          className="clickable-icon"
          disabled={!record}
          onClick={() => setFlower(storeKey, undefined)}
          aria-label="Put the token back on Start"
        >
          Reset
        </button>
      </div>
      {last && (
        <div className="rpg-hexflower-result" aria-live="polite">
          <strong>{last.result}</strong>
          <span className="rpg-hexflower-detail">
            {stepText(last)}
            {last.pick !== undefined &&
              ` · d${pickDie(flower.cells.get(hexKey(last.to.q, last.to.r))?.options.length ?? 2)} ${last.pick}`}
            {last.start && " · Start"}
            {last.shifted && ` · now ${TEMPERATURE_NAMES[last.temperature].toLowerCase()}`}
          </span>
          {last.doubles && flower.doubles && (
            <div className="rpg-hexflower-doubles">
              <span>Doubles:</span> <Markdown source={flower.doubles} sourcePath={sourcePath} />
            </div>
          )}
        </div>
      )}
      {history.length > 1 && (
        <ol className="rpg-hexflower-history">
          {history.slice(1).map((s, i) => (
            <li key={i}>
              {s.result} <span className="rpg-hexflower-detail">{stepText(s)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export class HexFlowerRenderChild extends MarkdownRenderChild {
  private root: ReactDOM.Root | null = null;

  constructor(
    el: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string
  ) {
    super(el);
  }

  onload(): void {
    const flower = parseHexFlower(this.source);
    this.root = ReactDOM.createRoot(this.containerEl);
    this.root.render(
      <HexFlowerView
        flower={flower}
        storeKey={`${this.sourcePath}#${flower.title ?? ""}`}
        sourcePath={this.sourcePath}
      />
    );
  }

  onunload(): void {
    this.root?.unmount();
    this.root = null;
  }
}
