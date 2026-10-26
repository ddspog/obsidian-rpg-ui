import { describe, expect, it } from "vitest";
import { isHexMapSource, parseHexMap } from "./parse-hex-map";

describe("isHexMapSource", () => {
  it("reads grid: hex from the head", () => {
    expect(isHexMapSource("grid: hex\n---\nt(0,0): grass")).toBe(true);
    expect(isHexMapSource("grid: square\n---\n. .")).toBe(false);
    expect(isHexMapSource("title: x\n---\ngrid: hex")).toBe(false);
  });
});

describe("parseHexMap", () => {
  it("reads the editor's example map unchanged below the header", () => {
    const map = parseHexMap(`grid: hex
---
title: Terrain, Path & Stack Example
pack: svg

0m:
  * t(0,0): (Ground) grass + #4CAF50
  * s(0,0): (Stack) grass + #FF5722
  * t(1,0): forest
  * t(-1,0): water
  * p(1,1): (Path) grass + #2196F3

100m:
  * t(0,2): (Mountain) stone + #795548
  * p(0,3): (High Path) grass + #9C27B0`);
    expect(map.errors).toEqual([]);
    expect(map.title).toBe("Terrain, Path & Stack Example");
    expect(map.pack).toBe("svg");
    expect(map.cells).toHaveLength(7);
    expect(map.cells[0]).toMatchObject({
      q: 0,
      r: 0,
      layer: "terrain",
      label: "Ground",
      spec: "grass",
      color: "#4CAF50",
      height: 0,
      line: 7,
    });
    expect(map.cells[1]).toMatchObject({ layer: "stack", label: "Stack" });
    expect(map.cells[2]).toMatchObject({ q: 1, r: 0, spec: "forest" });
    expect(map.cells[3]).toMatchObject({ q: -1, r: 0, spec: "water" });
    expect(map.cells[5]).toMatchObject({ q: 0, r: 2, height: 100, spec: "stone" });
  });

  it("reads the header as YAML, with regions", () => {
    const map = parseHexMap(`grid: hex
title: Dunlind
pack: basic
seed: 7
coords: always
regions:
  Dunlind: { color: "#8a3b2e", link: "[[Dunlind]]" }
---
t(0,0): plains @Dunlind`);
    expect(map).toMatchObject({ title: "Dunlind", pack: "basic", seed: "7", coords: "always" });
    expect(map.regions.Dunlind).toEqual({ name: "Dunlind", color: "#8a3b2e", link: "Dunlind", parent: undefined });
    expect(map.cells[0].regions).toEqual(["Dunlind"]);
  });

  it("reads every editor form: bare coordinates, lone colour, empty hex, legacy CSV", () => {
    const map = parseHexMap(`grid: hex
---
0,0: grass
t(1,0): #ff0000
t(2,0):
3,0,Village,#00ff00,forest`);
    expect(map.errors).toEqual([]);
    expect(map.cells.map((c) => [c.q, c.spec, c.color, c.label])).toEqual([
      [0, "grass", undefined, undefined],
      [1, undefined, "#ff0000", undefined],
      [2, undefined, undefined, undefined],
      [3, "forest", "#00ff00", "Village"],
    ]);
  });

  it("reads the added tokens: links, regions, copies, qualifiers", () => {
    const map = parseHexMap(`grid: hex
---
t(1,1): (Featherbark) [[Holy City of Featherbark]] water[Ocean](still water) @Dunlind @Caulkin
s(1,1): buildings[City Building 1 (blue)] x3`);
    expect(map.errors).toEqual([]);
    expect(map.cells[0]).toMatchObject({
      label: "Featherbark",
      link: "Holy City of Featherbark",
      spec: "water[Ocean](still water)",
      regions: ["Dunlind", "Caulkin"],
    });
    expect(map.cells[1]).toMatchObject({ layer: "stack", spec: "buildings[City Building 1 (blue)]", count: 3 });
  });

  it("drops inline comments but keeps colours", () => {
    const map = parseHexMap("grid: hex\n---\nt(0,0): (Ground) grass + #8B4513       # Terrain level ground");
    expect(map.cells[0]).toMatchObject({ spec: "grass", color: "#8B4513" });
  });

  it("lets a later terrain line replace an earlier one; stacks add up", () => {
    const map = parseHexMap("grid: hex\n---\nt(0,0): grass\nt(0,0): water\ns(0,0): a\ns(0,0): b");
    expect(map.cells.map((c) => c.spec)).toEqual(["water", "a", "b"]);
  });

  it("reports bad lines with their line number and keeps the rest", () => {
    const map = parseHexMap("grid: hex\n---\nt(0,0): grass\nnonsense here\nt(1,0): forest");
    expect(map.cells).toHaveLength(2);
    expect(map.errors).toHaveLength(1);
    expect(map.errors[0].line).toBe(4);
  });
});

describe("parseHexMap — bases and steps", () => {
  it("reads b(q,r) lines, a group's base= and the step header", () => {
    const map = parseHexMap(`grid: hex
step: 330 ft
---
0m:
  * t(0,0): plains
  * b(0,0): level
  * b(0,0): rocky
100m: base=rocky
  * t(1,0): hills`);
    expect(map.errors).toEqual([]);
    expect(map.step).toBeCloseTo(100.584);
    const bases = map.cells.filter((c) => c.layer === "base");
    // One base per hex: the later line wins.
    expect(bases.map((c) => [c.q, c.r, c.spec])).toEqual([[0, 0, "rocky"]]);
    expect(map.cells.find((c) => c.q === 1)?.groupBase).toBe("rocky");
    expect(map.cells.find((c) => c.q === 0 && c.layer === "terrain")?.groupBase).toBeUndefined();
  });
});

describe("labels", () => {
  it("reads l(q,r) lines with fractional coordinates and options", () => {
    const map = parseHexMap(`grid: hex
---
l(1.5,-0.25): (The Sunken Coast) title-1 size=1.2 rot=-4 #3a2410
l(0,2): [[Holy City of Featherbark]] title-3
l(3,3): (Plain)`);
    expect(map.errors).toEqual([]);
    expect(map.cells).toEqual([]);
    expect(map.labels).toMatchObject([
      { q: 1.5, r: -0.25, text: "The Sunken Coast", family: "title-1", size: 1.2, rot: -4, color: "#3a2410", line: 3 },
      { q: 0, r: 2, link: "Holy City of Featherbark", family: "title-3" },
      { q: 3, r: 3, text: "Plain" },
    ]);
  });

  it("wants a text or a note", () => {
    const map = parseHexMap(`grid: hex\n---\nl(0,0): title-1`);
    expect(map.labels).toEqual([]);
    expect(map.errors[0]).toMatchObject({ line: 3 });
  });
});

describe("label families", () => {
  it("takes a family by its folder name only", () => {
    const map = parseHexMap(`grid: hex\n---\nl(0,0): (Ford) title-3(small)`);
    expect(map.errors[0].message).toMatch(/isn't a label family/);
  });
});

describe("markers", () => {
  it("reads m(q,r) lines, in any order", () => {
    const map = parseHexMap(`grid: hex
---
m(3,1): pedestal-gold[tower] (Featherbark) [[Holy City of Featherbark]]
m(5.2,0.4): (The party) here-red[party-1] size=1.5`);
    expect(map.errors).toEqual([]);
    expect(map.markers).toMatchObject([
      { q: 3, r: 1, spec: "pedestal-gold[tower]", text: "Featherbark", link: "Holy City of Featherbark", size: 1 },
      { q: 5.2, r: 0.4, spec: "here-red[party-1]", text: "The party", size: 1.5, line: 4 },
    ]);
  });

  it("wants a style", () => {
    const map = parseHexMap(`grid: hex\n---\nm(0,0): (Nobody)`);
    expect(map.markers).toEqual([]);
    expect(map.errors[0].message).toMatch(/needs its style/);
  });
});

describe("view:", () => {
  it("reads where the block opens", () => {
    const map = parseHexMap(`grid: hex\nview: { level: 2, at: [41.7, -54.6], zoom: 5 }\n---\nt(0,0): grass`);
    expect(map.view).toEqual({ level: 2, at: [41.7, -54.6], zoom: 5 });
  });

  it("defaults to the fit, and keeps zoom in range", () => {
    expect(parseHexMap(`grid: hex\nview: { level: 1 }\n---\n`).view).toEqual({ level: 1, at: undefined, zoom: 1 });
    expect(parseHexMap(`grid: hex\nview: { zoom: 99 }\n---\n`).view?.zoom).toBe(12);
    expect(parseHexMap(`grid: hex\n---\n`).view).toBeUndefined();
  });
});
