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
