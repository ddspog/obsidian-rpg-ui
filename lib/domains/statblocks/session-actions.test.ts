import { describe, it, expect } from "vitest";
import { statActions } from "./session-actions";

describe("statActions — a creature's statblock as cards", () => {
  it("rolls an attack from its tier's hit and damage", () => {
    const [a] = statActions([
      {
        name: "Mining Pick",
        type: "action",
        text: "_Melee Weapon Attack:_ +5 to hit, reach 5 ft., one target. _Hit:_ 6 (1d6 + 3) piercing damage.",
        params: { hit: 5, reach: "5 ft.", damage: "6 (1d6 + 3)" },
      },
    ]);
    expect(a).toEqual({
      name: "Mining Pick",
      bucket: "attack",
      hit: "5",
      damage: "6 (1d6 + 3) piercing",
      range: "reach 5 ft.",
    });
  });

  it("reads a forced save off the text", () => {
    const [a] = statActions([
      {
        name: "Lantern Splash",
        type: "action",
        text: "Each creature must make a DC 12 Dexterity saving throw, taking 5 (2d4) fire damage.",
        params: {},
      },
    ]);
    expect(a).toMatchObject({ name: "Lantern Splash", bucket: "attack", save: "DEX 12" });
  });

  it("keeps an action with nothing to roll, and drops passive traits", () => {
    const actions = statActions([
      { name: "Multiattack", type: "action", text: "The kobold makes two attacks.", params: {} },
      { name: "Pack Tactics", type: "trait", text: "Advantage when an ally is near.", params: {} },
    ]);
    expect(actions).toEqual([{ name: "Multiattack", bucket: "action" }]);
  });
});
