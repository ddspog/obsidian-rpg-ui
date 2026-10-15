import { describe, it, expect } from "vitest";
import { applyLoadout, describeLoadout, readLoadouts } from "./loadouts";

const loadouts = readLoadouts({
  Bow: { main_hand: "[[Longbow]]" },
  Blades: { main_hand: "[[Shortsword]]", off_hand: "[[Shortsword]]" },
  Nothing: {},
});

describe("loadouts", () => {
  it("reads what a sheet declares, in order, and says what each holds", () => {
    expect(loadouts.map((l) => l.name)).toEqual(["Bow", "Blades"]);
    expect(describeLoadout(loadouts[1])).toBe("Shortsword + Shortsword");
  });

  it("puts a loadout in hand — a pair as one qty 2 entry, the rest cleared, armour left", () => {
    const items = [
      { name: "[[Longbow]]", slot: "main_hand" },
      { name: "[[Shortsword]]", qty: 2 },
      { name: "[[Leather]]", slot: "armor" },
      "[[Waterskin]]",
    ];
    const blades = applyLoadout(items, loadouts[1]);
    expect(blades.items).toEqual([
      { name: "[[Longbow]]" },
      { name: "[[Shortsword]]", qty: 2, slot: "main_hand" },
      { name: "[[Leather]]", slot: "armor" },
      { name: "[[Waterskin]]" },
    ]);
    expect(blades.missing).toEqual([]);
    const bow = applyLoadout(blades.items, loadouts[0]);
    expect((bow.items[0] as { slot?: string }).slot).toBe("main_hand");
    expect((bow.items[1] as { slot?: string }).slot).toBeUndefined();
  });

  it("takes two separate entries for two hands, and names what's missing", () => {
    const r = applyLoadout([{ name: "[[Shortsword]]" }, { name: "[[Shortsword]]" }], loadouts[1]);
    expect(r.items.map((e) => (e as { slot?: string }).slot)).toEqual(["main_hand", "off_hand"]);
    expect(applyLoadout([], loadouts[0]).missing).toEqual(["Longbow"]);
  });
});

describe("the other slots", () => {
  it("holds a light and an instrument beside the hands", () => {
    const l = readLoadouts({ Scout: { main_hand: "[[Shortsword]]", light: "[[Torch]]" } })[0];
    expect(describeLoadout(l)).toBe("Shortsword + Torch");
    const r = applyLoadout(
      [{ name: "[[Shortsword]]" }, { name: "[[Torch]]", slot: "light" }, { name: "[[Torch]]" }],
      l
    );
    expect(r.items.map((e) => (e as { slot?: string }).slot)).toEqual(["main_hand", "light", undefined]);
  });
});
