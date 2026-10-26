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

describe("a pack with land/ and water/ sections", () => {
  const sectioned = buildPack(
    "basic",
    [
      "land/forest/lush/conifer-0.webp",
      "land/forest/lush/conifer-1.webp",
      "land/mountain/rocky/peak.webp",
      "water/ocean/still/ocean-0.webp",
      "water/swamp/swamp-0.webp",
      "path/roads/clean/straight.webp",
    ].map((path) => ({ path, url: `app://${path}` })),
    parsePackConfig(
      `files:
  "land/mountain/rocky/peak": { offsetX: 49 }
catalog:
  forest: forest[lush]
  ocean: water[ocean][still]`,
      "basic"
    )
  );
  const pick = (spec: string) => selectTile(sectioned, "terrain", spec, "s")?.file.path;

  it("finds land tiles by their folder, as under terrain/", () => {
    expect(pick("forest[lush][conifer]")).toMatch(/^land\/forest\/lush\/conifer-[01]$/);
    expect(pick("forest")).toMatch(/^land\/forest\/lush\/conifer-/);
  });

  it("finds water tiles under the water folder", () => {
    expect(pick("water[ocean][still]")).toBe("water/ocean/still/ocean-0");
    expect(pick("ocean")).toBe("water/ocean/still/ocean-0");
  });

  it("reads pack.yml's section-prefixed tile names", () => {
    expect(selectTile(sectioned, "terrain", "mountain[rocky][peak]", "s")?.display.offsetX).toBe(49);
  });

  it("leaves the other layers alone", () => {
    expect(selectTile(sectioned, "path", "roads", "s")?.file.path).toBe("roads/clean/straight");
  });
});
