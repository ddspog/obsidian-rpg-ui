import { describe, expect, it } from "vitest";
import { parsePrompts, pickPrompts, promptSetFor } from "./prompts";

describe("margin prompts", () => {
  it("reads a note's prompts, one a line", () => {
    const note = [
      "---",
      "tags: [x]",
      "---",
      "# Prompts",
      "",
      "- The coins show the way",
      "Fountain of death",
      "1. Colorful sails",
      "Fountain of death",
    ].join("\n");
    expect(parsePrompts(note)).toEqual(["The coins show the way", "Fountain of death", "Colorful sails"]);
  });

  it("finds the set of a note's folder, the longest folder winning", () => {
    const sets = [
      { folder: "tales", wordsFile: "a.md" },
      { folder: "tales/compendium/tome/", wordsFile: "b.md" },
      { folder: "tales/other", wordsFile: "" },
    ];
    expect(promptSetFor("tales/compendium/tome/01. Intro.md", sets)?.wordsFile).toBe("b.md");
    expect(promptSetFor("tales/x.md", sets)?.wordsFile).toBe("a.md");
    expect(promptSetFor("talesman/x.md", sets)).toBeUndefined();
    expect(promptSetFor("tales/other/x.md", sets)?.wordsFile).toBe("a.md");
  });

  it("picks the same prompts for a page every time, none twice while the list lasts", () => {
    const words = ["a", "b", "c", "d", "e", "f"];
    const one = pickPrompts(words, "page.md", 4);
    expect(pickPrompts(words, "page.md", 4)).toEqual(one);
    expect(new Set(one).size).toBe(4);
    expect(pickPrompts(words, "other.md", 6)).not.toEqual(pickPrompts(words, "page.md", 6));
    expect(pickPrompts(words, "page.md", 8)).toHaveLength(8);
    expect(pickPrompts([], "page.md", 3)).toEqual([]);
  });
});
