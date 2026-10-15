import { describe, it, expect } from "vitest";
import { parseRange, rangeVerdict } from "./ranges";

describe("parseRange", () => {
  it("reads a spell's, a ranged weapon's and a melee attack's range", () => {
    expect(parseRange("90 ft.")).toEqual({ kind: "ranged", normal: 90 });
    expect(parseRange("150/600 ft.")).toEqual({ kind: "ranged", normal: 150, long: 600 });
    expect(parseRange("reach 5 ft.")).toEqual({ kind: "reach", feet: 5 });
    expect(parseRange("10 ft.", true)).toEqual({ kind: "reach", feet: 10 });
    expect(parseRange("≤30 ft.")).toEqual({ kind: "ranged", normal: 30 });
  });

  it("reads an area around its caster, a touch, and nothing for none", () => {
    expect(parseRange("Self (15-ft cube)")).toEqual({ kind: "self", area: 15 });
    expect(parseRange("Self (15-foot cone)")).toEqual({ kind: "self", area: 15 });
    expect(parseRange("Touch")).toEqual({ kind: "touch" });
    expect(parseRange("-")).toBeUndefined();
  });
});

describe("rangeVerdict", () => {
  it("says a spell's target is in range, or out of it", () => {
    expect(rangeVerdict({ kind: "ranged", normal: 90 }, 40)).toEqual({
      status: "in",
      text: "40 ft — in range (90 ft)",
      disadvantage: false,
    });
    expect(rangeVerdict({ kind: "ranged", normal: 90 }, 95).status).toBe("out");
  });

  it("puts a ranged weapon's far shot at long range — disadvantage", () => {
    expect(rangeVerdict({ kind: "ranged", normal: 150, long: 600 }, 200)).toEqual({
      status: "long",
      text: "200 ft — long range (150/600 ft): disadvantage",
      disadvantage: true,
    });
  });

  it("says a melee target is out of reach, and a hostile next to a ranged attacker", () => {
    expect(rangeVerdict({ kind: "reach", feet: 5 }, 10).text).toBe("10 ft — out of reach (5 ft): move first");
    expect(rangeVerdict({ kind: "ranged", normal: 150, long: 600 }, 30, ["Kobold, Elite"])).toMatchObject({
      status: "in",
      disadvantage: true,
    });
  });
});
