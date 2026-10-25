import { describe, expect, it } from "vitest";
import { buildPack, displayFor, parsePackConfig, parseTileSpec, selectTile } from "./packs";

const files = [
  "terrain/forest/Hex - Forest, conifer (dry) 1.webp",
  "terrain/forest/Hex - Forest, conifer (dry) 2.webp",
  "terrain/forest/Hex - Forest, deciduous (lush) 1.webp",
  "terrain/forest/lush/conifer-0.webp",
  "terrain/forest/lush/conifer-1.webp",
  "terrain/forest/lush/deciduous-0.webp",
  "terrain/forest/snowy/conifer-0.webp",
  "terrain/mountain/rocky/peak.webp",
  "terrain/mountain/rocky/low.webp",
  "terrain/water/Hex - Water - Ocean (still water) 1.webp",
  "terrain/water/Hex - Water - Ocean (waves) 1.webp",
  "terrain/water/Hex - Water - Swamp (still water) 1.webp",
  "stack/island/Hex - Island - Lush (solo) 1.png",
  "terrain/notes.md",
].map((path) => ({ path, url: `app://${path}` }));

const config = parsePackConfig(
  `name: "Basic"
defaults: { hexWidth: 477, zoom: 1 }
layers:
  stack: { zoom: 1.5 }
terrains:
  forest: { offsetY: -2 }
  stack/island: { hexWidth: 224 }
files:
  "forest/lush/conifer-0": { offsetY: -3 }
catalog:
  ocean: water[Ocean](still water)
  pine: { spec: "forest[lush][conifer]", color: "#225522" }`,
  "basic"
);
const pack = buildPack("basic", files, config);
const names = (spec: string, layer: "terrain" | "stack" = "terrain") => {
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const t = selectTile(pack, layer, spec, `s${i}`);
    if (t) seen.add(t.file.path);
  }
  return [...seen].sort();
};

describe("parseTileSpec", () => {
  it("splits brackets and qualifiers", () => {
    expect(parseTileSpec("water[Ocean](still water)")).toEqual({
      base: "water",
      parts: [
        { kind: "bracket", value: "Ocean" },
        { kind: "qualifier", value: "still water" },
      ],
    });
    expect(parseTileSpec("forest")).toEqual({ base: "forest", parts: [] });
  });
});

describe("selectTile", () => {
  it("a bare folder picks its own files", () => {
    expect(names("forest")).toEqual([
      "forest/Hex - Forest, conifer (dry) 1",
      "forest/Hex - Forest, conifer (dry) 2",
      "forest/Hex - Forest, deciduous (lush) 1",
    ]);
  });
  it("a folder with only subfolders picks from all of them", () => {
    expect(names("mountain")).toEqual(["mountain/rocky/low", "mountain/rocky/peak"]);
  });
  it("brackets descend into folders, then filter names", () => {
    expect(names("forest[lush]")).toEqual([
      "forest/lush/conifer-0",
      "forest/lush/conifer-1",
      "forest/lush/deciduous-0",
    ]);
    expect(names("forest[lush][conifer]")).toEqual(["forest/lush/conifer-0", "forest/lush/conifer-1"]);
    expect(names("forest[*][conifer]")).toEqual([
      "forest/lush/conifer-0",
      "forest/lush/conifer-1",
      "forest/snowy/conifer-0",
    ]);
  });
  it("a number picks by index, clamped", () => {
    expect(selectTile(pack, "terrain", "forest[lush][1]", "x")?.file.path).toBe("forest/lush/conifer-1");
    expect(selectTile(pack, "terrain", "forest[lush][9]", "x")?.file.path).toBe("forest/lush/deciduous-0");
  });
  it("qualifiers match the pack's biome names", () => {
    expect(names("forest(lush)")).toEqual(["forest/Hex - Forest, deciduous (lush) 1"]);
    expect(names("water[Ocean](still water)")).toEqual(["water/Hex - Water - Ocean (still water) 1"]);
  });
  it("catalog names resolve to their spec", () => {
    expect(names("ocean")).toEqual(["water/Hex - Water - Ocean (still water) 1"]);
    expect(names("pine")).toEqual(["forest/lush/conifer-0", "forest/lush/conifer-1"]);
  });
  it("is stable for the same seed", () => {
    const a = selectTile(pack, "terrain", "forest", "map:3,4:terrain:0");
    const b = selectTile(pack, "terrain", "forest", "map:3,4:terrain:0");
    expect(a?.file.path).toBe(b?.file.path);
  });
  it("returns null when nothing matches — no silent grass", () => {
    expect(selectTile(pack, "terrain", "lava", "x")).toBeNull();
    expect(selectTile(pack, "terrain", "forest(cursed)", "x")).toBeNull();
  });
  it("ignores files that aren't images", () => {
    expect(selectTile(pack, "terrain", "notes", "x")).toBeNull();
  });
});

describe("displayFor", () => {
  it("cascades defaults → layer → folder → file", () => {
    expect(displayFor(config, "terrain", "forest/lush/conifer-0")).toMatchObject({
      hexWidth: 477,
      offsetY: -3,
      zoom: 1,
    });
    expect(displayFor(config, "terrain", "forest/lush/conifer-1")).toMatchObject({ offsetY: -2 });
    expect(displayFor(config, "stack", "island/x")).toMatchObject({ hexWidth: 224, zoom: 1.5 });
  });
  it("survives a broken pack.yml", () => {
    expect(parsePackConfig("defaults: [", "x").defaults.zoom).toBe(1);
    expect(parsePackConfig(null, "x").name).toBe("x");
  });
});

describe("base layer", () => {
  it("indexes base tiles and reads step, hides and the pack's base", () => {
    const cfg = parsePackConfig(
      "defaults: { hexWidth: 477, step: 35 }\nbase: basic[level]\nterrains:\n  hills: { hides: true }",
      "p"
    );
    expect(cfg.defaults.step).toBe(35);
    expect(cfg.base).toBe("basic[level]");
    expect(displayFor(cfg, "terrain", "hills/a").hides).toBe(true);
    const pack = buildPack(
      "p",
      [
        { path: "base/level.webp", url: "u:level" },
        { path: "base/rocky-0.webp", url: "u:r0" },
        { path: "base/rocky-1.webp", url: "u:r1" },
        { path: "terrain/stray.webp", url: "u:stray" },
      ],
      cfg
    );
    // Bases sit in the layer folder itself and are named by file; `rocky` takes its `rocky-…` variants.
    expect(selectTile(pack, "base", "level", "s")?.file.path).toBe("level");
    expect(selectTile(pack, "base", "rocky[1]", "s")?.file.path).toBe("rocky-1");
    expect(selectTile(pack, "base", "rock", "s")).toBeNull();
    // Other layers still want a folder.
    expect(pack.layers.terrain.files).toHaveLength(0);
  });
});

describe("selectTile: an exact name", () => {
  it("wins over names that contain it", () => {
    const pack = buildPack(
      "basic",
      ["deciduous", "deciduous-sparse", "deciduous-clearing", "conifer-0", "conifer-1"].map((n) => ({
        path: `terrain/land/forest/lush/${n}.webp`,
        url: n,
      })),
      parsePackConfig("", "basic")
    );
    for (const seed of ["a", "b", "c", "d", "e"])
      expect(selectTile(pack, "terrain", "forest[lush][deciduous]", seed)?.file.name).toBe("deciduous");
    // `*` picks among every name it fits, at random.
    const deciduous = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map(
        (x) => selectTile(pack, "terrain", "forest[lush][deciduous*]", x)?.file.name
      )
    );
    expect([...deciduous].sort()).toEqual(["deciduous", "deciduous-clearing", "deciduous-sparse"]);
    expect(selectTile(pack, "terrain", "forest[lush][*sparse]", "a")?.file.name).toBe("deciduous-sparse");
    expect(selectTile(pack, "terrain", "forest[lush][*clear*]", "a")?.file.name).toBe("deciduous-clearing");
    const conifers = new Set(
      ["a", "b", "c", "d", "e", "f"].map((s) => selectTile(pack, "terrain", "forest[lush][conifer]", s)?.file.name)
    );
    expect([...conifers].every((n) => n?.startsWith("conifer-"))).toBe(true);
  });
});

describe("terrain sections at the pack's top", () => {
  it("reads land/ and water/ beside the other layers as the terrain layer, the paths unchanged", () => {
    const top = buildPack(
      "p",
      ["land/forest/lush/a.webp", "water/ocean/still-0.webp", "stack/foliage/tree.webp"].map((path) => ({ path, url: `u:${path}` })),
      parsePackConfig(null, "p")
    );
    const under = buildPack(
      "p",
      ["terrain/land/forest/lush/a.webp", "terrain/water/ocean/still-0.webp"].map((path) => ({ path, url: `u:${path}` })),
      parsePackConfig(null, "p")
    );
    expect([...top.byPath.terrain.keys()].sort()).toEqual([...under.byPath.terrain.keys()].sort());
    expect(selectTile(top, "terrain", "forest[lush]", "s")?.file.path).toBe("land/forest/lush/a");
    expect(selectTile(top, "terrain", "ocean", "s")?.file.path).toBe("water/ocean/still-0");
    expect(top.byPath.stack.size).toBe(1);
  });
});
