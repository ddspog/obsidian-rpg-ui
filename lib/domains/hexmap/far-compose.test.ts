import { describe, expect, it } from "vitest";
import {
  composeValue,
  type FarCompose,
  farVariations,
  readCompose,
  spritesFor,
  templateSprites,
  turnPoint,
} from "./far-compose";
import { applyPackEdits } from "./pack-yml-edit";
import { parsePackConfig } from "./packs";

const recipe: FarCompose = {
  canvas: 1.5,
  sprites: [
    { src: "stack/foliage/tree", zone: "mid", x: 0, y: 0.1, s: 0.6 },
    { src: "stack/foliage/tree", zone: "*+", x: 0, y: -0.3, s: 0.5 },
    { src: "stack/foliage/bush", zone: "*-", x: 0.05, y: -0.32, s: 0.4, flip: true },
    { src: "stack/hill/hill", zone: "S+", x: 0, y: 0.3, s: 0.5 },
  ],
  shapes: { "straight-0": [{ src: "stack/foliage/tree", x: 0, y: 0, s: 1 }] },
};

describe("far art recipes", () => {
  it("has 64 variations: alone, then every type's slots", () => {
    const all = farVariations();
    expect(all).toHaveLength(64);
    expect(all[0]).toEqual({ type: "alone", slot: 0 });
    expect(all.filter((v) => v.type === "straight")).toHaveLength(3);
  });

  it("turns a side's design round to each side, clockwise", () => {
    const p = turnPoint(0, -0.3, 3);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0.3);
    const ne = turnPoint(0, -1, 1);
    expect(ne.x).toBeCloseTo(Math.sqrt(3) / 2);
    expect(ne.y).toBeCloseTo(-0.5);
  });

  it("draws the middle always, joined sides where joined, open sides elsewhere", () => {
    const alone = templateSprites(recipe, []);
    expect(alone.filter((s) => s.src.endsWith("bush"))).toHaveLength(6);
    expect(alone.filter((s) => s.y === 0.1)).toHaveLength(1);
    const ns = templateSprites(recipe, ["N", "S"]);
    // Two joined sides (trees), four open (bushes), the middle, and S's own hill.
    expect(ns.filter((s) => s.src.endsWith("tree"))).toHaveLength(3);
    expect(ns.filter((s) => s.src.endsWith("bush"))).toHaveLength(4);
    expect(ns.filter((s) => s.src.endsWith("hill"))).toHaveLength(1);
  });

  it("draws a variation finished by hand as its own, back to front", () => {
    expect(spritesFor(recipe, { type: "straight", slot: 0 })).toEqual([
      { src: "stack/foliage/tree", x: 0, y: 0, s: 1 },
    ]);
    const star = spritesFor(recipe, { type: "star", slot: 0 });
    expect(star.map((s) => s.y)).toEqual([...star.map((s) => s.y)].sort((a, b) => a - b));
  });

  it("goes through pack.yml and back", () => {
    const text = applyPackEdits("name: basic\n", [{ kind: "far-compose", family: "forest", compose: recipe }]);
    expect(text).toContain("- { src: stack/foliage/tree, x: 0, y: 0.1, s: 0.6, zone: mid }");
    expect(parsePackConfig(text, "basic").far.forest.compose).toEqual(recipe);
    expect(readCompose(composeValue(recipe))).toEqual(recipe);
    const baked = applyPackEdits(text, [
      { kind: "far-baked", family: "forest", tiles: { "star-0": "forest/star-0", "alone-0": "forest/alone-0" } },
    ]);
    expect(Object.keys(parsePackConfig(baked, "basic").far.forest.tiles)).toEqual(["alone-0", "star-0"]);
  });
});
