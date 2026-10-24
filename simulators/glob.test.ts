import { describe, expect, it } from "vitest";
import { globToRegExp, picks } from "./glob.mjs";

describe("simulator vault globs", () => {
  it("`*` stays in a folder, `**` crosses folders", () => {
    expect(globToRegExp("gm-tools/*.md").test("gm-tools/Fate Chart.md")).toBe(true);
    expect(globToRegExp("gm-tools/*.md").test("gm-tools/tables/Fate Chart.md")).toBe(false);
    expect(globToRegExp("gm-tools/**/*.md").test("gm-tools/tables/x/Fate Chart.md")).toBe(true);
    expect(globToRegExp("**/*.md").test("a.md")).toBe(true);
  });

  it("includes everything when there is no include list, and honours exclude", () => {
    expect(picks("a/b.md")).toBe(true);
    expect(picks("a/b.md", ["a/**"], ["a/private/**"])).toBe(true);
    expect(picks("a/private/b.md", ["a/**"], ["a/private/**"])).toBe(false);
    expect(picks("c/b.md", ["a/**"])).toBe(false);
  });
});
