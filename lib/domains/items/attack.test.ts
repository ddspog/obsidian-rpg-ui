import { describe, expect, it } from "vitest";
import {
  deriveWeaponAttack,
  deriveWeaponAttacks,
  deriveWeaponForm,
  parseWeaponBonus,
  parseWeaponDamage,
  signed,
} from "./attack";
import type { ItemElementData } from "./schema";

const LONGSWORD: ItemElementData = {
  type: "[[Martial]] [[Melee]] Weapons",
  weapon: {
    damage: "1d8/1d10 slashing",
    properties: ["[[Versatile]]"],
  },
};

const LONGBOW: ItemElementData = {
  type: "[[Martial]] [[Ranged]] Weapons",
  weapon: {
    damage: "1d8 piercing",
    properties: ["[[Ammunition]]", "[[Heavy]]", "[[Two-Handed]]"],
  },
};

const RAPIER: ItemElementData = {
  type: "[[Martial]] [[Melee]] Weapons",
  weapon: {
    damage: "1d8 piercing",
    properties: ["[[Finesse]]"],
  },
};

const GLAIVE_PLUS_1: ItemElementData = {
  type: "[[Martial]] [[Melee]] Weapons",
  weapon: {
    damage: "1d10 slashing",
    bonus: "+1",
    properties: ["[[Heavy]]", "[[Reach]]", "[[Two-Handed]]"],
  },
};

describe("parseWeaponDamage", () => {
  it("splits roll and type on the last space", () => {
    expect(parseWeaponDamage("1d8 slashing")).toEqual({ roll: "1d8", type: "slashing" });
    expect(parseWeaponDamage("1d8/1d10 slashing")).toEqual({ roll: "1d8/1d10", type: "slashing" });
    expect(parseWeaponDamage("2d6 fire")).toEqual({ roll: "2d6", type: "fire" });
  });

  it("returns `untyped` when no type token exists", () => {
    expect(parseWeaponDamage("1d8")).toEqual({ roll: "1d8", type: "untyped" });
  });

  it("returns null for empty / non-string input", () => {
    expect(parseWeaponDamage("")).toBeNull();
    expect(parseWeaponDamage(undefined)).toBeNull();
  });
});

describe("deriveWeaponForm", () => {
  it("detects ranged via the Ranged token", () => {
    expect(deriveWeaponForm("[[Martial]] [[Ranged]] Weapons")).toBe("ranged");
    expect(deriveWeaponForm("Simple Ranged Weapons")).toBe("ranged");
  });

  it("defaults to melee otherwise", () => {
    expect(deriveWeaponForm("[[Martial]] [[Melee]] Weapons")).toBe("melee");
    expect(deriveWeaponForm(undefined)).toBe("melee");
    expect(deriveWeaponForm("Something weird")).toBe("melee");
  });
});

describe("parseWeaponBonus", () => {
  it("parses signed bonus strings", () => {
    expect(parseWeaponBonus("+1")).toBe(1);
    expect(parseWeaponBonus("+2")).toBe(2);
    expect(parseWeaponBonus("-1")).toBe(-1);
    expect(parseWeaponBonus(undefined)).toBe(0);
    expect(parseWeaponBonus("")).toBe(0);
  });
});

describe("signed", () => {
  it("renders integers with an explicit sign", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(0)).toBe("+0");
    expect(signed(-2)).toBe("-2");
  });
});

describe("deriveWeaponAttack", () => {
  const strFighter = { str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0, pb: 2 };
  const dexFighter = { str: 1, dex: 4, con: 0, int: 0, wis: 0, cha: 0, pb: 3 };

  it("uses STR for melee weapons", () => {
    const atk = deriveWeaponAttack(LONGSWORD, strFighter)!;
    expect(atk.form).toBe("melee");
    expect(atk.to_hit).toBe("+5 (STR)"); // PB 2 + STR 3
    expect(atk.damage).toEqual({ roll: "1d8/1d10", type: "slashing", bonus: "+3" });
  });

  it("uses DEX for ranged weapons", () => {
    const atk = deriveWeaponAttack(LONGBOW, dexFighter)!;
    expect(atk.form).toBe("ranged");
    expect(atk.to_hit).toBe("+7 (DEX)"); // PB 3 + DEX 4
    expect(atk.damage).toEqual({ roll: "1d8", type: "piercing", bonus: "+4" });
  });

  it("picks max(STR, DEX) for Finesse weapons", () => {
    const strWielder = deriveWeaponAttack(RAPIER, { str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0, pb: 2 })!;
    expect(strWielder.to_hit).toBe("+5 (STR)"); // STR 3 > DEX 1
    const dexWielder = deriveWeaponAttack(RAPIER, { str: 1, dex: 4, con: 0, int: 0, wis: 0, cha: 0, pb: 3 })!;
    expect(dexWielder.to_hit).toBe("+7 (DEX)"); // DEX 4 > STR 1
  });

  it("adds the weapon's magic bonus to both to-hit and damage", () => {
    const atk = deriveWeaponAttack(GLAIVE_PLUS_1, strFighter)!;
    expect(atk.to_hit).toBe("+6 (STR)"); // PB 2 + STR 3 + weapon bonus 1
    expect(atk.damage).toEqual({ roll: "1d10", type: "slashing", bonus: "+4" }); // STR 3 + bonus 1
  });

  it("layers overlay bonuses on top", () => {
    const atk = deriveWeaponAttack(LONGSWORD, strFighter, {
      attackBonus: 2,
      extraDamage: [{ roll: "1d6", type: "fire" }],
    })!;
    expect(atk.to_hit).toBe("+7 (STR)"); // PB 2 + STR 3 + overlay bonus 2
    expect(Array.isArray(atk.damage)).toBe(true);
    const damageList = atk.damage as unknown as Array<{ roll: string; type: string; bonus?: string }>;
    expect(damageList).toEqual([
      { roll: "1d8/1d10", type: "slashing", bonus: "+5" }, // STR 3 + overlay 2
      { roll: "1d6", type: "fire" },
    ]);
  });

  it("returns null for non-weapon items", () => {
    expect(deriveWeaponAttack({ type: "Tool" }, strFighter)).toBeNull();
    expect(deriveWeaponAttack({ weapon: {} }, strFighter)).toBeNull();
  });
});

describe("deriveWeaponAttacks", () => {
  const strFighter = { str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0, pb: 2 };

  it("infers a single one-handed attack for simple weapons", () => {
    const mace: ItemElementData = {
      type: "[[Simple]] [[Melee]] Weapons",
      weapon: { damage: "1d6 bludgeoning" },
    };
    const out = deriveWeaponAttacks(mace, strFighter, undefined, "Mace");
    expect(out).toHaveLength(1);
    expect(out[0].requires).toBe("one_hand");
    expect(out[0].damage).toEqual({ roll: "1d6", type: "bludgeoning", bonus: "+3" });
  });

  it("infers two-handed-only attack from the Two-Handed property", () => {
    const greatsword: ItemElementData = {
      type: "[[Martial]] [[Melee]] Weapons",
      weapon: {
        damage: "2d6 slashing",
        properties: ["[[Heavy]]", "[[Two-Handed]]"],
      },
    };
    const out = deriveWeaponAttacks(greatsword, strFighter, undefined, "Greatsword");
    expect(out).toHaveLength(1);
    expect(out[0].requires).toBe("two_hands");
  });

  it("fans out versatile weapons into 1h + 2h attacks with the right dice", () => {
    const longsword: ItemElementData = {
      type: "[[Martial]] [[Melee]] Weapons",
      weapon: {
        damage: "1d8/1d10 slashing",
        properties: ["[[Versatile]]"],
      },
    };
    const out = deriveWeaponAttacks(longsword, strFighter, undefined, "Longsword");
    expect(out).toHaveLength(2);
    expect(out[0].requires).toBe("one_hand");
    expect(out[0].damage).toEqual({ roll: "1d8", type: "slashing", bonus: "+3" });
    expect(out[1].name).toBe("Two-Handed");
    expect(out[1].requires).toBe("two_hands");
    expect(out[1].damage).toEqual({ roll: "1d10", type: "slashing", bonus: "+3" });
  });

  it("fans out thrown weapons into melee + ranged, keeping STR for thrown", () => {
    const javelin: ItemElementData = {
      type: "[[Simple]] [[Melee]] Weapons",
      weapon: {
        damage: "1d6 piercing",
        properties: ["[[Thrown]]", "([[Range]] 30/120 ft.)"],
      },
    };
    const out = deriveWeaponAttacks(javelin, strFighter, undefined, "Javelin");
    expect(out).toHaveLength(2);
    expect(out[0].form).toBe("melee");
    expect(out[0].damage).toEqual({ roll: "1d6", type: "piercing", bonus: "+3" });
    expect(out[1].name).toBe("Thrown");
    expect(out[1].form).toBe("ranged");
    expect(out[1].range).toBe("30/120 ft.");
    // Thrown keeps STR mod (base type is Melee).
    expect(out[1].damage).toEqual({ roll: "1d6", type: "piercing", bonus: "+3" });
  });

  it("honours an explicit `weapon.attacks:` list when authored", () => {
    const magic: ItemElementData = {
      type: "[[Martial]] [[Melee]] Weapons",
      weapon: {
        attacks: [
          {
            name: "Flame Tongue Strike",
            form: "melee",
            damage: [
              { roll: "1d8", type: "slashing" },
              { roll: "2d6", type: "fire" },
            ],
            requires: "one_hand",
          },
        ],
      },
    };
    const out = deriveWeaponAttacks(magic, strFighter, undefined, "Flame Tongue");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Flame Tongue Strike");
    expect(Array.isArray(out[0].damage)).toBe(true);
  });

  it("folds weapon.bonus into the derived damage", () => {
    const glaivePlus1: ItemElementData = {
      type: "[[Martial]] [[Melee]] Weapons",
      weapon: {
        damage: "1d10 slashing",
        bonus: "+1",
        properties: ["[[Heavy]]", "[[Reach]]", "[[Two-Handed]]"],
      },
    };
    const out = deriveWeaponAttacks(glaivePlus1, strFighter, undefined, "Glaive +1");
    expect(out).toHaveLength(1);
    expect(out[0].requires).toBe("two_hands");
    expect(out[0].to_hit).toBe("+6 (STR)"); // PB 2 + STR 3 + bonus 1
    expect(out[0].damage).toEqual({ roll: "1d10", type: "slashing", bonus: "+4" });
  });

  it("returns empty array for non-weapon items", () => {
    expect(deriveWeaponAttacks({ type: "Tool" }, strFighter)).toEqual([]);
  });
});
