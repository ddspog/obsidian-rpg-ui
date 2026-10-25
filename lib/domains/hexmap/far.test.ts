import { describe, expect, it } from "vitest";
import { farFamilyOf, farLayout, pickFarTile, resolveFar } from "./far";
import { type ImageSize, layoutHexMap, resolveHexMap, terrainAround } from "./layout";
import { buildPack, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";

const pack = buildPack(
  "basic",
  [
    "terrain/land/plains/a.webp",
    "terrain/land/forest/a.webp",
    "terrain/land/jungle/a.webp",
    "terrain/water/sea/a.webp",
    "far/forest/alone-0.webp",
    "far/forest/straight-0.webp",
    "far/forest/star-0.webp",
  ].map((path) => ({ path, url: `u:${path}` })),
  parsePackConfig(
    `far:
  forest:
    of: [forest, jungle]
    size: 1.5
    tiles:
      alone-0: forest/alone-0
      straight-0: forest/straight-0
      star-0: forest/star-0
      not-a-shape: forest/alone-0`,
    "basic"
  )
);
const packs = new Map([["basic", pack]]);

describe("far families in pack.yml", () => {
  it("reads the table, what it stands for, and its size", () => {
    const far = pack.config.far.forest;
    expect(far.of).toEqual(["forest", "jungle"]);
    expect(far.size).toBe(1.5);
    expect(Object.keys(far.tiles).sort()).toEqual(["alone-0", "star-0", "straight-0"]);
    expect(far.unknownKeys).toEqual(["not-a-shape"]);
    // With no `of:`, a family stands for its own name.
    expect(parsePackConfig("far:\n  hills: { tiles: {} }", "x").far.hills.of).toEqual(["hills"]);
  });

  it("finds the family of a hex by its terrain's folder", () => {
    const map = parseHexMap("---\nt(0,0): forest\nt(1,0): jungle\nt(2,0): plains");
    const { around } = terrainAround(map, pack);
    expect(farFamilyOf(pack, around, "0,0")).toBe("forest");
    expect(farFamilyOf(pack, around, "1,0")).toBe("forest");
    expect(farFamilyOf(pack, around, "2,0")).toBeNull();
  });
});

describe("picking far tiles", () => {
  it("picks by the sides joined, turning another slot into place", () => {
    expect(pickFarTile(pack, "forest", [], "s")?.file.path).toBe("forest/alone-0");
    expect(pickFarTile(pack, "forest", ["N", "S"], "s")).toMatchObject({
      file: { path: "forest/straight-0" },
      turn: 0,
    });
    // straight-1 (NE–SW) is straight-0 turned one side.
    expect(pickFarTile(pack, "forest", ["NE", "SW"], "s")).toMatchObject({
      file: { path: "forest/straight-0" },
      turn: 1,
    });
    // No turn60 at all: the family's whole tile stands in.
    expect(pickFarTile(pack, "forest", ["N", "NE"], "s")?.file.path).toBe("forest/star-0");
  });

  it("joins a wood: each hex by its neighbours of the family", () => {
    const map = parseHexMap("---\nt(0,-1): forest\nt(0,0): jungle\nt(0,1): forest\nt(4,0): forest");
    const picks = resolveFar(map, pack, terrainAround(map, pack).around);
    const by = Object.fromEntries(picks.map((p) => [`${p.q},${p.r}`, p.file.path]));
    expect(by["0,0"]).toBe("forest/straight-0");
    expect(by["4,0"]).toBe("forest/alone-0");
  });
});

describe("the level below, as the level above shows it", () => {
  const sizes = new Map<string, ImageSize>(
    [...pack.byPath.terrain.values(), ...pack.byPath.far.values()].map((f) => [f.url, { w: 100, h: 100 }])
  );
  const draw = (src: string) => {
    const map = parseHexMap(src);
    return { map, layout: layoutHexMap(resolveHexMap(map, packs, "basic"), sizes) };
  };

  it("draws far art, shrinks the rest, and leaves out hexes the same as their coarse hex", () => {
    const coarse = draw("pack: basic\nstep: 100 m\n---\nt(0,0): plains\n100m:\nt(1,0): plains");
    // Fine (6,0) sits on coarse (1,0); (0,0) and (1,0) on coarse (0,0).
    const fine = draw("pack: basic\n---\nt(0,0): plains\nt(1,0): sea\nt(0,1): forest\nt(6,0): forest");
    const picks = resolveFar(fine.map, pack, terrainAround(fine.map, pack).around);
    const out = farLayout(fine, picks, coarse, pack, sizes);
    const keys = out.items.map((i) => i.key.split(":")[0] + (i.key.endsWith(":far") ? ":far" : ""));
    expect(keys).not.toContain("0,0");
    expect(keys).toContain("1,0");
    expect(keys).toContain("0,1:far");
    expect(keys).toContain("6,0:far");
    // The far tile sits on its coarse hex's face, lifted with it (six times, in fine units).
    const lifted = out.items.find((i) => i.key === "6,0:far");
    const flat = out.items.find((i) => i.key === "0,1:far");
    expect(lifted?.kind === "tile" && flat?.kind === "tile").toBe(true);
    if (lifted?.kind === "tile" && flat?.kind === "tile") {
      const lift = coarse.layout.hexes.get("1,0")!.cy - Math.sqrt(3) * 40 * 0.5;
      expect(lift).toBeLessThan(0);
      // Size 1.5: half as wide again as the hex.
      expect(lifted.w).toBeCloseTo(2 * 40 * 1.5);
    }
  });
});
