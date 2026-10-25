import { describe, expect, it } from "vitest";
import { applyHexEdits } from "./edit-hex-map";
import { mergeImports } from "./imports";
import { resolveHexMap } from "./layout";
import { buildPack, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";

const pack = buildPack(
  "basic",
  [
    "terrain/land/plains/a.webp",
    "terrain/water/ocean/a.webp",
    "edge/coast/run1-0.webp",
    "edge/coast/run1-1.webp",
    "edge/coast/run1-5.webp",
    "edge/coast/run2-5.webp",
    "edge/coast/run3-0.webp",
    "path/rivers/straight-0.webp",
    "path/rivers/start-3.webp",
  ].map((path) => ({ path, url: `u:${path}` })),
  parsePackConfig(
    `edges:
  coast:
    meets: [water]
    tiles:
      run1-0: coast/run1-0
      run1-1: coast/run1-1
      run1-5: coast/run1-5
      run2-5: coast/run2-5
      run3-0: coast/run3-0
autotile:
  rivers:
    connectsTo: [water]
    tiles:
      straight-0: rivers/straight-0
      start-3: rivers/start-3`,
    "basic"
  )
);
const packs = new Map([["basic", pack]]);
// Water at (0,0); land N, NE and NW of it (its sides 0, 1, 5).
const sea = "grid: hex\n---\nt(0,0): ocean\nt(0,-1): plains\nt(1,-1): plains\nt(-1,0): plains";
const coast = (src: string) =>
  resolveHexMap(parseHexMap(src), packs, "basic")
    .picks.filter((p) => p.cell.layer === "edge" && p.file)
    .map((p) => p.file);

describe("coasts", () => {
  it("lay themselves along the land", () => {
    // Three sides in a row: one piece, named for its middle side.
    expect(coast(sea)).toEqual(["coast/run3-0"]);
  });

  it("give way to pieces placed by hand, or to none", () => {
    expect(coast(`${sea}\ne(0,0): coast[run1-0]`)).toEqual(["coast/run1-0"]);
    expect(coast(`${sea}\ne(0,0): none`)).toEqual([]);
    expect(resolveHexMap(parseHexMap(`${sea}\ne(0,0): none`), packs, "basic").errors).toEqual([]);
  });

  it("part where a river runs into the sea", () => {
    // A river down from (0,-2) into the sea through (0,-1): its mouth is the water's N side.
    const pieces = coast(`${sea}\np(0,-2): rivers\np(0,-1): rivers`);
    expect(pieces.sort()).toEqual(["coast/run1-1", "coast/run1-5"]);
  });

  it("are written off by erasing them, and back by erasing that", () => {
    const off = applyHexEdits(sea, [{ kind: "erase", layer: "edge", q: 0, r: 0 }]);
    expect(off).toContain("e(0,0): none");
    expect(applyHexEdits(off, [{ kind: "erase", layer: "edge", q: 0, r: 0 }])).not.toContain("e(0,0)");
  });

  it("see a faint neighbour's land", () => {
    const host = parseHexMap("grid: hex\n---\nt(0,0): ocean");
    const next = parseHexMap("grid: hex\n---\nt(0,-1): plains @Other");
    const merged = mergeImports(host, [{ path: "n", via: "host", body: "", map: next, offset: [0, 0], faint: true }]);
    expect(merged.cells.find((c) => c.r === -1)).toMatchObject({ faint: true, regions: [] });
    const picks = resolveHexMap(merged, packs, "basic").picks.filter((p) => p.cell.layer === "edge" && p.file);
    expect(picks.map((p) => p.file)).toEqual(["coast/run1-0"]);
  });
});
