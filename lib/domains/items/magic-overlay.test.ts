import { describe, it, expect } from "vitest";
import type { ItemElementData, ItemMagicData, ItemPersonalData } from "./schema";
import { resolvePersonalItem, type PersonalResolverLookups } from "./magic-overlay";

const SHIELD: ItemElementData = {
  type: "[[Shields]]",
  cost: "10 gp",
  weight: "6 lb.",
  armor: { ac: "+2", category: "Shield" },
};

const GLAIVE: ItemElementData = {
  type: "[[Martial]] [[Melee]] Weapons",
  cost: "20 gp",
  weight: "6 lb.",
  weapon: {
    damage: "1d10 slashing",
    properties: ["[[Heavy]]", "[[Reach]]", "[[Two-Handed]]"],
  },
};

const SENTINEL_SHIELD: ItemMagicData = {
  name: "Sentinel Shield",
  rarity: "Uncommon",
  applies_to: { kinds: ["shield"] },
  traits: {
    "Initiative A.": ["Sentinel Shield"],
    "Skill A. Perception": ["Sentinel Shield"],
  },
};

const WEAPON_PLUS_N: ItemMagicData = {
  name: "Weapon, +1, +2 or +3",
  applies_to: { kinds: ["weapon"] },
  variants: {
    "+1": { rarity: "Uncommon", cost: "1,000 gp + base", bonus: "+1" },
    "+2": { rarity: "Rare", cost: "5,000 gp + base", bonus: "+2" },
    "+3": { rarity: "Very Rare", cost: "15,000 gp + base", bonus: "+3" },
  },
};

const LOOKUPS = {
  elements: { Shield: SHIELD, Glaive: GLAIVE },
  magic: { "Sentinel Shield": SENTINEL_SHIELD, "Weapon, +1, +2 or +3": WEAPON_PLUS_N },
};

describe("resolvePersonalItem", () => {
  it("composes a shield + Sentinel Shield magic", () => {
    const personal: ItemPersonalData = {
      name: "Eyeshield",
      base: "[[Shield]]",
      magic: ["[[Sentinel Shield]]"],
      attuned: true,
    };
    const r = resolvePersonalItem(personal, LOOKUPS);
    expect(r).not.toBeNull();
    expect(r!.displayName).toBe("Eyeshield");
    expect(r!.attuned).toBe(true);
    expect(r!.effectiveElement.armor?.ac).toBe("+2");
    expect(r!.traits["Initiative A."]).toEqual(["Sentinel Shield"]);
    expect(r!.traits["Skill A. Perception"]).toEqual(["Sentinel Shield"]);
    expect(r!.magicFeatureSources).toEqual(["Sentinel Shield"]);
  });

  it("applies a weapon variant's bonus onto base damage", () => {
    const personal: ItemPersonalData = {
      name: "Druid Glaive",
      base: "[[Glaive]]",
      magic: ["[[Weapon, +1, +2 or +3]]"],
      variants: { "Weapon, +1, +2 or +3": "+1" },
    };
    const r = resolvePersonalItem(personal, LOOKUPS);
    expect(r).not.toBeNull();
    // Bonus is stamped onto the effective element's weapon.bonus so
    // `deriveWeaponAttack`'s existing `parseWeaponBonus` path picks it
    // up. Overlay is left empty to avoid double-counting.
    expect(r!.effectiveElement.weapon?.bonus).toBe("+1");
    expect(r!.weaponOverlay.attackBonus).toBeUndefined();
    expect(r!.effectiveElement.rarity).toBe("Uncommon");
    expect(r!.effectiveElement.cost).toBe("1,000 gp + base");
  });

  it("stacks numeric bonuses across multiple magic templates", () => {
    const stacker: ItemMagicData = {
      name: "Blessing",
      applies_to: { kinds: ["weapon"] },
      bonus: "+1",
    };
    const lookups = {
      elements: { Glaive: GLAIVE },
      magic: { "Weapon, +1, +2 or +3": WEAPON_PLUS_N, Blessing: stacker },
    };
    const personal: ItemPersonalData = {
      name: "Stacked",
      base: "[[Glaive]]",
      magic: ["[[Weapon, +1, +2 or +3]]", "[[Blessing]]"],
      variants: { "Weapon, +1, +2 or +3": "+2" },
    };
    const r = resolvePersonalItem(personal, lookups);
    expect(r).not.toBeNull();
    // +2 from variant, +1 from Blessing = +3 composed onto weapon.bonus.
    expect(r!.effectiveElement.weapon?.bonus).toBe("+3");
    expect(r!.weaponOverlay.attackBonus).toBeUndefined();
  });

  it("returns null when the base element can't be resolved", () => {
    const personal: ItemPersonalData = {
      name: "Ghost",
      base: "[[Nonexistent]]",
      magic: ["[[Sentinel Shield]]"],
    };
    const r = resolvePersonalItem(personal, LOOKUPS);
    expect(r).toBeNull();
  });

  it("merges variant traits on top of template traits", () => {
    const lookups = {
      elements: { Glaive: GLAIVE },
      magic: {
        "Focus Weapon": {
          name: "Focus Weapon",
          applies_to: { kinds: ["weapon"] as const },
          traits: { "Skill P. Arcana": ["Focus Weapon"] },
          variants: {
            attuned: {
              traits: { "Initiative B.": ["+1"] },
            },
          },
        } as ItemMagicData,
      },
    };
    const personal: ItemPersonalData = {
      name: "Focus Glaive",
      base: "[[Glaive]]",
      magic: ["[[Focus Weapon]]"],
      variants: { "Focus Weapon": "attuned" },
    };
    const r = resolvePersonalItem(personal, lookups);
    expect(r).not.toBeNull();
    expect(r!.traits["Skill P. Arcana"]).toEqual(["Focus Weapon"]);
    expect(r!.traits["Initiative B."]).toEqual(["+1"]);
  });

  it("collects magic template text bodies for the personal card to render", () => {
    const lookups: PersonalResolverLookups = {
      elements: { Shield: { type: "Armor", armor: { ac: "+2" } } },
      magic: {
        "Sentinel Shield": {
          name: "Sentinel Shield",
          text: "While holding this shield, you have advantage on initiative rolls.",
        } as ItemMagicData,
      },
    };
    const personal: ItemPersonalData = {
      base: "[[Shield]]",
      magic: ["[[Sentinel Shield]]"],
    };
    const r = resolvePersonalItem(personal, lookups);
    expect(r!.magicTexts).toEqual([
      "While holding this shield, you have advantage on initiative rolls.",
    ]);
  });

  it("lets the personal's rarity override any inherited variant rarity", () => {
    const lookups: PersonalResolverLookups = {
      elements: { Shortsword: { type: "Weapon", weapon: { damage: "1d6 piercing" } } },
      magic: {
        "Weapon, +1, +2 or +3": {
          name: "Weapon, +1, +2 or +3",
          variants: { "+1": { rarity: "Uncommon", bonus: "+1" } },
        } as ItemMagicData,
      },
    };
    const personal: ItemPersonalData = {
      base: "[[Shortsword]]",
      magic: ["[[Weapon, +1, +2 or +3]]"],
      variants: { "Weapon, +1, +2 or +3": "+1" },
      rarity: "Very Rare",
    };
    const r = resolvePersonalItem(personal, lookups);
    expect(r!.effectiveElement.rarity).toBe("Very Rare");
  });
});
