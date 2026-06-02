import { describe, expect, it } from "vitest";
import {
  buildRows,
  computeLayout,
  withContinuations,
  groupIntoSections,
  firstPageByList,
  sameBoundaries,
  type Row,
} from "./paginate-fit";
import type { ListBlock, ResolvedList } from "./types";

const block = (id: string, name: string, lineCount: number): ResolvedList => ({
  block: { id, name, columns: "auto", entries: [] } as ListBlock,
  lines: Array.from({ length: lineCount }, (_, i) => ({
    listId: id,
    markdown: `${name} ${i}`,
    file: `${id}/${i}.md`,
  })),
});

const entry = (n: number): Row => ({
  kind: "entry",
  listId: "l",
  markdown: "e" + n,
  key: "k" + n,
});

describe("buildRows", () => {
  it("emits a heading then its entry lines, in block order", () => {
    const rows = buildRows([block("a", "A", 2), block("b", "B", 1)]);
    expect(rows.map((r) => r.kind)).toEqual(["heading", "entry", "entry", "heading", "entry"]);
    expect(rows[0]).toMatchObject({ kind: "heading", listId: "a", name: "A" });
    expect(rows[1]).toMatchObject({ kind: "entry", listId: "a" });
    expect(rows[3]).toMatchObject({ kind: "heading", listId: "b", name: "B" });
  });
});

describe("computeLayout", () => {
  const opts = (over: Partial<Parameters<typeof computeLayout>[2]> = {}) => ({
    maxHeight: 700,
    maxCols: 3,
    minColHeight: 200,
    paginate: false,
    ...over,
  });

  it("uses all maxCols when content is tall enough (balanced, one page)", () => {
    // total 1800 → /200 = 9 cols possible → capped to 3; fits one page.
    const rows = Array.from({ length: 18 }, (_, i) => entry(i));
    const consumed = rows.map(() => 100); // 1800 total
    const layout = computeLayout(rows, consumed, opts());
    expect(layout.cols).toBe(3);
    expect(layout.pages).toEqual([rows]);
  });

  it("drops to 2 columns when 3 would be shorter than minColHeight", () => {
    // total 500 → /200 = 2 → 2 columns.
    const rows = Array.from({ length: 5 }, (_, i) => entry(i));
    const layout = computeLayout(rows, rows.map(() => 100), opts());
    expect(layout.cols).toBe(2);
    expect(layout.pages).toEqual([rows]);
  });

  it("drops to 1 column for very short content", () => {
    const rows = [entry(0)];
    const layout = computeLayout(rows, [150], opts()); // 150 < 200
    expect(layout.cols).toBe(1);
  });

  it("respects an explicit maxCols cap", () => {
    const rows = Array.from({ length: 18 }, (_, i) => entry(i));
    const layout = computeLayout(rows, rows.map(() => 100), opts({ maxCols: 2 }));
    expect(layout.cols).toBe(2); // capped even though content could fill more
  });

  it("does not paginate when paginate is off, even if content overflows", () => {
    const rows = Array.from({ length: 60 }, (_, i) => entry(i));
    const consumed = rows.map(() => 100); // 6000 > 3*700
    const layout = computeLayout(rows, consumed, opts({ paginate: false }));
    expect(layout.pages).toEqual([rows]); // single (scrolling) page
    expect(layout.cols).toBe(3);
  });

  it("paginates into headroom-capped chunks when content overflows", () => {
    // 60 rows × 100 = 6000; usable cap = 3*700*0.88 = 1848 → 18 rows/page
    // → 4 pages (the 0.88 headroom keeps the boundary row off the clip line).
    const rows = Array.from({ length: 60 }, (_, i) => entry(i));
    const layout = computeLayout(rows, rows.map(() => 100), opts({ paginate: true }));
    expect(layout.cols).toBe(3);
    expect(layout.pages.length).toBe(4);
    expect(layout.pages.flat().length).toBe(60); // no rows dropped
  });
});

describe("withContinuations", () => {
  const byId = new Map<string, ListBlock>([
    ["a", { id: "a", name: "Alpha", columns: "auto", entries: [] } as ListBlock],
  ]);

  it("prepends a (cont.) heading when a page opens mid-list", () => {
    const pages: Row[][] = [[entry(0)]]; // opens with an entry (listId 'l')
    const byL = new Map<string, ListBlock>([
      ["l", { id: "l", name: "Lst", columns: "auto", entries: [] } as ListBlock],
    ]);
    const out = withContinuations(pages, byL);
    expect(out[0][0]).toMatchObject({ kind: "heading", name: "Lst", cont: true });
    expect(out[0][1]).toMatchObject({ kind: "entry" });
  });

  it("leaves a page that already opens with a heading untouched", () => {
    const pages: Row[][] = [[{ kind: "heading", listId: "a", name: "Alpha" }, entry(0)]];
    expect(withContinuations(pages, byId)).toEqual(pages);
  });
});

describe("firstPageByList", () => {
  it("maps each list to the first page its content appears on", () => {
    const pages: Row[][] = [
      [{ kind: "heading", listId: "a", name: "A" }, { kind: "entry", listId: "a", markdown: "", key: "1" }],
      [{ kind: "heading", listId: "a", name: "A", cont: true }, { kind: "entry", listId: "a", markdown: "", key: "2" }],
      [{ kind: "heading", listId: "b", name: "B" }],
    ];
    const map = firstPageByList(pages);
    expect(map.get("a")).toBe(0); // first occurrence, not the cont. on page 1
    expect(map.get("b")).toBe(2);
  });
});

describe("groupIntoSections", () => {
  it("groups heading + following entries into sections", () => {
    const rows: Row[] = [
      { kind: "heading", listId: "a", name: "A" },
      { kind: "entry", listId: "a", markdown: "1", key: "1" },
      { kind: "entry", listId: "a", markdown: "2", key: "2" },
      { kind: "heading", listId: "b", name: "B" },
    ];
    const secs = groupIntoSections(rows);
    expect(secs).toHaveLength(2);
    expect(secs[0]).toMatchObject({ listId: "a", name: "A" });
    expect(secs[0].lines).toHaveLength(2);
    expect(secs[1].lines).toHaveLength(0);
  });

  it("synthesizes a nameless section when rows open with an entry", () => {
    const secs = groupIntoSections([entry(0)]);
    expect(secs).toHaveLength(1);
    expect(secs[0].name).toBe("");
    expect(secs[0].lines).toHaveLength(1);
  });
});

describe("sameBoundaries", () => {
  it("compares page counts and per-page lengths", () => {
    const a: Row[][] = [[entry(0), entry(1)], [entry(2)]];
    expect(sameBoundaries(a, [[entry(9), entry(8)], [entry(7)]])).toBe(true);
    expect(sameBoundaries(a, [[entry(9)], [entry(8), entry(7)]])).toBe(false);
    expect(sameBoundaries(null, a)).toBe(false);
  });
});
