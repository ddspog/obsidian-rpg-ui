import { describe, it, expect } from "vitest";
import type { SessionFeatureCard } from "./card-types";
import { addToExpression, modifyCard, readModifiers, toggleKey, touches } from "./modifiers";

const card = (c: Partial<SessionFeatureCard>): SessionFeatureCard =>
  ({
    id: "x",
    name: "Quarterstaff",
    bucket: "attack",
    logTemplate:
      "@({{actor}}) Quarterstaff → {{target}}\nd: Attack | d20+1= vs AC {{target_ac}} ->\nd: Bludgeoning damage | 1d6-1=",
    actor: "Kowyn",
    source: "s",
    origin: "weapon",
    attackForm: "melee",
    ...c,
  }) as SessionFeatureCard;

describe("modifiers", () => {
  it("adds to an expression — folded into a flat bonus, dice appended", () => {
    expect(addToExpression("1d6-1", 2)).toBe("1d6+1");
    expect(addToExpression("1d8+4", "+2")).toBe("1d8+6");
    expect(addToExpression("1d8", 2)).toBe("1d8+2");
    expect(addToExpression("1d8+4", "1d4")).toBe("1d8+4+1d4");
    expect(addToExpression("d20+6", 2)).toBe("d20+8");
  });

  it("knows which cards a modifier touches", () => {
    expect(touches(card({}), "melee attack")).toBe(true);
    expect(touches(card({}), "ranged attack")).toBe(false);
    expect(touches(card({ attackForm: "ranged" }), "ranged attack")).toBe(true);
    expect(touches(card({ name: "Icicle Javelin º", origin: "spell", attackForm: "spell" }), "spell")).toBe(true);
    expect(touches(card({}), "Quarterstaff")).toBe(true);
  });

  it("writes damage and to-hit into the rolls, and says who changed what", () => {
    const mods = readModifiers([{ on: "melee attack", damage: "+2", to_hit: 1 }]);
    const out = modifyCard(card({}), [{ from: "Rage", modifies: mods }]);
    expect(out.logTemplate).toContain("d20+2=");
    expect(out.logTemplate).toContain("1d6+1=");
    expect(out.modifiedBy).toEqual([{ from: "Rage", text: "+2 damage, +1 to hit" }]);
    expect(modifyCard(card({ attackForm: "ranged" }), [{ from: "Rage", modifies: mods }])).toEqual(
      card({ attackForm: "ranged" })
    );
  });

  it("hands advantage to the roll advice — attacks, and saves by ability", () => {
    const attack = modifyCard(card({}), [
      { from: "Reckless", modifies: readModifiers({ on: "attack", advantage: true }) },
    ]);
    expect(attack.grants?.attack?.advantage).toEqual(["Reckless"]);
    const save = card({
      name: "Thunderwave",
      bucket: "attack",
      logTemplate: "@({{actor}}) Thunderwave\nd: CON save | d20= vs DC 14 ->",
    });
    const r = modifyCard(save, [{ from: "Rage", modifies: readModifiers({ on: "save", advantage: "STR, CON" }) }]);
    expect(r.grants?.saves?.advantage).toEqual({ STR: ["Rage"], CON: ["Rage"] });
  });
});

describe("toggleKey", () => {
  it("keys a toggle by its character and name, without a source mark", () => {
    expect(toggleKey("Kowyn", "Rage ᴷ")).toBe("kowyn|rage");
  });
});
