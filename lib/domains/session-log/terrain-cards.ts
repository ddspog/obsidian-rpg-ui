/**
 * The checks the ground asks for, as cards: what changes with the terrain the party stands on (the
 * travel map's hex) and the weather (the log's last `[Weather: …]`).
 *
 * The party makes some of them as one, with one member rolling for it — finding the way, making
 * camp — and those go on the Party's cards. Each member can make the others — foraging, searching the
 * area, keeping watch — and those go on every character's cards. A card is offered only where its
 * check exists: no camp to make in a city, and nothing at all off the map.
 *
 * Numbers from the Campaign Builder's Running Exploration (Settings › Maps › Terrain types).
 */

import type { CardStack, SessionFeatureCard } from "./card-types";
import { TERRAIN_RULES, WEATHER, type TerrainId, type WeatherId } from "lib/domains/hexmap/terrain";

export interface TerrainCardsInput {
  terrain?: TerrainId;
  weather?: WeatherId;
}

interface Spec {
  key: string;
  name: string;
  icon: string;
  summary: string;
  /** The card's lines, `{{actor}}` for whoever plays it. */
  lines: string[];
}

const die = (mode?: "advantage" | "disadvantage") =>
  mode === "advantage" ? "2d20kh1" : mode === "disadvantage" ? "2d20kl1" : "d20";

/** Who rolls for the party: a pick of its members, or the party itself when nobody is known. */
const roller = (members: string[]) => (members.length > 0 ? `{{who:${members.join("|")}}}` : "Party");

function partySpecs(t: TerrainCardsInput, members: string[]): Spec[] {
  const rules = t.terrain ? TERRAIN_RULES[t.terrain] : undefined;
  if (!rules) return [];
  const w = t.weather ? WEATHER[t.weather] : undefined;
  const ground = rules.name.toLowerCase();
  const specs: Spec[] = [
    {
      key: "navigate",
      name: "Navigate",
      icon: "compass",
      summary:
        `Stay on course across the ${ground}: a Survival check, DC ${rules.navigationDC} (DC ${rules.navigationDC + 5} at a fast pace)` +
        `${w?.navDisadvantage ? `, with disadvantage in ${w.name.toLowerCase()} weather` : ""}. Fail it and the party is lost.`,
      lines: [
        `@(Party) Navigates the ${ground}`,
        `d(${roller(members)}): Survival | ${die(w?.navDisadvantage ? "disadvantage" : undefined)}+[[Survival]]= vs DC ${rules.navigationDC} ->`,
        "=> {{outcome?}}",
      ],
    },
  ];
  if (rules.campDC !== undefined)
    specs.push({
      key: "camp",
      name: "Make Camp",
      icon: "tent",
      summary: `Find a good place to camp in the ${ground}: a Survival check, DC ${rules.campDC}. A poor camp makes for a poor rest.`,
      lines: [
        `@(Party) Makes camp in the ${ground}`,
        `d(${roller(members)}): Survival | d20+[[Survival]]= vs DC ${rules.campDC} ->`,
        "=> {{outcome?}}",
      ],
    });
  return specs;
}

function memberSpecs(t: TerrainCardsInput): Spec[] {
  const rules = t.terrain ? TERRAIN_RULES[t.terrain] : undefined;
  if (!rules) return [];
  const w = t.weather ? WEATHER[t.weather] : undefined;
  const ground = rules.name.toLowerCase();
  return [
    {
      key: "forage",
      name: "Forage",
      icon: "sprout",
      summary:
        `Gather food and water in the ${ground}: a Survival check, DC ${rules.foragingDC}` +
        `${w?.forageAdvantage ? `, with advantage in ${w.name.toLowerCase()} weather` : ""}.`,
      lines: [
        `@({{actor}}) Forages in the ${ground}`,
        `d({{actor}}): Survival | ${die(w?.forageAdvantage ? "advantage" : undefined)}+[[Survival]]= vs DC ${rules.foragingDC} ->`,
        "=> {{outcome?}}",
      ],
    },
    {
      key: "search",
      name: "Search the Area",
      icon: "search",
      summary: `Look for what this hex hides (a lair, a ruin, a trail): an Investigation check, DC ${rules.searchDC}.`,
      lines: [
        `@({{actor}}) Searches the ${ground}`,
        `d({{actor}}): Investigation | d20+[[Investigation]]= vs DC ${rules.searchDC} ->`,
        "=> {{outcome?}}",
      ],
    },
    {
      key: "watch",
      name: "Keep Watch",
      icon: "eye",
      summary: `Watch for what comes: a Perception check. In the ${ground} creatures are noticed ${rules.encounterDistance} away.`,
      lines: [`@({{actor}}) Keeps watch`, `d({{actor}}): Perception | d20+[[Perception]]=`, "=> {{outcome?}}"],
    },
  ];
}

const card = (spec: Spec, actor: string, scope: string): SessionFeatureCard => ({
  id: `terrain:${scope}:${spec.key}`,
  name: spec.name,
  bucket: "action",
  logTemplate: spec.lines.join("\n"),
  summary: spec.summary,
  icon: spec.icon,
  source: "terrain",
  actor,
});

/** The stack of what the ground lets the party do as one (on the Party's cards), or null. */
export function partyTerrainStack(t: TerrainCardsInput, members: string[]): CardStack | null {
  const specs = partySpecs(t, members);
  if (specs.length === 0 || !t.terrain) return null;
  return {
    actor: "Party",
    actorType: "pc",
    bucket: "party-ground",
    label: TERRAIN_RULES[t.terrain].name,
    cards: specs.map((s) => card(s, "Party", "party")),
  };
}

/** The stack of what the ground lets one member do (on each character's cards), or null. */
export function memberTerrainStack(t: TerrainCardsInput, actor: string): CardStack | null {
  const specs = memberSpecs(t);
  if (specs.length === 0 || !t.terrain) return null;
  return {
    actor,
    actorType: "pc",
    bucket: "terrain",
    label: TERRAIN_RULES[t.terrain].name,
    cards: specs.map((s) => card(s, actor, actor)),
  };
}
