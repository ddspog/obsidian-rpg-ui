import { describe, it, expect } from "vitest";
import { evalInterpret, fateResult, fateThreshold, resolveInterpret, FATE_WORDING } from "./fate-chart";

describe("evalInterpret", () => {
  it("compares the roll against the chaos factor", () => {
    expect(evalInterpret(">CF", { roll: 8, cf: 5 })).toBe(true);
    expect(evalInterpret(">CF", { roll: 3, cf: 5 })).toBe(false);
    expect(evalInterpret("<=CF", { roll: 5, cf: 5 })).toBe(true);
    expect(evalInterpret("<CF", { roll: 5, cf: 5 })).toBe(false);
  });

  it("compares the roll against a literal number with a default of equality", () => {
    expect(evalInterpret(">18", { roll: 19 })).toBe(true);
    expect(evalInterpret(">=7", { roll: 7 })).toBe(true);
    expect(evalInterpret("<3", { roll: 2 })).toBe(true);
    expect(evalInterpret("=20", { roll: 20 })).toBe(true);
    expect(evalInterpret("20", { roll: 20 })).toBe(true);
    expect(evalInterpret("20", { roll: 19 })).toBe(false);
  });

  it("matches inclusive ranges", () => {
    expect(evalInterpret("4-15", { roll: 4 })).toBe(true);
    expect(evalInterpret("4-15", { roll: 15 })).toBe(true);
    expect(evalInterpret("4-15", { roll: 16 })).toBe(false);
  });

  it("matches parity, alone or combined with a comparison", () => {
    expect(evalInterpret("even", { roll: 8 })).toBe(true);
    expect(evalInterpret("odd", { roll: 7 })).toBe(true);
    expect(evalInterpret("<=CF, even", { roll: 4, cf: 5 })).toBe(true);
    expect(evalInterpret("<=CF, even", { roll: 3, cf: 5 })).toBe(false); // odd
    expect(evalInterpret("<=CF, odd", { roll: 3, cf: 5 })).toBe(true);
  });

  it("returns false for a CF clause with no chaos factor supplied", () => {
    expect(evalInterpret("<=CF", { roll: 3 })).toBe(false);
  });
});

describe("resolveInterpret", () => {
  it("returns the first matching outcome in authored order (Mythic scene check)", () => {
    const interpret = { ">CF": "Expected Scene", "<=CF, even": "Altered Scene", "<=CF, odd": "Interrupt Scene" };
    expect(resolveInterpret(interpret, { roll: 8, cf: 5 })).toBe("Expected Scene");
    expect(resolveInterpret(interpret, { roll: 4, cf: 5 })).toBe("Altered Scene");
    expect(resolveInterpret(interpret, { roll: 3, cf: 5 })).toBe("Interrupt Scene");
  });

  it("returns null when nothing matches", () => {
    expect(resolveInterpret({ ">18": "Crit" }, { roll: 5 })).toBeNull();
  });
});

describe("fateThreshold", () => {
  it("returns the neutral base at chaos factor 5", () => {
    expect(fateThreshold(5, "50/50")).toBe(50);
    expect(fateThreshold(5, "likely")).toBe(75);
  });

  it("rises with the chaos factor and with the likelihood", () => {
    expect(fateThreshold(9, "50/50")).toBeGreaterThan(fateThreshold(5, "50/50"));
    expect(fateThreshold(1, "50/50")).toBeLessThan(fateThreshold(5, "50/50"));
    expect(fateThreshold(5, "very-likely")).toBeGreaterThan(fateThreshold(5, "unlikely"));
  });

  it("clamps to the 1..99 d100 range", () => {
    expect(fateThreshold(9, "certain")).toBeLessThanOrEqual(99);
    expect(fateThreshold(1, "impossible")).toBeGreaterThanOrEqual(1);
  });
});

describe("fateResult", () => {
  it("bands a d100 roll into yes/no with exceptional edges", () => {
    // 50/50 at CF 5 → Yes threshold 50, exceptional-yes ≤ 10, exceptional-no ≥ 91.
    expect(fateResult(5, 5, "50/50")).toBe("Exceptional Yes");
    expect(fateResult(40, 5, "50/50")).toBe("Yes");
    expect(fateResult(60, 5, "50/50")).toBe("No");
    expect(fateResult(95, 5, "50/50")).toBe("Exceptional No");
  });

  it("maps each result to its lonelog wording", () => {
    expect(FATE_WORDING[fateResult(5, 5, "50/50")]).toBe("Yes, and...");
    expect(FATE_WORDING[fateResult(95, 5, "50/50")]).toBe("No, and...");
  });
});
