/**
 * `rpg hexflower` drawn as the book draws it: one ink for the lines, a heavier outline round the
 * flower, the results lettered in the text colour, Start's dice numbers on its sides and the
 * one-way arrows outside their edges. The current hex is ringed; the last move is an arrow drawn
 * under the lettering. Roll walks the token; a hex can be chosen (click, or Tab and Enter) to put
 * it there. See hex-flower.ts for the block.
 */

import { type App, MarkdownRenderChild } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Markdown } from "lib/components/markdown";
import { LucideIcon } from "lib/components/session-log/lucide-icon";
import { type Axial, hexCenter, hexKey, type Side, SIDE_STEP, SIDES } from "lib/domains/hexmap/axial";
import type { TableDef } from "lib/domains/tables/types";
import { type FlowerEntry, getFlower, setFlower, subscribeFlower } from "./flower-store";
import {
  distanceFromStart,
  type FlowerStep,
  type HexFlower,
  parseHexFlower,
  pickDie,
  rollFlower,
  startState,
  type Temperature,
  TEMPERATURE_NAMES,
} from "./hex-flower";
import { loadVaultTable, rollTable } from "./vault-tables";

const R = 50;
/** Where each side's middle is from the hex centre, in degrees (flat-top: N is straight up). */
const SIDE_ANGLE: Record<Side, number> = { N: -90, NE: -30, SE: 30, S: 90, SW: 150, NW: 210 };
/** Rolls shown under the result before "Show all". */
const HISTORY_SHOWN = 5;

type Pt = { x: number; y: number };
const at = (a: Axial): Pt => hexCenter(a.q, a.r, R);
const unit = (deg: number): Pt => ({ x: Math.cos((deg * Math.PI) / 180), y: Math.sin((deg * Math.PI) / 180) });
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const corner = (c: Pt, deg: number, r = R): Pt => add(c, unit(deg), r);
const round = (n: number) => Math.round(n * 100) / 100;
const pts = (list: Pt[]) => list.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
const hexPolygon = (c: Pt, r = R) => pts([0, 60, 120, 180, 240, 300].map((d) => corner(c, d, r)));

/** The totals that move the token to each side (`2, 12`, `3–4`), as Start shows them. */
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

/** A cell's text in lines that fit a hex: split at `/` (kept on the first line), then long words. */
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
    if (line) out.push(i < parts.length - 1 ? `${line} /` : line);
  });
  return out;
}

/** The flower's outline as closed paths: every side that faces no hex, chained end to end. */
function outlinePath(hexes: Axial[], radius: number): string {
  const key = (p: Pt) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const edges: Array<[Pt, Pt]> = [];
  for (const a of hexes) {
    const c = at(a);
    for (const side of SIDES) {
      const s = SIDE_STEP[side];
      if (distanceFromStart({ q: a.q + s.q, r: a.r + s.r }) <= radius) continue;
      const mid = SIDE_ANGLE[side];
      edges.push([corner(c, mid - 30), corner(c, mid + 30)]);
    }
  }
  const from = new Map<string, Array<[Pt, Pt]>>();
  for (const e of edges) for (const p of e) (from.get(key(p)) ?? from.set(key(p), []).get(key(p))!).push(e);
  const used = new Set<[Pt, Pt]>();
  let d = "";
  for (const first of edges) {
    if (used.has(first)) continue;
    used.add(first);
    const loop: Pt[] = [first[0], first[1]];
    for (;;) {
      const end = loop[loop.length - 1];
      const next = from.get(key(end))?.find((e) => !used.has(e));
      if (!next) break;
      used.add(next);
      loop.push(key(next[0]) === key(end) ? next[1] : next[0]);
    }
    d += `M${pts([loop[0]])}L${pts(loop.slice(1))}Z`;
  }
  return d;
}

/** One-way arrow on an edge: from just outside the edge, curving to just outside the hex it sends
 *  the token to (or a U-turn back into the same hex for `stay`). */
function arrowPath(fromCell: Axial, side: Side, toCell: Axial): string {
  const c = at(fromCell);
  const v = unit(SIDE_ANGLE[side]);
  const along = unit(SIDE_ANGLE[side] + 90);
  const edge = add(c, v, R * Math.sqrt(3) * 0.5);
  if (fromCell.q === toCell.q && fromCell.r === toCell.r) {
    const a = add(add(edge, v, R * 0.12), along, -R * 0.2);
    const b = add(add(edge, v, R * 0.12), along, R * 0.2);
    const ctl1 = add(a, v, R * 0.42);
    const ctl2 = add(b, v, R * 0.42);
    return `M${pts([a])}C${pts([ctl1])} ${pts([ctl2])} ${pts([b])}`;
  }
  const t = at(toCell);
  const start = add(edge, v, R * 0.14);
  const dir = { x: start.x - t.x, y: start.y - t.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const end = add(t, { x: dir.x / len, y: dir.y / len }, R * 1.02);
  const ctl = add({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, v, R * 0.35);
  return `M${pts([start])}Q${pts([ctl])} ${pts([end])}`;
}

/** The last move as a short arrow between the two hexes, trimmed off both labels' middles; a wrap
 *  leaves by one edge and comes in by the opposite edge of the hex it lands on. */
function movePaths(step: FlowerStep): string[] {
  const a = at(step.from);
  const b = at(step.to);
  if (step.wrapped) {
    const v = unit(SIDE_ANGLE[step.side]);
    const out1 = add(a, v, R * 0.5);
    const out2 = add(a, v, R * 1.05);
    const in1 = add(b, v, -R * 1.05);
    const in2 = add(b, v, -R * 0.5);
    return [`M${pts([out1])}L${pts([out2])}`, `M${pts([in1])}L${pts([in2])}`];
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [];
  const u = { x: dx / len, y: dy / len };
  return [`M${pts([add(a, u, R * 0.45)])}L${pts([add(b, u, -R * 0.5)])}`];
}

function FlowerDiagram({
  flower,
  here,
  last,
  onPlace,
  uid,
}: {
  flower: HexFlower;
  here: Axial;
  last?: FlowerStep;
  onPlace: (a: Axial) => void;
  uid: string;
}) {
  const hexes: Axial[] = [];
  for (let q = -flower.radius; q <= flower.radius; q++)
    for (let r = -flower.radius; r <= flower.radius; r++)
      if (distanceFromStart({ q, r }) <= flower.radius) hexes.push({ q, r });
  const numbers = sideNumbers(flower);
  // The flower's own extent, plus room for the arrows outside it.
  const halfW = (1.5 * flower.radius + 1) * R + (flower.arrows.length ? R * 0.55 : R * 0.12);
  const halfH = (Math.sqrt(3) / 2) * R * (2 * flower.radius + 1) + (flower.arrows.length ? R * 0.55 : R * 0.12);
  const head = `${uid}-head`;
  const move = `${uid}-move`;
  const isHere = (a: Axial) => a.q === here.q && a.r === here.r;
  return (
    <svg
      className="rpg-hexflower-diagram"
      viewBox={`${-halfW} ${-halfH} ${halfW * 2} ${halfH * 2}`}
      role="group"
      aria-label={`${flower.title ?? "Hex flower"}: choose a hex to put the token there`}
    >
      <defs>
        <marker
          id={head}
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="rpg-hexflower-arrowhead" />
        </marker>
        <marker
          id={move}
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" className="rpg-hexflower-movehead" />
        </marker>
      </defs>
      {/* Hexes: fills and thin inner lines; the current one is ringed. */}
      {hexes.map((a) => {
        const c = at(a);
        const cell = flower.cells.get(hexKey(a.q, a.r));
        const start = a.q === 0 && a.r === 0;
        const name = start
          ? `Start${flower.start === "previous" ? ", repeats the last result" : `, gives ${flower.start}`}`
          : (cell?.text ?? "empty");
        return (
          <g
            key={hexKey(a.q, a.r)}
            className={`rpg-hexflower-cell${start ? " is-start" : ""}${isHere(a) ? " is-here" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`${name}${isHere(a) ? " (token here)" : ""}`}
            aria-current={isHere(a) ? "location" : undefined}
            onClick={() => onPlace(a)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPlace(a);
              }
            }}
          >
            <polygon points={hexPolygon(c)} />
            {isHere(a) && <polygon className="rpg-hexflower-here" points={hexPolygon(c, R * 0.86)} />}
          </g>
        );
      })}
      <path className="rpg-hexflower-outline" d={outlinePath(hexes, flower.radius)} />
      {flower.arrows.map((arrow, i) => (
        <path
          key={`arrow:${i}`}
          className="rpg-hexflower-arrow"
          d={arrowPath(arrow.from, arrow.side, arrow.to)}
          markerEnd={`url(#${head})`}
        />
      ))}
      {last &&
        movePaths(last).map((d, i, all) => (
          <path
            key={`move:${i}`}
            className={`rpg-hexflower-move${last.wrapped ? " is-wrapped" : ""}`}
            d={d}
            markerEnd={i === all.length - 1 ? `url(#${move})` : undefined}
          />
        ))}
      {/* Lettering last, with a halo, so lines never run through it. */}
      <g className="rpg-hexflower-lettering" aria-hidden="true">
        {hexes.map((a) => {
          const c = at(a);
          const start = a.q === 0 && a.r === 0;
          const lines = start ? ["START"] : cellLines(flower.cells.get(hexKey(a.q, a.r))?.text ?? "");
          const lh = 1.15;
          return (
            <g key={hexKey(a.q, a.r)}>
              <text
                className={start ? "rpg-hexflower-start" : "rpg-hexflower-label"}
                x={c.x}
                y={c.y}
                dy={`${0.35 - ((lines.length - 1) * lh) / 2}em`}
              >
                {lines.map((l, i) => (
                  <tspan key={i} x={c.x} dy={i === 0 ? undefined : `${lh}em`}>
                    {l.toUpperCase()}
                  </tspan>
                ))}
              </text>
              {start &&
                SIDES.map((side) => {
                  const p = add(c, unit(SIDE_ANGLE[side]), R * 0.6);
                  return (
                    <text key={side} className="rpg-hexflower-number" x={p.x} y={p.y} dy="0.35em">
                      {numbers[side]}
                    </text>
                  );
                })}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function stepText(step: FlowerStep, flower: HexFlower): string {
  const how = step.arrow ? ", by the arrow" : step.wrapped ? ", round the edge" : "";
  const pick =
    step.pick !== undefined
      ? ` · d${pickDie(flower.cells.get(hexKey(step.to.q, step.to.r))?.options.length ?? 2)} ${step.pick}`
      : "";
  return `${step.dice.join(" + ")} = ${step.total} · ${step.side}${how}${pick}${step.start ? " · Start" : ""}`;
}

function entryText(e: FlowerEntry): string {
  return e.kind === "roll" ? e.step.result : `Put on ${e.cell || "Start"}`;
}

const TEMP_CLASS: Record<Temperature, string> = { [-1]: "is-cold", 0: "is-temperate", 1: "is-hot" };

export function HexFlowerView({
  flower,
  storeKey,
  sourcePath,
  app,
}: {
  flower: HexFlower;
  storeKey: string;
  sourcePath: string;
  app?: App;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const record = React.useSyncExternalStore(
    React.useCallback((l) => subscribeFlower(storeKey, l), [storeKey]),
    () => getFlower(storeKey)
  );
  const state = record?.state ?? startState();
  const history = record?.history ?? [];
  const lastRoll = history.find((e): e is Extract<FlowerEntry, { kind: "roll" }> => e.kind === "roll");
  const latest = history[0];
  const [showAll, setShowAll] = React.useState(false);

  // The doubles table, read once, so a roll can use it at once.
  const [table, setTable] = React.useState<TableDef | null>(null);
  React.useEffect(() => {
    if (!app || !flower.doublesTable) return;
    let alive = true;
    void loadVaultTable(app, flower.doublesTable, sourcePath).then((t) => alive && setTable(t));
    return () => {
      alive = false;
    };
  }, [app, flower.doublesTable, sourcePath]);

  const roll = () => {
    const { step, state: next } = rollFlower(flower, state);
    const element = step.doubles && table ? rollTable(table) : null;
    const entry: FlowerEntry = {
      kind: "roll",
      step,
      ...(element ? { element: { name: element.name, text: element.text } } : {}),
    };
    setFlower(storeKey, { state: next, history: [entry, ...history].slice(0, 30) });
  };
  const place = (a: Axial) => {
    if (a.q === state.at.q && a.r === state.at.r) return;
    const cell = a.q === 0 && a.r === 0 ? "Start" : (flower.cells.get(hexKey(a.q, a.r))?.text ?? "");
    setFlower(storeKey, {
      state: { ...state, at: a },
      history: [{ kind: "place" as const, to: a, cell }, ...history].slice(0, 30),
    });
  };
  const reset = () => setFlower(storeKey, { state: startState(), history: [], undo: { state, history } });
  const undo = () => record?.undo && setFlower(storeKey, { state: record.undo.state, history: record.undo.history });

  const earlier = history.slice(1);
  const shown = showAll ? earlier : earlier.slice(0, HISTORY_SHOWN);

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
      <FlowerDiagram
        flower={flower}
        here={state.at}
        last={latest?.kind === "roll" ? lastRoll?.step : undefined}
        onPlace={place}
        uid={uid}
      />
      <div className="rpg-hexflower-controls">
        <button className="mod-cta rpg-hexflower-roll" onClick={roll} type="button">
          <LucideIcon name="dices" size={16} /> Roll {flower.dice.count}d{flower.dice.sides}
        </button>
        {flower.temperature && (
          <span
            className={`rpg-hexflower-weather ${TEMP_CLASS[state.temperature]}`}
            title="A 1 on a die turns colder, a 6 warmer; both at once, back to temperate"
          >
            {TEMPERATURE_NAMES[state.temperature]}
          </span>
        )}
        {record?.undo && history.length === 0 ? (
          <button type="button" className="rpg-hexflower-quiet" onClick={undo}>
            <LucideIcon name="undo-2" size={14} /> Undo reset
          </button>
        ) : (
          <button
            type="button"
            className="rpg-hexflower-quiet"
            disabled={history.length === 0}
            onClick={reset}
            aria-label="Put the token back on Start and clear the rolls"
          >
            <LucideIcon name="rotate-ccw" size={14} /> Reset
          </button>
        )}
      </div>
      {latest && (
        <div className="rpg-hexflower-result" aria-live="polite">
          {latest.kind === "roll" ? (
            <>
              <div className="rpg-hexflower-result-line">
                <strong>{latest.step.result}</strong>
                <span className="rpg-hexflower-detail">{stepText(latest.step, flower)}</span>
                {latest.step.shifted && (
                  <span className="rpg-hexflower-detail">
                    {" "}
                    · now {TEMPERATURE_NAMES[latest.step.temperature].toLowerCase()}
                  </span>
                )}
              </div>
              {latest.step.doubles && (latest.element || flower.doubles) && (
                <div className="rpg-hexflower-doubles">
                  <span className="rpg-hexflower-doubles-label">Doubles</span>
                  {latest.element ? (
                    <Markdown
                      source={latest.element.text}
                      sourcePath={sourcePath}
                      className="rpg-hexflower-doubles-text"
                    />
                  ) : (
                    <Markdown source={flower.doubles!} sourcePath={sourcePath} className="rpg-hexflower-doubles-text" />
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rpg-hexflower-result-line">
              <strong>{latest.cell || "Start"}</strong>
              <span className="rpg-hexflower-detail">token put here by hand</span>
            </div>
          )}
        </div>
      )}
      {earlier.length > 0 && (
        <div className="rpg-hexflower-history">
          <span className="rpg-hexflower-history-label">Earlier</span>
          <ul>
            {shown.map((e, i) => (
              <li key={i}>
                <span className="rpg-hexflower-history-result">{entryText(e)}</span>
                {e.kind === "roll" && (
                  <span className="rpg-hexflower-detail">
                    {" "}
                    {e.step.total} · {e.step.side}
                    {e.element ? ` · ${e.element.name}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {earlier.length > HISTORY_SHOWN && (
            <button type="button" className="rpg-hexflower-quiet" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${earlier.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export class HexFlowerRenderChild extends MarkdownRenderChild {
  private root: ReactDOM.Root | null = null;

  constructor(
    el: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly app?: App
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
        {...(this.app ? { app: this.app } : {})}
      />
    );
  }

  onunload(): void {
    this.root?.unmount();
    this.root = null;
  }
}
