import { describe, expect, it } from "vitest";
import { parseNewInventoryBlock, wikilinkLabel, wikilinkTarget } from "./schema";

describe("parseNewInventoryBlock", () => {
  it("returns null for legacy shape (sections: without items:)", () => {
    const yaml = `
state_key: foo
sections:
  - name: Equipped
    items:
      - name: Sword
`;
    expect(parseNewInventoryBlock(yaml)).toBeNull();
  });

  it("returns null for empty or malformed YAML", () => {
    expect(parseNewInventoryBlock("")).toBeNull();
    expect(parseNewInventoryBlock("  \n")).toBeNull();
    expect(parseNewInventoryBlock("not: valid\nitems: nota_list")).toBeNull();
  });

  it("parses flat items with string shorthand", () => {
    const yaml = `
state_key: pc-bob
items:
  - "[[Longsword]]"
  - "[[Shield]]"
`;
    const block = parseNewInventoryBlock(yaml)!;
    expect(block.state_key).toBe("pc-bob");
    expect(block.items).toEqual([{ name: "[[Longsword]]" }, { name: "[[Shield]]" }]);
  });

  it("accepts long-form entries with qty, slot, notes, contents", () => {
    const yaml = `
items:
  - name: "[[Arrows]]"
    qty: 20
  - name: "[[Shield]]"
    slot: off_hand
    equipped: true
  - name: "[[Backpack]]"
    container: main
    contents:
      - "[[Rope]]"
      - name: "[[Rations]]"
        qty: 5
`;
    const block = parseNewInventoryBlock(yaml)!;
    expect(block.items).toHaveLength(3);
    expect(block.items[0]).toEqual({ name: "[[Arrows]]", qty: 20 });
    expect(block.items[1]).toEqual({
      name: "[[Shield]]",
      slot: "off_hand",
      equipped: true,
    });
    expect(block.items[2].container).toBe("main");
    expect(block.items[2].contents).toEqual([{ name: "[[Rope]]" }, { name: "[[Rations]]", qty: 5 }]);
  });

  it("accepts `quantity` as alias for `qty`", () => {
    const block = parseNewInventoryBlock("items:\n  - { name: X, quantity: 4 }")!;
    expect(block.items[0].qty).toBe(4);
  });

  it("normalizes currency with both short and long keys", () => {
    const yaml = `
items: []
currency:
  gold: 50
  pp: 3
  copper: 5
`;
    const block = parseNewInventoryBlock(yaml)!;
    expect(block.currency).toEqual({ gp: 50, pp: 3, cp: 5 });
  });

  it("extracts encumbrance overrides", () => {
    const yaml = `
items: []
encumbrance:
  carry: 120
  push: 400
`;
    const block = parseNewInventoryBlock(yaml)!;
    expect(block.encumbrance).toEqual({ carry: 120, push: 400 });
  });

  it("ignores unknown section and slot values", () => {
    const yaml = `
items:
  - { name: Foo, section: trash, slot: pinky }
`;
    const block = parseNewInventoryBlock(yaml)!;
    expect(block.items[0].section).toBeUndefined();
    expect(block.items[0].slot).toBeUndefined();
  });
});

describe("wikilink helpers", () => {
  it("wikilinkLabel strips brackets and prefers the alias", () => {
    expect(wikilinkLabel("[[Longsword]]")).toBe("Longsword");
    expect(wikilinkLabel("[[items/Longsword|Long Sword]]")).toBe("Long Sword");
    expect(wikilinkLabel("[[foo/bar/Baz]]")).toBe("Baz");
  });

  it("wikilinkTarget returns the path segment or null", () => {
    expect(wikilinkTarget("[[Longsword]]")).toBe("Longsword");
    expect(wikilinkTarget("[[items/Longsword|Alias]]")).toBe("items/Longsword");
    expect(wikilinkTarget("Longsword")).toBeNull();
    expect(wikilinkTarget("[[partial")).toBeNull();
  });
});
