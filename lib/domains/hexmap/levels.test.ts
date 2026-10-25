import { describe, expect, it } from "vitest";
import { applyHexEdits } from "./edit-hex-map";
import {
  coarseHexOf,
  editLevel,
  fillHexes,
  importsAtLevel,
  innerHexesOf,
  levelScale,
  levelSections,
  levelView,
  migrateDetails,
  viewAtLevel,
  withFill,
} from "./levels";
import { parseHexMap } from "./parse-hex-map";

const SRC = `grid: hex
title: Coast
pack: basic
scale: 30 mi
regions:
  Dunlind: { color: "#8a3b2e" }
---
0m:
  * t(1,0): plains @Dunlind
  * t(2,0): forest

level 1:
  * t(6,0): plains
  * t(7,0): forest @Dunlind

level 2:
  * t(36,0): hamlet`;

describe("levels in the block", () => {
  it("reads them, and keeps the main map to the lines above the first", () => {
    const map = parseHexMap(SRC);
    expect(map.cells.map((c) => `${c.q},${c.r}`)).toEqual(["1,0", "2,0"]);
    expect(map.errors).toEqual([]);
    expect(levelSections(SRC).map((s) => s.depth)).toEqual([1, 2]);
  });

  it("gives each level's scale, six times finer each time", () => {
    expect(levelScale("30 mi", 0)).toBe("30 mi");
    expect(levelScale("30 mi", 1)).toBe("5 mi");
    expect(levelScale("30 mi", 2)).toBe("1 mi");
  });

  it("views a level as a map of its own, in global coordinates", () => {
    const view = parseHexMap(levelView(SRC, 1));
    expect(view).toMatchObject({ title: "Coast", pack: "basic", scale: "5 mi" });
    expect(view.at).toBeUndefined();
    expect(view.cells.map((c) => [c.q, c.r, c.spec, c.regions])).toEqual([
      [6, 0, "plains", []],
      [7, 0, "forest", ["Dunlind"]],
    ]);
    expect(view.regions.Dunlind.color).toBe("#8a3b2e");
  });

  it("writes edits into a level, and adds a missing one in order", () => {
    const out = editLevel(SRC, 1, (v) =>
      applyHexEdits(v, [{ kind: "paint", layer: "terrain", q: 5, r: 0, spec: "ocean" }])
    );
    expect(out).toContain("level 1:\n  * t(6,0): plains\n  * t(7,0): forest @Dunlind\n  * t(5,0): ocean\n\nlevel 2:");
    expect(parseHexMap(out).cells).toHaveLength(2);
    const only = SRC.slice(0, SRC.indexOf("\nlevel 1:"));
    const two = editLevel(only + "\n\nlevel 2:\n  * t(0,0): hamlet", 1, (v) =>
      applyHexEdits(v, [{ kind: "paint", layer: "terrain", q: 0, r: 0, spec: "hills" }])
    );
    expect(levelSections(two).map((s) => s.depth)).toEqual([1, 2]);
    expect(two).toContain("level 1:\n  * t(0,0): hills\n\nlevel 2:");
  });

  it("keeps main-map edits above the levels", () => {
    const out = applyHexEdits(SRC, [
      { kind: "paint", layer: "terrain", q: 3, r: 0, spec: "hills" },
      { kind: "point", layer: "marker", q: 1.5, r: 0, content: "pin[red]" },
    ]);
    const lines = out.split("\n");
    expect(lines.indexOf("  * t(3,0): hills")).toBeLessThan(lines.indexOf("level 1:"));
    expect(lines.indexOf("  * m(1.5,0): pin[red]")).toBeLessThan(lines.indexOf("level 1:"));
    expect(levelSections(out)).toHaveLength(2);
  });
});

describe("where a level lies in the level above", () => {
  it("puts (6q, 6r) on the centre of (q, r)", () => {
    expect(coarseHexOf(6, 0)).toEqual({ q: 1, r: 0 });
    expect(coarseHexOf(-6, 12)).toEqual({ q: -1, r: 2 });
  });

  it("fills only the fine hexes wholly inside a coarse hex", () => {
    const inner = innerHexesOf(0, 0);
    expect(inner.length).toBeGreaterThan(20);
    expect(inner.length).toBeLessThan(37);
    expect(inner.every((h) => coarseHexOf(h.q, h.r).q === 0 && coarseHexOf(h.q, h.r).r === 0)).toBe(true);
    // Shifting the coarse hex shifts its inner hexes by six times as much.
    const moved = innerHexesOf(1, -1).map((h) => `${h.q - 6},${h.r + 6}`);
    expect(new Set(moved)).toEqual(new Set(inner.map((h) => `${h.q},${h.r}`)));
  });

  it("takes a coarse tile down, skipping hexes already painted", () => {
    const fill = fillHexes(0, 0, { terrain: "forest", base: "lush", height: 2 }, new Set(["0,0"]));
    expect(fill.some((f) => f.q === 0 && f.r === 0)).toBe(false);
    expect(fill).toHaveLength(innerHexesOf(0, 0).length - 1);
    const map = parseHexMap(withFill(levelView(SRC, 1), fill));
    expect(map.cells.filter((c) => c.layer === "terrain" && c.spec === "forest" && c.height === 2)).toHaveLength(
      fill.length
    );
    expect(map.cells.filter((c) => c.layer === "base" && c.spec === "lush")).toHaveLength(fill.length);
    // The level's own lines stay as they were, above the fill.
    expect(map.cells.find((c) => c.q === 6 && c.r === 0)?.spec).toBe("plains");
  });

  it("scales a view box between levels", () => {
    expect(viewAtLevel({ x: 1, y: 2, w: 3, h: 4 }, 0, 1)).toEqual({ x: 6, y: 12, w: 18, h: 24 });
    expect(viewAtLevel({ x: 6, y: 12, w: 18, h: 24 }, 1, 0)).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it("places imports' own levels, their offsets scaled", () => {
    const body = "grid: hex\nscale: 30 mi\n---\nt(0,0): plains\nlevel 1:\nt(1,0): forest";
    const placed = importsAtLevel(
      [{ path: "A.md", body, map: parseHexMap(body), offset: [2, -1], faint: false, via: "Host.md" }],
      1
    );
    expect(placed[0].offset).toEqual([12, -6]);
    expect(placed[0].map.cells.map((c) => [c.q, c.r, c.spec])).toEqual([[1, 0, "forest"]]);
    expect(importsAtLevel(placed, 2)).toEqual([]);
  });
});

describe("older detail(q,r) sections", () => {
  const OLD = `grid: hex
scale: 30 mi
---
0m:
  * t(0,0): ocean
  * t(1,0): plains

detail(1,0):
  * t(0,0): plains
  * t(-1,1): plains
  * m(0.5,0): pin[red]

detail(1,0 / 2,-1):
  * t(0,0): hamlet
  * 3,1: fields
detail(2,0): [[Barelgrove]]`;

  it("moves them into levels at their global places", () => {
    const out = migrateDetails(OLD);
    expect(out).toContain(
      "  * t(1,0): plains\n\nlevel 1:\n  * t(6,0): plains\n  * t(5,1): plains\n  * m(6.5,0): pin[red]"
    );
    // (1,0) / (2,-1) is level 1's (8,-1); its (0,0) is level 2's (48,-6).
    expect(out).toContain("level 2:\n  * t(48,-6): hamlet\n  * 51,-5: fields");
    expect(out).not.toContain("Barelgrove");
    expect(out).not.toContain("detail(");
    expect(parseHexMap(out).cells).toHaveLength(2);
    expect(parseHexMap(levelView(out, 2)).cells.map((c) => [c.q, c.r])).toEqual([
      [48, -6],
      [51, -5],
    ]);
  });
});
