import { describe, expect, it } from "vitest";

import {
  absDiffCr,
  addCr,
  benchmarkFor,
  cmpCr,
  formatCr,
  formatDifficulty,
  labelEncounter,
  mulCr,
  parseCr,
  targetFor,
} from "./difficulty";

const bench = (levels: number[]) => formatCr(benchmarkFor(levels));

describe("rational CR", () => {
  it("parses integers and fractions", () => {
    expect(parseCr("3")).toEqual({ num: 3, den: 1 });
    expect(parseCr("1/8")).toEqual({ num: 1, den: 8 });
    expect(parseCr(" 2/4 ")).toEqual({ num: 1, den: 2 });
  });

  it("rejects garbage", () => {
    for (const bad of ["", "abc", "1/0", "1/", "/2", "-1", "1.5", "1/2/3", "1 2"]) {
      expect(() => parseCr(bad), bad).toThrow(/Invalid CR/);
    }
  });

  it("adds exactly", () => {
    expect(formatCr(addCr(parseCr("1/2"), parseCr("1/8")))).toBe("5/8");
    expect(formatCr(addCr(parseCr("1/2"), parseCr("1/2")))).toBe("1");
  });

  it("multiplies exactly", () => {
    expect(formatCr(mulCr(parseCr("1/2"), parseCr("4")))).toBe("2");
    expect(formatCr(mulCr(parseCr("3"), parseCr("1/8")))).toBe("3/8");
  });

  it("compares", () => {
    expect(cmpCr(parseCr("5/8"), parseCr("1/2"))).toBe(1);
    expect(cmpCr(parseCr("1/2"), parseCr("2/4"))).toBe(0);
    expect(cmpCr(parseCr("1/8"), parseCr("1/2"))).toBe(-1);
  });

  it("takes absolute differences", () => {
    expect(formatCr(absDiffCr(parseCr("1/8"), parseCr("1/2")))).toBe("3/8");
    expect(formatCr(absDiffCr(parseCr("1/2"), parseCr("1/8")))).toBe("3/8");
    expect(formatCr(absDiffCr(parseCr("2"), parseCr("2")))).toBe("0");
  });

  it("formats irreducible, integers plain, zero as 0", () => {
    expect(formatCr({ num: 4, den: 8 })).toBe("1/2");
    expect(formatCr({ num: 10, den: 1 })).toBe("10");
    expect(formatCr({ num: 20, den: 2 })).toBe("10");
    expect(formatCr({ num: 0, den: 5 })).toBe("0");
    expect(formatCr(parseCr("0"))).toBe("0");
  });
});

describe("benchmarkFor", () => {
  it("uses the printed table at average level 1", () => {
    expect(bench([1, 1, 1])).toBe("1/2");
    expect(bench([1, 1, 1, 1])).toBe("1/2");
    expect(bench([1, 1, 1, 1, 1])).toBe("1/2");
    expect(bench([1, 1, 1, 1, 1, 1])).toBe("1");
    expect(bench([1, 1, 1, 1, 1, 1, 1])).toBe("1");
  });

  it("falls back to floor(total/4) for other party sizes at level 1", () => {
    expect(bench([1])).toBe("0");
    expect(bench([1, 1])).toBe("0");
    expect(bench([1, 1, 1, 1, 1, 1, 1, 1])).toBe("2");
  });

  it("uses floor(total/4) at average levels 2-4", () => {
    expect(bench([2, 2, 2, 2])).toBe("2");
    expect(bench([4, 4, 4, 4])).toBe("4");
    expect(bench([3, 3, 3])).toBe("2");
  });

  it("uses floor(total/2) at average levels 5-10", () => {
    expect(bench([5, 5, 5, 5])).toBe("10");
    expect(bench([10, 10, 10, 10])).toBe("20");
  });

  it("uses floor(3*total/4) at average levels 11-20", () => {
    expect(bench([12, 12, 12, 12])).toBe("36");
    expect(bench([11, 11, 11, 11])).toBe("33");
  });

  it("floors the average level", () => {
    expect(bench([1, 2, 1, 1])).toBe("1/2");
    expect(bench([4, 5, 5, 5])).toBe("4");
  });

  it("rejects an empty party", () => {
    expect(() => benchmarkFor([])).toThrow();
  });
});

describe("labelEncounter", () => {
  const party = [1, 1, 1, 1];

  it("labels above, at and below by exact comparison", () => {
    expect(labelEncounter(party, parseCr("5/8")).label).toBe("above");
    expect(labelEncounter(party, parseCr("1/2")).label).toBe("at");
    expect(labelEncounter(party, parseCr("1/8")).label).toBe("below");
  });

  it("formats a result as strings", () => {
    expect(formatDifficulty(labelEncounter(party, parseCr("5/8")))).toEqual({
      totalCr: "5/8",
      benchmark: "1/2",
      label: "above",
    });
  });
});

describe("targetFor", () => {
  it("scales the benchmark by 1/2, 1 or 2", () => {
    const benchmark = parseCr("1/2");
    expect(formatCr(targetFor("easy", benchmark))).toBe("1/4");
    expect(formatCr(targetFor("challenging", benchmark))).toBe("1/2");
    expect(formatCr(targetFor("deadly", benchmark))).toBe("1");
    expect(formatCr(targetFor("easy", parseCr("10")))).toBe("5");
  });
});
