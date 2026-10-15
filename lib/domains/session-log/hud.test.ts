import { describe, it, expect } from "vitest";
import { hudLoadouts, loadoutGlyph } from "./hud";
import { readLoadouts } from "./loadouts";

describe("loadout glyphs", () => {
  it("tells a loadout by what's in its hands", () => {
    const [bow, blades, board, totem, staff] = readLoadouts({
      Bow: { main_hand: "[[Longbow]]" },
      Blades: { main_hand: "[[Shortsword]]", off_hand: "[[Shortsword]]" },
      Board: { main_hand: "[[Longsword]]", shield: "[[Shield]]" },
      Totem: { main_hand: "[[Quarterstaff]]", off_hand: "[[Druidic Focus]]" },
      Staff: { main_hand: "[[Quarterstaff]]" },
    });
    expect([bow, blades, board, totem, staff].map(loadoutGlyph)).toEqual([
      "Crosshair",
      "Swords",
      "Shield",
      "Sparkles",
      "Sword",
    ]);
  });

  it("offers the first four, the one in hand marked", () => {
    const ls = readLoadouts({
      A: { main_hand: "[[A]]" },
      B: { main_hand: "[[B]]" },
      C: { main_hand: "[[C]]" },
      D: { main_hand: "[[D]]" },
      E: { main_hand: "[[E]]" },
    });
    const out = hudLoadouts(ls, "B");
    expect(out.map((l) => l.name)).toEqual(["A", "B", "C", "D"]);
    expect(out.map((l) => l.held)).toEqual([false, true, false, false]);
  });
});
