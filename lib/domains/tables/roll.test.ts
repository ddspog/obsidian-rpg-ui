import { describe, it, expect } from "vitest";
import {
  formatRollOutcome,
  joinEach,
  matchRoll,
  parseWeightCell,
  parseWeightColumn,
  rollCellRows,
  rollEach,
  rollOnce,
} from "./roll";
import { parseTableBlock } from "./parse-table-block";
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
    footer: [],
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

describe("rollCellRows", () => {
  const def = parseTableBlock(
    "borders",
    ["|d4*|Border|", "|---|---|", "|1|Swamp|", "|2|Desert|", "|3-4|**Hills**. A chain of hills.|"].join("\n")
  );

  it("says which row each roll landed on", () => {
    const cell = { segments: [{ kind: "roll" }] };
    // 0.6 of a d4 is a 3: the 3-4 row, the third.
    const out = rollCellRows(def, cell, () => 0.6);
    expect(out.values).toEqual(["**Hills**. A chain of hills."]);
    expect(out.rows).toEqual([2]);
  });

  it("gives no row for a text segment, one per roll", () => {
    const cell = { segments: [{ kind: "text" }, { kind: "roll" }, { kind: "roll" }] };
    expect(rollCellRows(def, cell, () => 0).rows).toEqual([0, 0]);
  });
});

describe("rollOnce, a table rolled with several dice", () => {
  const def = parseTableBlock(
    "population",
    ["|3d6*|People|", "|---|---|", "|3-5|Sparse|", "|6-15|Average|", "|16-18|Crowded|"].join("\n")
  );

  it("adds the dice: three lowest faces are a 3", () => {
    expect(rollOnce(def, [], undefined, () => 0)).toEqual({ kind: "hit", values: ["Sparse"], rolled: 3 });
  });

  it("three highest faces are an 18", () => {
    expect(rollOnce(def, [], undefined, () => 0.999)).toEqual({ kind: "hit", values: ["Crowded"], rolled: 18 });
  });

  it("never rolls below the number of dice", () => {
    for (let i = 0; i < 200; i++) expect(rollOnce(def, [], undefined).kind).toBe("hit");
  });
});

describe("independent columns: {{ roll each }}", () => {
  const body = `| d4* | Description | Feature (first word) | Feature (second word) |
|---|---|---|---|
| 1 | Adamantine | Ant- | Abbot |
| 2 | Aerial | Ape- | Actor |
| 3 | Black | Bat | Altar |
| 4 | Burning | Bear | Barge |
|= {{ roll each join=' ' }} =|`;
  const def = parseTableBlock("parts", body);
  // Rolls 1, 2, 3 (rand → 0, .25, .5 on a d4).
  const seq = (...xs: number[]) => {
    let i = 0;
    return () => xs[i++ % xs.length];
  };

  it("rolls each column on its own die and reads it from its own row", () => {
    const out = rollEach(def, [], undefined, seq(0, 0.25, 0.5));
    expect(out).toMatchObject({
      kind: "each",
      values: ["Adamantine", "Ape-", "Altar"],
      rolls: [1, 2, 3],
      rows: [0, 1, 2],
    });
  });

  it("a footer cell joins the values and marks every row read", () => {
    const r = rollCellRows(def, exprRowsOf(def)[0], seq(0, 0.25, 0.5));
    expect(r.values).toEqual(["Adamantine Ape-Altar"]);
    expect(r.rows).toEqual([null]);
    expect(r.marked).toEqual([[0, 1, 2]]);
    expect(r.cells).toEqual([
      [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    ]);
  });

  it("a linked roll still reads one row, and marks it", () => {
    const linked = parseTableBlock("parts", body.replace("{{ roll each join=' ' }}", "{{ roll }}"));
    const r = rollCellRows(linked, exprRowsOf(linked)[0], seq(0.25));
    expect(r.values).toEqual(["Aerial — Ape- — Actor"]);
    expect(r.marked).toEqual([[1]]);
    expect(r.cells).toEqual([[]]);
  });

  it("a column the table lacks reads nothing", () => {
    const out = rollEach(def, ["nope", "description"], undefined, seq(0, 0.75));
    expect(formatRollOutcome(out)).toBe("Burning");
  });

  it("joins with an em dash by default, and a trailing hyphen joins the next word", () => {
    expect(joinEach(["Red", "Bitter"])).toBe("Red — Bitter");
    expect(joinEach(["Ant-", "Abbot"], " ")).toBe("Ant-Abbot");
    expect(joinEach(["", "Lone", " "])).toBe("Lone");
  });
});

function exprRowsOf(def: TableDef) {
  return def.footer.flatMap((it) => (it.kind === "expr" ? it.cells : []));
}

describe("@reroll", () => {
  it("rolls again when the die lands on a number the table lacks", () => {
    const src = "|d4*|Monster|\n|---|---|\n|1|Orc|\n|2|Ogre|\n|4|Troll|";
    // The die comes up 3 (no row), then 2.
    const rolls = [0.5, 0.25];
    const rand = () => rolls.shift() ?? 0;
    expect(rollOnce(parseTableBlock("m", src), [], undefined, rand)).toMatchObject({ kind: "miss", rolled: 3 });
    rolls.push(0.5, 0.25);
    expect(rollOnce(parseTableBlock("m", "@reroll\n" + src), [], undefined, rand)).toMatchObject({
      kind: "hit",
      rolled: 2,
      values: ["Ogre"],
    });
  });
});
