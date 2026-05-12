import { describe, expect, it } from "vitest";
import { expandOptionRefs } from "./index-builder";

const tagIndex = {
  Martial: ["[[Longsword]]", "[[Warhammer]]"],
  Divine: ["[[Guidance]]", "[[Cure Wounds]]"],
};

const folderIndex = {
  "compendium/weapons/simple": ["[[Dagger]]", "[[Club]]"],
  cantrips: ["[[Guidance]]", "[[Light]]"],
};

describe("expandOptionRefs", () => {
  it("expands [[Name]] refs via tagIndex", () => {
    expect(expandOptionRefs(["[[Martial]]"], tagIndex, folderIndex)).toEqual(["[[Longsword]]", "[[Warhammer]]"]);
  });

  it("strips path prefix and alias from wikilinks before lookup", () => {
    expect(expandOptionRefs(["[[some/path/Martial|Martial Weapons]]"], tagIndex, folderIndex)).toEqual([
      "[[Longsword]]",
      "[[Warhammer]]",
    ]);
  });

  it("passes unknown wikilinks through as literals", () => {
    // [[Insight]] is a specific note, not a tag group — must stay literal.
    expect(expandOptionRefs(["[[Insight]]"], tagIndex, folderIndex)).toEqual(["[[Insight]]"]);
  });

  it("expands @folder/path refs via folderIndex", () => {
    expect(expandOptionRefs(["@compendium/weapons/simple"], tagIndex, folderIndex)).toEqual(["[[Dagger]]", "[[Club]]"]);
  });

  it("falls back to shorter @folder suffix when the full path is unknown", () => {
    expect(expandOptionRefs(["@worldbuilding/cantrips"], tagIndex, folderIndex)).toEqual(["[[Guidance]]", "[[Light]]"]);
  });

  it("no longer expands # prefixed strings — they pass through literally", () => {
    expect(expandOptionRefs(["#Martial"], tagIndex, folderIndex)).toEqual(["#Martial"]);
  });

  it("deduplicates expansions across refs", () => {
    // Guidance appears in both the Divine tag and the cantrips folder.
    expect(expandOptionRefs(["[[Divine]]", "@cantrips"], tagIndex, folderIndex)).toEqual([
      "[[Guidance]]",
      "[[Cure Wounds]]",
      "[[Light]]",
    ]);
  });

  it("preserves authored order", () => {
    expect(
      expandOptionRefs(["[[Shield]]", "[[Martial]]", "@compendium/weapons/simple"], tagIndex, folderIndex)
    ).toEqual(["[[Shield]]", "[[Longsword]]", "[[Warhammer]]", "[[Dagger]]", "[[Club]]"]);
  });

  it("handles undefined indexes — wikilinks pass through, @ refs collapse", () => {
    expect(expandOptionRefs(["[[Martial]]", "@compendium/weapons/simple", "[[Shield]]"], undefined, undefined)).toEqual(
      ["[[Martial]]", "[[Shield]]"]
    );
  });

  it("skips empty / non-string entries", () => {
    expect(expandOptionRefs(["", "  ", "[[Martial]]", null as unknown as string], tagIndex, folderIndex)).toEqual([
      "[[Longsword]]",
      "[[Warhammer]]",
    ]);
  });
});
