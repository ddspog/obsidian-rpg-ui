import { describe, expect, it } from "vitest";
import { fenceNameFromSection, hashSource } from "./section-fence-name";

const text = ["# Note", "```rpg table.first", "| a |", "```", "", "```rpg table.second", "| b |", "```"].join("\n");

describe("fenceNameFromSection", () => {
  it("reads the name of the block's own section, not the first in the note", () => {
    expect(fenceNameFromSection({ text, lineStart: 1, lineEnd: 3 }, "table")).toBe("first");
    expect(fenceNameFromSection({ text, lineStart: 5, lineEnd: 7 }, "table")).toBe("second");
  });

  it("returns an empty name without section info or a match", () => {
    expect(fenceNameFromSection(null, "table")).toBe("");
    expect(fenceNameFromSection({ text, lineStart: 1, lineEnd: 3 }, "list")).toBe("");
  });
});

describe("hashSource", () => {
  it("is stable and tells different sources apart", () => {
    expect(hashSource("| a |")).toBe(hashSource("| a |"));
    expect(hashSource("| a |")).not.toBe(hashSource("| b |"));
  });
});
