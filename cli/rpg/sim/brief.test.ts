import { describe, expect, it } from "vitest";
import { anyWordIn, briefJson, fitByDifficulty, skippedByOwner, wordForms, wordKey } from "./brief";

describe("wordKey", () => {
  it("folds case and a plural so table tags and habitats meet", () => {
    expect(wordKey("Forests")).toBe("forest");
    expect(wordKey("forest")).toBe("forest");
    expect(wordKey("Hills")).toBe("hill");
    expect(wordKey("marshes")).toBe("marsh");
    expect(wordKey("boxes")).toBe("box");
    expect(wordKey("grass")).toBe("grass");
    expect(wordKey("gas")).toBe("gas");
  });
});

describe("wordForms and anyWordIn", () => {
  it("try the singulars of -ves and -ies plurals", () => {
    expect(wordForms("Wolves")).toEqual(["wolves", "wolve", "wolf"]);
    expect(wordForms("harpies")).toEqual(["harpies", "harpie", "harpy"]);
    expect(anyWordIn(["wolves"], ["Wolf, Dire"])).toBe(true);
    expect(anyWordIn(["harpies"], ["Harpy"])).toBe(true);
    expect(anyWordIn(["goblin", "ambush"], ["Hobgoblin Leader"])).toBe(true);
    expect(anyWordIn(["ambush"], ["Thug", "Medium Humanoid"])).toBe(false);
    expect(anyWordIn([], ["Thug"])).toBe(false);
  });
});

describe("fitByDifficulty", () => {
  it("judges one outcome against each difficulty", () => {
    expect(fitByDifficulty({ avgHpLost: 0.05, tpkRate: 0 })).toEqual({
      easy: "fit",
      challenging: "too-easy",
      deadly: "too-easy",
    });
    expect(fitByDifficulty({ avgHpLost: 0.95, tpkRate: 0.6 })).toEqual({
      easy: "too-hard",
      challenging: "too-hard",
      deadly: "too-hard",
    });
  });
});

describe("skippedByOwner", () => {
  it("lists what was skipped that may matter, by owner, renamed", () => {
    expect(
      skippedByOwner(
        {
          Kowyn: [
            { name: "Entangle", owner: "Kowyn", status: "skipped", reason: "control-spell" },
            { name: "Message", owner: "Kowyn", status: "skipped", reason: "utility-spell" },
            { name: "Thunderwave", owner: "Kowyn", status: "modelled" },
          ],
          Lilith: [{ name: "Light", owner: "Lilith", status: "skipped", reason: "utility-spell" }],
          "bestiary/Thug.md": [
            { name: "Pack Tactics", owner: "bestiary/Thug.md", status: "skipped", reason: "unsupported-feature" },
          ],
        },
        (owner) => owner.replace(/^.*\/|\.md$/g, "")
      )
    ).toEqual({ Kowyn: ["Entangle (control-spell)"], Thug: ["Pack Tactics (unsupported-feature)"] });
  });
});

describe("briefJson", () => {
  it("writes the keys and their items one to a line, deeper values inline, and stays JSON", () => {
    const doc = { a: 1, list: [{ x: [1, 2] }, "s"], map: { k: { deep: true } }, empty: [], none: undefined };
    const text = briefJson(doc);
    expect(text).toBe(
      '{\n  "a": 1,\n  "list": [\n    {"x":[1,2]},\n    "s"\n  ],\n  "map": {\n    "k": {"deep":true}\n  },\n  "empty": []\n}'
    );
    expect(JSON.parse(text)).toEqual({ a: 1, list: [{ x: [1, 2] }, "s"], map: { k: { deep: true } }, empty: [] });
    expect(briefJson("plain")).toBe('"plain"');
  });
});
