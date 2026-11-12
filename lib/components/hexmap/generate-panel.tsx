/**
 * Build's Generate tool, in the sidebar: which hex flower it rolls, how warm the walk is, and what
 * the last rolls gave. See lib/domains/hexflower/generate.ts.
 */

import * as React from "react";
import type { FoundFlower } from "lib/domains/hexflower/find-flowers";
import type { Generated } from "lib/domains/hexflower/generate";
import { type Temperature, TEMPERATURE_NAMES } from "lib/domains/hexflower/hex-flower";

export interface GeneratePanelProps {
  flowers: FoundFlower[] | null;
  chosen?: FoundFlower;
  onChoose: (key: string) => void;
  temperature: Temperature;
  log: Generated[];
  onReset: () => void;
  /** The map names its flower (`generate:` in its head). */
  named: boolean;
  /** On a detail level: keep the walk near what the bigger hex is. */
  tether?: { on: boolean; onChange: (on: boolean) => void };
}

export const flowerKey = (f: FoundFlower) => `${f.path}#${f.title}`;

export function GeneratePanel({
  flowers,
  chosen,
  onChoose,
  temperature,
  log,
  onReset,
  named,
  tether,
}: GeneratePanelProps) {
  return (
    <section className="rpg-hexpaint-brush rpg-hexpaint-generate" aria-label="Generate">
      <dl className="rpg-hexpaint-fields">
        <dt>Flower</dt>
        <dd>
          {flowers === null ? (
            <span className="rpg-hexpaint-muted">Finding hex flowers…</span>
          ) : flowers.length === 0 ? (
            <span className="rpg-hexpaint-muted">None: add an rpg hexflower block to a note</span>
          ) : (
            <select
              aria-label="Hex flower"
              value={chosen ? flowerKey(chosen) : ""}
              onChange={(e) => onChoose(e.target.value)}
              title={named ? "This map's generate: names its flower; choosing here is for this session" : undefined}
            >
              {flowers.map((f) => (
                <option key={flowerKey(f)} value={flowerKey(f)}>
                  {f.title}
                </option>
              ))}
            </select>
          )}
        </dd>
        {chosen?.flower.temperature && (
          <>
            <dt>Weather</dt>
            <dd>{TEMPERATURE_NAMES[temperature]}</dd>
          </>
        )}
      </dl>
      {tether && (
        <label className="rpg-hexpaint-generate-tether">
          <input type="checkbox" checked={tether.on} onChange={(e) => tether.onChange(e.target.checked)} />
          <span>
            Keep to the big hex
            <small className="rpg-hexpaint-muted">
              {" "}
              Each roll starts from what the bigger hex is, and the token never strays more than one step from it on the
              flower.
            </small>
          </span>
        </label>
      )}
      <p className="rpg-hexpaint-muted rpg-hexpaint-generate-hint">
        Drag across empty hexes to walk the flower, or click a filled hex to fill the empty ones round it.
      </p>
      {log.length > 0 && (
        <ol className="rpg-hexpaint-generate-log">
          {log.slice(0, 8).map((g, i) => (
            <li key={i}>
              <span>
                ({g.hex.q},{g.hex.r})
              </span>{" "}
              <strong>{g.step.result}</strong>
              {g.step.doubles && (
                <em title={g.element?.text ?? "Both dice alike: the book adds a distinct element to the hex"}>
                  {" "}
                  · doubles{g.element ? `: ${g.element.name}` : ""}
                </em>
              )}
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={onReset} disabled={log.length === 0}>
        Start a new walk
      </button>
    </section>
  );
}
