import { describe, it, expect } from "vitest";
import { parseOracleThresholds, rollDice, interpretOracle } from "./oracle";

describe("parseOracleThresholds", () => {
  it("extracts the three numbers in order", () => {
    expect(parseOracleThresholds("$^{10}\\;50\\;^{91}$")).toEqual([10, 50, 91]);
  });

  it("maps `x` to null (absent bound)", () => {
    expect(parseOracleThresholds("$^{x}\\;1\\;^{81}$")).toEqual([null, 1, 81]);
    expect(parseOracleThresholds("$^{20}\\;99\\;^{x}$")).toEqual([20, 99, null]);
  });
});

describe("rollDice", () => {
  it("rolls dN in [1, N]", () => {
    expect(rollDice("d100", () => 0)).toBe(1);
    expect(rollDice("d100", () => 0.999)).toBe(100);
  });

  it("sums MdN", () => {
    expect(rollDice("2d10", () => 0)).toBe(2);
    expect(rollDice("2d10", () => 0.999)).toBe(20);
  });

  it("falls back to d100 for an unparseable spec", () => {
    expect(rollDice("nonsense", () => 0)).toBe(1);
  });
});

describe("interpretOracle", () => {
  const answers = ["Exceptional Yes", "Yes", "No", "Exceptional No"];

  it("maps the four periods of `^{10} 50 ^{91}`", () => {
    const t = [10, 50, 91];
    expect(interpretOracle(10, t, answers)).toBe("Exceptional Yes");
    expect(interpretOracle(11, t, answers)).toBe("Yes");
    expect(interpretOracle(50, t, answers)).toBe("Yes");
    expect(interpretOracle(51, t, answers)).toBe("No");
    expect(interpretOracle(90, t, answers)).toBe("No");
    expect(interpretOracle(91, t, answers)).toBe("Exceptional No");
    expect(interpretOracle(100, t, answers)).toBe("Exceptional No");
  });

  it("collapses the Exceptional Yes period when the left bound is x", () => {
    const t = [null, 1, 81];
    expect(interpretOracle(1, t, answers)).toBe("Yes");
    expect(interpretOracle(2, t, answers)).toBe("No");
    expect(interpretOracle(80, t, answers)).toBe("No");
    expect(interpretOracle(81, t, answers)).toBe("Exceptional No");
  });

  it("collapses the Exceptional No period when the right bound is x", () => {
    const t = [20, 99, null];
    expect(interpretOracle(20, t, answers)).toBe("Exceptional Yes");
    expect(interpretOracle(99, t, answers)).toBe("Yes");
    expect(interpretOracle(100, t, answers)).toBe("No");
  });
});
