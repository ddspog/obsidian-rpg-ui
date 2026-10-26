import { describe, expect, it } from "vitest";
import { formatModifier, parseDice, rollD20, rollDamage } from "./roll";

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("parseDice", () => {
  it("reads dice with and without a bonus", () => {
    expect(parseDice("1d8+3")).toEqual({ count: 1, sides: 8, bonus: 3 });
    expect(parseDice("2d6")).toEqual({ count: 2, sides: 6, bonus: 0 });
    expect(parseDice("1d10 - 1")).toEqual({ count: 1, sides: 10, bonus: -1 });
    expect(parseDice("1d10−1")).toEqual({ count: 1, sides: 10, bonus: -1 });
  });

  it("rejects what isn't a dice expression", () => {
    expect(parseDice("5")).toBeNull();
    expect(parseDice("1d1")).toBeNull();
    expect(parseDice("0d6")).toBeNull();
    expect(parseDice("1d8/1d10+1")).toBeNull();
  });
});

describe("rollD20", () => {
  it("adds the modifier to one die", () => {
    expect(rollD20(5, "normal", seq(0.5))).toEqual({ dice: [11], kept: 11, modifier: 5, total: 16 });
  });

  it("keeps the higher die with advantage and the lower with disadvantage", () => {
    expect(rollD20(0, "adv", seq(0, 0.99)).kept).toBe(20);
    expect(rollD20(0, "dis", seq(0, 0.99)).kept).toBe(1);
  });
});

describe("rollDamage", () => {
  it("sums the dice and the bonus", () => {
    expect(rollDamage("2d6+3", false, seq(0, 0.99))).toEqual({ dice: [1, 6], bonus: 3, total: 10, crit: false });
  });

  it("doubles the dice on a critical hit, not the bonus", () => {
    const r = rollDamage("1d8+3", true, seq(0.99))!;
    expect(r.dice).toHaveLength(2);
    expect(r.total).toBe(8 + 8 + 3);
  });

  it("returns null for a flat number", () => {
    expect(rollDamage("5")).toBeNull();
  });
});

describe("formatModifier", () => {
  it("uses a true minus", () => {
    expect(formatModifier(-1)).toBe("−1");
    expect(formatModifier(0)).toBe("+0");
  });
});
