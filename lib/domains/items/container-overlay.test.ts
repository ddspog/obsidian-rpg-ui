import { describe, it, expect } from "vitest";
import type { ItemContainerData, ItemElementData, ItemMagicData } from "./schema";
import {
  extractItemContainerBlocks,
  parseItemContainer,
} from "./schema";
import {
  resolveContainer,
  type ContainerResolverLookups,
} from "./container-overlay";

const CHEST: ItemElementData = {
  type: "Adventuring Gear (Container)",
  cost: "25 gp",
  weight: "25 lb.",
  desc: "A lockable wooden chest.",
  container: { weight_cap: "300 lb." },
};

const SACK: ItemElementData = {
  type: "Adventuring Gear (Container)",
  cost: "1 sp",
  weight: "0.5 lb.",
  container: { weight_cap: "30 lb." },
};

const BAG_OF_HOLDING: ItemMagicData = {
  name: "Bag of Holding",
  rarity: "Uncommon",
  cost: "4,000 gp",
  text: "Whatever is placed inside weighs only a fraction…",
  traits: { "Weight Reduction.": true as unknown as string[] },
};

const LOOKUPS: ContainerResolverLookups = {
  elements: { Chest: CHEST, Sack: SACK },
  magic: { "Bag of Holding": BAG_OF_HOLDING },
};

describe("parseItemContainer / extractItemContainerBlocks", () => {
  it("parses the full body with sections", () => {
    const yaml = `
name: Guild Chest
base: "[[Chest]]"
sections:
  - name: Common Supplies
    items:
      - { name: "[[Rope (50 feet)]]", qty: 2 }
      - "[[Tinderbox]]"
  - name: Trade Goods
    items:
      - { name: "[[Silk Bolt]]", qty: 5 }
`;
    const out = parseItemContainer(yaml);
    expect(out?.name).toBe("Guild Chest");
    expect(out?.sections).toHaveLength(2);
    expect(out?.sections?.[0].items?.[0].name).toBe("[[Rope (50 feet)]]");
    expect(out?.sections?.[0].items?.[0].qty).toBe(2);
  });

  it("extracts multiple container fences from one doc and returns the full list", () => {
    const md = [
      "```rpg item.container",
      "name: A",
      "base: \"[[Chest]]\"",
      "```",
      "",
      "```rpg item.container",
      "name: B",
      "base: \"[[Sack]]\"",
      "```",
    ].join("\n");
    const blocks = extractItemContainerBlocks(md);
    expect(blocks.map((b) => b.name)).toEqual(["A", "B"]);
  });
});

describe("resolveContainer", () => {
  it("returns null when the base element can't be found", () => {
    const c: ItemContainerData = { base: "[[Nope]]" };
    expect(resolveContainer(c, LOOKUPS)).toBeNull();
  });

  it("composes base + magic — rarity / cost lift to the effective element, traits merge", () => {
    const c: ItemContainerData = {
      name: "Kowyn's Bag",
      base: "[[Sack]]",
      magic: ["[[Bag of Holding]]"],
      sections: [{ name: "Party", items: [{ name: "[[Potion of Healing]]" }] }],
    };
    const r = resolveContainer(c, LOOKUPS);
    expect(r).not.toBeNull();
    expect(r!.effectiveElement.rarity).toBe("Uncommon");
    expect(r!.effectiveElement.cost).toBe("4,000 gp");
    // Boolean trait flag normalises to a single bare-flag entry so the
    // trait renders as "Weight Reduction." without a parens value list.
    expect(r!.traits["Weight Reduction."]).toEqual([""]);
    expect(r!.magicFeatureSources).toEqual(["Bag of Holding"]);
    expect(r!.magicTexts[0]).toMatch(/weighs only a fraction/);
    expect(r!.sections).toHaveLength(1);
    expect(r!.sections[0].name).toBe("Party");
  });

  it("flattens `items:` body into a trailing unnamed section", () => {
    const c: ItemContainerData = {
      base: "[[Chest]]",
      items: [{ name: "[[Rope (50 feet)]]", qty: 3 }],
    };
    const r = resolveContainer(c, LOOKUPS);
    expect(r!.sections).toHaveLength(1);
    expect(r!.sections[0].name).toBeUndefined();
    expect(r!.sections[0].items?.[0].qty).toBe(3);
  });

  it("falls back to the container stem when no display name is authored", () => {
    const c: ItemContainerData = { base: "[[Chest]]" };
    const r = resolveContainer(c, LOOKUPS, "Guild Chest");
    expect(r!.displayName).toBe("Guild Chest");
  });
});
