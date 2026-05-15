import { describe, expect, it } from "vitest";
import { parsePaginateDirective, sliceRows, totalPages } from "./pagination";

describe("parsePaginateDirective", () => {
  it("parses prev-next control", () => {
    expect(parsePaginateDirective("@paginate 10 prev-next")).toEqual({
      size: 10,
      controls: "prev-next",
    });
  });

  it("parses pages control", () => {
    expect(parsePaginateDirective("@paginate 5 pages")).toEqual({
      size: 5,
      controls: "pages",
    });
  });

  it("parses show-more control", () => {
    expect(parsePaginateDirective("@paginate 20 show-more")).toEqual({
      size: 20,
      controls: "show-more",
    });
  });

  it("handles leading/trailing whitespace", () => {
    expect(parsePaginateDirective("  @paginate 10 prev-next  ")).toEqual({
      size: 10,
      controls: "prev-next",
    });
  });

  it("rejects size 0", () => {
    expect(parsePaginateDirective("@paginate 0 pages")).toBeNull();
  });

  it("rejects unknown control type", () => {
    expect(parsePaginateDirective("@paginate 10 infinite")).toBeNull();
  });

  it("rejects missing size", () => {
    expect(parsePaginateDirective("@paginate pages")).toBeNull();
  });

  it("rejects non-directive lines", () => {
    expect(parsePaginateDirective("| header |")).toBeNull();
    expect(parsePaginateDirective("")).toBeNull();
  });
});

describe("sliceRows", () => {
  const rows = Array.from({ length: 25 }, (_, i) => i);

  it("slices page 0 for prev-next", () => {
    const config = { size: 10, controls: "prev-next" as const };
    expect(sliceRows(rows, config, { page: 0, visiblePages: 1 })).toEqual(rows.slice(0, 10));
  });

  it("slices page 2 for pages", () => {
    const config = { size: 10, controls: "pages" as const };
    expect(sliceRows(rows, config, { page: 2, visiblePages: 1 })).toEqual(rows.slice(20, 25));
  });

  it("accumulates pages for show-more", () => {
    const config = { size: 10, controls: "show-more" as const };
    expect(sliceRows(rows, config, { page: 0, visiblePages: 2 })).toEqual(rows.slice(0, 20));
  });

  it("show-more with all pages visible returns everything", () => {
    const config = { size: 10, controls: "show-more" as const };
    expect(sliceRows(rows, config, { page: 0, visiblePages: 5 })).toEqual(rows);
  });
});

describe("totalPages", () => {
  it("calculates correct page count", () => {
    expect(totalPages(25, 10)).toBe(3);
    expect(totalPages(20, 10)).toBe(2);
    expect(totalPages(1, 10)).toBe(1);
    expect(totalPages(0, 10)).toBe(1);
  });
});
