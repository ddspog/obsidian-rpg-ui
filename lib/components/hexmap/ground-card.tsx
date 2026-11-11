/**
 * "Here": what the ground the party stands on means, at the entry being read — the terrain and its
 * rules, the region and how settled it is, the weather and what it costs, the hex's distinct
 * elements and their rules, and whether the party is lost. Under the log's minimap (folded to one
 * line) and in the journey view (open).
 */

import * as React from "react";
import type { HexLayout } from "lib/domains/hexmap/layout";
import { HEX_ELEMENT_RULES, TERRAIN_RULES, WEATHER, type WeatherId } from "lib/domains/hexmap/terrain";
import type { TravelFrame } from "lib/domains/session-log/travel";
import { partySpot } from "lib/domains/session-log/travel";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function GroundCard({
  frame,
  layout,
  weather,
  open = false,
}: {
  frame: TravelFrame;
  layout?: HexLayout;
  weather?: WeatherId | null;
  /** Shown whole (the journey view); else folded to its first line. */
  open?: boolean;
}) {
  const spot = partySpot(frame);
  const info = spot && layout ? layout.hexes.get(`${spot.at[0]},${spot.at[1]}`) : undefined;
  const rules = info?.terrain ? TERRAIN_RULES[info.terrain] : undefined;
  const w = weather && weather !== "agreeable" ? WEATHER[weather] : undefined;
  const believed = spot ? frame.believed?.[spot.token] : undefined;
  const region = info?.regions.length
    ? (layout?.regions.find((g) => g.name === info.regions[info.regions.length - 1])?.title ??
      info.regions[info.regions.length - 1])
    : undefined;
  if (!spot && !w) return null;

  const headline = [
    rules?.name ?? (spot ? "Unknown ground" : null),
    region,
    w ? w.name.toLowerCase() : null,
    believed ? "lost" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const facts: Array<[string, string]> = [];
  if (rules) {
    facts.push([
      "Ground",
      [
        rules.difficult && !info?.road ? "difficult (half speed)" : info?.road ? "road: not difficult" : "open",
        rules.maxPace ? `fastest ${rules.maxPace}${info?.road ? " (+1 by road)" : ""}` : "by boat",
        info?.river ? "a river runs here" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ]);
    facts.push([
      "Checks",
      [
        `navigate DC ${rules.navigationDC} (+5 fast${w?.navDisadvantage ? ", disadvantage" : ""})`,
        `forage DC ${rules.foragingDC}${w?.forageAdvantage ? " (advantage)" : ""}`,
        rules.campDC !== undefined ? `camp DC ${rules.campDC}` : null,
        `search DC ${rules.searchDC}`,
      ]
        .filter(Boolean)
        .join(" · "),
    ]);
    facts.push(["Encounters", `noticed at ${rules.encounterDistance}`]);
  }
  if (info?.population) facts.push(["People", `${cap(info.population)} population`]);
  if (w)
    facts.push([
      "Weather",
      [
        w.name,
        w.time === null ? "no travel without magic" : w.time !== 1 ? `travel time ×${w.time}` : null,
        w.navDisadvantage ? "disadvantage to navigate" : null,
        w.exhaustionPerHex ? "a level of exhaustion each hex" : null,
        w.forageAdvantage ? "advantage to forage" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ]);
  for (const e of info?.elements ?? []) facts.push([HEX_ELEMENT_RULES[e].name, HEX_ELEMENT_RULES[e].rule]);
  if (believed && spot)
    facts.push(["Lost", `really at (${spot.at[0]},${spot.at[1]}); believes (${believed[0]},${believed[1]})`]);

  const body = (
    <dl className="lonelog-ground-facts">
      {facts.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
  return open ? (
    <section className="lonelog-ground is-open" aria-label="Where the party stands">
      <header>
        <strong>Here</strong>
        {spot && (
          <span className="lonelog-ground-at">
            ({spot.at[0]},{spot.at[1]})
          </span>
        )}{" "}
        <span>{headline}</span>
      </header>
      {body}
    </section>
  ) : (
    <details className="lonelog-ground" aria-label="Where the party stands">
      <summary>
        <strong>Here</strong> <span>{headline}</span>
      </summary>
      {body}
    </details>
  );
}
