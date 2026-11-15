import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  facetChoices,
  facetValue,
  filterItems,
  pageCount,
  pageOf,
  pagerOptions,
  type PagerItem,
} from "./folder-pager";

const seg = (fn: string, ...args: unknown[]) => ({ fn, args, params: {} });

const items: PagerItem[] = [
  { key: "a", name: "Bag of Holding", data: { rarity: "Uncommon", type: "Wondrous Item" } },
  { key: "b", name: "Flame Tongue", data: { rarity: "Rare", type: "Weapon (Any Sword)" } },
  { key: "c", name: "Ring of Warmth", data: { rarity: "Uncommon", type: "Ring" } },
  { key: "d", name: "Wolf", data: { type: "[[Beast]]", cr: "1/4" } },
  { key: "e", name: "Dire Wolf", data: { type: "[[Beast]]", cr: "1" } },
];

describe("folder pager", () => {
  it("reads its options from the chain, with defaults by view", () => {
    expect(pagerOptions([], "magic")).toEqual({ size: DEFAULT_PAGE_SIZE, facets: ["rarity", "type"], explicit: false });
    expect(pagerOptions([seg("paginate", 5)], "stat").size).toBe(5);
    expect(pagerOptions([seg("paginate", 0)], "stat").size).toBe(0);
    expect(pagerOptions([seg("facets", "school")], "spell")).toMatchObject({ facets: ["school"], explicit: true });
    expect(pagerOptions([], "row").facets).toEqual([]);
  });

  it("reads a field's value without its link brackets", () => {
    expect(facetValue(items[3].data, "type")).toBe("Beast");
    expect(facetValue({ tags: ["[[Fire]]", "Cold"] }, "tags")).toBe("Fire, Cold");
    expect(facetValue({ a: { b: "x" } }, "a.b")).toBe("x");
    expect(facetValue({ type: "Weapon (Any Sword)" }, "type")).toBe("Weapon");
    expect(facetValue({ type: "Medium Fiend (Demon)" }, "type")).toBe("Fiend");
    expect(facetValue({ type: "Small or Medium Humanoid" }, "type")).toBe("Humanoid");
  });

  it("offers each value once, challenge ratings by value", () => {
    expect(facetChoices(items, "rarity")).toEqual(["Rare", "Uncommon"]);
    expect(facetChoices(items, "cr")).toEqual(["1/4", "1"]);
  });

  it("filters by the words of the name and the values chosen", () => {
    expect(filterItems(items, "wolf", {}).map((i) => i.key)).toEqual(["d", "e"]);
    expect(filterItems(items, "", { rarity: "Uncommon" }).map((i) => i.key)).toEqual(["a", "c"]);
    expect(filterItems(items, "ring", { rarity: "Uncommon" }).map((i) => i.key)).toEqual(["c"]);
    expect(filterItems(items, "", { rarity: "" }).length).toBe(5);
  });

  it("pages, keeping the page in range", () => {
    expect(pageCount(25, 12)).toBe(3);
    expect(pageCount(0, 12)).toBe(1);
    expect(pageOf([1, 2, 3, 4, 5], 1, 2)).toEqual({ items: [3, 4], page: 1 });
    expect(pageOf([1, 2, 3, 4, 5], 9, 2)).toEqual({ items: [5], page: 2 });
    expect(pageOf([1, 2, 3], 0, 0)).toEqual({ items: [1, 2, 3], page: 0 });
  });
});
