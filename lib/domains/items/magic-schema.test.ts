import { describe, it, expect } from "vitest";
import {
  extractItemMagicBlocks,
  extractItemPersonalBlocks,
  parseItemMagic,
  parseItemPersonal,
} from "./schema";

describe("extractItemMagicBlocks", () => {
  it("extracts a simple magic template", () => {
    const doc = [
      "```rpg item.magic",
      "name: Sentinel Shield",
      "rarity: Uncommon",
      "attunement: false",
      "applies_to:",
      "  kinds: [shield]",
      "traits:",
      "  Initiative A.: [Sentinel Shield]",
      "```",
    ].join("\n");
    const fences = extractItemMagicBlocks(doc);
    expect(fences).toHaveLength(1);
    expect(fences[0].name).toBe("Sentinel Shield");
    expect(fences[0].rarity).toBe("Uncommon");
    expect(fences[0].applies_to?.kinds).toEqual(["shield"]);
    expect(fences[0].traits?.["Initiative A."]).toEqual(["Sentinel Shield"]);
  });

  it("extracts a multi-variant template", () => {
    const doc = [
      "```rpg item.magic",
      "name: Weapon",
      "applies_to:",
      "  kinds: [weapon]",
      "variants:",
      "  '+1':",
      "    rarity: Uncommon",
      "    bonus: '+1'",
      "  '+2':",
      "    rarity: Rare",
      "    bonus: '+2'",
      "```",
    ].join("\n");
    const fences = extractItemMagicBlocks(doc);
    expect(fences).toHaveLength(1);
    expect(fences[0].variants).toBeDefined();
    expect(fences[0].variants?.["+1"].bonus).toBe("+1");
    expect(fences[0].variants?.["+2"].rarity).toBe("Rare");
  });

  it("returns an empty array for docs with no magic fence", () => {
    expect(extractItemMagicBlocks("# Just prose\n\nno fences")).toEqual([]);
    expect(extractItemMagicBlocks("")).toEqual([]);
  });
});

describe("extractItemPersonalBlocks", () => {
  it("extracts a simple personal item", () => {
    const doc = [
      "```rpg item.personal",
      "name: Eyeshield",
      "base: '[[Shield]]'",
      "magic:",
      "  - '[[Sentinel Shield]]'",
      "attuned: false",
      "notes: Found in session 7.",
      "```",
    ].join("\n");
    const fences = extractItemPersonalBlocks(doc);
    expect(fences).toHaveLength(1);
    expect(fences[0].name).toBe("Eyeshield");
    expect(fences[0].base).toBe("[[Shield]]");
    expect(fences[0].magic).toEqual(["[[Sentinel Shield]]"]);
    expect(fences[0].attuned).toBe(false);
  });

  it("extracts a personal with a variant pick", () => {
    const doc = [
      "```rpg item.personal",
      "name: Druid Glaive",
      "base: '[[Glaive]]'",
      "magic:",
      "  - '[[Weapon, +1, +2 or +3]]'",
      "variants:",
      "  'Weapon, +1, +2 or +3': '+1'",
      "```",
    ].join("\n");
    const fences = extractItemPersonalBlocks(doc);
    expect(fences).toHaveLength(1);
    expect(fences[0].variants).toEqual({
      "Weapon, +1, +2 or +3": "+1",
    });
  });
});

describe("parseItemMagic / parseItemPersonal", () => {
  it("returns `{}` for an empty fence body (authoring placeholder)", () => {
    expect(parseItemMagic("")).toEqual({});
    expect(parseItemPersonal("")).toEqual({});
  });

  it("returns null on malformed YAML", () => {
    expect(parseItemMagic(":::\nnot yaml")).toBeNull();
    expect(parseItemPersonal(":::\nnot yaml")).toBeNull();
  });
});
