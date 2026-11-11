/**
 * What kind of ground each hex is — its terrain type (forest, hills, swamp…) — and the travel rules
 * that come with it (design: docs/hexcrawl-exploration.md).
 *
 * A hex's type is, in order:
 *  1. its own `terrain=hills` on the terrain line;
 *  2. the map's `classify:` rules, then its pack's `classify:` rules (pack.yml), then the built-in
 *     rules below, matched against the path of the tile the hex draws (`land/forest/lush/conifer-0`);
 *  3. the words of the spec itself (`forest[lush]`, a catalog name like `conifer-forest`), for maps
 *     drawn without a pack's files.
 *
 * The rules come from Tales of the Valiant's Game Master's Guide (Travel Terrain and Overland
 * Navigation tables), the Campaign Builder's hexcrawl chapter (Adjusted Travel Speed by Map Element)
 * and the Solo Adventurer's Toolbox (campsite DCs). Which terrain is *difficult* follows the
 * Player's Guide: dense forests, deep swamps, rubble-strewn ruins, steep mountains, ice-covered ground.
 */

import { type Axial, hexKey } from "./axial";

export type Pace = "slow" | "normal" | "fast";
export const PACES: Pace[] = ["slow", "normal", "fast"];

/** Miles a day (8 hours) at each pace on open ground (Player's Guide). */
export const PACE_MILES: Record<Pace, number> = { slow: 18, normal: 24, fast: 30 };

export const TERRAIN_IDS = [
  "arctic",
  "badlands",
  "coastal",
  "desert",
  "farmland",
  "forest",
  "grassland",
  "hills",
  "jungle",
  "mountain",
  "ruins",
  "swamp",
  "underground",
  "urban",
  "water",
] as const;
export type TerrainId = (typeof TERRAIN_IDS)[number];

export interface TerrainRules {
  id: TerrainId;
  name: string;
  /** Halves travel speed (a road through it cancels this). */
  difficult: boolean;
  /** The fastest pace the ground allows; a good road raises it one step. `null`: not on foot (water). */
  maxPace: Pace | null;
  /** WIS (Survival) to keep from getting lost, at a normal or slow pace (+5 fast). */
  navigationDC: number;
  foragingDC: number;
  /** WIS (Perception) to find a place you're looking for. */
  searchDC: number;
  /** WIS (Survival) to find a campsite (Solo Adventurer's Toolbox). */
  campDC?: number;
  /** How far apart creatures notice each other. */
  encounterDistance: string;
}

const r = (
  id: TerrainId,
  name: string,
  difficult: boolean,
  maxPace: Pace | null,
  navigationDC: number,
  foragingDC: number,
  searchDC: number,
  campDC: number | undefined,
  encounterDistance: string
): TerrainRules => ({ id, name, difficult, maxPace, navigationDC, foragingDC, searchDC, campDC, encounterDistance });

export const TERRAIN_RULES: Record<TerrainId, TerrainRules> = {
  arctic: r("arctic", "Arctic", true, "fast", 10, 20, 10, 14, "6d6 × 10 ft"),
  badlands: r("badlands", "Badlands", false, "normal", 10, 20, 15, 8, "6d6 × 10 ft"),
  coastal: r("coastal", "Coastal", false, "normal", 5, 10, 15, 8, "2d10 × 10 ft"),
  desert: r("desert", "Desert", false, "normal", 10, 20, 10, 8, "6d6 × 10 ft"),
  farmland: r("farmland", "Farmland", false, "fast", 5, 10, 15, 8, "6d6 × 10 ft"),
  forest: r("forest", "Forest", true, "normal", 15, 10, 15, 6, "2d8 × 10 ft"),
  grassland: r("grassland", "Grassland", false, "fast", 5, 15, 15, 8, "6d6 × 10 ft"),
  hills: r("hills", "Hills", false, "normal", 10, 15, 15, 6, "2d10 × 10 ft"),
  jungle: r("jungle", "Jungle", true, "slow", 15, 10, 20, 6, "2d8 × 10 ft"),
  mountain: r("mountain", "Mountain", true, "slow", 15, 20, 20, 14, "4d10 × 10 ft"),
  ruins: r("ruins", "Ruins", true, "normal", 15, 20, 15, 10, "2d6 × 10 ft"),
  swamp: r("swamp", "Swamp", true, "slow", 15, 10, 20, 12, "2d8 × 10 ft"),
  underground: r("underground", "Underground", false, "normal", 10, 20, 20, 10, "2d6 × 10 ft"),
  urban: r("urban", "Urban", false, "normal", 15, 20, 15, undefined, "2d6 × 10 ft"),
  water: r("water", "Water", false, null, 10, 15, 15, undefined, "6d6 × 10 ft"),
};

/** What the settings change in a terrain type's rules (Settings › Hex maps › Terrain types). */
export type TerrainOverrides = Partial<Record<TerrainId, Partial<Omit<TerrainRules, "id" | "name">>>>;

/** The rules as the books give them, before the settings' changes. */
export const BOOK_TERRAIN_RULES: Readonly<Record<TerrainId, TerrainRules>> = Object.freeze(
  Object.fromEntries(Object.entries(TERRAIN_RULES).map(([k, v]) => [k, Object.freeze({ ...v })])) as Record<
    TerrainId,
    TerrainRules
  >
);

/** Puts the settings' changes over the books' rules (in place: every reader of TERRAIN_RULES sees them). */
export function applyTerrainOverrides(overrides: TerrainOverrides | undefined): void {
  for (const id of TERRAIN_IDS) {
    const own = overrides?.[id] ?? {};
    Object.assign(TERRAIN_RULES[id], BOOK_TERRAIN_RULES[id], own, { id, name: BOOK_TERRAIN_RULES[id].name });
  }
}

/** Other words for a terrain type, as specs, catalog names and books write them. */
const ALIASES: Record<string, TerrainId> = {
  plains: "grassland",
  plain: "grassland",
  meadow: "grassland",
  grass: "grassland",
  steppe: "grassland",
  savanna: "grassland",
  fields: "farmland",
  field: "farmland",
  farm: "farmland",
  woods: "forest",
  wood: "forest",
  conifer: "forest",
  deciduous: "forest",
  hill: "hills",
  foothills: "hills",
  highlands: "hills",
  plateau: "hills",
  mountains: "mountain",
  peak: "mountain",
  volcano: "mountain",
  marsh: "swamp",
  wetlands: "swamp",
  wetland: "swamp",
  bog: "swamp",
  fen: "swamp",
  snow: "arctic",
  snowy: "arctic",
  tundra: "arctic",
  ice: "arctic",
  glacier: "arctic",
  sand: "desert",
  dunes: "desert",
  wasteland: "badlands",
  coast: "coastal",
  beach: "coastal",
  shore: "coastal",
  ocean: "water",
  sea: "water",
  lake: "water",
  river: "water",
  waterborne: "water",
  underdark: "underground",
  cave: "underground",
  caves: "underground",
  cavern: "underground",
  subterranean: "underground",
  city: "urban",
  town: "urban",
  village: "urban",
  hamlet: "urban",
  ruin: "ruins",
};

/** A word read as a terrain type (`Hills`, `marsh`, `ocean`), or null. */
export function terrainOf(word: string | undefined | null): TerrainId | null {
  if (!word) return null;
  const w = word.trim().toLowerCase();
  if ((TERRAIN_IDS as readonly string[]).includes(w)) return w as TerrainId;
  return ALIASES[w] ?? null;
}

/** One classify rule: a tile path pattern and the terrain type it means. */
export interface ClassifyRule {
  /** Folders from the layer down, `/`-separated; `*` matches any one folder, and a `*` inside a
   *  name matches any letters (`foothills*`). Matches the path's start: `land/forest` is every forest. */
  pattern: string;
  terrain: TerrainId;
}

/** For the `basic` pack's folders, the most particular first. */
export const DEFAULT_CLASSIFY: ClassifyRule[] = [
  ["land/mountain/badlands", "badlands"],
  ["land/mountain/*/foothills*", "hills"],
  ["land/mountain", "mountain"],
  ["land/hills", "hills"],
  ["land/forest", "forest"],
  ["land/plains/desert", "desert"],
  ["land/plains/farmland", "farmland"],
  ["land/plains/snowy", "arctic"],
  ["land/plains/wasteland", "badlands"],
  ["land/plains", "grassland"],
  ["land/basic/snowy", "arctic"],
  ["land/basic/plateau", "hills"],
  ["land/basic", "grassland"],
  ["land/wetlands", "swamp"],
  ["land/urban/*/farmland*", "farmland"],
  ["land/urban/*/ruins*", "ruins"],
  ["land/urban/*/lumber*", "forest"],
  ["land/urban", "urban"],
  ["water/swamp", "swamp"],
  ["water", "water"],
].map(([pattern, terrain]) => ({ pattern, terrain: terrain as TerrainId }));

/** `classify:` as pack.yml or a map's head writes it: `{ "land/forest/dead": badlands }`, or a list
 *  of `{ pattern, terrain }`. Unknown terrain words are skipped. */
export function readClassify(raw: unknown): ClassifyRule[] {
  const out: ClassifyRule[] = [];
  const add = (pattern: unknown, terrain: unknown) => {
    const t = typeof terrain === "string" ? terrainOf(terrain) : null;
    if (typeof pattern === "string" && pattern.trim() && t)
      out.push({
        pattern: pattern
          .trim()
          .toLowerCase()
          .replace(/^\/+|\/+$/g, ""),
        terrain: t,
      });
  };
  if (Array.isArray(raw)) {
    for (const item of raw)
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        add(o.pattern ?? o.match, o.terrain);
      }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) add(k, v);
  }
  return out;
}

function segmentMatches(pattern: string, segment: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === segment;
  const re = new RegExp(
    `^${pattern
      .split("*")
      .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`
  );
  return re.test(segment);
}

/** Whether a tile path (`land/forest/lush/conifer-0`) starts with a pattern's folders. */
export function pathMatches(pattern: string, path: string): boolean {
  const want = pattern.split("/").filter(Boolean);
  const have = path.toLowerCase().split("/").filter(Boolean);
  if (want.length > have.length) return false;
  return want.every((seg, i) => segmentMatches(seg, have[i]));
}

/** The terrain type of a tile path by the first rule it matches. */
export function classifyPath(path: string, rules: ClassifyRule[]): TerrainId | null {
  for (const rule of rules) if (pathMatches(rule.pattern, path)) return rule.terrain;
  return null;
}

/** Bracket words that change what the ground is, whatever the base (`mountain[foothills]` is hills,
 *  `water[swamp]` a swamp); others (`[snowy]`, `[desert]`) only say how it looks. */
const LANDFORMS = new Set([
  "foothills",
  "plateau",
  "swamp",
  "marsh",
  "wetlands",
  "ruins",
  "ruin",
  "farmland",
  "fields",
  "jungle",
  "badlands",
  "wasteland",
]);

/** The terrain type a spec's words name (`forest[lush]`, `conifer-forest`, `water[swamp]`): a
 *  bracket naming a landform, then the base (or a word of a hyphenated name), then any bracket.
 *  Plains take their kind from a bracket (`plains[desert]` is desert). */
export function classifySpec(spec: string | undefined): TerrainId | null {
  if (!spec) return null;
  const m = spec.trim().match(/^([^[(]*)(.*)$/);
  const base = (m?.[1] ?? "").trim();
  const brackets = [...(m?.[2] ?? "").matchAll(/\[([^\]]*)\]/g)].map((b) => b[1].trim().toLowerCase());
  for (const b of brackets) if (LANDFORMS.has(b)) return terrainOf(b);
  let own = terrainOf(base);
  if (!own) for (const word of base.split(/[-_\s]+/).reverse()) if ((own = terrainOf(word))) break;
  if (own && own !== "grassland") return own;
  for (const b of brackets) {
    const t = terrainOf(b);
    if (t && (!own || (t !== "water" && t !== "forest"))) return t;
  }
  return own;
}

/** Path families read for travel, by name: a road (and trail) or a river (and stream). */
export function travelPathKind(family: string): "road" | "river" | null {
  const f = family.toLowerCase();
  if (/road|trail|track|highway/.test(f)) return "road";
  if (/river|stream|creek|brook/.test(f)) return "river";
  return null;
}

/** What travel needs to know about a map's hexes. */
export interface TerrainGrid {
  /** Each hex's terrain type, where it's known. */
  terrain: Map<string, TerrainId>;
  /** Hexes a road runs through. */
  roads: Set<string>;
  /** Hexes a river runs through. */
  rivers: Set<string>;
  /** How many people live round each hex, from its regions' `population:` (the innermost that says). */
  population?: Map<string, Population>;
}

/** How settled a region is (Solo Adventurer's Toolbox: encounter rolls and unmarked settlements). */
export type Population = "low" | "medium" | "high";
export const POPULATIONS: Population[] = ["low", "medium", "high"];

export function populationOf(word: unknown): Population | null {
  const w = typeof word === "string" ? word.trim().toLowerCase() : "";
  return (POPULATIONS as string[]).includes(w) ? (w as Population) : null;
}

export const emptyGrid = (): TerrainGrid => ({ terrain: new Map(), roads: new Set(), rivers: new Set() });

/** A step from one hex to the next, as travel counts it. */
export interface TravelStep {
  to: Axial;
  terrain?: TerrainId;
  /** A road runs from the hex left into this one. */
  road: boolean;
  /** Crossing a river into this hex (no road across it). */
  ford: boolean;
  /** Halves the speed: difficult ground off the road, or a ford. */
  difficult: boolean;
  /** Water on foot. */
  impassable: boolean;
  /** The pace the step was made at (the chosen one, capped by the ground). */
  pace: Pace;
  /** Hours the step takes. */
  hours: number;
}

/** One pace step slower or faster. */
function shiftPace(pace: Pace, by: number): Pace {
  return PACES[Math.max(0, Math.min(PACES.length - 1, PACES.indexOf(pace) + by))];
}

function slower(a: Pace, b: Pace): Pace {
  return PACES.indexOf(a) <= PACES.indexOf(b) ? a : b;
}

/**
 * The steps of a route (a list of neighbouring hexes, the start first), with how long each takes at
 * a pace across hexes `hexMiles` wide:
 *  - the ground caps the pace (`maxPace`); a road along the step raises the cap one step and cancels
 *    difficult ground;
 *  - difficult ground, or crossing a river where no road does, halves the speed.
 */
export function routeSteps(
  route: Axial[],
  grid: TerrainGrid,
  pace: Pace,
  hexMiles: number,
  { weather = "agreeable", tracking = "miles" }: TravelOptions = {}
): TravelStep[] {
  const out: TravelStep[] = [];
  const w = WEATHER[weather];
  for (let i = 1; i < route.length; i++) {
    const from = hexKey(route[i - 1].q, route[i - 1].r);
    const to = hexKey(route[i].q, route[i].r);
    const terrain = grid.terrain.get(to);
    const rules = terrain ? TERRAIN_RULES[terrain] : undefined;
    const road = grid.roads.has(from) && grid.roads.has(to);
    const ford = grid.rivers.has(to) && !grid.rivers.has(from) && !road;
    const impassable = rules?.maxPace === null;
    const cap = rules?.maxPace ? (road ? shiftPace(rules.maxPace, 1) : rules.maxPace) : "fast";
    const stepPace = slower(pace, cap);
    const difficult = ((rules?.difficult ?? false) && !road) || ford;
    const mph = PACE_MILES[stepPace] / 8;
    const base =
      tracking === "hexes" ? 8 / hexesPerDay(hexMiles, stepPace, difficult) : (hexMiles / mph) * (difficult ? 2 : 1);
    const hours = impassable || w.time === null ? 0 : base * w.time;
    out.push({ to: route[i], terrain, road, ford, difficult, impassable, pace: stepPace, hours });
  }
  return out;
}

/** Weather's effect on a day's travel (Campaign Builder, Weather Effects). */
export type WeatherId = "catastrophic" | "extreme" | "inclement" | "unpleasant" | "agreeable" | "nice" | "ideal";
export interface WeatherRules {
  id: WeatherId;
  name: string;
  /** Times as long to cross a hex; null: no travel without magic. */
  time: number | null;
  /** Disadvantage on checks to stay on course. */
  navDisadvantage: boolean;
  /** A level of exhaustion for each hex crossed. */
  exhaustionPerHex: boolean;
  /** Advantage on foraging. */
  forageAdvantage: boolean;
  examples: string;
}
const wr = (
  id: WeatherId,
  name: string,
  time: number | null,
  navDisadvantage: boolean,
  exhaustionPerHex: boolean,
  forageAdvantage: boolean,
  examples: string
): WeatherRules => ({ id, name, time, navDisadvantage, exhaustionPerHex, forageAdvantage, examples });
export const WEATHER: Record<WeatherId, WeatherRules> = {
  catastrophic: wr("catastrophic", "Catastrophic", null, true, true, false, "Hurricanes, monsoons, floods"),
  extreme: wr("extreme", "Extreme", 2, true, true, false, "Blizzards, hail, tornados, mud slides"),
  inclement: wr("inclement", "Inclement", 2, true, false, false, "Thunderstorms, major snowstorm"),
  unpleasant: wr("unpleasant", "Unpleasant", 2, false, false, false, "Rain and wind, light snowfall"),
  agreeable: wr("agreeable", "Agreeable", 1, false, false, false, "Overcast"),
  nice: wr("nice", "Nice", 1, false, false, true, "Sunny"),
  ideal: wr("ideal", "Ideal", 0.5, false, false, true, "The most clement day of the year"),
};
export const WEATHER_IDS = Object.keys(WEATHER) as WeatherId[];

/** A word read as weather (`Inclement`, `storm`): the table's names, or null. */
export function weatherOf(word: string | undefined): WeatherId | null {
  const w = word?.trim().toLowerCase();
  return w && (WEATHER_IDS as string[]).includes(w) ? (w as WeatherId) : null;
}

/** Words the log's weather tag uses (`Autumn · warm · windy · heavy rain`) read as the Weather
 *  Effects row they fall in: the worst of them. A row's own name (`Inclement`) counts too. */
const WEATHER_WORDS: Array<[RegExp, WeatherId]> = [
  [/hurricane|monsoon|flood/, "catastrophic"],
  [/blizzard|hail|tornado|mud ?slide|gale/, "extreme"],
  [/storm|heavy rain|heavy snow|thunder/, "inclement"],
  [/rain|snow|sleet|strong winds?|drizzle/, "unpleasant"],
  [/overcast|cloud|fog|mist/, "agreeable"],
  [/clear|sunny|fair/, "nice"],
];
const WEATHER_ORDER: WeatherId[] = ["ideal", "nice", "agreeable", "unpleasant", "inclement", "extreme", "catastrophic"];

export function weatherFromWords(parts: string[]): WeatherId | null {
  let worst: WeatherId | null = null;
  const worse = (w: WeatherId) => {
    if (!worst || WEATHER_ORDER.indexOf(w) > WEATHER_ORDER.indexOf(worst)) worst = w;
  };
  for (const raw of parts) {
    const p = raw.trim().toLowerCase();
    const named = weatherOf(p);
    if (named) {
      worse(named);
      continue;
    }
    const hit = WEATHER_WORDS.find(([re]) => re.test(p));
    if (hit) worse(hit[1]);
  }
  return worst;
}

/** How a route's time is counted: miles at the pace (the default), or whole hexes a day (Campaign
 *  Builder, Travel Speed (Hex Tracking)). */
export type Tracking = "miles" | "hexes";

export interface TravelOptions {
  weather?: WeatherId;
  tracking?: Tracking;
}

/** Hexes a day by hex tracking: for hexes 12 miles or larger, or smaller ones. */
export function hexesPerDay(hexMiles: number, pace: Pace, difficult: boolean): number {
  const big = hexMiles >= 12;
  const table: Record<Pace, [number, number]> = big
    ? { slow: [1, 0.5], normal: [2, 1], fast: [3, 2] }
    : { slow: [2, 1], normal: [3, 2], fast: [4, 2] };
  return table[pace][difficult ? 1 : 0];
}

export interface RouteSummary {
  hexes: number;
  miles: number;
  hours: number;
  /** Steps on difficult ground (or fords). */
  difficult: number;
  fords: number;
  /** Steps along a road. */
  road: number;
  /** Water hexes on the way, which need a boat. */
  water: number;
  /** Steps the ground made slower than the pace chosen. */
  capped: number;
  /** The hardest navigation DC on the way off the road, at this pace (fast adds 5); unset: all on roads. */
  navigationDC?: number;
  /** The weather the route was counted in, when it isn't agreeable. */
  weather?: WeatherId;
}

export function summarizeRoute(
  steps: TravelStep[],
  pace: Pace,
  hexMiles: number,
  weather: WeatherId = "agreeable"
): RouteSummary {
  let navigationDC: number | undefined;
  const s: RouteSummary = {
    hexes: steps.length,
    miles: steps.length * hexMiles,
    hours: 0,
    difficult: 0,
    fords: 0,
    road: 0,
    water: 0,
    capped: 0,
  };
  for (const step of steps) {
    s.hours += step.hours;
    if (step.difficult) s.difficult++;
    if (step.ford) s.fords++;
    if (step.road) s.road++;
    if (step.impassable) s.water++;
    if (step.pace !== pace) s.capped++;
    if (!step.road && step.terrain && !step.impassable) {
      const dc = TERRAIN_RULES[step.terrain].navigationDC + (pace === "fast" ? 5 : 0);
      navigationDC = Math.max(navigationDC ?? 0, dc);
    }
  }
  s.navigationDC = navigationDC;
  if (weather !== "agreeable") s.weather = weather;
  return s;
}

/** "2 d 3 h" — travel hours as 8-hour days and hours. */
export function travelHoursText(hours: number): string {
  if (hours <= 0) return "0 h";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  const days = Math.floor(hours / 8 + 1e-9);
  const rest = Math.round((hours - days * 8) * 4) / 4;
  const h = `${rest}`
    .replace(/\.25$/, "¼")
    .replace(/\.5$/, "½")
    .replace(/\.75$/, "¾")
    .replace(/^0(?=[¼½¾])/, "");
  if (days === 0) return `${h} h`;
  return rest ? `${days} d ${h} h` : `${days} day${days === 1 ? "" : "s"}`;
}

/** "4 hexes · 24 mi · Normal · 1 d 2 h · 2 difficult · 1 ford · nav DC 15" */
export function routeText(s: RouteSummary, pace: Pace): string {
  const parts = [`${s.hexes} hex${s.hexes === 1 ? "" : "es"}`];
  if (s.miles) parts.push(`${Math.round(s.miles * 10) / 10} mi`);
  parts.push(pace[0].toUpperCase() + pace.slice(1));
  const w = s.weather ? WEATHER[s.weather] : undefined;
  if (w?.time === null) parts.push(`${w.name}: no travel without magic`);
  else if (s.miles && s.water < s.hexes) parts.push(travelHoursText(s.hours));
  if (s.road) parts.push(`${s.road} by road`);
  if (s.difficult) parts.push(`${s.difficult} difficult`);
  if (s.fords) parts.push(`${s.fords} ford${s.fords === 1 ? "" : "s"}`);
  if (s.capped) parts.push(`${s.capped} slowed`);
  if (s.water) parts.push(`${s.water} by boat`);
  if (s.navigationDC !== undefined)
    parts.push(`nav DC ${s.navigationDC}${w?.navDisadvantage ? " (disadvantage)" : ""}`);
  if (w?.exhaustionPerHex && w.time !== null) parts.push(`${s.hexes - s.water} exhaustion`);
  if (w && w.time !== null && w.time !== 1) parts.push(`${w.name.toLowerCase()} weather ×${w.time}`);
  return parts.join(" · ");
}

/** A hex as the grid is built from it: its top terrain line's spec and own `terrain=`, and the
 *  path of the tile drawn for it (when a pack drew one). */
export interface GridHex {
  key: string;
  spec?: string;
  own?: TerrainId;
  path?: string;
}

/** Each hex's terrain type (own, then the rules on its tile's path, then its spec's words), and the
 *  hexes roads and rivers run through (by their path families' names). */
export function buildTerrainGrid(
  hexes: GridHex[],
  paths: Array<{ key: string; family: string }>,
  rules: ClassifyRule[]
): TerrainGrid {
  const grid = emptyGrid();
  for (const h of hexes) {
    const t = h.own ?? (h.path ? classifyPath(h.path, rules) : null) ?? classifySpec(h.spec);
    if (t) grid.terrain.set(h.key, t);
  }
  for (const p of paths) {
    const kind = travelPathKind(p.family);
    if (kind === "road") grid.roads.add(p.key);
    else if (kind === "river") grid.rivers.add(p.key);
  }
  return grid;
}
