import { describe, expect, it } from "vitest";
import { applyPackEdits } from "./pack-yml-edit";
import { parsePackConfig } from "./packs";

const yml = `# Basic hex pack.
name: "Basic"

defaults:
  hexWidth: 477
  zoom: 1.0   # extra multiplier
  offsetX: 0

terrains: {}
files:
  # The peak tiles sit off-centre.
  "mountain/rocky/peak": { offsetX: 49, offsetY: 7 }

# Short names.
catalog:
  plains: plains[lush]
  ocean: water[Ocean](still water)
`;

describe("applyPackEdits", () => {
  it("leaves the text alone with no edits", () => {
    expect(applyPackEdits(yml, [])).toBe(yml);
  });

  it("adds, renames and removes catalog names, keeping comments", () => {
    const out = applyPackEdits(yml, [
      { kind: "catalog-set", id: "dry-plains", spec: "plains(dry)" },
      { kind: "catalog-rename", from: "ocean", to: "sea" },
      { kind: "catalog-delete", id: "plains" },
      { kind: "catalog-set", id: "city", spec: "urban[City](lush)", color: "#a08060" },
    ]);
    expect(out).toContain("# Basic hex pack.");
    expect(out).toContain("# Short names.");
    expect(out).toContain("# The peak tiles sit off-centre.");
    expect(parsePackConfig(out, "basic").catalog).toEqual({
      "dry-plains": { spec: "plains(dry)" },
      sea: { spec: "water[Ocean](still water)" },
      city: { spec: "urban[City](lush)", color: "#a08060" },
    });
  });

  it("tunes at each level; a tile entry stays a one-liner", () => {
    const out = applyPackEdits(yml, [
      { kind: "tune", level: { kind: "defaults" }, key: "zoom", value: 1.1 },
      { kind: "tune", level: { kind: "terrains", key: "forest" }, key: "offsetY", value: -2 },
      { kind: "tune", level: { kind: "files", key: "forest/lush/conifer-0" }, key: "offsetY", value: -3 },
      { kind: "tune", level: { kind: "files", key: "mountain/rocky/peak" }, key: "zoom", value: 1.05 },
    ]);
    const config = parsePackConfig(out, "basic");
    expect(config.defaults).toMatchObject({ hexWidth: 477, zoom: 1.1, offsetX: 0 });
    expect(config.terrains.forest).toEqual({ offsetY: -2 });
    expect(config.files["forest/lush/conifer-0"]).toEqual({ offsetY: -3 });
    expect(config.files["mountain/rocky/peak"]).toEqual({ offsetX: 49, offsetY: 7, zoom: 1.05 });
    expect(out).toContain('"forest/lush/conifer-0": { offsetY: -3 }');
    expect(out).toContain("zoom: 1.1 # extra multiplier");
  });

  it("clears a value, and drops a tile entry left empty", () => {
    const out = applyPackEdits(yml, [
      { kind: "tune", level: { kind: "files", key: "mountain/rocky/peak" }, key: "offsetX", value: null },
      { kind: "tune", level: { kind: "files", key: "mountain/rocky/peak" }, key: "offsetY", value: null },
      { kind: "tune", level: { kind: "defaults" }, key: "offsetX", value: null },
    ]);
    const config = parsePackConfig(out, "basic");
    expect(config.files["mountain/rocky/peak"]).toBeUndefined();
    expect(out).not.toContain("mountain/rocky/peak");
    expect(config.defaults.offsetX).toBe(0); // back to the built-in default
    expect(out).not.toMatch(/^\s+offsetX: 0$/m);
  });

  it("writes into an empty or missing file", () => {
    const out = applyPackEdits("", [{ kind: "catalog-set", id: "plains", spec: "grass" }]);
    expect(parsePackConfig(out, "x").catalog.plains).toEqual({ spec: "grass" });
  });
});

describe("tile-rename", () => {
  const yml = [
    "# kept",
    "files:",
    '  "mountain/rocky/peak": { offsetX: 49 }',
    '  "path/roads/clean/start-0": { zoom: 2 }',
    "autotile:",
    "  roads:",
    "    tiles:",
    '      "N": "roads/clean/start-0"',
    '      "S": ["roads/clean/start-0", "roads/clean/start-3"]',
    "catalog:",
    "  peak: mountain[rocky][peak]",
    "  rocks: mountain[rocky]",
    '  road-start: { spec: "roads[clean][start-0]", color: "#aa0" }',
    "",
  ].join("\n");
  it("follows a terrain tile: its tuning and the catalog names for it", () => {
    const out = applyPackEdits(yml, [
      { kind: "tile-rename", layer: "terrain", from: "mountain/rocky/peak", to: "mountain/rocky/summit" },
    ]);
    expect(out).toContain('"mountain/rocky/summit": { offsetX: 49 }');
    expect(out).toContain("peak: mountain[rocky][summit]");
    expect(out).toContain("rocks: mountain[rocky]");
    expect(out).toContain("# kept");
  });
  it("follows a path tile into its autotile lists", () => {
    const out = applyPackEdits(yml, [
      { kind: "tile-rename", layer: "path", from: "roads/clean/start-0", to: "roads/clean/begin-0" },
    ]);
    expect(out).toContain('"path/roads/clean/begin-0": { zoom: 2 }');
    expect(out).toContain('"N": "roads/clean/begin-0"');
    expect(out).toMatch(/\[ ?"roads\/clean\/begin-0", "roads\/clean\/start-3" ?\]/);
    expect(out).toContain('spec: "roads[clean][begin-0]"');
    // A terrain tile of the same path is another file.
    expect(out).toContain('"mountain/rocky/peak"');
  });
});

describe("tile-rename in a section", () => {
  it("follows catalog specs that name the section and ones that don't", () => {
    const yml = "catalog:\n  a: forest[lush][x]\n  b: land[forest][lush][x]\n  c: forest[lush]\n";
    const out = applyPackEdits(yml, [
      { kind: "tile-rename", layer: "terrain", from: "land/forest/lush/x", to: "land/forest/lush/y" },
    ]);
    expect(out).toContain("a: forest[lush][y]");
    expect(out).toContain("b: land[forest][lush][y]");
    expect(out).toContain("c: forest[lush]");
  });
});

describe("autotile-set", () => {
  const yml = [
    "autotile:",
    "  roads:",
    "    tiles:",
    '      "S": ["roads/b", "roads/c"]',
    '      "N": "roads/a"',
    '      "n, s": "roads/c"',
    "",
  ].join("\n");
  const tiles = (text: string) => parsePackConfig(text, "x").autotile.roads.tiles;
  it("rewrites side keys as shape names, in catalogue order", () => {
    const out = applyPackEdits(yml, [{ kind: "autotile-shape-keys", family: "roads" }]);
    expect(out).toMatch(/start-0: "roads\/a"\n\s+start-3: \[ ?"roads\/b", "roads\/c" ?\]\n\s+straight-0: "roads\/c"/);
    expect(parsePackConfig(out, "x").autotile.roads.sideKeys).toBe(0);
    expect(parsePackConfig(yml, "x").autotile.roads.sideKeys).toBe(3);
  });
  it("moves a tile to its shape, tidying the lists it leaves", () => {
    const out = applyPackEdits(yml, [{ kind: "autotile-set", family: "roads", path: "roads/c", shape: "start-0" }]);
    expect(tiles(out)).toEqual({ "start-0": ["roads/a", "roads/c"], "start-3": ["roads/b"] });
    expect(out).toContain('start-3: "roads/b"');
  });
  it("keeps a variant apart from its type, and starts new tables", () => {
    const out = applyPackEdits(yml, [
      { kind: "autotile-set", family: "roads", path: "roads/d", shape: "start-0-hub" },
      { kind: "autotile-set", family: "wall", path: "wall/straight-0", shape: "straight-0" },
    ]);
    expect(tiles(out)["start-0"]).toEqual(["roads/a"]);
    expect(tiles(out)["start-0-hub"]).toEqual(["roads/d"]);
    expect(parsePackConfig(out, "x").autotile.wall.tiles).toEqual({ "straight-0": ["wall/straight-0"] });
  });
  it("writes edge pieces into the edges: table, keyed by run", () => {
    const out = applyPackEdits(yml, [
      { kind: "autotile-set", section: "edges", family: "coast", path: "coast/big-0", shape: "run3-0" },
    ]);
    expect(parsePackConfig(out, "x").edges.coast.tiles).toEqual({ "run3-0": ["coast/big-0"] });
    expect(
      applyPackEdits(out, [{ kind: "tile-rename", layer: "edge", from: "coast/big-0", to: "coast/run3-0" }])
    ).toContain('run3-0: "coast/run3-0"');
  });
  it("takes a tile out of the table", () => {
    const out = applyPackEdits(yml, [{ kind: "autotile-set", family: "roads", path: "roads/a", shape: null }]);
    expect(tiles(out)["start-0"]).toBeUndefined();
  });
});

describe("tile-move", () => {
  const src = `defaults:
  hexWidth: 477
terrains:
  basic: { zoom: 1.1 }
  path/wall: { hexWidth: 115 }
files:
  "basic/rocky": { hexWidth: 115 }
  "basic/level": { hexWidth: 115 }
  "forest/lush/conifer-0": { offsetY: -3 }
autotile:
  roads:
    tiles:
      straight-0: ["roads/clean/straight-0", "roads/clean/straight-0b"]
`;

  it("takes a tile's tuning to the other layer", () => {
    const cfg = parsePackConfig(
      applyPackEdits(src, [{ kind: "tile-move", from: "terrain", to: "base", path: "basic/level", folder: false }]),
      "p"
    );
    expect(cfg.files["base/basic/level"]).toEqual({ hexWidth: 115 });
    expect(cfg.files["basic/level"]).toBeUndefined();
    expect(cfg.files["basic/rocky"]).toEqual({ hexWidth: 115 });
  });

  it("takes a top folder's tuning and everything below it, leaving other layers' keys", () => {
    const cfg = parsePackConfig(
      applyPackEdits(src, [{ kind: "tile-move", from: "terrain", to: "base", path: "basic", folder: true }]),
      "p"
    );
    expect(cfg.terrains["base/basic"]).toEqual({ zoom: 1.1 });
    expect(cfg.terrains["path/wall"]).toEqual({ hexWidth: 115 });
    expect(Object.keys(cfg.files).sort()).toEqual(["base/basic/level", "base/basic/rocky", "forest/lush/conifer-0"]);
  });

  it("into base, keeps only the file name", () => {
    const cfg = parsePackConfig(
      applyPackEdits(src, [
        { kind: "tile-move", from: "terrain", to: "base", path: "basic", folder: true, flat: true },
      ]),
      "p"
    );
    expect(cfg.files["base/level"]).toEqual({ hexWidth: 115 });
    expect(cfg.files["base/rocky"]).toEqual({ hexWidth: 115 });
    // The folder's own tuning stays: its files no longer sit in a folder.
    expect(cfg.terrains.basic).toEqual({ zoom: 1.1 });
  });

  it("drops a moved path tile from its family's table", () => {
    const cfg = parsePackConfig(
      applyPackEdits(src, [
        { kind: "tile-move", from: "path", to: "stack", path: "roads/clean/straight-0b", folder: false },
      ]),
      "p"
    );
    expect(cfg.autotile.roads.tiles["straight-0"]).toEqual(["roads/clean/straight-0"]);
  });
});

describe("label-set", () => {
  it("writes a family's text box as a one-liner, and clears it", () => {
    let text = applyPackEdits("name: Basic\n", [
      { kind: "label-set", family: "title-1", key: "inset", value: [120, 60, 50, 75] },
    ]);
    expect(text).toContain("labels:\n  title-1: { inset: [ 120, 60, 50, 75 ] }");
    text = applyPackEdits(text, [{ kind: "label-set", family: "title-1", key: "size", value: 0.3 }]);
    expect(parsePackConfig(text, "basic").labels["title-1"]).toEqual({ inset: [120, 60, 50, 75], size: 0.3 });
    text = applyPackEdits(text, [
      { kind: "label-set", family: "title-1", key: "inset", value: null },
      { kind: "label-set", family: "title-1", key: "size", value: null },
    ]);
    expect(parsePackConfig(text, "basic").labels["title-1"]).toBeUndefined();
  });
});

describe("marker-set", () => {
  it("writes a style's anchor and size as a one-liner", () => {
    const text = applyPackEdits("name: Basic\n", [
      { kind: "marker-set", style: "pin", key: "anchor", value: [0.5, 0.98] },
      { kind: "marker-set", style: "pin", key: "size", value: 0.8 },
    ]);
    expect(parsePackConfig(text, "basic").markers.pin).toEqual({ anchor: [0.5, 0.98], size: 0.8 });
    expect(text).toContain("markers:\n  pin: { anchor: [ 0.5, 0.98 ], size: 0.8 }");
  });
});

describe("stamps in pack.yml", () => {
  it("writes, renames and deletes a stamp, its lines quoted, and reads back", async () => {
    const { parsePackConfig } = await import("./packs");
    const text = applyPackEdits("name: basic\n# my stamps\n", [
      { kind: "stamp-set", name: "town", lines: ["t(0,0): city", "100m:", "t(1,0): hills"] },
    ]);
    expect(text).toContain('custom:\n  town:\n    - "t(0,0): city"\n    - "100m:"');
    expect(text).toContain("# my stamps");
    expect(parsePackConfig(text, "basic").stamps.town).toEqual(["t(0,0): city", "100m:", "t(1,0): hills"]);
    const renamed = applyPackEdits(text, [{ kind: "stamp-rename", from: "town", to: "village" }]);
    expect(parsePackConfig(renamed, "basic").stamps).toEqual({ village: ["t(0,0): city", "100m:", "t(1,0): hills"] });
    const gone = applyPackEdits(renamed, [{ kind: "stamp-set", name: "village", lines: null }]);
    expect(parsePackConfig(gone, "basic").stamps).toEqual({});
  });
});

describe("far tables", () => {
  it("lists a far tile under its shape, and sets what the family stands for", () => {
    const out = applyPackEdits("name: basic\n", [
      { kind: "autotile-set", section: "far", family: "forest", path: "forest/alone-0", shape: "alone-0" },
      { kind: "autotile-set", section: "far", family: "forest", path: "forest/star-0", shape: "star-0" },
      { kind: "far-set", family: "forest", key: "of", value: ["forest", "jungle"] },
      { kind: "far-set", family: "forest", key: "size", value: 1.2 },
    ]);
    const far = parsePackConfig(out, "basic").far.forest;
    expect(far.tiles).toEqual({ "alone-0": ["forest/alone-0"], "star-0": ["forest/star-0"] });
    expect(far.of).toEqual(["forest", "jungle"]);
    expect(far.size).toBe(1.2);
    const cleared = applyPackEdits(out, [{ kind: "far-set", family: "forest", key: "size", value: null }]);
    expect(parsePackConfig(cleared, "basic").far.forest.size).toBeUndefined();
  });
});
