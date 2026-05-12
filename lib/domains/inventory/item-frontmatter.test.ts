import { describe, expect, it } from "vitest";
import { itemTypeBucket, parseItemMetadata, parseWeight } from "./item-frontmatter";

describe("parseWeight", () => {
  it("parses numbers directly", () => {
    expect(parseWeight(3)).toBe(3);
    expect(parseWeight(0.5)).toBe(0.5);
    expect(parseWeight(0)).toBe(0);
  });

  it("parses strings with units", () => {
    expect(parseWeight("3 lb.")).toBe(3);
    expect(parseWeight("0.5lb")).toBe(0.5);
    expect(parseWeight("13 pounds")).toBe(13);
    expect(parseWeight("—")).toBe(0);
    expect(parseWeight("")).toBe(0);
  });

  it("returns 0 for unusable input", () => {
    expect(parseWeight(undefined)).toBe(0);
    expect(parseWeight(null)).toBe(0);
    expect(parseWeight({})).toBe(0);
    expect(parseWeight(Number.NaN)).toBe(0);
  });
});

describe("parseItemMetadata", () => {
  it("extracts all recognised fields from a flat frontmatter", () => {
    const fm = {
      type: "[[Martial]] [[Melee]] Weapons",
      cost: "15 gp",
      weight: "3 lb.",
      damage: "1d8/1d10 slashing",
      properties: ["[[Versatile]]"],
      reference_img: "![[longsword.webp|384]]",
    };
    const meta = parseItemMetadata(fm);
    expect(meta.type).toBe("[[Martial]] [[Melee]] Weapons");
    expect(meta.cost).toBe("15 gp");
    expect(meta.weight).toBe(3);
    expect(meta.damage).toBe("1d8/1d10 slashing");
    expect(meta.properties).toEqual(["[[Versatile]]"]);
    expect(meta.image).toBe("![[longsword.webp|384]]");
  });

  it("handles empty / missing frontmatter", () => {
    expect(parseItemMetadata(undefined).weight).toBe(0);
    expect(parseItemMetadata(null).weight).toBe(0);
    expect(parseItemMetadata({}).weight).toBe(0);
  });

  it("ignores empty strings and empty arrays", () => {
    const meta = parseItemMetadata({
      type: "",
      cost: "",
      properties: [],
    });
    expect(meta.type).toBeUndefined();
    expect(meta.cost).toBeUndefined();
    expect(meta.properties).toBeUndefined();
  });
});

describe("itemTypeBucket", () => {
  it("routes weapon types", () => {
    expect(itemTypeBucket("[[Martial]] [[Melee]] Weapons")).toBe("weapon");
    expect(itemTypeBucket("Simple Weapon")).toBe("weapon");
  });

  it("routes armor and shield types", () => {
    expect(itemTypeBucket("Light Armor")).toBe("armor");
    expect(itemTypeBucket("Heavy Armor")).toBe("armor");
    expect(itemTypeBucket("Shield")).toBe("armor");
  });

  it("returns null for unknown types", () => {
    expect(itemTypeBucket(undefined)).toBeNull();
    expect(itemTypeBucket("")).toBeNull();
    expect(itemTypeBucket("Potion")).toBeNull();
    expect(itemTypeBucket("Adventuring Gear")).toBeNull();
  });
});
