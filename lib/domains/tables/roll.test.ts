import { describe, it, expect } from "vitest";
import { formatRollOutcome, matchRoll, parseWeightCell, parseWeightColumn, rollOnce } from "./roll";
import type { TableDef } from "./types";

describe("parseWeightCell", () => {
  it("parses a single integer as a 1-wide range", () => {
    expect(parseWeightCell("3")).toEqual({ min: 3, max: 3, rowIndex: -1 });
  });
  it("parses `N-M` as a closed range", () => {
    expect(parseWeightCell("1-4")).toEqual({ min: 1, max: 4, rowIndex: -1 });
  });
  it("tolerates whitespace inside the range", () => {
    expect(parseWeightCell(" 1 - 4 ")).toEqual({ min: 1, max: 4, rowIndex: -1 });
  });
  it("excludes rows with empty, 0, or `-` markers", () => {
    expect(parseWeightCell("")).toBeNull();
    expect(parseWeightCell("0")).toBeNull();
    expect(parseWeightCell("-")).toBeNull();
    expect(parseWeightCell(undefined)).toBeNull();
  });
  it("returns undefined (fallback) for non-numeric cells", () => {
    expect(parseWeightCell("rare")).toBeUndefined();
    expect(parseWeightCell("d6")).toBeUndefined();
  });
});

describe("parseWeightColumn", () => {
  const rows = [
    { cells: [{ value: "1-2" }, { value: "a" }] },
    { cells: [{ value: "3" }, { value: "b" }] },
    { cells: [{ value: "4-6" }, { value: "c" }] },
  ];

  it("collects ranges and their max endpoint", () => {
    const w = parseWeightColumn(rows, 0)!;
    expect(w.max).toBe(6);
    expect(w.ranges).toEqual([
      { min: 1, max: 2, rowIndex: 0 },
      { min: 3, max: 3, rowIndex: 1 },
      { min: 4, max: 6, rowIndex: 2 },
    ]);
  });

  it("returns null when any weight cell is non-numeric", () => {
    const mixed = [{ cells: [{ value: "1" }, { value: "a" }] }, { cells: [{ value: "rare" }, { value: "b" }] }];
    expect(parseWeightColumn(mixed, 0)).toBeNull();
  });

  it("returns null when every cell is excluded", () => {
    const excluded = [{ cells: [{ value: "0" }, { value: "a" }] }, { cells: [{ value: "-" }, { value: "b" }] }];
    expect(parseWeightColumn(excluded, 0)).toBeNull();
  });
});

describe("matchRoll", () => {
  const ranges = [
    { min: 1, max: 2, rowIndex: 0 },
    { min: 3, max: 3, rowIndex: 1 },
    { min: 6, max: 6, rowIndex: 2 },
  ];

  it("finds the range containing the rolled value", () => {
    expect(matchRoll(ranges, 2)).toBe(0);
    expect(matchRoll(ranges, 3)).toBe(1);
    expect(matchRoll(ranges, 6)).toBe(2);
  });
  it("returns null when the rolled value falls in a gap", () => {
    expect(matchRoll(ranges, 4)).toBeNull();
    expect(matchRoll(ranges, 5)).toBeNull();
  });
});

// ─── End-to-end rollOnce against a hand-built TableDef ───────────────────────

function tableOf(columns: string[], rows: string[][], keyColumn?: string): TableDef {
  return {
    name: "t",
    columns,
    columnLabels: columns,
    rows: rows.map((cells) => ({ cells: cells.map((value) => ({ value })) })),
    headerRows: [],
    keyColumn,
    classes: [],
    footerRows: [],
  };
}

describe("rollOnce", () => {
  const t = tableOf(
    ["dice", "motivation", "name"],
    [
      ["1-2", "First", "Alice"],
      ["3", "Second", "Bob"],
      ["4-6", "Third", "Cleo"],
    ],
    "dice"
  );

  it("uses the key column as default weight and returns the matched row's target", () => {
    // rand=0 → rolled=1 → matches row 0 (range 1-2).
    const out = rollOnce(t, ["motivation"], undefined, () => 0);
    expect(out).toEqual({ kind: "hit", values: ["First"], rolled: 1 });
  });

  it("empty targets → shows every non-weight column of the matched row", () => {
    // rand=0 → rolled=1 → row 0. Weight col is `dice`, so targets are
    // motivation + name in declaration order.
    const out = rollOnce(t, [], undefined, () => 0);
    expect(out).toEqual({ kind: "hit", values: ["First", "Alice"], rolled: 1 });
  });

  it("returns multi-column output in target order", () => {
    // rand=0.5 → rolled = floor(0.5*6)+1 = 4 → row 2 (range 4-6).
    const out = rollOnce(t, ["name", "motivation"], undefined, () => 0.5);
    expect(out).toEqual({ kind: "hit", values: ["Cleo", "Third"], rolled: 4 });
  });

  it("emits a miss outcome when the rolled value hits a gap", () => {
    const gapTable = tableOf(
      ["dice", "name"],
      [
        ["1-2", "A"],
        ["3", "B"],
        ["6", "C"],
      ],
      "dice"
    );
    // rand such that floor(r*6)+1 = 4 → r must satisfy 3 <= r*6 < 4 → 0.5..0.667.
    const out = rollOnce(gapTable, ["name"], undefined, () => 0.5);
    expect(out).toEqual({ kind: "miss", rolled: 4, max: 6 });
    expect(formatRollOutcome(out)).toBe("Rolled 4, nothing found.");
  });

  it("falls back to uniform pick when the weight column is non-numeric", () => {
    const textTable = tableOf(
      ["rarity", "spell"],
      [
        ["rare", "bless"],
        ["common", "cure wounds"],
        ["legendary", "wish"],
      ],
      "rarity"
    );
    // rand=0 → first non-empty from "spell" column.
    const out = rollOnce(textTable, ["spell"], undefined, () => 0);
    expect(out).toEqual({ kind: "uniform", values: ["bless"] });
  });

  it("respects the `by=` override to pick a different weight column", () => {
    // Default would be key=rarity (text → uniform). Overriding to `w`
    // (numeric) switches back to range-match mode.
    const tbl = tableOf(
      ["rarity", "w", "spell"],
      [
        ["rare", "1", "bless"],
        ["common", "1", "cure wounds"],
        ["legendary", "1", "wish"],
      ],
      "rarity"
    );
    const out = rollOnce(tbl, ["spell"], "w", () => 0);
    expect(out).toEqual({ kind: "hit", values: ["bless"], rolled: 1 });
  });
});
