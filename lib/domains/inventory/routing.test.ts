import { describe, expect, it } from "vitest";
import { classifyItem, isContainerEntry } from "./routing";
import type { ItemMetadata } from "./item-frontmatter";
import type { YamlItemEntry } from "./schema";

const emptyMeta = (): ItemMetadata => ({ weight: 0 });

describe("classifyItem", () => {
  it("routes explicit `container: other`", () => {
    const entry: YamlItemEntry = { name: "[[Cart]]", container: "other" };
    expect(classifyItem(entry, emptyMeta())).toBe("other_containers");
  });

  it("routes explicit `container: main`", () => {
    const entry: YamlItemEntry = { name: "[[Pouch]]", container: "main" };
    expect(classifyItem(entry, emptyMeta())).toBe("main_containers");
  });

  it("treats `contents:` as a main container by default", () => {
    const entry: YamlItemEntry = {
      name: "[[Backpack]]",
      contents: [{ name: "[[Rope]]" }],
    };
    expect(classifyItem(entry, emptyMeta())).toBe("main_containers");
  });

  it("honours explicit section override", () => {
    const entry: YamlItemEntry = { name: "Totem", section: "visible" };
    const meta: ItemMetadata = { weight: 0, type: "Wondrous Item" };
    expect(classifyItem(entry, meta)).toBe("visible");
  });

  it("infers weapons and armor from resolved type", () => {
    const weaponMeta: ItemMetadata = {
      weight: 3,
      type: "[[Martial]] [[Melee]] Weapons",
    };
    expect(classifyItem({ name: "[[Longsword]]" }, weaponMeta)).toBe("weapons");

    const armorMeta: ItemMetadata = { weight: 13, type: "Light Armor" };
    expect(classifyItem({ name: "[[Leather]]" }, armorMeta)).toBe("armor");

    const shieldMeta: ItemMetadata = { weight: 6, type: "Shield" };
    expect(classifyItem({ name: "[[Shield]]" }, shieldMeta)).toBe("armor");
  });

  it("falls back to Visible when type is unknown", () => {
    expect(classifyItem({ name: "[[Waterskin]]" }, emptyMeta())).toBe("visible");
    const potionMeta: ItemMetadata = { weight: 0.5, type: "Potion" };
    expect(classifyItem({ name: "[[Healing Potion]]" }, potionMeta)).toBe("visible");
  });

  it("prioritises container placement over inferred type", () => {
    // Even a "weapons"-typed container goes into the main_containers section.
    const entry: YamlItemEntry = {
      name: "[[Weapon Case]]",
      contents: [{ name: "[[Longsword]]" }],
    };
    const meta: ItemMetadata = { weight: 1, type: "Martial Weapons" };
    expect(classifyItem(entry, meta)).toBe("main_containers");
  });
});

describe("isContainerEntry", () => {
  it("is true when `container:` is set", () => {
    expect(isContainerEntry({ name: "X", container: "main" })).toBe(true);
    expect(isContainerEntry({ name: "X", container: "other" })).toBe(true);
  });
  it("is true when `contents:` is non-empty", () => {
    expect(isContainerEntry({ name: "X", contents: [{ name: "Y" }] })).toBe(true);
  });
  it("is false for empty `contents:` without container marker", () => {
    expect(isContainerEntry({ name: "X", contents: [] })).toBe(false);
  });
  it("is false for plain items", () => {
    expect(isContainerEntry({ name: "X" })).toBe(false);
  });
});
