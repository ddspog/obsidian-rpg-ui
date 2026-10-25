import { describe, expect, it } from "vitest";
import { hexCenter } from "./axial";
import { childHexesOf, detailNote, detailRatio, detailScale, firstHexMap, parentHexOf } from "./detail";
import { parseDistance, parseHexMap } from "./parse-hex-map";

describe("detail maps", () => {
  it("reads scales as distances, and their ratio", () => {
    expect(parseDistance("30 mi")).toBeCloseTo(48280.32);
    expect(parseDistance("5/6 mi")).toBeCloseTo(1341.12);
    expect(parseDistance("1340 m")).toBe(1340);
    expect(parseDistance("a lot")).toBeUndefined();
    expect(detailRatio(parseDistance("30 mi"), parseDistance("5 mi"))).toBe(6);
    expect(detailRatio(parseDistance("5 mi"), parseDistance("5/6 mi"))).toBe(6);
    expect(detailRatio(parseDistance("5 mi"), parseDistance("1 mi"))).toBe(6);
    expect(detailRatio(parseDistance("30 mi"), parseDistance("1 mi"))).toBe(36);
    expect(detailRatio(undefined, 100)).toBe(6);
  });

  it("puts fine hex (6q, 6r) on the centre of coarse hex (q, r)", () => {
    for (const [q, r] of [
      [1, 0],
      [3, -2],
      [-1, 4],
    ]) {
      const coarse = hexCenter(q, r, 6);
      const fine = hexCenter(6 * q, 6 * r, 1);
      expect(fine.x).toBeCloseTo(coarse.x);
      expect(fine.y).toBeCloseTo(coarse.y);
      expect(parentHexOf(6 * q, 6 * r, 6)).toEqual({ q, r });
    }
  });

  it("finds the detail hexes inside a parent hex, local or global", () => {
    const local = childHexesOf(3, 2, 6, [3, 2]);
    // Six across the flats: about 6² hexes of the same shape fit, give or take the edges.
    expect(local.length).toBeGreaterThan(30);
    expect(local.length).toBeLessThan(42);
    expect(local).toContainEqual({ q: 0, r: 0 });
    expect(local.every((h) => parentHexOf(h.q, h.r, 6, [3, 2]).q === 3)).toBe(true);
    expect(childHexesOf(1, 0, 6)).toContainEqual({ q: 6, r: 0 });
  });

  it("names the next scale down, six times finer", () => {
    expect(detailScale("30 mi")).toBe("5 mi");
    expect(detailScale("5 mi")).toBe("1 mi");
    expect(detailScale("1 mi")).toBe("1/6 mi");
    expect(detailScale("5/6 mi")).toBe("5/36 mi");
    expect(detailScale("huge")).toBeUndefined();
  });

  it("writes a detail note whose header reads back", () => {
    const note = detailNote({
      title: "Dunlind (3,2)",
      parentNote: "Caulkin coast",
      q: 3,
      r: 2,
      scale: "5 mi",
      pack: "basic",
    });
    const body = firstHexMap(note)!;
    const map = parseHexMap(body);
    expect(map).toMatchObject({
      title: "Dunlind (3,2)",
      of: "Caulkin coast",
      at: [3, 2],
      scale: "5 mi",
      pack: "basic",
    });
  });
});
