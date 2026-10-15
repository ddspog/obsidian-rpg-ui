import { describe, it, expect } from "vitest";
import { adviseRolls, durationOf, readConditionRules, withAdvice, type ConditionEffects } from "./roll-advice";

// As the Tales of the Valiant condition pages word them.
const RULES: Record<string, string[]> = {
  blinded: [
    "A blinded creature can’t see and automatically fails any ability check that requires sight.",
    "Attack rolls against a blinded creature have [[advantage]], and a blinded creature’s attack rolls have [[Advantage|disadvantage]].",
  ],
  prone: [
    "The creature has disadvantage on attack rolls.",
    "An attack roll against a prone creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.",
  ],
  restrained: [
    "Attack rolls against a restrained creature have advantage, and a restrained creature’s attack rolls have disadvantage.",
    "The creature has disadvantage on Dexterity saves.",
  ],
  stunned: [
    "The creature automatically fails Strength and Dexterity saves.",
    "Attack rolls against a stunned creature have advantage.",
  ],
  invisible: [
    "Attack rolls against an invisible creature have disadvantage, and an invisible creature’s attack rolls have advantage.",
  ],
  poisoned: ["A poisoned creature has disadvantage on attack rolls and ability checks."],
};
const effects: Record<string, ConditionEffects> = Object.fromEntries(
  Object.entries(RULES).map(([k, r]) => [k, readConditionRules(r)])
);

describe("readConditionRules", () => {
  it("reads what a condition does to attacks and saves", () => {
    expect(effects.blinded).toEqual({ attackedWith: "advantage", attacksWith: "disadvantage" });
    expect(effects.prone).toEqual({ closeOnly: true, attacksWith: "disadvantage" });
    expect(effects.restrained).toEqual({
      attackedWith: "advantage",
      attacksWith: "disadvantage",
      saveDisadvantage: ["DEX"],
    });
    expect(effects.stunned).toEqual({ attackedWith: "advantage", failsSaves: ["STR", "DEX"] });
    expect(effects.invisible).toEqual({ attackedWith: "disadvantage", attacksWith: "advantage" });
    expect(effects.poisoned).toEqual({ attacksWith: "disadvantage" });
  });
});

describe("adviseRolls", () => {
  const on = (who: Record<string, string[]>) => (name: string) => who[name] ?? [];
  const base = { effectsOf: (c: string) => effects[c], actor: "Kowyn", target: "Kobold, Elite" };

  it("gives an attack on a blinded target advantage — and leaves its STR save alone", () => {
    expect(
      adviseRolls({
        ...base,
        attack: true,
        save: { ability: "STR", by: "Kobold, Elite" },
        conditionsOf: on({ "Kobold, Elite": ["blinded"] }),
      })
    ).toEqual([{ roll: "Attack", verdict: "advantage", why: "Kobold, Elite is blinded" }]);
  });

  it("fails a stunned target's DEX save, and cancels advantage with disadvantage", () => {
    expect(
      adviseRolls({
        ...base,
        attack: false,
        save: { ability: "DEX", by: "Kobold, Elite" },
        conditionsOf: on({ "Kobold, Elite": ["stunned"] }),
      })
    ).toEqual([{ roll: "DEX save", verdict: "fails", why: "Kobold, Elite is stunned" }]);
    const both = adviseRolls({
      ...base,
      attack: true,
      conditionsOf: on({ Kowyn: ["poisoned"], "Kobold, Elite": ["blinded"] }),
    });
    expect(both[0].verdict).toBe("cancels");
  });

  it("reads a prone target by distance — advantage within 5 ft, disadvantage beyond", () => {
    const prone = on({ "Kobold, Elite": ["prone"] });
    expect(adviseRolls({ ...base, attack: true, conditionsOf: prone, within5: true })[0].verdict).toBe("advantage");
    expect(adviseRolls({ ...base, attack: true, conditionsOf: prone, within5: false })[0].verdict).toBe("disadvantage");
  });
});

describe("durationOf", () => {
  it("reads a condition that ends with its bearer's next turn", () => {
    expect(durationOf("blinded until end of its next turn on failed save")).toBe("end-of-next-turn");
    expect(durationOf("pinned to a wall")).toBeUndefined();
  });
});

describe("withAdvice", () => {
  const bolt = [
    '@({{actor}}) @[[Jacqui Ilitul|Jacqui]].action("Luminous Bolt ᴷ") → {{target}}',
    "d: Attack | d20+6= vs AC {{target_ac}} ->",
    "d: Radiant damage | 1d6=",
    "d: CON save | d20= vs DC 14 ->",
  ].join("\n");

  it("writes disadvantage into the attack roll — both dice, the lower kept", () => {
    const out = withAdvice(bolt, [
      { roll: "Attack", verdict: "disadvantage", why: "Kobold, Elite is prone, out past 5 ft" },
    ]);
    expect(out.split("\n")[1]).toBe("d: Attack | 2d20kl1+6= vs AC {{target_ac}} ->");
    expect(out.split("\n")[3]).toBe("d: CON save | d20= vs DC 14 ->");
  });

  it("writes advantage, and a save that fails without a roll", () => {
    const out = withAdvice(bolt, [
      { roll: "Attack", verdict: "advantage", why: "Kobold, Elite is stunned" },
      { roll: "CON save", verdict: "fails", why: "x" },
    ]);
    expect(out.split("\n")[1]).toBe("d: Attack | 2d20kh1+6= vs AC {{target_ac}} ->");
    expect(out.split("\n")[3]).toBe("d: CON save | d20= vs DC 14 -> Failure");
  });

  it("leaves the plain d20 when advantage and disadvantage cancel", () => {
    expect(withAdvice(bolt, [{ roll: "Attack", verdict: "cancels", why: "x" }])).toBe(bolt);
  });
});
