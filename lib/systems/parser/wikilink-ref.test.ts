/**
 * Tests for wikilink reference normalization
 */

import { describe, it, expect } from "vitest";
import { extractWikilinkRef, normalizeRef } from "./wikilink-ref";

describe("extractWikilinkRef", () => {
  it("should extract path from YAML-parsed [[path]] (nested array)", () => {
    // YAML parses [[Ability Modifier]] as [["Ability Modifier"]]
    expect(extractWikilinkRef([["Ability Modifier"]])).toBe("Ability Modifier");
  });

  it("should extract path with folder structure", () => {
    // YAML parses [[07. Spellcasting]] as [["07. Spellcasting"]]
    expect(extractWikilinkRef([["07. Spellcasting"]])).toBe("07. Spellcasting");
  });

  it("should extract path from nested path", () => {
    expect(extractWikilinkRef([["013. Glossary/Skills"]])).toBe("013. Glossary/Skills");
  });

  it("should return null for a plain string", () => {
    expect(extractWikilinkRef("skills/dnd5e-skills.md")).toBeNull();
  });

  it("should return null for a flat string array", () => {
    expect(extractWikilinkRef(["strength", "dexterity"])).toBeNull();
  });

  it("should return null for a nested array with multiple inner elements", () => {
    expect(extractWikilinkRef([["a", "b"]])).toBeNull();
  });

  it("should return null for a nested array with multiple outer elements", () => {
    expect(extractWikilinkRef([["a"], ["b"]])).toBeNull();
  });

  it("should return null for null/undefined", () => {
    expect(extractWikilinkRef(null)).toBeNull();
    expect(extractWikilinkRef(undefined)).toBeNull();
  });

  it("should return null for a number", () => {
    expect(extractWikilinkRef(42)).toBeNull();
  });

  it("should return null for an object", () => {
    expect(extractWikilinkRef({ categories: [] })).toBeNull();
  });
});

describe("normalizeRef", () => {
  it("should normalize wikilink ref to string", () => {
    expect(normalizeRef([["Ability Modifier"]])).toBe("Ability Modifier");
  });

  it("should pass through plain strings unchanged", () => {
    expect(normalizeRef("skills/dnd5e-skills.md")).toBe("skills/dnd5e-skills.md");
  });

  it("should pass through arrays unchanged when not wikilink pattern", () => {
    const arr = ["strength", "dexterity"];
    expect(normalizeRef(arr)).toBe(arr);
  });

  it("should pass through objects unchanged", () => {
    const obj = { categories: [], providers: [] };
    expect(normalizeRef(obj)).toBe(obj);
  });
});
