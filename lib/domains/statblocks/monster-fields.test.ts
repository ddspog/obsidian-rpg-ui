import { describe, expect, it } from "vitest";
import { mapCategory, mapMonster } from "./monster-fields";

describe("mapCategory", () => {
  it("maps the core fields and collapses blank placeholders", () => {
    const data = mapCategory({
      name: "Bears",
      subtitle: "Forest predators",
      habitat: "[[Forest]], [[Mountain]]",
      treasure: "__",
      text: "Massive omnivores of the wild.",
    });
    expect(data).toEqual({
      name: "Bears",
      level: undefined,
      subtitle: "Forest predators",
      habitat: "[[Forest]], [[Mountain]]",
      treasure: undefined,
      text: "Massive omnivores of the wild.",
    });
  });

  describe("level", () => {
    it("is undefined when omitted (component defaults to h2)", () => {
      expect(mapCategory({ name: "Druids" }).level).toBeUndefined();
    });

    it("accepts a number", () => {
      expect(mapCategory({ name: "Druids", level: 1 }).level).toBe(1);
    });

    it("accepts a numeric string", () => {
      expect(mapCategory({ name: "Druids", level: "3" }).level).toBe(3);
    });

    it("clamps to the 1–6 range", () => {
      expect(mapCategory({ name: "Druids", level: 0 }).level).toBe(1);
      expect(mapCategory({ name: "Druids", level: 9 }).level).toBe(6);
    });

    it("truncates fractional values", () => {
      expect(mapCategory({ name: "Druids", level: 2.7 }).level).toBe(2);
    });

    it("ignores non-numeric input", () => {
      expect(mapCategory({ name: "Druids", level: "huge" }).level).toBeUndefined();
    });
  });
});

describe("unknown ability scores", () => {
  it("marks scores written as — as unknown, counting them as 0", () => {
    const data = mapMonster({
      name: "Black Bear",
      abilities: { str: "—", dex: "—", con: 2, int: "?", wis: 1, cha: -2 },
    });
    expect(data.unknownAbilities).toEqual(["str", "dex", "int"]);
    expect(data.abilities).toMatchObject({ str: 0, con: 2, int: 0 });
    expect(mapMonster({ name: "Orc", abilities: { str: 3 } }).unknownAbilities).toBeUndefined();
  });
});
