import { describe, expect, it } from "vitest";
import { layoutHexMap, resolveHexMap } from "./layout";
import { buildPack, canonicalMask, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";

const pack = buildPack(
  "basic",
  [
    "terrain/plains/a.webp",
    "terrain/water/sea.webp",
    "path/roads/clean/straight-0.webp",
    "path/roads/clean/turn60-0.webp",
    "path/roads/clean/start-0.webp",
    "path/roads/clean/start-3.webp",
    "path/roads/clean/yfork-0.webp",
    "path/roads/clean/start-4-hub.webp",
    "path/rivers/River 2 N.webp",
    "path/rivers/River 9 N.webp",
    "path/rivers/River 1 N.webp",
    "path/rivers/River 2 N Mouth.webp",
  ].map((path) => ({ path, url: `u:${path}` })),
  parsePackConfig(
    `autotile:
  roads:
    tiles:
      "N": roads/clean/start-0
      "s": roads/clean/start-3
      "S,N": roads/clean/straight-0
      "N,NE": roads/clean/turn60-0
      "N,S,SW": roads/clean/yfork-0
      culdesac-4: roads/clean/start-4-hub
      "N,Q": roads/clean/start-0
  rivers:
    connectsTo: [water]
    tiles:
      "N": "rivers/River 1 N"
      "N,S": ["rivers/River 2 N", "rivers/River 9 N"]
      straight-0-mouth0: "rivers/River 2 N Mouth"`,
    "basic"
  )
);
const packs = new Map([["basic", pack]]);

const tileOf = (src: string, q: number, r: number) => {
  const resolved = resolveHexMap(parseHexMap(`grid: hex\n---\n${src}`), packs, "basic");
  return resolved.picks.find((p) => p.cell.layer === "path" && p.cell.q === q && p.cell.r === r);
};

describe("canonicalMask", () => {
  it("orders sides N, NE, SE, S, SW, NW and upper-cases them", () => {
    expect(canonicalMask("s, n")).toBe("N,S");
    expect(canonicalMask("NW,SE,N")).toBe("N,SE,NW");
  });
});

describe("autotiled paths", () => {
  it("joins a road along a column: N,S in the middle, ends at either side", () => {
    const src = "p(0,0): roads\np(0,1): roads\np(0,2): roads";
    expect(tileOf(src, 0, 1)).toMatchObject({ file: "roads/clean/straight-0", mask: "N,S" });
    expect(tileOf(src, 0, 0)).toMatchObject({ file: "roads/clean/start-3", mask: "S" });
    expect(tileOf(src, 0, 2)).toMatchObject({ file: "roads/clean/start-0", mask: "N" });
  });

  it("picks a fork where three roads meet", () => {
    // (0,1) has neighbours N (0,0), S (0,2) and SW (-1,2).
    const src = "p(0,1): roads\np(0,0): roads\np(0,2): roads\np(-1,2): roads";
    expect(tileOf(src, 0, 1)).toMatchObject({ file: "roads/clean/yfork-0", mask: "N,S,SW" });
  });

  it("draws a hub when the plain shape has no tile", () => {
    // (0,0) has one neighbour, SW (-1,1): start-4 has no tile, start-4-hub does (written as the older culdesac-4).
    expect(tileOf("p(0,0): roads\np(-1,1): roads", 0, 0)).toMatchObject({
      file: "roads/clean/start-4-hub",
      mask: "SW",
    });
  });

  it("keys tables by shape, older side masks read as their type", () => {
    expect(pack.config.autotile.roads.tiles["straight-0"]).toEqual(["roads/clean/straight-0"]);
    expect(pack.config.autotile.roads.unknownKeys).toEqual(["N,Q"]);
  });

  it("doesn't join different families", () => {
    expect(tileOf("p(0,0): roads\np(0,1): rivers", 0, 0)).toMatchObject({ mask: "" });
  });

  it("runs a river into a neighbouring water hex", () => {
    expect(tileOf("t(0,-1): water\np(0,0): rivers\np(0,1): rivers", 0, 0)).toMatchObject({ mask: "N,S" });
  });

  it("opens a river into the sea with a mouth tile, plain where it doesn't meet water", () => {
    expect(tileOf("t(0,-1): water\np(0,0): rivers\np(0,1): rivers", 0, 0)).toMatchObject({
      file: "rivers/River 2 N Mouth",
      mask: "N,S",
    });
    expect(tileOf("p(0,-1): rivers\np(0,0): rivers\np(0,1): rivers", 0, 0)?.file).not.toBe("rivers/River 2 N Mouth");
  });

  it("varies between listed tiles by the seed, the same way each time", () => {
    const river = "p(0,-1): rivers\np(0,0): rivers\np(0,1): rivers";
    const a = tileOf(river, 0, 0)?.file;
    expect(["rivers/River 2 N", "rivers/River 9 N"]).toContain(a);
    expect(tileOf(river, 0, 0)?.file).toBe(a);
  });

  it("turns a tile of the shape into place when its own slot has none", () => {
    // SE is start-2: start-0 turned two sides.
    expect(tileOf("p(0,0): roads\np(1,0): roads", 0, 0)).toMatchObject({
      mask: "SE",
      file: "roads/clean/start-0",
      turn: 2,
    });
  });

  it("draws a stroke when no tile has the shape at any turn", () => {
    // N,SE is a turn120: the pack has none.
    const lines = "p(0,-1): roads\np(0,0): roads\np(1,0): roads";
    expect(tileOf(lines, 0, 0)).toMatchObject({ mask: "N,SE", stroke: { sides: ["N", "SE"], family: "roads" } });
    const layout = layoutHexMap(resolveHexMap(parseHexMap(`grid: hex\n---\n${lines}`), packs, "basic"), new Map());
    expect(layout.items.map((i) => i.kind)).toContain("stroke");
  });

  it("leaves a full spec as written", () => {
    expect(tileOf("p(0,0): roads[clean][turn60-0]\np(0,1): roads", 0, 0)).toMatchObject({
      file: "roads/clean/turn60-0",
    });
    expect(tileOf("p(0,0): roads[clean][turn60-0]\np(0,1): roads", 0, 0)?.mask).toBeUndefined();
  });
});

describe("regions", () => {
  const layoutOf = (src: string) =>
    layoutHexMap(
      resolveHexMap(parseHexMap(src), packs, "basic"),
      new Map([["u:terrain/plains/a.webp", { w: 932, h: 810 }]])
    );

  it("outlines a region along its border and counts hexes and coast", () => {
    const layout = layoutOf(`grid: hex
regions:
  Dunlind: { color: "#8a3b2e", link: "[[Dunlind]]" }
---
t(0,0): plains @Dunlind
t(1,0): plains @Dunlind
t(0,1): sea
t(-1,0): sea`);
    expect(layout.regions).toHaveLength(1);
    const g = layout.regions[0];
    expect(g).toMatchObject({ name: "Dunlind", color: "#8a3b2e", link: "Dunlind", hexes: 2, depth: 0 });
    // Two hexes share one side: 12 sides, 10 on the border.
    expect(g.edge.match(/M/g)).toHaveLength(10);
    // (0,0) faces (0,1) to the S and (-1,0) to the NW; (1,0) faces (0,1) to the SW.
    expect(g.coast).toBe(3);
    expect(g.fill.match(/Z/g)).toHaveLength(2);
  });

  it("nests a region inside its parent and colours undeclared ones", () => {
    const layout = layoutOf(`grid: hex
regions:
  Dunlind: { color: "#111111" }
  Barelgrove: { parent: Dunlind }
---
t(0,0): plains @Dunlind @Barelgrove
t(1,0): plains @Dunlind
t(2,0): plains @Wilds`);
    expect(layout.regions.map((g) => [g.name, g.depth])).toEqual([
      ["Dunlind", 0],
      ["Wilds", 0],
      ["Barelgrove", 1],
    ]);
    expect(layout.regions.find((g) => g.name === "Wilds")?.color).toMatch(/^#/);
  });
});

describe("river mouths", () => {
  it("joins the sea only at the river's end, straight on where it can", () => {
    // (0,1) comes from N; water lies S, SE and SW of it: it runs out S.
    const src = "p(0,0): rivers\np(0,1): rivers\nt(0,2): water\nt(1,1): water\nt(-1,2): water\nt(1,0): water";
    expect(tileOf(src, 0, 1)).toMatchObject({ mask: "N,S" });
    // (0,0), the other end, has water only off to its SE (two sides off
    // straight): it doesn't turn back into it.
    expect(tileOf(src, 0, 0)).toMatchObject({ mask: "S" });
  });

  it("gives a river one mouth: the end written last when both could", () => {
    // A river N–S between two seas: both ends could run out straight on.
    const src = "t(0,-1): water\np(0,0): rivers\np(0,1): rivers\nt(0,2): water";
    expect(tileOf(src, 0, 0)).toMatchObject({ mask: "S" });
    expect(tileOf(src, 0, 1)).toMatchObject({ mask: "N,S" });
  });
});
