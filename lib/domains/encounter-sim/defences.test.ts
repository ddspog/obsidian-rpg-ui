import { describe, expect, it } from "vitest";
import { applyDefences, defencesOf, immuneTo } from "./defences";

describe("defencesOf", () => {
  it("reads types and conditions from the lines", () => {
    expect(defencesOf({ immune: "poison | poisoned", vulnerable: "fire" }, () => undefined)).toEqual({
      resistant: [],
      immune: ["poison"],
      vulnerable: ["fire"],
      conditionImmune: ["poisoned"],
      conditionResistant: [],
    });
  });

  it("reads nonmagical weapon damage as one defence", () => {
    const d = defencesOf(
      { resistant: "bludgeoning, piercing, and slashing damage from nonmagical attacks" },
      () => undefined
    );
    expect(d.resistant).toEqual(["nonmagical"]);
    expect(applyDefences(10, "slashing", d, true)).toBe(5);
    expect(applyDefences(10, "slashing", d, false)).toBe(10);
  });

  it("keeps a nonmagical defence to the weapon types it names", () => {
    const d = defencesOf({ resistant: "fire, piercing damage from nonmagical attacks" }, () => undefined);
    expect(d.resistant).toEqual(["fire", "nonmagical-piercing"]);
    expect(applyDefences(10, "piercing", d, true)).toBe(5);
    expect(applyDefences(10, "slashing", d, true)).toBe(10);
    expect(applyDefences(10, "piercing", d, false)).toBe(10);
    const t = defencesOf(
      { resistant: "Thorn Hide" },
      () => "It is resistant to piercing damage from nonmagical attacks."
    );
    expect(t.resistant).toEqual(["nonmagical-piercing"]);
  });

  it("reads what a named trait grants from its text", () => {
    const text: Record<string, string> = {
      "Construct Resilience":
        "The animated artillery is immune to poison and psychic damage, and it is immune to exhaustion and the charmed, frightened, paralyzed, petrified, and poisoned conditions.",
      "Monstrosity Resilience": "The griffon is resistant to exhaustion and to the frightened condition.",
    };
    const construct = defencesOf({ immune: "Construct Resilience" }, (n) => text[n]);
    expect(construct.immune).toEqual(["poison", "psychic"]);
    expect(construct.conditionImmune).toEqual(
      expect.arrayContaining(["charmed", "frightened", "paralyzed", "poisoned"])
    );
    const griffon = defencesOf({ resistant: "Monstrosity Resilience" }, (n) => text[n]);
    expect(griffon.resistant).toEqual([]);
    expect(griffon.conditionResistant).toEqual(["exhaustion", "frightened"]);
    expect(immuneTo(construct, "paralyzed")).toBe(true);
  });

  it("applies immunity, resistance and vulnerability", () => {
    const d = {
      resistant: ["cold"],
      immune: ["fire"],
      vulnerable: ["radiant"],
      conditionImmune: [],
      conditionResistant: [],
    };
    expect(applyDefences(9, "cold", d, false)).toBe(4);
    expect(applyDefences(9, "fire", d, false)).toBe(0);
    expect(applyDefences(9, "radiant", d, false)).toBe(18);
    expect(applyDefences(9, "acid", d, false)).toBe(9);
    expect(applyDefences(9, undefined, d, false)).toBe(9);
  });
});
