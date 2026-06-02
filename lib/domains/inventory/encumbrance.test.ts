import { describe, expect, it } from "vitest";
import { classifyLoad, computeBands } from "./encumbrance";

describe("computeBands", () => {
  it("derives all four thresholds from STR", () => {
    expect(computeBands(10)).toEqual({
      encumbered: 50,
      heavy: 100,
      carry: 150,
      push: 300,
    });
    expect(computeBands(16)).toEqual({
      encumbered: 80,
      heavy: 160,
      carry: 240,
      push: 480,
    });
  });

  it("zeroes out non-positive STR", () => {
    expect(computeBands(0)).toEqual({
      encumbered: 0,
      heavy: 0,
      carry: 0,
      push: 0,
    });
    expect(computeBands(Number.NaN)).toEqual({
      encumbered: 0,
      heavy: 0,
      carry: 0,
      push: 0,
    });
  });

  it("applies overrides without touching the others", () => {
    expect(computeBands(10, { carry: 200 })).toEqual({
      encumbered: 50,
      heavy: 100,
      carry: 200,
      push: 300,
    });
    expect(computeBands(10, { heavy: 80, push: 400 })).toEqual({
      encumbered: 50,
      heavy: 80,
      carry: 150,
      push: 400,
    });
  });
});

describe("classifyLoad", () => {
  const bands = computeBands(10); // 50 / 100 / 150 / 300

  it("returns 'free' at or under the encumbered threshold", () => {
    expect(classifyLoad(0, bands)).toBe("free");
    expect(classifyLoad(50, bands)).toBe("free");
  });

  it("returns 'encumbered' above the light threshold", () => {
    expect(classifyLoad(51, bands)).toBe("encumbered");
    expect(classifyLoad(100, bands)).toBe("encumbered");
  });

  it("returns 'heavy' above STR×10", () => {
    expect(classifyLoad(101, bands)).toBe("heavy");
    expect(classifyLoad(150, bands)).toBe("heavy");
  });

  it("returns 'over' above carry capacity", () => {
    expect(classifyLoad(151, bands)).toBe("over");
    expect(classifyLoad(1_000, bands)).toBe("over");
  });
});
