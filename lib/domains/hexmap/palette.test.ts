import { describe, expect, it } from "vitest";
import { buildPack, parsePackConfig, selectTile } from "./packs";
import { catalogEntries, familyEntries, folderEntries, paintableLayers, specOf } from "./palette";

const files = [
  "terrain/land/forest/lush/conifer-0.webp",
  "terrain/land/forest/lush/conifer-1.webp",
  "terrain/land/plains/dry/clean.webp",
  "terrain/water/ocean/still-0.webp",
  "base/rocky.webp",
  "path/roads/clean/straight-0.webp",
  "marker/pin/red.webp",
].map((path) => ({ path, url: `app://${path}` }));

const pack = buildPack(
  "basic",
  files,
  parsePackConfig(
    `catalog:
  pine: forest[lush][conifer]
  sea: water[ocean]
  dot: pin[red]
autotile:
  roads:
    tiles: { straight-0: [roads/clean/straight-0] }`,
    "basic"
  )
);

describe("palette", () => {
  it("names folders and tiles the way a map line does, without terrain's sections", () => {
    expect(specOf("terrain", ["land", "forest", "lush"])).toBe("forest[lush]");
    expect(specOf("terrain", ["water", "ocean"])).toBe("ocean");
    expect(specOf("base", [], { name: "rocky", path: "rocky", url: "" })).toBe("rocky");
    expect(specOf("marker", ["pin"], { name: "red", path: "pin/red", url: "" })).toBe("pin[red]");
    // Each spec picks what it names.
    for (const spec of ["forest[lush]", "ocean", "plains[dry][clean]"])
      expect(selectTile(pack, "terrain", spec, "x")).not.toBeNull();
  });

  it("lists a folder's subfolders and tiles; sections are headings", () => {
    expect(folderEntries(pack, "terrain", []).map((e) => [e.name, e.spec])).toEqual([
      ["land", ""],
      ["water", ""],
    ]);
    expect(folderEntries(pack, "terrain", ["land", "forest", "lush"]).map((e) => e.spec)).toEqual([
      "forest[lush][conifer-0]",
      "forest[lush][conifer-1]",
    ]);
    expect(folderEntries(pack, "terrain", ["land"])[0]).toMatchObject({ spec: "forest", kind: "folder" });
  });

  it("puts each catalog name under the layer it picks on, and lists joined families", () => {
    expect(catalogEntries(pack, "terrain").map((e) => e.spec)).toEqual(["pine", "sea"]);
    expect(catalogEntries(pack, "marker").map((e) => e.spec)).toEqual(["dot"]);
    expect(familyEntries(pack)).toEqual([
      { spec: "roads", name: "roads", url: "app://path/roads/clean/straight-0.webp", kind: "family" },
    ]);
  });

  it("offers only the layers the pack has tiles for", () => {
    expect(paintableLayers(pack)).toEqual(["terrain", "base", "path", "marker"]);
    expect(paintableLayers(undefined)).toEqual(["terrain"]);
  });
});
