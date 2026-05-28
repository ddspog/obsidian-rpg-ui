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
    expect(splitCells("| a | b | c |")).toEqual([{ value: "a" }, { value: "b" }, { value: "c" }]);
  });

  it("handles `||` as a colspan extension on the previous cell", () => {
    expect(splitCells("| a || b |")).toEqual([{ value: "a", colspan: 2 }, { value: "b" }]);
  });

  it("supports multiple colspan extensions in a row", () => {
    expect(splitCells("| CLERIC |||| SPELLS |||")).toEqual([
      { value: "CLERIC", colspan: 4 },
      { value: "SPELLS", colspan: 3 },
    ]);
  });

  it("preserves `|` inside [[wikilink|alias]] without splitting", () => {
    expect(splitCells("| [[Cure Wounds|Cure]] | 1st |")).toEqual([
      { value: "[[Cure Wounds|Cure]]" },
      { value: "1st" },
    ]);
  });

  it("handles multiple wikilinks with pipes in the same row", () => {
    expect(splitCells("| [[A|B]] | [[C|D]] | plain |")).toEqual([
      { value: "[[A|B]]" },
      { value: "[[C|D]]" },
      { value: "plain" },
    ]);
  });

  it("still supports colspan with wikilink pipes", () => {
    expect(splitCells("| [[X|Y]] || z |")).toEqual([
      { value: "[[X|Y]]", colspan: 2 },
      { value: "z" },
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
    expect(t.rows[0].cells.map((c) => c.value)).toEqual(["1", "+2", "Spellcasting", "3", "2", "—", "—"]);
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

describe("parseTableBlock: |= … =| footer rows", () => {
  it("parses a single-cell footer with one roll expression", () => {
    const body = `| dice | Motivation |
|---|---|
| 1-2 | First |
| 3   | Second |
|= {{ roll : motivation }} =|`;
    const t = parseTableBlock("npc", body);
    expect(t.footerRows).toHaveLength(1);
    expect(t.footerRows[0].cells).toHaveLength(1);
    expect(t.footerRows[0].cells[0].segments).toEqual([
      { kind: "text", text: " " },
      { kind: "roll", targets: ["motivation"] },
      { kind: "text", text: " " },
    ]);
  });

  it("parses a bare {{ roll }} with no target list", () => {
    const body = `| d8* | Motivation |
|---|---|
| 1 | First |
| 2 | Second |
|= {{ roll }} =|`;
    const t = parseTableBlock("npc", body);
    const roll = t.footerRows[0].cells[0].segments.find((s) => s.kind === "roll");
    expect(roll).toEqual({ kind: "roll", targets: [] });
  });

  it("parses a bare {{ roll by=weight }} with no targets but a by= override", () => {
    const body = `| k | w | Motivation |
|---|---|---|
| a | 1 | First |
|= {{ roll by=w }} =|`;
    const t = parseTableBlock("npc", body);
    const roll = t.footerRows[0].cells[0].segments.find((s) => s.kind === "roll");
    expect(roll).toEqual({ kind: "roll", targets: [], by: "w" });
  });

  it("splits a multi-cell footer on internal pipes", () => {
    const body = `| dice | name | title |
|---|---|---|
| 1 | A | X |
|= {{ roll : name }} | {{ roll : title }} =|`;
    const t = parseTableBlock("npc", body);
    expect(t.footerRows[0].cells).toHaveLength(2);
    expect(t.footerRows[0].cells[0].segments.find((s) => s.kind === "roll")).toEqual({
      kind: "roll",
      targets: ["name"],
    });
    expect(t.footerRows[0].cells[1].segments.find((s) => s.kind === "roll")).toEqual({
      kind: "roll",
      targets: ["title"],
    });
  });

  it("mixes markdown text and roll expressions within one cell", () => {
    const body = `| dice | name | motivation |
|---|---|---|
| 1 | A | X |
|= You are {{ roll : name }} who desires {{ roll : motivation }}. =|`;
    const t = parseTableBlock("npc", body);
    const segs = t.footerRows[0].cells[0].segments;
    expect(segs).toHaveLength(5);
    expect(segs[0]).toEqual({ kind: "text", text: " You are " });
    expect(segs[1]).toEqual({ kind: "roll", targets: ["name"] });
    expect(segs[2]).toEqual({ kind: "text", text: " who desires " });
    expect(segs[3]).toEqual({ kind: "roll", targets: ["motivation"] });
    expect(segs[4]).toEqual({ kind: "text", text: ". " });
  });

  it("supports multi-column rolls and the `by=` override", () => {
    const body = `| weight | name | motivation |
|---|---|---|
| 3 | A | X |
|= {{ roll : name, motivation by=weight }} =|`;
    const t = parseTableBlock("npc", body);
    const roll = t.footerRows[0].cells[0].segments.find((s) => s.kind === "roll");
    expect(roll).toEqual({
      kind: "roll",
      targets: ["name", "motivation"],
      by: "weight",
    });
  });

  it("normalises single-quoted labels with spaces and caps", () => {
    const body = `| dice | Adventuring Motivation |
|---|---|
| 1 | Line |
|= {{ roll : 'Adventuring Motivation' }} =|`;
    const t = parseTableBlock("npc", body);
    const roll = t.footerRows[0].cells[0].segments.find((s) => s.kind === "roll");
    expect(roll).toEqual({ kind: "roll", targets: ["adventuring_motivation"] });
  });

  it("keeps an unknown {{ … }} expression verbatim as text", () => {
    const body = `| dice | name |
|---|---|
| 1 | A |
|= {{ unknown : foo }} =|`;
    const t = parseTableBlock("npc", body);
    const segs = t.footerRows[0].cells[0].segments;
    expect(segs.every((s) => s.kind === "text")).toBe(true);
    expect(segs.map((s) => (s as { text: string }).text).join("")).toBe(" {{ unknown : foo }} ");
  });

  it("does not treat ordinary `||` colspan rows as footer rows", () => {
    const body = `| dice | name |
|---|---|
| 1 || A |`;
    const t = parseTableBlock("npc", body);
    expect(t.footerRows).toEqual([]);
    expect(t.rows).toHaveLength(1);
  });
});

describe("parseTableBlock: indented cells", () => {
  it("strips a leading `> ` and sets indent=1 on the cell", () => {
    const body = `| NAME | COST |
|---|---|
| Longsword | 15 gp |
| > Versatile | — |`;
    const t = parseTableBlock("weapons", body);
    expect(t.rows[0].cells[0].indent).toBeUndefined();
    expect(t.rows[1].cells[0].indent).toBe(1);
    expect(t.rows[1].cells[0].value).toBe("Versatile");
  });

  it("supports multiple indent levels with `>>` and `>>>`", () => {
    const body = `| A | B |
|---|---|
| Parent | x |
| > Child | y |
| >> Grandchild | z |`;
    const t = parseTableBlock("nested", body);
    expect(t.rows[1].cells[0].indent).toBe(1);
    expect(t.rows[2].cells[0].indent).toBe(2);
    expect(t.rows[2].cells[0].value).toBe("Grandchild");
  });

  it("works on any cell, not just the first", () => {
    const body = `| COST | NAME | NOTE |
|---|---|---|
| 15 gp | Longsword | — |
| — | > Versatile | two-handed |`;
    const t = parseTableBlock("weapons", body);
    expect(t.rows[1].cells[0].indent).toBeUndefined();
    expect(t.rows[1].cells[1].indent).toBe(1);
    expect(t.rows[1].cells[1].value).toBe("Versatile");
  });

  it("does not confuse a `>` without trailing space as indent", () => {
    const body = `| A | B |
|---|---|
| >5 gp | note |`;
    const t = parseTableBlock("edge", body);
    expect(t.rows[0].cells[0].indent).toBeUndefined();
    expect(t.rows[0].cells[0].value).toBe(">5 gp");
  });
});
