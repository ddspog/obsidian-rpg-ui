import { describe, expect, it } from "vitest";
import type { NewInventoryBlock } from "./schema";
import { resolveInventory, type LookupFn } from "./resolver";

const COMPENDIUM: Record<string, Record<string, unknown>> = {
  Longsword: {
    type: "[[Martial]] [[Melee]] Weapons",
    weight: "3 lb.",
    damage: "1d8/1d10 slashing",
    cost: "15 gp",
  },
  Leather: {
    type: "Light Armor",
    weight: "10 lb.",
    ac: "11 + DEX",
  },
  Shield: {
    type: "Shield",
    weight: "6 lb.",
    ac: "+2",
  },
  Backpack: {
    type: "Adventuring Gear",
    weight: "5 lb.",
    container_capacity: 30,
  },
  Rope: { type: "Adventuring Gear", weight: "10 lb." },
  Rations: { type: "Adventuring Gear", weight: "2 lb." },
  Waterskin: { type: "Adventuring Gear", weight: "5 lb." },
  Dagger: { type: "Simple Melee Weapons", weight: "1 lb." },
  Quiver: {
    type: "Adventuring Gear (Container)",
    weight: "1 lb.",
    container: { ammo_cap: 20, for_ammo: ["[[Arrows]]", "[[Crossbow Bolts]]"] },
  },
  Pouch: {
    type: "Adventuring Gear (Container)",
    weight: "1 lb.",
    container: {
      for_ammo: ["[[Sling Bullets]]", "[[Blowgun Needles]]"],
      ammo_cap: { "Sling Bullets": 20, "Blowgun Needles": 50 },
    },
  },
  Arrows: { type: "Ammunition", weight: "0.05 lb." },
  "Sling Bullets": { type: "Ammunition", weight: "0.075 lb." },
  "Blowgun Needles": { type: "Ammunition", weight: "0.02 lb." },
};

const lookup: LookupFn = (target) => COMPENDIUM[target];

describe("resolveInventory", () => {
  it("routes items into fixed sections with correct weight totals", () => {
    const block: NewInventoryBlock = {
      items: [
        { name: "[[Longsword]]" },
        { name: "[[Leather]]", equipped: true },
        { name: "[[Shield]]", slot: "off_hand" },
        { name: "[[Waterskin]]" },
        {
          name: "[[Backpack]]",
          container: "main",
          contents: [{ name: "[[Rope]]" }, { name: "[[Rations]]", qty: 5 }],
        },
      ],
    };

    const result = resolveInventory({ block, lookup, strength: 10 });
    const byId = Object.fromEntries(result.sections.map((s) => [s.id, s]));

    expect(byId.weapons.items.map((i) => i.label)).toEqual(["Longsword"]);
    expect(byId.armor.items.map((i) => i.label)).toEqual(["Leather", "Shield"]);
    expect(byId.visible.items.map((i) => i.label)).toEqual(["Waterskin"]);
    expect(byId.main_containers.items.map((i) => i.label)).toEqual(["Backpack"]);
    expect(byId.other_containers.items).toEqual([]);

    // 3 + 10 + 6 + 5 + (5 backpack + 10 rope + 2*5 rations = 25) = 49 lb
    expect(result.totalWeight).toBe(49);
    expect(result.sections.find((s) => s.id === "main_containers")!.totalWeight).toBe(25);
  });

  it("applies qty to total weight", () => {
    const block: NewInventoryBlock = {
      items: [{ name: "[[Dagger]]", qty: 3 }],
    };
    const result = resolveInventory({ block, lookup, strength: 10 });
    expect(result.sections.find((s) => s.id === "weapons")!.totalWeight).toBe(3);
    expect(result.sections.find((s) => s.id === "weapons")!.items[0].qty).toBe(3);
  });

  it("classifies the load given a STR threshold", () => {
    const block: NewInventoryBlock = {
      items: [{ name: "[[Rope]]", qty: 10 }], // 100 lb
    };
    const light = resolveInventory({ block, lookup, strength: 20 }); // 100/200 carry
    const heavy = resolveInventory({ block, lookup, strength: 8 }); // 100/120 carry
    expect(light.load).toBe("free");
    expect(heavy.load).toBe("heavy");
  });

  it("preserves wikilink target and label", () => {
    const block: NewInventoryBlock = {
      items: [{ name: "[[Longsword|Long Sword]]" }],
    };
    const result = resolveInventory({ block, lookup, strength: 10 });
    const weapons = result.sections.find((s) => s.id === "weapons")!;
    expect(weapons.items[0].label).toBe("Long Sword");
    expect(weapons.items[0].linkTarget).toBe("Longsword");
    expect(weapons.items[0].link).toBe("[[Longsword|Long Sword]]");
  });

  it("handles unresolved wikilinks gracefully", () => {
    const block: NewInventoryBlock = {
      items: [{ name: "[[Mystery Item]]" }],
    };
    const result = resolveInventory({ block, lookup, strength: 10 });
    const visible = result.sections.find((s) => s.id === "visible")!;
    expect(visible.items).toHaveLength(1);
    expect(visible.items[0].label).toBe("Mystery Item");
    expect(visible.items[0].meta.weight).toBe(0);
  });

  it("treats `equipped: true` and `slot` as equivalent for equipped flag", () => {
    const block: NewInventoryBlock = {
      items: [
        { name: "[[Longsword]]", slot: "main_hand" },
        { name: "[[Dagger]]", equipped: true },
        { name: "[[Shield]]" },
      ],
    };
    const result = resolveInventory({ block, lookup, strength: 10 });
    const weapons = result.sections.find((s) => s.id === "weapons")!;
    const armor = result.sections.find((s) => s.id === "armor")!;
    expect(weapons.items.find((i) => i.label === "Longsword")!.equipped).toBe(true);
    expect(weapons.items.find((i) => i.label === "Dagger")!.equipped).toBe(true);
    // Shields are equipped-by-ownership: the resolver always treats a
    // shield-kind entry as equipped so its AC and trait contributions
    // reach the character sheet without a manual toggle.
    expect(armor.items.find((i) => i.label === "Shield")!.equipped).toBe(true);
  });

  describe("ammo-tracking containers", () => {
    it("fires ammo-tracking mode and exposes the numeric cap", () => {
      const block: NewInventoryBlock = {
        items: [{ name: "[[Quiver]]", contents: [{ name: "[[Arrows]]", qty: 15 }] }],
      };
      const result = resolveInventory({ block, lookup, strength: 10 });
      const weapons = result.sections.find((s) => s.id === "weapons")!;
      const quiver = weapons.items.find((i) => i.label === "Quiver")!;
      expect(quiver.isAmmoTracking).toBe(true);
      expect(quiver.ammoCarried).toBe(15);
      expect(quiver.ammoCap).toBe(20);
    });

    it("picks the per-type cap based on loaded ammo", () => {
      const sling: NewInventoryBlock = {
        items: [{ name: "[[Pouch]]", contents: [{ name: "[[Sling Bullets]]", qty: 12 }] }],
      };
      const needles: NewInventoryBlock = {
        items: [{ name: "[[Pouch]]", contents: [{ name: "[[Blowgun Needles]]", qty: 30 }] }],
      };
      const slingResult = resolveInventory({ block: sling, lookup, strength: 10 });
      const needleResult = resolveInventory({ block: needles, lookup, strength: 10 });
      const slingPouch = slingResult.sections.find((s) => s.id === "weapons")!.items[0];
      const needlePouch = needleResult.sections.find((s) => s.id === "weapons")!.items[0];

      expect(slingPouch.ammoCarried).toBe(12);
      expect(slingPouch.ammoCap).toBe(20);
      expect(needlePouch.ammoCarried).toBe(30);
      expect(needlePouch.ammoCap).toBe(50);
    });

    it("leaves ammoCap undefined when not in ammo-tracking mode", () => {
      const block: NewInventoryBlock = {
        items: [{ name: "[[Pouch]]", contents: [{ name: "[[Rope]]" }] }],
      };
      const result = resolveInventory({ block, lookup, strength: 10 });
      const pouch = result.sections.find((s) => s.id === "main_containers")!.items[0];
      expect(pouch.isAmmoTracking).toBe(false);
      expect(pouch.ammoCap).toBeUndefined();
    });
  });
});
