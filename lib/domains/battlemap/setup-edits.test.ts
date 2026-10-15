import { describe, it, expect } from "vitest";
import { formatInitEntry, setIcon, setInitiative, setStartSquare } from "./setup-edits";

const body = [
  "? Combat begins.",
  "[Init: [[Kobold, Elite]] d20+[[Initiative]]=20 @N5; Fat [[Kobold, A]] 9 @F7 🐸; Talon d20+[[Initiative]]=14]",
  "[COMBAT: Clearing]",
  "T1",
  "@(Kobold, Elite) Closes in [Mv: N8]",
].join("\n");

describe("formatInitEntry", () => {
  it("writes an entry back as read", () => {
    expect(formatInitEntry({ name: "Fat [[Kobold, A]]", value: 9, at: "F7", icon: "🐸" })).toBe(
      "Fat [[Kobold, A]] 9 @F7 🐸"
    );
    expect(formatInitEntry({ name: "Talon", roll: "d20+[[Initiative]]=", value: 14 })).toBe(
      "Talon d20+[[Initiative]]=14"
    );
    expect(formatInitEntry({ name: "Lilith" })).toBe("Lilith");
  });
});

describe("setStartSquare", () => {
  it("moves an entry's @square, or gives it one", () => {
    expect(setStartSquare(body, 0, "[[Kobold, Elite]]", "m6").split("\n")[1]).toBe(
      "[Init: [[Kobold, Elite]] d20+[[Initiative]]=20 @M6; Fat [[Kobold, A]] 9 @F7 🐸; Talon d20+[[Initiative]]=14]"
    );
    expect(setStartSquare(body, 0, "Talon", "J14").split("\n")[1]).toContain("Talon d20+[[Initiative]]=14 @J14]");
  });

  it("places someone not in the list with a [Pos:] after [COMBAT]", () => {
    const lines = setStartSquare(body, 0, "Kowyn", "L11").split("\n");
    expect(lines.slice(2, 4)).toEqual(["[COMBAT: Clearing]", "[Pos: Kowyn L11]"]);
    const again = setStartSquare(lines.join("\n"), 0, "Kowyn", "L12").split("\n");
    expect(again[3]).toBe("[Pos: Kowyn L12]");
  });
});

describe("setInitiative", () => {
  it("writes the roll into the entry", () => {
    const out = setInitiative(body, 0, "Talon", "d20+[[Initiative]]=", 19).split("\n")[1];
    expect(out).toContain("Talon d20+[[Initiative]]=19");
  });

  it("adds whoever isn't in the list", () => {
    expect(setInitiative(body, 0, "Lilith", "d20=", 7).split("\n")[1]).toMatch(/; Lilith d20=7\]$/);
  });

  it("starts a list before [COMBAT] when the fight has none", () => {
    const bare = "[COMBAT: Clearing]\n[Pos: Talon J14]\nT1";
    expect(setInitiative(bare, 0, "Talon", "d20+[[Initiative]]=", 12).split("\n")).toEqual([
      "[Init: Talon d20+[[Initiative]]=12]",
      "[COMBAT: Clearing]",
      "[Pos: Talon J14]",
      "T1",
    ]);
  });
});

describe("setIcon", () => {
  it("sets, changes and clears a fight's emoji", () => {
    expect(setIcon(body, 0, "Talon", "🏹").split("\n")[1]).toContain("Talon d20+[[Initiative]]=14 🏹]");
    expect(setIcon(body, 0, "Fat Kobold, A", "").split("\n")[1]).toContain("Fat [[Kobold, A]] 9 @F7;");
  });

  it("touches only the fight asked for", () => {
    const two = `${body}\n[/COMBAT]\n[Init: Talon 5]\n[COMBAT: Ford]\nT1`;
    const out = setIcon(two, 1, "Talon", "🐺").split("\n");
    expect(out[1]).not.toContain("🐺");
    expect(out[6]).toBe("[Init: Talon 5 🐺]");
  });
});
