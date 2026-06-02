import { describe, it, expect } from "vitest";
import { parseTableBlock } from "./parse-table-block";
import { parseMergeMarker, resolveRenderRows, type RowRange } from "./row-merge";

/** Parse a fence body and resolve its body rows over an optional window. */
function resolve(src: string, range?: RowRange) {
  const def = parseTableBlock("t", src.trim());
  return resolveRenderRows(def.rows, def.columns.length, range);
}

describe("parseMergeMarker", () => {
  it("recognises the bare caret with no explicit alignment", () => {
    expect(parseMergeMarker("^")).toEqual({});
    expect(parseMergeMarker("  ^  ")).toEqual({});
  });

  it("maps glyph suffixes to alignments", () => {
    expect(parseMergeMarker("^^")).toEqual({ align: "top" });
    expect(parseMergeMarker("^v")).toEqual({ align: "bottom" });
    expect(parseMergeMarker("^V")).toEqual({ align: "bottom" });
    expect(parseMergeMarker("^-")).toEqual({ align: "middle" });
  });

  it("rejects empty, content-bearing, and unknown-glyph cells", () => {
    expect(parseMergeMarker("")).toBeNull();
    expect(parseMergeMarker("a")).toBeNull();
    expect(parseMergeMarker("^ hi")).toBeNull();
    expect(parseMergeMarker("^^^")).toBeNull();
    expect(parseMergeMarker("^x")).toBeNull();
    expect(parseMergeMarker("x^")).toBeNull();
  });
});

describe("parseTableBlock: merge markers", () => {
  it("flags `^` body cells as mergeUp and blanks their value", () => {
    const t = parseTableBlock(
      "p",
      `| LVL | PB |
|---|---|
| 1 | +2 |
| 2 | ^ |
| 3 | ^^ |
| 4 | ^v |`
    );
    expect(t.rows[0].cells[1]).toEqual({ value: "+2" });
    expect(t.rows[1].cells[1]).toEqual({ value: "", mergeUp: true });
    expect(t.rows[2].cells[1]).toEqual({ value: "", mergeUp: true, mergeAlign: "top" });
    expect(t.rows[3].cells[1]).toEqual({ value: "", mergeUp: true, mergeAlign: "bottom" });
  });

  it("leaves a caret-with-text cell as ordinary content", () => {
    const t = parseTableBlock("p", `| A |\n|---|\n| ^ hi |`);
    expect(t.rows[0].cells[0]).toEqual({ value: "^ hi" });
  });

  it("does not treat header `^` cells as merges (headers excluded)", () => {
    const t = parseTableBlock("p", `| ^ | B |\n|---|---|\n| 1 | 2 |`);
    expect(t.headerRows[0].cells[0]).toEqual({ value: "^" });
  });

  it("strips a `||` colspan off a marker so it stays single-column", () => {
    // `^ ||` would otherwise leave the marker with colspan=2 and corrupt the
    // grid: the marker must occupy exactly its own column.
    const t = parseTableBlock(
      "p",
      `| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | ^ || x |`
    );
    expect(t.rows[1].cells).toEqual([
      { value: "4" },
      { value: "", mergeUp: true },
      { value: "x" },
    ]);
  });
});

describe("resolveRenderRows: vertical merge", () => {
  it("collapses a stack of `^` into one centred spanning cell", () => {
    const rows = resolve(`| LVL | PB |
|---|---|
| 1 | +2 |
| 2 | ^ |
| 3 | ^ |
| 4 | +3 |`);

    expect(rows).toHaveLength(4);
    expect(rows[0].cells).toEqual([
      { value: "1" },
      { value: "+2", rowspan: 3, valign: "middle" },
    ]);
    expect(rows[1].cells).toEqual([{ value: "2" }]);
    expect(rows[2].cells).toEqual([{ value: "3" }]);
    expect(rows[3].cells).toEqual([{ value: "4" }, { value: "+3" }]);
  });

  it("honours an explicit top alignment glyph", () => {
    const rows = resolve(`| A | B |
|---|---|
| 1 | x |
| 2 | ^^ |`);
    expect(rows[0].cells[1]).toEqual({ value: "x", rowspan: 2, valign: "top" });
  });

  it("lets the top-most explicit glyph win over later ones", () => {
    const rows = resolve(`| A | B |
|---|---|
| 1 | x |
| 2 | ^^ |
| 3 | ^v |`);
    expect(rows[0].cells[1]).toEqual({ value: "x", rowspan: 3, valign: "top" });
  });

  it("treats a bare caret above an explicit glyph as inheriting it", () => {
    const rows = resolve(`| A | B |
|---|---|
| 1 | x |
| 2 | ^ |
| 3 | ^v |`);
    expect(rows[0].cells[1]).toEqual({ value: "x", rowspan: 3, valign: "bottom" });
  });

  it("resets active spans at a category divider row", () => {
    const rows = resolve(`| A | B |
|---|---|
| x | 1 |
| Section ||
| y | ^ |`);
    expect(rows[0].cells).toEqual([{ value: "x" }, { value: "1" }]);
    expect(rows[1]).toEqual({ cells: [], category: true, categoryLabel: "Section" });
    // No anchor above after the band → the marker degrades to an empty cell.
    expect(rows[2].cells).toEqual([{ value: "y" }, { value: "" }]);
  });

  it("renders a top-of-table `^` (no anchor) as an empty cell", () => {
    const rows = resolve(`| A | B |
|---|---|
| ^ | 1 |`);
    expect(rows[0].cells).toEqual([{ value: "" }, { value: "1" }]);
  });

  it("extends a colspanned anchor only once when several markers reference it", () => {
    // "xx" spans columns B+C; both markers below point at the same anchor.
    const rows = resolve(`| A | B | C |
|---|---|---|
| 1 | xx ||
| 2 | ^ | ^ |`);
    expect(rows[0].cells).toEqual([
      { value: "1" },
      { value: "xx", colspan: 2, rowspan: 2, valign: "middle" },
    ]);
    expect(rows[1].cells).toEqual([{ value: "2" }]);
  });

  it("preserves indent on non-merge cells", () => {
    const rows = resolve(`| A | B |
|---|---|
| Parent | 1 |
| > Child | ^ |`);
    expect(rows[0].cells[1]).toEqual({ value: "1", rowspan: 2, valign: "middle" });
    expect(rows[1].cells).toEqual([{ value: "Child", indent: 1 }]);
  });

  it("keeps the grid aligned when a marker shares a row with content (stripped `||`)", () => {
    const rows = resolve(`| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | ^ || x |`);
    expect(rows[0].cells).toEqual([
      { value: "1" },
      { value: "2", rowspan: 2, valign: "middle" },
      { value: "3" },
    ]);
    // col B covered by the rowspan; "x" lands at col C, not skipped to col D.
    expect(rows[1].cells).toEqual([{ value: "4" }, { value: "x" }]);
  });

  it("resets spans on both sides of a mid-table category divider", () => {
    const rows = resolve(`| A | B |
|---|---|
| 1 | x |
| 2 | ^ |
| Section ||
| 3 | y |
| 4 | ^ |`);
    expect(rows[0].cells).toEqual([{ value: "1" }, { value: "x", rowspan: 2, valign: "middle" }]);
    expect(rows[1].cells).toEqual([{ value: "2" }]);
    expect(rows[2]).toEqual({ cells: [], category: true, categoryLabel: "Section" });
    expect(rows[3].cells).toEqual([{ value: "3" }, { value: "y", rowspan: 2, valign: "middle" }]);
    expect(rows[4].cells).toEqual([{ value: "4" }]);
  });
});

describe("resolveRenderRows: pagination windows", () => {
  const src = `| LVL | PB |
|---|---|
| 1 | +2 |
| 2 | ^ |
| 3 | ^ |
| 4 | ^ |
| 5 | +3 |
| 6 | ^ |`;

  it("carries the anchor value down when a page starts mid-span", () => {
    // Window = rows index 2..4 (LVL 3,4,5). The "+2" anchor is on the prior
    // page, so the orphaned markers re-anchor with the carried value.
    const rows = resolve(src, { start: 2, end: 4 });
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toEqual([
      { value: "3" },
      { value: "+2", rowspan: 2, valign: "middle", carried: true },
    ]);
    expect(rows[1].cells).toEqual([{ value: "4" }]);
  });

  it("counts only in-window markers toward an in-window anchor's rowspan", () => {
    // Window = rows index 0..3 (LVL 1,2,3). The span continues past the page
    // (LVL 4) but the rowspan reflects only the visible rows.
    const rows = resolve(src, { start: 0, end: 3 });
    expect(rows[0].cells[1]).toEqual({ value: "+2", rowspan: 3, valign: "middle" });
    expect(rows).toHaveLength(3);
  });

  it("preserves a colspanned anchor's width when carried across a page", () => {
    const colspanSrc = `| A | B | C |
|---|---|---|
| 1 | wide ||
| 2 | ^ |
| 3 | ^ |
| 4 | ^ |`;
    // Window starts mid-span: the "wide" anchor (colspan 2) is on the prior
    // page and must keep its colspan when carried down, not collapse to 1.
    const rows = resolve(colspanSrc, { start: 2, end: 4 });
    expect(rows[0].cells).toEqual([
      { value: "3" },
      { value: "wide", colspan: 2, rowspan: 2, valign: "middle", carried: true },
    ]);
    expect(rows[1].cells).toEqual([{ value: "4" }]);
  });

  it("returns no rows for an empty window (start >= end)", () => {
    expect(resolve(src, { start: 5, end: 5 })).toEqual([]);
    expect(resolve(src, { start: 99, end: 99 })).toEqual([]);
  });
});

