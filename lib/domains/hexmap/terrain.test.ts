import { describe, expect, it } from "vitest";
import { resolveHexMap } from "./layout";
import { buildPack, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";
import {
  classifyPath,
  classifySpec,
  DEFAULT_CLASSIFY,
  emptyGrid,
  pathMatches,
  readClassify,
  routeSteps,
  routeText,
  summarizeRoute,
  terrainOf,
  travelHoursText,
} from "./terrain";

describe("terrain types", () => {
  it("reads words, aliases and specs", () => {
    expect(terrainOf("Hills")).toBe("hills");
    expect(terrainOf("marsh")).toBe("swamp");
    expect(terrainOf("lush")).toBeNull();
    expect(classifySpec("forest[lush][conifer-1]")).toBe("forest");
    expect(classifySpec("conifer-forest")).toBe("forest");
    expect(classifySpec("water[swamp][waves]")).toBe("swamp");
    expect(classifySpec("mountain[lush][foothills]")).toBe("hills");
    expect(classifySpec("mountain[snowy]")).toBe("mountain");
    expect(classifySpec("hills[desert]")).toBe("hills");
    expect(classifySpec("plains[desert]")).toBe("desert");
    expect(classifySpec("basic[ocean]")).toBe("water");
    expect(classifySpec("basic[lush]")).toBeNull();
  });

  it("matches tile paths by folder, with wildcards", () => {
    expect(pathMatches("land/forest", "land/forest/lush/conifer-0")).toBe(true);
    expect(pathMatches("land/mountain/*/foothills*", "land/mountain/lush/foothills-2")).toBe(true);
    expect(pathMatches("land/mountain/*/foothills*", "land/mountain/lush/medium-0")).toBe(false);
    expect(classifyPath("land/mountain/lush/foothills-1", DEFAULT_CLASSIFY)).toBe("hills");
    expect(classifyPath("land/mountain/badlands/x", DEFAULT_CLASSIFY)).toBe("badlands");
    expect(classifyPath("land/basic/lush", DEFAULT_CLASSIFY)).toBe("grassland");
    expect(classifyPath("land/wetlands/damp/field-1", DEFAULT_CLASSIFY)).toBe("swamp");
    expect(classifyPath("water/ocean/still-0", DEFAULT_CLASSIFY)).toBe("water");
    expect(classifyPath("water/swamp/still-0", DEFAULT_CLASSIFY)).toBe("swamp");
  });

  it("reads classify rules as a map or a list, skipping unknown types", () => {
    expect(readClassify({ "land/forest/dead": "badlands", "x/y": "lava" })).toEqual([
      { pattern: "land/forest/dead", terrain: "badlands" },
    ]);
    expect(readClassify([{ pattern: "/land/hills/", terrain: "Mountains" }])).toEqual([
      { pattern: "land/hills", terrain: "mountain" },
    ]);
  });
});

describe("travel across terrain", () => {
  const route = [0, 1, 2, 3].map((q) => ({ q, r: 0 }));

  it("halves speed on difficult ground, unless a road runs there", () => {
    const grid = emptyGrid();
    grid.terrain.set("1,0", "grassland");
    grid.terrain.set("2,0", "forest");
    grid.terrain.set("3,0", "forest");
    // 6-mile hexes at a normal pace (3 mph): 2 h, then 4 h and 4 h in the forest.
    let steps = routeSteps(route, grid, "normal", 6);
    expect(steps.map((s) => s.hours)).toEqual([2, 4, 4]);
    grid.roads.add("2,0");
    grid.roads.add("3,0");
    steps = routeSteps(route, grid, "normal", 6);
    expect(steps.map((s) => s.road)).toEqual([false, false, true]);
    expect(steps.map((s) => s.hours)).toEqual([2, 4, 2]);
  });

  it("caps the pace by the ground, a road raising the cap one step", () => {
    const grid = emptyGrid();
    for (const k of ["1,0", "2,0", "3,0"]) grid.terrain.set(k, "mountain");
    let steps = routeSteps(route, grid, "fast", 6);
    // Slow (18 mi/day, 2¼ mph), difficult: 6 / 2.25 × 2.
    expect(steps[0].pace).toBe("slow");
    expect(steps[0].hours).toBeCloseTo((6 / 2.25) * 2);
    grid.roads.add("0,0");
    grid.roads.add("1,0");
    steps = routeSteps(route, grid, "fast", 6);
    expect(steps[0].pace).toBe("normal");
    expect(steps[0].difficult).toBe(false);
  });

  it("counts crossing a river as difficult, but not along it or over a road", () => {
    const grid = emptyGrid();
    for (const k of ["1,0", "2,0", "3,0"]) grid.terrain.set(k, "grassland");
    grid.rivers.add("1,0");
    grid.rivers.add("2,0");
    const steps = routeSteps(route, grid, "normal", 6);
    expect(steps.map((s) => s.ford)).toEqual([true, false, false]);
    expect(steps[0].hours).toBe(4);
  });

  it("sums a route: water needs a boat, navigation takes the hardest DC off the road", () => {
    const grid = emptyGrid();
    grid.terrain.set("1,0", "swamp");
    grid.terrain.set("2,0", "water");
    grid.terrain.set("3,0", "hills");
    const s = summarizeRoute(routeSteps(route, grid, "fast", 6), "fast", 6);
    expect(s.water).toBe(1);
    expect(s.navigationDC).toBe(20);
    expect(s.capped).toBe(2);
    expect(routeText(s, "fast")).toContain("1 by boat");
  });

  it("writes hours as days of 8 hours", () => {
    expect(travelHoursText(0.5)).toBe("30 min");
    expect(travelHoursText(2.5)).toBe("2½ h");
    expect(travelHoursText(10)).toBe("1 d 2 h");
    expect(travelHoursText(16)).toBe("2 days");
  });
});

describe("terrain on a map", () => {
  const pack = buildPack(
    "basic",
    [
      { path: "terrain/land/forest/lush/conifer-0.webp", url: "u:f" },
      { path: "terrain/land/plains/lush/a.webp", url: "u:p" },
      { path: "terrain/water/ocean/still-0.webp", url: "u:w" },
      { path: "path/roads/road.webp", url: "u:r" },
      { path: "path/rivers/river.webp", url: "u:v" },
    ],
    parsePackConfig('classify:\n  "land/plains/lush": farmland\n', "basic")
  );
  const packs = new Map([["basic", pack]]);

  it("classifies hexes by their tile, the pack's rules and their own terrain=", () => {
    const map = parseHexMap(
      [
        "grid: hex",
        "classify:",
        '  "land/forest": jungle',
        "---",
        "t(0,0): forest[lush]",
        "t(1,0): plains[lush]",
        "t(2,0): water[ocean]",
        "t(3,0): plains[lush] terrain=hills",
        "p(1,0): roads",
        "p(2,0): rivers",
      ].join("\n")
    );
    expect(map.errors).toEqual([]);
    const grid = resolveHexMap(map, packs, "basic").grid;
    expect(Object.fromEntries(grid.terrain)).toEqual({
      "0,0": "jungle",
      "1,0": "farmland",
      "2,0": "water",
      "3,0": "hills",
    });
    expect([...grid.roads]).toEqual(["1,0"]);
    expect([...grid.rivers]).toEqual(["2,0"]);
  });

  it("reports an unknown terrain= word", () => {
    const map = parseHexMap("grid: hex\n---\nt(0,0): forest terrain=lava");
    expect(map.errors[0].message).toContain("isn't a terrain type");
  });
});

describe("terrain rule overrides", () => {
  it("lays the settings over the book's rules, and takes them off again", async () => {
    const { applyTerrainOverrides, TERRAIN_RULES, BOOK_TERRAIN_RULES } = await import("./terrain");
    applyTerrainOverrides({ hills: { difficult: true, navigationDC: 12 } });
    expect(TERRAIN_RULES.hills.difficult).toBe(true);
    expect(TERRAIN_RULES.hills.navigationDC).toBe(12);
    expect(BOOK_TERRAIN_RULES.hills.difficult).toBe(false);
    applyTerrainOverrides({});
    expect(TERRAIN_RULES.hills.difficult).toBe(false);
    expect(TERRAIN_RULES.hills.navigationDC).toBe(10);
  });
});

describe("weather and hex tracking", () => {
  const route = [0, 1, 2].map((q) => ({ q, r: 0 }));
  it("scales travel by the weather and says what it costs", async () => {
    const { emptyGrid, routeSteps, summarizeRoute, routeText } = await import("./terrain");
    const grid = emptyGrid();
    grid.terrain.set("1,0", "grassland");
    grid.terrain.set("2,0", "forest");
    const steps = routeSteps(route, grid, "normal", 6, { weather: "inclement" });
    expect(steps.map((s) => s.hours)).toEqual([4, 8]);
    const text = routeText(summarizeRoute(steps, "normal", 6, "inclement"), "normal");
    expect(text).toContain("1 d 4 h");
    expect(text).toContain("nav DC 15 (disadvantage)");
    const stuck = routeText(
      summarizeRoute(routeSteps(route, grid, "normal", 6, { weather: "catastrophic" }), "normal", 6, "catastrophic"),
      "normal"
    );
    expect(stuck).toContain("no travel without magic");
    const blizzard = routeText(
      summarizeRoute(routeSteps(route, grid, "normal", 6, { weather: "extreme" }), "normal", 6, "extreme"),
      "normal"
    );
    expect(blizzard).toContain("2 exhaustion");
  });

  it("counts whole hexes a day by the hex tracking table", async () => {
    const { emptyGrid, routeSteps, hexesPerDay } = await import("./terrain");
    expect(hexesPerDay(30, "normal", false)).toBe(2);
    expect(hexesPerDay(30, "slow", true)).toBe(0.5);
    expect(hexesPerDay(6, "fast", true)).toBe(2);
    const grid = emptyGrid();
    grid.terrain.set("1,0", "grassland");
    grid.terrain.set("2,0", "forest");
    // 30-mile hexes, normal pace: grassland half a day (4 h), forest a whole day (8 h).
    expect(routeSteps(route, grid, "normal", 30, { tracking: "hexes" }).map((s) => s.hours)).toEqual([4, 8]);
  });
});
