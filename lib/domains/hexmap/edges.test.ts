import { describe, expect, it } from "vitest";
import { edgeSides } from "./edges";
import { resolveHexMap } from "./layout";
import { buildPack, type Ground, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";
import { coverSides, type ShapeSlot, shapeName } from "./path-shapes";

const names = (pieces: ShapeSlot[]) => pieces.map((s) => shapeName(s)).sort();

describe("coverSides", () => {
  const all = () => true;
  const sides = (...on: number[]) => [0, 1, 2, 3, 4, 5].map((i) => on.includes(i));
  it("covers each run with one piece, slotted like paths", () => {
    expect(names(coverSides(sides(0), all))).toEqual(["run1-0"]);
    expect(names(coverSides(sides(5, 0), all))).toEqual(["run2-5"]);
    expect(names(coverSides(sides(5, 0, 1), all))).toEqual(["run3-0"]);
    expect(names(coverSides(sides(0, 3), all))).toEqual(["run1-0", "run1-3"]);
    expect(names(coverSides(sides(0, 1, 2, 3, 4, 5), all))).toEqual(["ring-0"]);
  });
  it("splits a run into the pieces there are", () => {
    const upTo3 = (s: ShapeSlot) => /^run[123]$/.test(s.type);
    expect(names(coverSides(sides(0, 1, 2, 3), upTo3))).toEqual(["run1-3", "run3-1"]);
    expect(names(coverSides(sides(0, 1, 2, 3, 4, 5), upTo3))).toEqual(["run3-1", "run3-4"]);
  });
});

const pack = buildPack(
  "basic",
  ["terrain/plains/a.webp", "terrain/water/a.webp", "edge/coast/run1-0.webp", "edge/coast/run2-5.webp"].map((path) => ({
    path,
    url: `u:${path}`,
  })),
  parsePackConfig(
    `edges:
  coast:
    meets: [water]
    tiles:
      run1-0: coast/run1-0
      run2-5: coast/run2-5
      run9-0: coast/nope
  beach:
    meets: [water]
    on: outside`,
    "basic"
  )
);

describe("edges", () => {
  it("reads runs, and reports keys that aren't one", () => {
    expect(pack.config.edges.coast).toMatchObject({ meets: ["water"], on: "inside", unknownKeys: ["run9-0"] });
    expect(pack.config.edges.beach.on).toBe("outside");
  });

  it("runs along the water's sides that face land (the land's, outside), not the map's edge", () => {
    // Bases that don't say water (`basic`), with the ground saying it.
    const around = {
      paths: new Map(),
      terrain: new Map([
        ["0,0", "basic"],
        ["0,-1", "basic"],
        ["1,-1", "basic"],
      ]),
      ground: new Map<string, Ground>([
        ["0,0", "land"],
        ["0,-1", "water"],
        ["1,-1", "land"],
      ]),
    };
    const { coast, beach } = pack.config.edges;
    const at = (family: typeof coast, q: number, r: number) =>
      edgeSides(family, { q, r }, around)
        .map((on, i) => (on ? i : -1))
        .filter((i) => i >= 0);
    // Water (0,-1) has land S (0,0) and SE (1,-1); land (0,0) has water N.
    expect(at(coast, 0, -1)).toEqual([2, 3]);
    expect(at(coast, 0, 0)).toEqual([]);
    expect(at(beach, 0, 0)).toEqual([0]);
  });

  it("lays coast pieces on the water", () => {
    // Water (0,0) has land to the N (0,-1) and NW (-1,0): one run2-5 piece, on the water.
    const resolved = resolveHexMap(
      parseHexMap("grid: hex\n---\nt(0,0): water\nt(0,-1): plains\nt(-1,0): plains"),
      new Map([["basic", pack]]),
      "basic"
    );
    const edges = resolved.picks.filter((p) => p.cell.layer === "edge");
    expect(edges.map((p) => [p.cell.q, p.cell.r, p.file])).toEqual([[0, 0, "coast/run2-5"]]);
  });

  it("colours the coast from a tint line, not from the terrain's look", () => {
    const resolved = resolveHexMap(
      parseHexMap("grid: hex\n---\nt(0,0): water size=2 hue=90\ne(0,0): sat=0.4\nt(0,-1): plains\nt(-1,0): plains"),
      new Map([["basic", pack]]),
      "basic"
    );
    const edges = resolved.picks.filter((p) => p.cell.layer === "edge");
    expect(edges.map((p) => [p.file, p.cell.look])).toEqual([["coast/run2-5", { sat: 0.4 }]]);
  });
});

describe("land and water sections", () => {
  const sections = buildPack(
    "s",
    [
      "terrain/land/basic/lush.webp",
      "terrain/land/forest/lush/a.webp",
      "terrain/water/basic/ocean.webp",
      "terrain/water/swamp/a.webp",
      "edge/coast/run1-0.webp",
    ].map((path) => ({ path, url: `u:${path}` })),
    parsePackConfig(
      `terrains:
  forest: { zoom: 2 }
edges:
  coast:
    meets: [water]
    tiles:
      run1-0: coast/run1-0`,
      "s"
    )
  );
  const packs = new Map([["s", sections]]);
  const tileAt = (src: string) =>
    resolveHexMap(parseHexMap(`grid: hex\n---\n${src}`), packs, "s").picks.filter((p) => p.cell.layer === "terrain");

  it("finds folders through the sections, and reads one name in both as one", () => {
    expect(tileAt("t(0,0): forest[lush]")[0]?.file).toBe("land/forest/lush/a");
    expect(tileAt("t(0,0): water[swamp]")[0]?.file).toBe("water/swamp/a");
    expect(tileAt("t(0,0): basic[ocean]")[0]?.file).toBe("water/basic/ocean");
    expect(tileAt("t(0,0): basic[lush]")[0]?.file).toBe("land/basic/lush");
  });

  it("tunes a folder by its name below the section", () => {
    expect(tileAt("t(0,0): forest[lush]")[0]?.display?.zoom).toBe(2);
  });

  it("knows water by the section its tile is in, whatever the spec says", () => {
    // basic[ocean] is water, basic[lush] land: a coast on the ocean, along its S side.
    const resolved = resolveHexMap(
      parseHexMap("grid: hex\n---\nt(0,0): basic[ocean]\nt(0,1): basic[lush]"),
      packs,
      "s"
    );
    expect(resolved.water).toEqual(new Set(["0,0"]));
    expect(resolved.picks.filter((p) => p.cell.layer === "edge")).toHaveLength(0);
    const north = resolveHexMap(parseHexMap("grid: hex\n---\nt(0,0): basic[ocean]\nt(0,-1): basic[lush]"), packs, "s");
    expect(north.picks.filter((p) => p.cell.layer === "edge").map((p) => [p.cell.q, p.cell.r, p.file])).toEqual([
      [0, 0, "coast/run1-0"],
    ]);
  });

  it("leaves out the hexes its except names, by their tile's folder", () => {
    const family = { tiles: {}, meets: ["water"], except: ["swamp"], on: "inside" as const, unknownKeys: [] };
    const around = {
      paths: new Map(),
      terrain: new Map([
        ["0,0", "water"],
        ["0,-1", "water"],
        ["1,-1", "plains"],
      ]),
      ground: new Map<string, Ground>([
        ["0,0", "water"],
        ["0,-1", "water"],
        ["1,-1", "land"],
      ]),
      folder: new Map([
        ["0,0", "swamp"],
        ["0,-1", "ocean"],
      ]),
    };
    // The swamp lays no coast of its own…
    expect(edgeSides(family, { q: 0, r: 0 }, around)).toEqual([false, false, false, false, false, false]);
    // …and the sea beside it takes it for land.
    expect(edgeSides(family, { q: 0, r: -1 }, around)[3]).toBe(true);
  });
});
