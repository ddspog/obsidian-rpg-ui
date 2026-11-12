/**
 * The party's ground: what the hex the party stands on means for play, at the entry being read, in
 * the order a hexcrawl turn runs — how long the hex takes to cross, the check to stay on course, how
 * far off encounters start, then foraging, camp and searching. The weather is counted inside the row
 * it changes; the hex's distinct elements add their rules; a lost party is told where it believes it
 * is and how to find its bearings. Under the log's minimap (folded to the ground and its two numbers
 * that matter most) and in the journey view (open).
 */

import * as React from "react";
import { hexKey } from "lib/domains/hexmap/axial";
import type { HexInfo, HexLayout } from "lib/domains/hexmap/layout";
import {
  HEX_ELEMENT_RULES,
  PACES,
  routeSteps,
  TERRAIN_RULES,
  travelHoursText,
  WEATHER,
  type Pace,
  type Population,
  type TerrainGrid,
  type TerrainRules,
  type WeatherId,
} from "lib/domains/hexmap/terrain";
import type { TravelFrame } from "lib/domains/session-log/travel";
import { partySpot } from "lib/domains/session-log/travel";

const POPULATION: Record<Population, string> = {
  low: "Sparsely settled",
  medium: "Settled",
  high: "Well settled",
};

/** How long crossing this one hex takes at each pace (the ground caps it; null where it can't go). */
function crossing(
  info: HexInfo,
  at: [number, number],
  hexMiles: number,
  weather: WeatherId
): Array<{ pace: Pace; ran: Pace; hours: number; difficult: boolean }> {
  const key = hexKey(at[0], at[1]);
  const grid: TerrainGrid = {
    terrain: new Map(info.terrain ? [[key, info.terrain]] : []),
    roads: new Set(info.road ? [key] : []),
    rivers: new Set(),
    elements: new Map(info.elements?.length ? [[key, info.elements]] : []),
  };
  const hex = { q: at[0], r: at[1] };
  return PACES.map((pace) => {
    const [s] = routeSteps([hex, hex], grid, pace, hexMiles, { weather });
    return { pace, ran: s.pace, hours: s.hours, difficult: s.difficult };
  });
}

/** The folded line's numbers: how fast the party goes here, and the check to stay on course. */
function verdict(rules: TerrainRules | undefined, info: HexInfo | undefined, navDis: boolean): string[] {
  if (!rules) return [];
  const overgrown = info?.elements?.some((e) => HEX_ELEMENT_RULES[e].difficult) ?? false;
  const speed =
    rules.maxPace === null
      ? "by boat only"
      : (rules.difficult || overgrown) && !info?.road
        ? "half speed"
        : rules.difficult && info?.road
          ? "full speed on the road"
          : "full speed";
  return [speed, `navigate DC ${rules.navigationDC}${navDis ? ", disadv." : ""}`];
}

function termsOf(frame: TravelFrame | undefined, layout: HexLayout | undefined) {
  const spot = frame ? partySpot(frame) : null;
  const info = spot && layout ? layout.hexes.get(`${spot.at[0]},${spot.at[1]}`) : undefined;
  return { spot, info, rules: info?.terrain ? TERRAIN_RULES[info.terrain] : undefined };
}

export function GroundCard({
  frame,
  previous,
  layout,
  hexMiles,
  weather,
  lost,
  open = false,
}: {
  frame: TravelFrame;
  /** The step before, to say what changed on entering this hex. */
  previous?: TravelFrame;
  layout?: HexLayout;
  /** The map's hex width in miles, for the time to cross; unknown, the card says "half speed" only. */
  hexMiles?: number;
  weather?: WeatherId | null;
  /** Lost: whether the real hex is shown (the GM's look) or only where the party believes it is. */
  lost?: { shown: boolean; onShow: (shown: boolean) => void };
  /** Shown whole (the journey view); else folded to its first line. */
  open?: boolean;
}) {
  const [how, setHow] = React.useState(false);
  const { spot, info, rules } = termsOf(frame, layout);
  const w = weather ? WEATHER[weather] : undefined;
  const bad = w && weather !== "agreeable" ? w : undefined;
  const believed = spot ? frame.believed?.[spot.token] : undefined;
  const region = info?.regions.length
    ? (layout?.regions.find((g) => g.name === info.regions[info.regions.length - 1])?.title ??
      info.regions[info.regions.length - 1])
    : undefined;
  if (!spot && !bad) return null;

  const ground = rules?.name ?? (spot ? "Unmapped ground" : "Weather");
  const place = [ground, region].filter(Boolean).join(" · ");
  const numbers = verdict(rules, info, !!bad?.navDisadvantage);

  // What changed on entering this hex: the ground, and the two numbers of the folded line.
  const before = previous ? termsOf(previous, layout) : null;
  const moved = before?.spot && spot && hexKey(...before.spot.at) !== hexKey(...spot.at);
  const change =
    moved && before?.rules && rules && before.rules.id !== rules.id
      ? `Entered from ${before.rules.name}` +
        (before.rules.navigationDC !== rules.navigationDC
          ? `: navigate DC ${before.rules.navigationDC} → ${rules.navigationDC}`
          : "")
      : null;

  const facts: Array<[string, React.ReactNode]> = [];
  if (rules && info && spot) {
    const runs = hexMiles ? crossing(info, spot.at, hexMiles, weather ?? "agreeable") : null;
    const normal = runs?.find((r) => r.pace === "normal");
    const why = [
      (rules.difficult || info.elements?.some((e) => HEX_ELEMENT_RULES[e].difficult)) && !info.road
        ? "difficult ground: half speed"
        : null,
      rules.difficult && info.road ? "difficult, but the road is easy going" : null,
      !rules.difficult && info.road ? "a road runs here" : null,
      info.river && !info.road ? "fording the river is difficult too" : null,
      rules.maxPace && rules.maxPace !== "fast"
        ? `${rules.maxPace} pace at most${info.road ? " (fast on the road)" : ""}`
        : null,
      bad?.time === null
        ? `${bad.name.toLowerCase()} weather: no travel without magic`
        : bad && bad.time !== 1
          ? `${bad.name.toLowerCase()} weather: twice as long`
          : null,
      bad?.exhaustionPerHex ? "a level of exhaustion each hex" : null,
    ].filter(Boolean);
    if (rules.maxPace === null) facts.push(["Crossing", "Water: by boat only"]);
    else
      facts.push([
        "Crossing",
        <>
          {normal && normal.hours > 0 && (
            <>
              <strong>{travelHoursText(normal.hours)}</strong> at normal pace
              {runs!
                .filter((r) => r.pace !== "normal" && r.ran === r.pace)
                .map((r) => ` · ${travelHoursText(r.hours)} ${r.pace}`)
                .join("")}
              {why.length ? " — " : ""}
            </>
          )}
          {why.join(" · ")}
        </>,
      ]);
    facts.push([
      believed ? "Bearings" : "Navigate",
      [
        `DC ${rules.navigationDC}`,
        `DC ${rules.navigationDC + 5} at fast pace`,
        bad?.navDisadvantage ? `disadvantage (${bad.name.toLowerCase()} weather)` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ]);
    facts.push([
      "Encounters",
      [`start ${rules.encounterDistance} away`, info.population ? POPULATION[info.population].toLowerCase() : null]
        .filter(Boolean)
        .join(" · "),
    ]);
    facts.push([
      "Camp",
      [
        `forage DC ${rules.foragingDC}${bad?.forageAdvantage || w?.forageAdvantage ? " (advantage)" : ""}`,
        rules.campDC !== undefined ? `make camp DC ${rules.campDC}` : null,
        `search DC ${rules.searchDC}`,
      ]
        .filter(Boolean)
        .join(" · "),
    ]);
  } else if (bad) {
    facts.push([
      "Weather",
      [
        bad.name,
        bad.time === null ? "no travel without magic" : bad.time !== 1 ? "travel takes twice as long" : null,
        bad.navDisadvantage ? "disadvantage to navigate" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ]);
  }
  for (const e of info?.elements ?? []) {
    const rule = HEX_ELEMENT_RULES[e];
    facts.push([rule.name, <span title={rule.rule}>{rule.rule}</span>]);
  }
  // Lost: where the party believes it is, and (only when the GM shows it) where it really is.
  const hidden = !!lost && !lost.shown;
  if (believed && spot)
    facts.push([
      "Lost",
      <>
        {`The party believes it is at (${believed[0]},${believed[1]})`}
        {hidden ? ". " : `; it is really at (${spot.at[0]},${spot.at[1]}). `}
        {rules ? `A navigate check (DC ${rules.navigationDC}) finds its bearings.` : ""}
        {lost && (
          <button type="button" className="lonelog-ground-reveal" onClick={() => lost.onShow(!lost.shown)}>
            {lost.shown ? "Hide where they really are" : "Show where they really are"}
          </button>
        )}
      </>,
    ]);

  const body = (
    <div className="lonelog-ground-body">
      {change && <p className="lonelog-ground-change">{change}</p>}
      <dl className="lonelog-ground-facts">
        {facts.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <button type="button" className="lonelog-ground-how" aria-expanded={how} onClick={() => setHow((v) => !v)}>
        How this works
      </button>
      {how && (
        <div className="lonelog-ground-explain">
          <p>
            Each hex the party enters costs time and asks for checks. The rows follow a hexcrawl turn, as the Campaign
            Builder's <em>Running Exploration</em> runs it:
          </p>
          <ul>
            <li>
              <strong>Crossing</strong>: the hours to cross one hex of this map at each pace. Difficult ground (and a
              river without a bridge) halves the speed; a road cancels difficult ground and lifts the pace cap by one;
              bad weather doubles the time.
            </li>
            <li>
              <strong>Navigate</strong>: the Survival check to stay on course; +5 at a fast pace, and with disadvantage
              in inclement weather or worse. Fail it and the party is lost.
            </li>
            <li>
              <strong>Encounters</strong>: how far apart the party and a creature are when one notices the other, and
              how settled the region is (the encounter check's odds).
            </li>
            <li>
              <strong>Camp</strong>: the checks to forage, to make a good camp, and to search the hex.
            </li>
          </ul>
          <p>
            The numbers are the terrain's, from Settings › Maps › Terrain types, where you can change them. The weather
            is the log's last <code>[Weather: …]</code> at the entry you're reading.
          </p>
        </div>
      )}
    </div>
  );
  const label = `The party's ground: ${place}`;
  const head = (
    <>
      <span className="lonelog-ground-place">
        {believed && <span className="lonelog-ground-lost">Lost</span>}
        {place}
        {bad && <span className="lonelog-ground-weather"> · {bad.name.toLowerCase()} weather</span>}
      </span>
      {numbers.length > 0 && <span className="lonelog-ground-numbers">{numbers.join(" · ")}</span>}
    </>
  );
  return open ? (
    <section className="lonelog-ground is-open" aria-label={label}>
      <header>{head}</header>
      {body}
    </section>
  ) : (
    <details className="lonelog-ground" aria-label={label}>
      <summary title="What the party's ground means: open for the rules">{head}</summary>
      {body}
    </details>
  );
}
