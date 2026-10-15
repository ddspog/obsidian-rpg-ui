import { describe, expect, it } from "vitest";
import { hexCenter, neighbour, pixelToHex, SIDES } from "./axial";
import { layoutHexMap, resolveHexMap } from "./layout";
import { buildPack, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";

describe("axial", () => {
  it("round-trips centres through pixelToHex", () => {
    for (const [q, r] of [
      [0, 0],
      [3, -2],
      [-4, 5],
      [7, 7],
    ]) {
      const { x, y } = hexCenter(q, r, 40);
      expect(pixelToHex(x + 5, y - 5, 40)).toEqual({ q, r });
    }
  });
  it("puts each neighbour on its side", () => {
    const c = hexCenter(0, 0, 40);
    const n = SIDES.map((s) => {
      const h = neighbour({ q: 0, r: 0 }, s);
      const p = hexCenter(h.q, h.r, 40);
      return Math.round((Math.atan2(p.x - c.x, -(p.y - c.y)) * 180) / Math.PI);
    });
    expect(n).toEqual([0, 60, 120, 180, -120, -60]);
  });
});

const pack = buildPack(
  "basic",
  [
    { path: "terrain/plains/a.webp", url: "u:plains" },
    { path: "stack/buildings/house.webp", url: "u:house" },
    { path: "path/roads/road.webp", url: "u:road" },
  ],
  parsePackConfig("defaults: { hexWidth: 477, borderWidth: 0 }", "basic")
);
const packs = new Map([["basic", pack]]);
const sizes = new Map([
  ["u:plains", { w: 932, h: 810 }],
  ["u:house", { w: 245, h: 168 }],
  ["u:road", { w: 932, h: 810 }],
]);

describe("resolveHexMap + layoutHexMap", () => {
  it("draws in the editor's order: height, then terrain < stack < path, then top to bottom", () => {
    const map = parseHexMap(`grid: hex
---
0m:
  * p(0,0): roads
  * s(0,0): buildings
  * t(0,1): plains
  * t(0,0): plains
100m:
  * t(0,-1): plains`);
    const layout = layoutHexMap(resolveHexMap(map, packs, "basic"), sizes);
    expect(layout.items.map((i) => i.key.split(":")[0] + ":" + i.key.split(":")[1])).toEqual([
      "0,0:terrain",
      "0,1:terrain",
      "0,0:stack",
      "0,0:path",
      "0,-1:terrain",
    ]);
  });

  it("scales tiles so the hex face spans the hex: 932 px at hexWidth 477", () => {
    const layout = layoutHexMap(
      resolveHexMap(parseHexMap("grid: hex\n---\nt(0,0): plains"), packs, "basic"),
      sizes,
      40
    );
    const tile = layout.items[0];
    expect(tile.kind).toBe("tile");
    if (tile.kind === "tile") {
      expect(tile.w).toBeCloseTo((932 * 80) / 477);
      expect(tile.x + tile.w / 2).toBeCloseTo(0);
    }
  });

  it("falls back to a hatched colour for a missing tile and reports it", () => {
    const resolved = resolveHexMap(parseHexMap("grid: hex\n---\nt(0,0): lava + #ff3300"), packs, "basic");
    expect(resolved.errors.map((e) => e.message)).toEqual(['no terrain tile for "lava" in pack "basic"']);
    const fill = layoutHexMap(resolved, sizes).items[0];
    expect(fill).toMatchObject({ kind: "fill", color: "#ff3300", missing: true });
  });

  it("draws plain colours with the flat pack, without errors", () => {
    const resolved = resolveHexMap(parseHexMap("grid: hex\npack: flat\n---\nt(0,0): forest"), packs, "basic");
    expect(resolved.errors).toEqual([]);
    expect(layoutHexMap(resolved, sizes).items[0]).toMatchObject({ kind: "fill", color: "#2E7D32", missing: false });
  });

  it("names a linked place after its note", () => {
    const layout = layoutHexMap(
      resolveHexMap(
        parseHexMap("grid: hex\n---\nt(0,0): plains [[Places/Featherbark|the Holy City]]\nt(1,0): (Ford) plains"),
        packs,
        "basic"
      ),
      sizes
    );
    expect(layout.labels.map((l) => l.text)).toEqual(["the Holy City", "Ford"]);
  });

  it("scatters xN copies inside the hex, the same way each time", () => {
    const src = "grid: hex\n---\ns(0,0): buildings x3";
    const a = layoutHexMap(resolveHexMap(parseHexMap(src), packs, "basic"), sizes).items;
    const b = layoutHexMap(resolveHexMap(parseHexMap(src), packs, "basic"), sizes).items;
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
    for (const item of a)
      if (item.kind === "tile") expect(Math.hypot(item.x + item.w / 2, item.y + item.h / 2)).toBeLessThan(40 * 0.5);
  });
});
