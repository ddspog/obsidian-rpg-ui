import { describe, expect, it } from "vitest";
import { SIDES } from "./axial";
import {
  classifyMask,
  PATH_SHAPES,
  planShapeRenames,
  shapeFromName,
  shapeKey,
  shapeMask,
  shapesWithSides,
} from "./path-shapes";

describe("path shapes", () => {
  it("names every set of sides exactly once", () => {
    const masks = new Set<string>();
    const types = PATH_SHAPES.filter((s) => !s.variantOf);
    for (const s of types) for (let slot = 0; slot < s.slots; slot++) masks.add(shapeMask(s.type, slot));
    expect(types.reduce((n, s) => n + s.slots, 0)).toBe(63);
    expect(masks.size).toBe(63);
    for (let bits = 1; bits < 64; bits++) {
      const mask = SIDES.filter((_, i) => bits & (1 << i)).join(",");
      expect(classifyMask(mask), mask).not.toBeNull();
    }
  });

  it("turns clockwise from the north face", () => {
    expect(shapeMask("start", 4)).toBe("SW");
    expect(shapeMask("straight", 1)).toBe("NE,SW");
    expect(shapeMask("turn120", 4)).toBe("N,SW");
    expect(shapeMask("nfork", 0)).toBe("N,NE,NW");
    expect(shapeMask("pfork", 1)).toBe("NE,S,SW,NW");
    expect(classifyMask("N,S,SW")).toEqual({ type: "rfork", slot: 0 });
    expect(classifyMask("N,SE,S")).toEqual({ type: "lfork", slot: 0 });
    expect(classifyMask("NE,S,NW")).toEqual({ type: "yfork", slot: 1 });
    expect(classifyMask("NE,SE,SW,NW")).toEqual({ type: "xfork", slot: 2 });
  });

  it("counts only the distinct turns", () => {
    const slots = Object.fromEntries(PATH_SHAPES.map((s) => [s.type, s.slots]));
    expect(slots).toMatchObject({ straight: 3, xfork: 3, yfork: 2, rfork: 6, star: 1, pfork: 6 });
  });

  it("lists a type's variants with it, the type first, then each with a hub", () => {
    expect(shapesWithSides("SW")).toEqual([
      { type: "start", slot: 4 },
      { type: "end", slot: 4 },
      { type: "start", slot: 4, centre: "hub" },
      { type: "end", slot: 4, centre: "hub" },
    ]);
    expect(shapesWithSides("N,NE")).toEqual([
      { type: "turn60", slot: 0 },
      { type: "turn60", slot: 0, centre: "hub" },
    ]);
    expect(classifyMask("SW")).toEqual({ type: "start", slot: 4 });
  });

  it("puts the shapes opening at a mouth side first, the plain ones after", () => {
    const list = shapesWithSides("N,SW", "N");
    expect(list[0]).toEqual({ type: "turn120", slot: 4, mouth: 0 });
    expect(list).toContainEqual({ type: "turn120", slot: 4 });
    expect(shapesWithSides("N,SW", "S")).toEqual(shapesWithSides("N,SW"));
  });

  it("reads a stub, but not on a start", () => {
    expect(shapeFromName("turn120-5-stub")).toEqual({ type: "turn120", slot: 5, centre: "stub" });
    expect(shapeFromName("straight-0b-stub-mouth3")).toEqual({ type: "straight", slot: 0, centre: "stub", mouth: 3 });
    expect(shapeFromName("start-0-stub")).toBeNull();
    expect(shapesWithSides("NE,NW").some((s) => s.centre === "stub")).toBe(false);
  });

  it("reads a mouth only on one of the shape's own sides", () => {
    expect(shapeFromName("turn120-4-mouth0")).toEqual({ type: "turn120", slot: 4, mouth: 0 });
    expect(shapeFromName("turn120-4b-hub-mouth4")).toEqual({ type: "turn120", slot: 4, centre: "hub", mouth: 4 });
    expect(shapeFromName("turn120-4-mouth2")).toBeNull();
    expect(shapeKey("straight-0-mouth3")).toBe("straight-0-mouth3");
  });

  it("reads table keys: shape names, or older side masks as their type", () => {
    expect(shapeKey("culdesac-4")).toBe("start-4-hub");
    expect(shapeKey("turn60-2-hub")).toBe("turn60-2-hub");
    expect(shapeKey("s, n")).toBe("straight-0");
    expect(shapeKey("SW")).toBe("start-4");
    expect(shapeKey("start-6")).toBeNull();
    expect(shapeKey("N,X")).toBeNull();
  });

  it("names tiles for their shapes, lettering the extras in a folder", () => {
    const listed = [
      { path: "rivers/Hex - River 9 N", shape: "straight-0" },
      { path: "rivers/Hex - River 2 N", shape: "straight-0" },
      { path: "rivers/straight-0", shape: "start-0" },
      { path: "roads/clean/culdesac-4", shape: "start-4-hub" },
      { path: "roads/clean/start-0b", shape: "start-0" },
      { path: "rivers/Lake", shape: "turn60-2-hub" },
    ];
    const taken = [...listed.map((t) => t.path), "rivers/straight-0c", "rivers/turn60-2-hub"];
    expect(planShapeRenames(listed, taken)).toEqual([
      { from: "rivers/Hex - River 2 N", to: "rivers/straight-0" },
      { from: "rivers/Hex - River 9 N", to: "rivers/straight-0b" },
      { from: "rivers/Lake", to: "rivers/turn60-2b-hub" },
      { from: "rivers/straight-0", to: "rivers/start-0" },
      { from: "roads/clean/culdesac-4", to: "roads/clean/start-4-hub" },
    ]);
  });

  it("reads names that follow the standard", () => {
    expect(shapeFromName("Straight-2")).toEqual({ type: "straight", slot: 2 });
    expect(shapeFromName("straight-3")).toBeNull();
    expect(shapeFromName("culdesac-4")).toBeNull();
    expect(shapeFromName("start-4b-hub")).toEqual({ type: "start", slot: 4, centre: "hub" });
    expect(shapeFromName("end-1")).toEqual({ type: "end", slot: 1 });
    expect(shapeFromName("turnaround-4")).toBeNull();
    expect(shapeFromName("start-0b")).toEqual({ type: "start", slot: 0 });
    expect(shapeFromName("Hex - River 1 N")).toBeNull();
  });
});
