import { describe, it, expect } from "vitest";
import { lootDestinations, type ContainerNote } from "./loot-destinations";

const notes: Record<string, ContainerNote> = {
  Pouch: { holds: true },
  Quiver: { holds: true },
  "Kowyn's Bag": {
    named: {
      name: "Kowyn's Bag",
      items: [
        { name: "[[Quiver]]", contents: [{ name: "[[Crossbow Bolts]]" }] },
        { name: "[[Backpack]]", notes: "Jacqui's Quick Access", contents: [{ name: "[[Bedroll]]" }] },
      ],
    },
  },
};

describe("lootDestinations", () => {
  it("offers each member, then what they carry that holds things — a named container by its name alone", () => {
    const out = lootDestinations(
      [
        {
          name: "Talon",
          items: [
            { name: "[[Shortsword]]" },
            { name: "[[Kowyn's Bag]]", container: "main" },
            { name: "[[Pouch]]", label: "Sling Pouch" },
          ],
        },
        { name: "Kowyn", items: [{ name: "[[Pouch]]" }, { name: "[[Pouch]]" }] },
      ],
      (s) => notes[s]
    );
    expect(out.map((d) => [d.label, d.key])).toEqual([
      ["Talon", "Talon"],
      ["Kowyn's Bag", "Kowyn's Bag"],
      ["Kowyn's Bag › Quiver", "Kowyn's Bag/Quiver"],
      ["Kowyn's Bag › Backpack (Jacqui's Quick Access)", "Kowyn's Bag/Backpack"],
      ["Sling Pouch", "Talon/Sling Pouch"],
      ["Kowyn", "Kowyn"],
      ["Kowyn's Pouch", "Kowyn/Pouch"],
      ["Kowyn's Pouch #2", "Kowyn/Pouch"],
    ]);
  });
});
