import { describe, expect, it } from "vitest";
import { characterArmorClass } from "../../../vault/tales-of-the-valiant/config/entities/character.defense";

const lookup = {
  $items: {
    "Chain Mail": { armor: { ac: "16", category: "Heavy" } },
    Shield: { armor: { ac: "+2", category: "Shield" } },
    Warhammer: { weapon: { damage: "1d8" } },
    "Ring of Protection": { ac_bonus: 1 },
    Quarterstaff: { weapon: { damage: "1d6" } },
  },
};
const sheet = (items: unknown[]) => ({ stats: { DEX: 12 }, inventory: { items } });

describe("armor class from the loadout", () => {
  it("counts a shield only when it's wielded", () => {
    const worn = { name: "[[Chain Mail]]", slot: "armor" };
    const held = characterArmorClass(
      sheet([worn, { name: "[[Quarterstaff]]", slot: "main_hand" }, { name: "[[Shield]]", slot: "shield" }]),
      lookup,
      {},
      10
    );
    const stowed = characterArmorClass(
      sheet([worn, { name: "[[Quarterstaff]]", slot: "main_hand" }, { name: "[[Shield]]" }]),
      lookup,
      {},
      10
    );
    expect(held).toMatchObject({ armor: 16, shieldBonus: 2 });
    expect(stowed).toMatchObject({ armor: 16, shieldBonus: 0 });
  });
  it("counts a shield in the off hand", () => {
    const ac = characterArmorClass(
      sheet([
        { name: "[[Shield]]", slot: "off_hand" },
        { name: "[[Warhammer]]", slot: "main_hand" },
      ]),
      lookup,
      {},
      10
    );
    expect(ac.shieldBonus).toBe(2);
  });
  it("keeps counting a carried shield on a sheet with no hands assigned", () => {
    expect(characterArmorClass(sheet([{ name: "[[Shield]]" }]), lookup, {}, 10).shieldBonus).toBe(2);
  });
  it("adds an equipped item's bonus and an AC Bonus trait", () => {
    const ac = characterArmorClass(
      sheet([{ name: "[[Ring of Protection]]", slot: "ring" }]),
      lookup,
      { "AC Bonus": ["+1"] },
      10
    );
    expect(ac.bonus).toBe(2);
    const unworn = characterArmorClass(sheet([{ name: "[[Ring of Protection]]" }]), lookup, {}, 10);
    expect(unworn.bonus).toBe(0);
  });
});
