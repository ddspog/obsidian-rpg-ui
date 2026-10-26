import { describe, expect, it } from "vitest";
import { findMapFences, replaceMapBody } from "./fence-text";

const NOTE = [
  "# Dunlind",
  "",
  "```rpg map",
  "grid: hex",
  "---",
  "t(0,0): ocean",
  "```",
  "",
  "> [!map] Callout",
  "> ```rpg map",
  "> grid: hex",
  "> ---",
  ">",
  "> t(0,0): ocean",
  "> ```",
  "",
  "````rpg map",
  "grid: hex",
  "---",
  "t(0,0): ocean",
  "````",
].join("\n");

describe("findMapFences", () => {
  it("finds plain, quoted and long fences with their bodies", () => {
    const fences = findMapFences(NOTE);
    expect(fences.map((f) => f.open)).toEqual([2, 9, 16]);
    expect(fences[1].prefix).toBe("> ");
    expect(fences[1].body).toBe("grid: hex\n---\n\nt(0,0): ocean");
  });
});

describe("replaceMapBody", () => {
  it("swaps the body of the block with that text", () => {
    const out = replaceMapBody(NOTE, "grid: hex\n---\n\nt(0,0): ocean", "grid: hex\n---\nt(0,0): plains");
    expect(out?.split("\n").slice(9, 14)).toEqual([
      "> ```rpg map",
      "> grid: hex",
      "> ---",
      "> t(0,0): plains",
      "> ```",
    ]);
  });

  it("picks the block nearest the hint among equals, and gives null for none", () => {
    const body = "grid: hex\n---\nt(0,0): ocean";
    const out = replaceMapBody(NOTE, body, "grid: hex\n---\nt(0,0): hills", 17)!;
    expect(out.split("\n")[5]).toBe("t(0,0): ocean");
    expect(out.split("\n")[19]).toBe("t(0,0): hills");
    expect(replaceMapBody(NOTE, "grid: hex\n---\nt(9,9): x", "…")).toBeNull();
  });
});
