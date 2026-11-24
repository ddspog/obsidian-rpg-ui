import { describe, it, expect } from "vitest";
import { composeMultiattack, parseMultiattack } from "./multiattack";

describe("parseMultiattack", () => {
  it("reads how many attacks, and which", () => {
    expect(parseMultiattack("The Kobold, Tinkerer makes two Tinkerer's Hammer or Parts-Filled Sling attacks.")).toEqual(
      {
        count: 2,
        attacks: ["Tinkerer's Hammer", "Parts-Filled Sling"],
      }
    );
    expect(parseMultiattack("The Humanoid makes two Rapier attacks.")).toEqual({
      count: 2,
      attacks: ["Rapier"],
      picks: [{ name: "Rapier", count: 2 }],
    });
  });

  it("adds up a mix, and knows a Multiattack that names no attacks", () => {
    expect(parseMultiattack("The bear makes one Bite attack and two Claw attacks.")).toEqual({
      count: 3,
      attacks: ["Bite", "Claw"],
      picks: [
        { name: "Bite", count: 1 },
        { name: "Claw", count: 2 },
      ],
    });
    expect(parseMultiattack("The dragon uses its Frightful Presence.")).toBeUndefined();
  });

  it("counts the first of alternatives, not their sum, and offers every attack named", () => {
    expect(parseMultiattack("The knight makes three Greatsword attacks, or it makes four Javelin attacks.")).toEqual({
      count: 3,
      attacks: ["Greatsword", "Javelin"],
      picks: [{ name: "Greatsword", count: 3 }],
    });
  });

  it("keeps a choice clause a free mix (no fixed picks), and the mix fixed across an alternative", () => {
    expect(parseMultiattack("The hobgoblin makes two Longsword or Longbow attacks.")?.picks).toBeUndefined();
    expect(
      parseMultiattack(
        "The bugbear champion makes two Spiked Club attacks and one Shield Smash attack, or it makes three Javelin attacks."
      )
    ).toEqual({
      count: 3,
      attacks: ["Spiked Club", "Shield Smash", "Javelin"],
      picks: [
        { name: "Spiked Club", count: 2 },
        { name: "Shield Smash", count: 1 },
      ],
    });
  });
});

describe("composeMultiattack", () => {
  const sling =
    '@({{actor}}) @[[Kobold, Tinkerer]].action("Parts-Filled Sling") → {{target}}\nd: Attack | d20+4= vs AC {{target_ac}} ->\nd: Damage | 1d4+2=';

  it("writes the opener, each attack at its own target, and the outcome they share", () => {
    const opener = '@({{actor}}) @[[Kobold, Tinkerer]].action("Multiattack")\n=> {{outcome?}}';
    expect(
      composeMultiattack(opener, [
        { template: sling, target: "Jacqui" },
        { template: sling, target: "Talon" },
      ]).split("\n")
    ).toEqual([
      '@({{actor}}) @[[Kobold, Tinkerer]].action("Multiattack")',
      '@({{actor}}) @[[Kobold, Tinkerer]].action("Parts-Filled Sling") → Jacqui',
      "d: Attack | d20+4= vs AC ->",
      "d: Damage | 1d4+2=",
      '@({{actor}}) @[[Kobold, Tinkerer]].action("Parts-Filled Sling") → Talon',
      "d: Attack | d20+4= vs AC ->",
      "d: Damage | 1d4+2=",
      "=> {{outcome?}}",
    ]);
  });

  it("leaves out an attack with no target yet", () => {
    expect(composeMultiattack("@(K) Multiattack", [{ template: sling, target: " " }])).toBe("@(K) Multiattack");
  });
});
