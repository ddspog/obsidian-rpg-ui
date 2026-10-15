import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { foesInPlay, foldFoes } from "./foes";

const fold = (lines: string[]) => {
  const segs = groupIntoProse(parseLonelog(lines.join("\n")));
  const at = foldFoes(segs);
  return segs.map((s) => at.get(s.sourceIndex));
};

describe("foldFoes — health through the log", () => {
  const log = [
    "? Combat begins. [F:[[Kobold, Elite]]|HP 26] [F:Fat [[Kobold, A]]|HP 9]",
    "@(Talon) I shoot the elite",
    "=> Through the shoulder. [F:[[Kobold, Elite]]|HP-7]",
    "@(Kobold, Elite) It slashes back",
    "@(Lilith) I wait",
    "=> It falls. [F:[[Kobold, Elite]]|dead]",
  ];

  it("lists the foes a question brings in, at full health", () => {
    expect(fold(log)[0]).toEqual([
      { name: "[[Kobold, Elite]]", current: 26, max: 26 },
      { name: "Fat [[Kobold, A]]", current: 9, max: 9 },
    ]);
  });

  it("moves HP by a delta and keeps the first HP as the max", () => {
    expect(fold(log)[1]).toEqual([{ name: "[[Kobold, Elite]]", current: 19, max: 26 }]);
  });

  it("shows a foe again where it acts, with its current health", () => {
    expect(fold(log)[2]).toEqual([{ name: "[[Kobold, Elite]]", current: 19, max: 26 }]);
  });

  it("lists nothing for an entry that mentions no foe, and records an end state", () => {
    const at = fold(log);
    expect(at[3]).toEqual([{ name: "[[Kobold, Elite]]", current: 19, max: 26, state: "dead" }]);
  });
});

describe("foesInPlay — who is still fighting", () => {
  it("drops foes marked down or at 0 HP, keeping the rest in entry order", () => {
    const segs = groupIntoProse(
      parseLonelog(
        [
          "? Combat. [F:[[Kobold, Elite]]|HP 26] [F:Fat [[Kobold, A]]|HP 9] [F:Thin [[Kobold, A]]|HP 9]",
          "@(Talon) Shoot",
          "=> Down it goes. [F:Fat [[Kobold, A]]|HP-9]",
          "@(Lilith) Strike",
          "=> It runs. [F:Thin [[Kobold, A]]|fled]",
        ].join("\n")
      )
    );
    expect(foesInPlay(segs).map((f) => f.name)).toEqual(["[[Kobold, Elite]]"]);
  });
});

describe("foe conditions — given with +, lifted with -", () => {
  it("tracks a condition from `+surprised` until `-surprised`", () => {
    const at = fold([
      "? Combat begins. [F:[[Kobold, Elite]]|HP 26]",
      "=> The foes are surprised. [F:[[Kobold, Elite]]|+surprised]",
      "@(Kobold, Elite) Shakes it off",
      "=> Its first turn passes. [F:[[Kobold, Elite]]|-surprised]",
    ]);
    expect(at[0]).toEqual([{ name: "[[Kobold, Elite]]", current: 26, max: 26, conditions: ["surprised"] }]);
    expect(at[1]).toEqual([{ name: "[[Kobold, Elite]]", current: 26, max: 26, conditions: [] }]);
  });

  it("doesn't read an HP change as a condition", () => {
    const [first] = fold(["? Fight. [F:Ogre|HP 30]", "=> Hit. [F:Ogre|HP-7]"]);
    expect(first).toEqual([{ name: "Ogre", current: 23, max: 30 }]);
  });
});
