import { describe, expect, it } from "vitest";

import { averageOf, createSeededRng, d20, isRollable, rollExpr } from "./rng";

const take = (rng: () => number, n: number) => Array.from({ length: n }, () => rng());

describe("createSeededRng", () => {
  it("gives identical sequences for the same seed", () => {
    expect(take(createSeededRng(7), 20)).toEqual(take(createSeededRng(7), 20));
  });

  it("gives different sequences for different seeds", () => {
    expect(take(createSeededRng(7), 20)).not.toEqual(take(createSeededRng(8), 20));
  });

  it("stays in [0, 1)", () => {
    for (const v of take(createSeededRng(1), 500)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("rollExpr", () => {
  it("draws only from the injected rng", () => {
    const calls: number[] = [];
    const rng = () => {
      calls.push(0);
      return 0; // always the lowest face
    };
    expect(rollExpr("2d6+1", false, rng)).toBe(3);
    expect(calls).toHaveLength(2);
  });

  it("doubles the dice count on a crit but not the bonus", () => {
    let n = 0;
    const rng = () => {
      n++;
      return 0.999; // always the highest face
    };
    expect(rollExpr("1d8+1", false, rng)).toBe(9);
    n = 0;
    expect(rollExpr("1d8+1", true, rng)).toBe(17);
    expect(n).toBe(2);
  });

  it("rolls a flat expression to itself and leaves it unchanged on a crit", () => {
    let n = 0;
    const rng = () => {
      n++;
      return 0.5;
    };
    expect(rollExpr("1", false, rng)).toBe(1);
    expect(rollExpr("1", true, rng)).toBe(1);
    expect(n).toBe(0);
  });

  it("throws on an expression it cannot roll", () => {
    expect(() => rollExpr("lots", false, () => 0)).toThrow(/lots/);
  });
});

describe("d20", () => {
  it("maps the rng onto 1..20", () => {
    expect(d20(() => 0)).toBe(1);
    expect(d20(() => 0.999)).toBe(20);
  });
});

describe("averageOf", () => {
  it("computes the mean of dice with a bonus", () => {
    expect(averageOf("1d8+1")).toBe(5.5);
    expect(averageOf("12d8")).toBe(54);
    expect(averageOf("2d6-1")).toBe(6);
  });

  it("returns a flat number as itself", () => {
    expect(averageOf("1")).toBe(1);
  });
});

describe("expressions the damage parser can produce", () => {
  it("reads a bare die, several flat terms and a subtracted bonus", () => {
    expect(isRollable("d6")).toBe(true);
    expect(isRollable("2d6+3-1")).toBe(true);
    expect(averageOf("d6")).toBe(3.5);
    expect(averageOf("2d6+3-1")).toBe(9);
    expect(rollExpr("2d6+3-1", false, () => 0)).toBe(4);
    expect(rollExpr("1d8+1+2", true, () => 0.999)).toBe(19);
  });

  it("refuses what it cannot read instead of averaging it to zero silently", () => {
    for (const bad of ["", "lots", "1d", "d1", "1d6+"]) expect(isRollable(bad)).toBe(false);
  });
});
