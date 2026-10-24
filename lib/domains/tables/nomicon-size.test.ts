import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

/** A Nomicon page stays short enough to read and edit; a longer chapter is split into
 *  part files (in a folder beside it) that the chapter imports as tabs. */
const MAX_LINES = 300;
const ROOT = path.resolve(__dirname, "../../../vault/tales-of-the-valiant/compendium/the-nomicon");

function pages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? pages(p) : p.endsWith(".md") ? [p] : [];
  });
}

describe("the Nomicon's pages", () => {
  it(`are at most ${MAX_LINES} lines`, () => {
    const tooLong = pages(ROOT)
      .map((p) => ({ page: path.relative(ROOT, p), lines: fs.readFileSync(p, "utf8").split("\n").length }))
      .filter((p) => p.lines > MAX_LINES);
    expect(tooLong).toEqual([]);
  });
});
