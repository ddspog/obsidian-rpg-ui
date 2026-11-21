import { describe, expect, it } from "vitest";

import { buildMonsterIndex, findMentions, lookupName, normWord, pluralsOf, tokenize, wordsOf } from "./monster-index";

const entries = [
  { note: "b/Bandit.md", name: "Bandit", cr: "1/8" },
  { note: "b/Bandit Captain.md", name: "Bandit Captain", cr: "2" },
  { note: "b/Cultist.md", name: "Cultist", cr: "1/8" },
  { note: "b/Cultist, Fanatic.md", name: "Cultist, Fanatic", cr: "2" },
  { note: "b/Kobold.md", name: "Kobold", cr: "1/8" },
  { note: "b/Kobold, Elite.md", name: "Kobold, Elite", cr: "1" },
  { note: "b/Winter Wolf.md", name: "Winter Wolf", cr: "3" },
  { note: "b/Wolf.md", name: "Wolf", cr: "1/4" },
  { note: "b/Wolf, Dire.md", name: "Wolf, Dire", cr: "1" },
  { note: "b/Werebear.md", name: "Werebear", cr: "5" },
  { note: "b/Ice Mephit.md", name: "Ice Mephit", cr: "1/2" },
  { note: "b/Mammoth.md", name: "Mammoth", cr: "6" },
  { note: "b/Giant, Frost.md", name: "Giant, Frost", cr: "8" },
  { note: "b/Ghoul.md", name: "Ghoul", cr: "1" },
  { note: "b/Grimlock.md", name: "Grimlock", cr: "1/4" },
  { note: "b/Polar Bear.md", name: "Polar Bear", cr: "2" },
  { note: "b/undead/Wraith Bear ᴷ.md", name: "Wraith Bear", cr: "5" },
  { note: "b/Wraith Bear.md", name: "Wraith Bear", cr: "5" },
];

const index = buildMonsterIndex(entries);

describe("normWord", () => {
  it("lowercases, drops accents, the Kobold Press mark and the possessive", () => {
    expect(normWord("Zwölfhulk")).toBe("zwolfhulk");
    expect(normWord("ᴷ")).toBe("");
    expect(normWord("Owl’s")).toBe("owl");
  });
});

describe("tokenize", () => {
  it("reads dice with their modifier as one token", () => {
    const tokens = tokenize("1d4 + 1 grimlocks and 3d4 kobolds");
    expect(tokens.map((t) => [t.kind, t.norm])).toEqual([
      ["dice", "1d4 + 1"],
      ["word", "grimlocks"],
      ["word", "and"],
      ["dice", "3d4"],
      ["word", "kobolds"],
    ]);
  });

  it("keeps a dice-like run inside a longer word in the word", () => {
    expect(wordsOf("sword4 and d6")).toEqual(["sword4", "and"]);
  });
});

describe("pluralsOf", () => {
  it.each([
    ["wolf", "wolves"],
    ["cultist", "cultists"],
    ["mephit", "mephits"],
    ["werebear", "werebears"],
    ["harpy", "harpies"],
    ["fox", "foxes"],
    ["lich", "liches"],
    ["knife", "knives"],
    ["dwarf", "dwarves"],
    ["thief", "thieves"],
    ["mouse", "mice"],
    ["ox", "oxen"],
    ["goblinman", "goblinmen"],
    ["homunculus", "homunculi"],
  ])("%s -> %s", (word, plural) => {
    expect(pluralsOf(word)).toContain(plural);
  });

  it("has no plural for an invariant word", () => {
    expect(pluralsOf("sheep")).toEqual([]);
    expect(pluralsOf("deer")).toEqual([]);
  });
});

describe("lookupName", () => {
  it("finds a name as written, in any case", () => {
    expect(lookupName(index, "Bandit Captain")).toMatchObject({ note: "b/Bandit Captain.md", plural: false });
    expect(lookupName(index, "bandit captain")).toMatchObject({ note: "b/Bandit Captain.md" });
  });

  it("finds a plural and says so", () => {
    expect(lookupName(index, "Winter Wolves")).toMatchObject({ name: "Winter Wolf", plural: true });
    expect(lookupName(index, "ice mephits")).toMatchObject({ name: "Ice Mephit", plural: true });
    expect(lookupName(index, "cultists")).toMatchObject({ name: "Cultist", plural: true });
    expect(lookupName(index, "werebears")).toMatchObject({ name: "Werebear", plural: true });
    expect(lookupName(index, "mammoths")).toMatchObject({ name: "Mammoth", plural: true });
    expect(lookupName(index, "grimlocks")).toMatchObject({ name: "Grimlock", plural: true });
  });

  it("reads a comma name in the order people say it", () => {
    expect(lookupName(index, "dire wolf")).toMatchObject({ note: "b/Wolf, Dire.md", plural: false });
    expect(lookupName(index, "dire wolves")).toMatchObject({ note: "b/Wolf, Dire.md", plural: true });
    expect(lookupName(index, "elite kobolds")).toMatchObject({ note: "b/Kobold, Elite.md", plural: true });
    expect(lookupName(index, "kobold elite")).toMatchObject({ note: "b/Kobold, Elite.md" });
    expect(lookupName(index, "fanatic cultist")).toMatchObject({ note: "b/Cultist, Fanatic.md" });
    expect(lookupName(index, "frost giants")).toMatchObject({ note: "b/Giant, Frost.md", plural: true });
    expect(lookupName(index, "Wolf, Dire")).toMatchObject({ note: "b/Wolf, Dire.md" });
  });

  it("does not let a comma name answer to its bare head", () => {
    expect(lookupName(index, "kobold")).toMatchObject({ note: "b/Kobold.md" });
    expect(lookupName(index, "giant")).toBeUndefined();
    expect(lookupName(index, "elite")).toBeUndefined();
  });

  it("answers nothing for an unknown name", () => {
    expect(lookupName(index, "shrieker")).toBeUndefined();
    expect(lookupName(index, "")).toBeUndefined();
  });

  it("prefers the note without the ᴷ suffix, and keeps the other as an alternative", () => {
    const entry = lookupName(index, "wraith bears");
    expect(entry).toMatchObject({ note: "b/Wraith Bear.md", plural: true });
    expect(entry?.alternatives.map((a) => a.note)).toEqual(["b/undead/Wraith Bear ᴷ.md"]);
  });

  it("prefers the shortest path when neither or both have the mark", () => {
    const idx = buildMonsterIndex([
      { note: "families/humanoids/Merchant.md", name: "Merchant" },
      { note: "families/or-small-humanoids/Merchant.md", name: "Merchant" },
    ]);
    expect(lookupName(idx, "merchant")?.note).toBe("families/humanoids/Merchant.md");
  });

  it("finds the marked note when it is the only one", () => {
    const idx = buildMonsterIndex([{ note: "undead/Wraith Bear ᴷ.md", name: "Wraith Bear" }]);
    expect(lookupName(idx, "wraith bear")?.note).toBe("undead/Wraith Bear ᴷ.md");
  });

  it("reads 'Kobold, A' as the plain kobold, and drops a trailing CR mark and a parenthesis", () => {
    const idx = buildMonsterIndex([
      { note: "k/Kobold, A.md", name: "Kobold, A" },
      { note: "k/Clockwork Companion CR —.md", name: "Clockwork Companion CR —" },
      { note: "k/Thrice Forgotten.md", name: "Thrice Forgotten (Fallen Angel)" },
    ]);
    expect(lookupName(idx, "kobolds")).toMatchObject({ note: "k/Kobold, A.md", plural: true });
    expect(lookupName(idx, "a kobold")).toBeUndefined();
    expect(lookupName(idx, "clockwork companions")).toMatchObject({ plural: true });
    expect(lookupName(idx, "thrice forgotten")).toBeDefined();
  });

  it("answers to a tail of several words and to swarms", () => {
    const idx = buildMonsterIndex([
      { note: "i/Insect, Giant Wasp.md", name: "Insect, Giant Wasp" },
      { note: "s/Rat, Swarm of Rats.md", name: "Rat, Swarm of Rats" },
      { note: "g/Giant Rat.md", name: "Rat, Giant" },
    ]);
    expect(lookupName(idx, "giant wasps")).toMatchObject({ note: "i/Insect, Giant Wasp.md", plural: true });
    expect(lookupName(idx, "swarms of rats")).toMatchObject({ note: "s/Rat, Swarm of Rats.md", plural: true });
    expect(lookupName(idx, "swarm of rats")).toMatchObject({ plural: false });
    expect(lookupName(idx, "giant rats")).toMatchObject({ plural: true });
  });
});

describe("findMentions", () => {
  it("finds every creature with offsets into the text", () => {
    const text = "A bandit captain and two bandits are claiming trapped animals";
    const found = findMentions(index, text);
    expect(found.map((m) => [m.name, m.text, m.plural])).toEqual([
      ["Bandit Captain", "bandit captain", false],
      ["Bandit", "bandits", true],
    ]);
    for (const m of found) expect(text.slice(m.start, m.end)).toBe(m.text);
  });

  it("lets the longest name win", () => {
    expect(findMentions(index, "A pack of four winter wolves prowls").map((m) => m.name)).toEqual(["Winter Wolf"]);
    expect(findMentions(index, "An arctic dire wolf returns").map((m) => m.name)).toEqual(["Wolf, Dire"]);
    expect(findMentions(index, "the wolf and the dire wolf").map((m) => m.name)).toEqual(["Wolf", "Wolf, Dire"]);
    expect(findMentions(index, "Two fanatic cultists and six cultists").map((m) => m.name)).toEqual([
      "Cultist, Fanatic",
      "Cultist",
    ]);
  });

  it("does not match across punctuation", () => {
    expect(findMentions(index, "a dire. wolf").map((m) => m.name)).toEqual(["Wolf"]);
    expect(findMentions(index, "dire, wolf").map((m) => m.name)).toEqual(["Wolf"]);
  });

  it("reads a possessive as the creature", () => {
    expect(findMentions(index, "the mammoth’s tusks").map((m) => [m.name, m.plural])).toEqual([["Mammoth", false]]);
  });

  it("finds nothing in a line with no creature", () => {
    expect(findMentions(index, "A minor earthquake causes the snow to give way")).toEqual([]);
  });
});
