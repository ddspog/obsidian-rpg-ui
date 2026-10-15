import { describe, it, expect } from "vitest";
import { parseAxisCell, parseTableBlock, splitCells, normalizeColumnKey } from "./parse-table-block";
import type { FooterRowItem, TableDef } from "./types";

/** The `kind: "expr"` footer rows (the `|= … =|` rows), in order. */
const exprRows = (t: TableDef) =>
  t.footer.filter((it): it is Extract<FooterRowItem, { kind: "expr" }> => it.kind === "expr");
/** The `kind: "cells"` footer rows (multi-column rows, e.g. an axis row). */
const cellRows = (t: TableDef) =>
  t.footer.filter((it): it is Extract<FooterRowItem, { kind: "cells" }> => it.kind === "cells");

describe("parseAxisCell", () => {
  it("parses `\\` as the ↘ (down) diagonal", () => {
    expect(parseAxisCell("{{ axis Stat \\ Mod }}")).toEqual({ col: "Stat", row: "Mod", dir: "down" });
  });

  it("parses `/` as the ↗ (up) diagonal", () => {
    expect(parseAxisCell("{{ axis Stat / Mod }}")).toEqual({ col: "Stat", row: "Mod", dir: "up" });
  });

  it("tolerates tight braces and multi-word labels, splitting on the first separator", () => {
    expect(parseAxisCell("{{axis Ability Score / Saving Throw}}")).toEqual({
      col: "Ability Score",
      row: "Saving Throw",
      dir: "up",
    });
  });

  it("returns null for non-axis cells", () => {
    expect(parseAxisCell("Stat")).toBeNull();
    expect(parseAxisCell("{{ roll : x }}")).toBeNull();
    expect(parseAxisCell("{{ axis NoSeparator }}")).toBeNull();
  });
});

describe("parseTableBlock: header vertical merge", () => {
  it("resolves a `^` marker in the last header row and carries the column key down", () => {
    const body = `| LEVEL | SPELL SLOTS ||
| ^ | 1st | 2nd |
|---|---|---|
| 1 | 2 | — |`;
    const t = parseTableBlock("p", body);
    // The `^` in the last header row becomes a content-free merge marker.
    expect(t.headerRows[1].cells[0].mergeUp).toBe(true);
    expect(t.headerRows[1].cells[0].value).toBe("");
    // Column 0's key carries down from "LEVEL" despite the `^` below it; the
    // group row's wider span doesn't inflate the column count.
    expect(t.columns).toEqual(["level", "1st", "2nd"]);
    expect(t.keyColumn).toBe("level");
  });

  it("captures an explicit alignment glyph (`^-`) on a header marker", () => {
    const body = `| LEVEL | X |
| ^- | y |
|---|---|
| 1 | a |`;
    const t = parseTableBlock("p", body);
    expect(t.headerRows[1].cells[0].mergeUp).toBe(true);
    expect(t.headerRows[1].cells[0].mergeAlign).toBe("middle");
  });
});

describe("parseTableBlock: footer cells (second `|---|` separator)", () => {
  it("captures rows after a second separator as footer cell rows, not body rows", () => {
    const body = `| LVL | DMG |
|---|---|
| 1 | 1d6 |
| 2 | 2d6 |
|-----|-----|
| Avg | 7 |`;
    const t = parseTableBlock("dmg", body);
    expect(t.rows).toHaveLength(2);
    expect(cellRows(t)).toHaveLength(1);
    expect(cellRows(t)[0].cells.map((c) => c.value)).toEqual(["Avg", "7"]);
  });

  it("leaves the footer empty without a second separator", () => {
    const body = `| A | B |
|---|---|
| 1 | 2 |`;
    expect(parseTableBlock("x", body).footer).toEqual([]);
  });

  it("does not treat a body row of single-hyphen cells as the footer boundary", () => {
    const body = `| A | B |
|---|---|
| - | - |
| 1 | 2 |`;
    const t = parseTableBlock("x", body);
    expect(t.footer).toEqual([]);
    expect(t.rows).toHaveLength(2);
  });

  it("supports `||` colspan in footer cells", () => {
    const body = `| A | B |
|---|---|
| 1 | 2 |
|---|---|
| Total || x |`;
    const t = parseTableBlock("x", body);
    expect(cellRows(t)[0].cells).toEqual([{ value: "Total", colspan: 2 }, { value: "x" }]);
  });
});

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
    expect(splitCells("| [[Cure Wounds|Cure]] | 1st |")).toEqual([{ value: "[[Cure Wounds|Cure]]" }, { value: "1st" }]);
  });

  it("handles multiple wikilinks with pipes in the same row", () => {
    expect(splitCells("| [[A|B]] | [[C|D]] | plain |")).toEqual([
      { value: "[[A|B]]" },
      { value: "[[C|D]]" },
      { value: "plain" },
    ]);
  });

  it("still supports colspan with wikilink pipes", () => {
    expect(splitCells("| [[X|Y]] || z |")).toEqual([{ value: "[[X|Y]]", colspan: 2 }, { value: "z" }]);
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
    expect(exprRows(t)).toHaveLength(1);
    expect(exprRows(t)[0].cells).toHaveLength(1);
    expect(exprRows(t)[0].cells[0].segments).toEqual([
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
    const roll = exprRows(t)[0].cells[0].segments.find((s) => s.kind === "roll");
    expect(roll).toEqual({ kind: "roll", targets: [] });
  });

  it("parses a bare {{ roll by=weight }} with no targets but a by= override", () => {
    const body = `| k | w | Motivation |
|---|---|---|
| a | 1 | First |
|= {{ roll by=w }} =|`;
    const t = parseTableBlock("npc", body);
    const roll = exprRows(t)[0].cells[0].segments.find((s) => s.kind === "roll");
    expect(roll).toEqual({ kind: "roll", targets: [], by: "w" });
  });

  it("splits a multi-cell footer on internal pipes", () => {
    const body = `| dice | name | title |
|---|---|---|
| 1 | A | X |
|= {{ roll : name }} | {{ roll : title }} =|`;
    const t = parseTableBlock("npc", body);
    expect(exprRows(t)[0].cells).toHaveLength(2);
    expect(exprRows(t)[0].cells[0].segments.find((s) => s.kind === "roll")).toEqual({
      kind: "roll",
      targets: ["name"],
    });
    expect(exprRows(t)[0].cells[1].segments.find((s) => s.kind === "roll")).toEqual({
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
    const segs = exprRows(t)[0].cells[0].segments;
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
    const roll = exprRows(t)[0].cells[0].segments.find((s) => s.kind === "roll");
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
    const roll = exprRows(t)[0].cells[0].segments.find((s) => s.kind === "roll");
    expect(roll).toEqual({ kind: "roll", targets: ["adventuring_motivation"] });
  });

  it("keeps an unknown {{ … }} expression verbatim as text", () => {
    const body = `| dice | name |
|---|---|
| 1 | A |
|= {{ unknown : foo }} =|`;
    const t = parseTableBlock("npc", body);
    const segs = exprRows(t)[0].cells[0].segments;
    expect(segs.every((s) => s.kind === "text")).toBe(true);
    expect(segs.map((s) => (s as { text: string }).text).join("")).toBe(" {{ unknown : foo }} ");
  });

  it("does not treat ordinary `||` colspan rows as footer rows", () => {
    const body = `| dice | name |
|---|---|
| 1 || A |`;
    const t = parseTableBlock("npc", body);
    expect(exprRows(t)).toEqual([]);
    expect(t.rows).toHaveLength(1);
  });

  it("parses a bare `{{ oracle }}` footer with defaults", () => {
    const body = `| a | b |
|---|---|
| 1 | 2 |
|= {{ oracle }} =|`;
    const t = parseTableBlock("fc", body);
    const seg = exprRows(t)[0].cells[0].segments.find((s) => s.kind === "oracle");
    expect(seg).toEqual({
      kind: "oracle",
      dice: "d100",
      answers: ["Exceptional Yes", "Yes", "No", "Exceptional No"],
    });
  });

  it("parses `{{ oracle }}` kwargs (dice + pipe-separated answers)", () => {
    const body = `| a | b |
|---|---|
| 1 | 2 |
|= {{ oracle dice=2d10 answers="Yes | No" }} =|`;
    const t = parseTableBlock("fc", body);
    const seg = exprRows(t)[0].cells[0].segments.find((s) => s.kind === "oracle");
    expect(seg).toEqual({ kind: "oracle", dice: "2d10", answers: ["Yes", "No"] });
  });
});

describe("parseTableBlock: {{ paginate }} footer expression", () => {
  it("parses a bare `{{ paginate }}` as numbered pages of 10", () => {
    const body = `| A | B |
|---|---|
| 1 | 2 |
|= {{ paginate }} =|`;
    const t = parseTableBlock("p", body);
    const seg = exprRows(t)[0].cells[0].segments.find((s) => s.kind === "paginate");
    expect(seg).toEqual({ kind: "paginate", size: 10, controls: "pages" });
    // The expr drives the table's pagination config (body-row slicing).
    expect(t.pagination).toEqual({ size: 10, controls: "pages" });
  });

  it("reads the control type from the kwarg key (`pages=` / `prev-next=` / `show-more=`)", () => {
    const cases: Array<[string, "pages" | "prev-next" | "show-more", number]> = [
      ["pages=5", "pages", 5],
      ["prev-next=8", "prev-next", 8],
      ["show-more=3", "show-more", 3],
    ];
    for (const [kw, controls, size] of cases) {
      const t = parseTableBlock("p", `| A |\n|---|\n| 1 |\n|= {{ paginate ${kw} }} =|`);
      expect(t.pagination).toEqual({ size, controls });
    }
  });

  it("renders the paginate controls at the authored position, after a roll row", () => {
    const body = `| dice | name |
|---|---|
| 1 | A |
|= {{ roll : name }} =|
|= {{ paginate pages=4 }} =|`;
    const t = parseTableBlock("p", body);
    expect(t.footer.map((it) => it.kind)).toEqual(["expr", "expr"]);
    expect(exprRows(t)[1].cells[0].segments.find((s) => s.kind === "paginate")).toEqual({
      kind: "paginate",
      size: 4,
      controls: "pages",
    });
  });
});

describe("parseTableBlock: footer group dividers", () => {
  it("turns a `|---|` between footer rows into a divider item, keeping order", () => {
    const body = `|---|---|
| Certain | 50 |
| Likely | 35 |
|---|---|
| {{ axis Odds / CF }} | 1 |
|---|---|
|= {{ oracle }} =|`;
    const t = parseTableBlock("fc", body);
    // body rows above the boundary; footer keeps axis · divider · oracle.
    expect(t.rows).toHaveLength(2);
    expect(t.footer.map((it) => it.kind)).toEqual(["cells", "divider", "expr"]);
    expect(cellRows(t)[0].cells[0].value).toBe("{{ axis Odds / CF }}");
    expect(exprRows(t)[0].cells[0].segments.some((s) => s.kind === "oracle")).toBe(true);
  });

  it("does not emit a divider for the boundary separator itself (it is consumed)", () => {
    const body = `| A | B |
|---|---|
| 1 | 2 |
|---|---|
| Avg | 7 |`;
    const t = parseTableBlock("x", body);
    expect(t.footer.map((it) => it.kind)).toEqual(["cells"]);
  });
});

describe("parseTableBlock: legacy @paginate back-compat", () => {
  it("appends a paginate expr at the end of the footer when @paginate is used", () => {
    const body = `@paginate 3 pages
| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |`;
    const t = parseTableBlock("p", body);
    expect(t.pagination).toEqual({ size: 3, controls: "pages" });
    expect(t.footer).toHaveLength(1);
    expect(exprRows(t)[0].cells[0].segments[0]).toEqual({ kind: "paginate", size: 3, controls: "pages" });
  });

  it("lets an explicit {{ paginate }} expr take precedence over @paginate", () => {
    const body = `@paginate 3 pages
| A | B |
|---|---|
| 1 | 2 |
|= {{ paginate pages=7 }} =|`;
    const t = parseTableBlock("p", body);
    expect(t.pagination).toEqual({ size: 7, controls: "pages" });
    // No duplicate paginate expr appended — only the authored one.
    expect(exprRows(t)).toHaveLength(1);
    expect(exprRows(t)[0].cells[0].segments.find((s) => s.kind === "paginate")).toEqual({
      kind: "paginate",
      size: 7,
      controls: "pages",
    });
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

describe("parseTableBlock: cell @modifiers", () => {
  it("strips recognised leading @modifiers into cell.mods", () => {
    const t = parseTableBlock("m", `| A | B |\n|---|---|\n| @compact @highlight-col Caster Level | x |`);
    expect(t.rows[0].cells[0].mods).toEqual(["compact", "highlight-col"]);
    expect(t.rows[0].cells[0].value).toBe("Caster Level");
  });

  it("recognises @highlight-cross as the cross-highlight modifier", () => {
    const t = parseTableBlock("m", `| A | B |\n|---|---|\n| @highlight-cross 7 | x |`);
    expect(t.rows[0].cells[0].mods).toEqual(["highlight-cross"]);
    expect(t.rows[0].cells[0].value).toBe("7");
  });

  it("does not recognise the old @highlight-both as a modifier", () => {
    const t = parseTableBlock("m", `| A | B |\n|---|---|\n| @highlight-both x | y |`);
    expect(t.rows[0].cells[0].mods).toBeUndefined();
    expect(t.rows[0].cells[0].value).toBe("@highlight-both x");
  });

  it("works on header cells and keeps the column key from the stripped text", () => {
    const t = parseTableBlock("m", `| @highlight-col LEVEL | B |\n|---|---|\n| 1 | 2 |`);
    expect(t.headerRows[0].cells[0].mods).toEqual(["highlight-col"]);
    expect(t.headerRows[0].cells[0].value).toBe("LEVEL");
    expect(t.columns).toEqual(["level", "b"]);
  });

  it("leaves unknown @words and @[[refs]] untouched as content", () => {
    const t = parseTableBlock("m", `| A | B |\n|---|---|\n| @bogus keep | @[[File]].x |`);
    expect(t.rows[0].cells[0].mods).toBeUndefined();
    expect(t.rows[0].cells[0].value).toBe("@bogus keep");
    expect(t.rows[0].cells[1].mods).toBeUndefined();
    expect(t.rows[0].cells[1].value).toBe("@[[File]].x");
  });

  it("accepts a modifier with content after it", () => {
    const t = parseTableBlock("m", `| A | B |\n|---|---|\n| @highlight-row x | y |`);
    expect(t.rows[0].cells[0].mods).toEqual(["highlight-row"]);
    expect(t.rows[0].cells[0].value).toBe("x");
  });

  it("strips trailing @modifiers, leaving the core content (e.g. an axis cell)", () => {
    const t = parseTableBlock(
      "m",
      `| A | B |\n|---|---|\n| {{ axis Odds / Chaos Factor }} @header @highlight-cross | x |`
    );
    const cell = t.rows[0].cells[0];
    expect(cell.value).toBe("{{ axis Odds / Chaos Factor }}");
    expect(cell.mods?.slice().sort()).toEqual(["header", "highlight-cross"]);
  });

  it("strips modifiers flanking the content (leading + trailing)", () => {
    const t = parseTableBlock("m", `| A | B |\n|---|---|\n| @compact Caster Level @header | x |`);
    const cell = t.rows[0].cells[0];
    expect(cell.value).toBe("Caster Level");
    expect(cell.mods?.slice().sort()).toEqual(["compact", "header"]);
  });

  it("parses @modifiers on footer cells (after a 2nd separator)", () => {
    const t = parseTableBlock(
      "m",
      `| A | B |\n|---|---|\n| 1 | 2 |\n|---|---|\n| {{ axis O / C }} @header @highlight-cross | 1 |`
    );
    const cell = cellRows(t)[0].cells[0];
    expect(cell.value).toBe("{{ axis O / C }}");
    expect(cell.mods?.slice().sort()).toEqual(["header", "highlight-cross"]);
  });

  it("recognises the @middle vertical-centering family", () => {
    const t = parseTableBlock(
      "m",
      `| A | B | C | D |\n|---|---|---|---|\n| @middle a | @middle-col b | @middle-row c | @middle-cross d |`
    );
    expect(t.rows[0].cells[0].mods).toEqual(["middle"]);
    expect(t.rows[0].cells[0].value).toBe("a");
    expect(t.rows[0].cells[1].mods).toEqual(["middle-col"]);
    expect(t.rows[0].cells[2].mods).toEqual(["middle-row"]);
    expect(t.rows[0].cells[3].mods).toEqual(["middle-cross"]);
  });
});

describe("parseTableBlock: caption @title", () => {
  it("captures @title and keeps the remaining caption text", () => {
    const t = parseTableBlock("c", `| A |\n|---|\n| 1 |\n[Cleric Progression @title]`);
    expect(t.caption).toBe("Cleric Progression");
    expect(t.captionTitle).toBe(true);
  });

  it("leaves captionTitle undefined without @title", () => {
    const t = parseTableBlock("c", `| A |\n|---|\n| 1 |\n[Plain Caption]`);
    expect(t.caption).toBe("Plain Caption");
    expect(t.captionTitle).toBeUndefined();
  });
});
