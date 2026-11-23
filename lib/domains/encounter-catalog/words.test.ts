import { describe, expect, it } from "vitest";

import { anyWordIn, diceRange, normaliseTags, sameTag, wordForms, wordKey } from "./words";

describe("wordKey and sameTag", () => {
  it("fold case and a plural", () => {
    expect(wordKey("Forests")).toBe("forest");
    expect(wordKey("marshes")).toBe("marsh");
    expect(wordKey("grass")).toBe("grass");
    expect(sameTag("Forests", "forest")).toBe(true);
    expect(sameTag("hills", "Hill")).toBe(true);
    expect(sameTag("forest", "tier-1")).toBe(false);
  });

  it("wordForms tries -ves and -ies singulars", () => {
    expect(wordForms("wolves")).toEqual(["wolves", "wolve", "wolf"]);
    expect(anyWordIn(["harpies"], ["Harpy"])).toBe(true);
  });
});

describe("normaliseTags", () => {
  it("lower-cases, drops empties and keeps one spelling per folded word, in order", () => {
    expect(normaliseTags(["Forests", "tier-1", " ", "forest", "TIER-1"])).toEqual(["forests", "tier-1"]);
  });

  it("prefers the bestiary's spelling, even when only the table's was written", () => {
    const habitats = new Set(["forest", "hills", "badlands"]);
    expect(normaliseTags(["forests", "tier-1", "forest", "hills"], habitats)).toEqual(["forest", "tier-1", "hills"]);
    expect(normaliseTags(["forests", "badlands"], habitats)).toEqual(["forest", "badlands"]);
    expect(normaliseTags(["hill"], habitats)).toEqual(["hills"]);
  });
});

describe("diceRange", () => {
  it("reads NdM with a flat bonus or malus", () => {
    expect(diceRange("1d4 + 1")).toEqual({ min: 2, max: 5 });
    expect(diceRange("2d6")).toEqual({ min: 2, max: 12 });
    expect(diceRange("1d6-2")).toEqual({ min: 1, max: 4 });
    expect(diceRange("3D4+0")).toEqual({ min: 3, max: 12 });
  });

  it("is null for anything else", () => {
    expect(diceRange("several")).toBeNull();
    expect(diceRange("0d6")).toBeNull();
    expect(diceRange("")).toBeNull();
  });
});
