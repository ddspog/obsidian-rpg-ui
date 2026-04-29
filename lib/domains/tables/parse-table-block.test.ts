import { describe, it, expect } from "vitest";
import { parseTableBlock, splitCells, normalizeColumnKey } from "./parse-table-block";

describe("normalizeColumnKey", () => {
  it("lowercases and collapses non-alphanumeric runs to `_`", () => {
    expect(normalizeColumnKey("LEVEL")).toBe("level");
    expect(normalizeColumnKey("Cantrips Known")).toBe("cantrips_known");
    expect(normalizeColumnKey("1ST")).toBe("1st");
    expect(normalizeColumnKey(" Foo—Bar ")).toBe("foo_bar");
  });
});

describe("splitCells", () => {
  it("splits a plain row into cells", () => {
    expect(splitCells("| a | b | c |")).toEqual([
      { value: "a" },
      { value: "b" },
      { value: "c" },
    ]);
  });

  it("handles `||` as a colspan extension on the previous cell", () => {
    expect(splitCells("| a || b |")).toEqual([
      { value: "a", colspan: 2 },
      { value: "b" },
    ]);
  });

  it("supports multiple colspan extensions in a row", () => {
    expect(splitCells("| CLERIC |||| SPELLS |||")).toEqual([
      { value: "CLERIC", colspan: 4 },
      { value: "SPELLS", colspan: 3 },
    ]);
  });
});

describe("parseTableBlock", () => {
  it("parses a simple markdown table and defaults the key to the first column", () => {
    const body = `| LEVEL | PB |
|---|---|
| 1 | +2 |
| 2 | +2 |`;
    const t = parseTableBlock("progression", body);
    expect(t.name).toBe("progression");
    expect(t.columns).toEqual(["level", "pb"]);
    expect(t.columnLabels).toEqual(["LEVEL", "PB"]);
    expect(t.rows).toEqual([
      { cells: [{ value: "1" }, { value: "+2" }] },
      { cells: [{ value: "2" }, { value: "+2" }] },
    ]);
    expect(t.headerRows).toHaveLength(1);
    expect(t.classes).toEqual([]);
    expect(t.keyColumn).toBe("level");
  });

  it("recognises a `*` sigil in a header cell as the key-column override", () => {
    const body = `| NAME | LEVEL* | PB |
|---|---|---|
| Cleric | 1 | +2 |`;
    const t = parseTableBlock("override", body);
    expect(t.keyColumn).toBe("level");
    // The `*` is stripped from the displayable header label.
    expect(t.columnLabels).toEqual(["NAME", "LEVEL", "PB"]);
    expect(t.columns).toEqual(["name", "level", "pb"]);
  });

  it("only the first `*`-marked column wins when several are present", () => {
    const body = `| A* | B* | C |
|---|---|---|
| 1 | 2 | 3 |`;
    const t = parseTableBlock("multi", body);
    expect(t.keyColumn).toBe("a");
    expect(t.columnLabels).toEqual(["A", "B", "C"]);
  });

  it("parses the `[CAPTION #css/...]` footer", () => {
    const body = `| LEVEL | PB |
|---|---|
| 1 | +2 |
[CLERIC PROGRESSION #css/tx/table #css/tx/wide]`;
    const t = parseTableBlock("progression", body);
    expect(t.caption).toBe("CLERIC PROGRESSION");
    expect(t.classes).toEqual(["css/tx/table", "css/tx/wide"]);
  });

  it("keeps multi-row headers intact and derives columns from the last header row", () => {
    const body = `| CLERIC |||| DIVINE SPELL SLOTS ||| |
| LEVEL | PB | FEATURES | CANTRIPS | 1ST | 2ND | 3RD |
|---|---|---|---|---|---|---|
| 1 | +2 | Spellcasting | 3 | 2 | — | — |`;
    const t = parseTableBlock("progression", body);
    expect(t.headerRows).toHaveLength(2);
    expect(t.headerRows[0].cells[0]).toEqual({ value: "CLERIC", colspan: 4 });
    expect(t.columns).toEqual(["level", "pb", "features", "cantrips", "1st", "2nd", "3rd"]);
    expect(t.rows[0].cells.map((c) => c.value)).toEqual([
      "1",
      "+2",
      "Spellcasting",
      "3",
      "2",
      "—",
      "—",
    ]);
  });

  it("ignores blank lines and stray non-pipe lines between rows", () => {
    const body = `| A | B |
|---|---|

| 1 | 2 |
| 3 | 4 |`;
    const t = parseTableBlock("demo", body);
    expect(t.rows).toHaveLength(2);
  });
});
