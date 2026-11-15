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
  countText,
  DEFAULT_PHONE_PAGE_SIZE,
  fieldLabel,
  pageNames,
  pagerFields,
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
    expect(pagerOptions([], "magic")).toEqual({
      size: DEFAULT_PAGE_SIZE,
      facets: ["rarity", "type"],
      explicit: false,
      noun: ["item", "items"],
    });
    expect(pagerOptions([], "stat", true).size).toBe(DEFAULT_PHONE_PAGE_SIZE);
    expect(pagerOptions([seg("paginate", 4)], "stat", true).size).toBe(4);
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

describe("pagerFields", () => {
  const fence = (entity: string, block: string, body: Record<string, unknown>, start: number, end: number) => ({
    entity,
    block,
    body,
    start,
    end,
  });

  it("reads the note's own block, not a side box after it", () => {
    const fences = [
      fence("stat", "monster", { type: "Tiny Beast", cr: "1/8" }, 0, 100),
      fence("rule", "side", { type: "rules", title: "Variant" }, 200, 300),
    ];
    expect(pagerFields(fences, { source: "MV" })).toEqual({ source: "MV", type: "Tiny Beast", cr: "1/8" });
  });

  it("falls back when the note has only rule blocks", () => {
    const fences = [fence("rule", "content", { circle: "x" }, 0, 10)];
    expect(pagerFields(fences, {}, { circle: "3rd-Circle" })).toEqual({ circle: "3rd-Circle" });
  });
});

describe("pager words", () => {
  it("names fields as a reader knows them", () => {
    expect(fieldLabel("cr")).toBe("CR");
    expect(fieldLabel("rarity")).toBe("Rarity");
    expect(fieldLabel("system.school")).toBe("School");
  });

  it("counts in the view's noun", () => {
    expect(countText(241, 241, ["item", "items"])).toBe("241 items");
    expect(countText(3, 241, ["item", "items"])).toBe("3 of 241 items");
    expect(countText(1, 1, ["creature", "creatures"])).toBe("1 creature");
  });
});

describe("pageNames", () => {
  it("names each page by its first and last entries", () => {
    const items = ["Ape", "Bat", "Cat", "Deer", "Elk"].map((name) => ({ key: name, name, data: {} }));
    expect(pageNames(items, 2)).toEqual(["Ape – Bat", "Cat – Deer", "Elk"]);
  });
});
