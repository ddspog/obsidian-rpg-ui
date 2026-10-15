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
