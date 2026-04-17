import { describe, it, expect } from "vitest";
import { groupByTag, tagLabel } from "./grants";

describe("grants.tagLabel", () => {
  it("maps known tags to their human-readable labels", () => {
    expect(tagLabel("hp")).toBe("Hit Points");
    expect(tagLabel("skill_proficiency")).toBe("Skill P.");
    expect(tagLabel("armor")).toBe("Armor");
    expect(tagLabel("save")).toBe("Saving Throws");
    expect(tagLabel("language")).toBe("Languages");
  });

  it("falls back to the tag id for unknown tags", () => {
    expect(tagLabel("unknown_tag" as never)).toBe("unknown_tag");
  });
});

describe("grants.groupByTag", () => {
  it("preserves first-seen tag order across duplicates", () => {
    const result = groupByTag([
      { tag: "armor", values: ["Light Armor"] },
      { tag: "hp", values: ["+8"] },
      { tag: "armor", values: ["Shields"] },
      { tag: "skill_proficiency", values: ["Medicine"] },
      { tag: "hp", values: ["+1d8"] },
    ]);
    expect(result.map((g) => g.tag)).toEqual(["armor", "hp", "skill_proficiency"]);
  });

  it("merges values across duplicate-tag entries", () => {
    const result = groupByTag([
      { tag: "armor", values: ["Light Armor"] },
      { tag: "armor", values: ["Medium Armor", "Shields"] },
    ]);
    expect(result).toEqual([{ tag: "armor", values: ["Light Armor", "Medium Armor", "Shields"] }]);
  });

  it("dedupes values within a tag (first occurrence wins)", () => {
    const result = groupByTag([
      { tag: "skill_proficiency", values: ["Medicine", "Insight"] },
      { tag: "skill_proficiency", values: ["Medicine", "History"] },
    ]);
    expect(result).toEqual([
      { tag: "skill_proficiency", values: ["Medicine", "Insight", "History"] },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(groupByTag([])).toEqual([]);
  });
});
