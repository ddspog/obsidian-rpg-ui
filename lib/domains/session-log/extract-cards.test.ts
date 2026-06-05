import { describe, it, expect } from "vitest";
import { extractCards, buildCardStacks, resolveMaxCount } from "./extract-cards";
import type { FeatureDetails } from "../features/types";
import type { ResolvedSourceSlice } from "./extract-cards";

describe("resolveMaxCount", () => {
  it("returns undefined for null/undefined max", () => {
    expect(resolveMaxCount(undefined)).toBeUndefined();
    expect(resolveMaxCount(null as any)).toBeUndefined();
  });

  it("returns number directly for scalar max", () => {
    expect(resolveMaxCount(3)).toBe(3);
  });

  it("parses numeric string max", () => {
    expect(resolveMaxCount("5")).toBe(5);
  });

  it("returns undefined for non-numeric string max without vars", () => {
    expect(resolveMaxCount("PB")).toBeUndefined();
  });

  it("picks correct value from per-level map", () => {
    const map = { 2: 1, 6: 2, 10: 3 };
    expect(resolveMaxCount(map, 1)).toBeUndefined();
    expect(resolveMaxCount(map, 2)).toBe(1);
    expect(resolveMaxCount(map, 5)).toBe(1);
    expect(resolveMaxCount(map, 6)).toBe(2);
    expect(resolveMaxCount(map, 15)).toBe(3);
  });

  it("picks last entry when no character level provided", () => {
    const map = { 2: 1, 6: 2 };
    expect(resolveMaxCount(map)).toBe(2);
  });
});

describe("extractCards", () => {
  const makeSource = (features: FeatureDetails[], source = "Cleric", level = 5): ResolvedSourceSlice => ({
    source,
    level,
    features,
  });

  it("extracts cards from aspect sub-objects", () => {
    const features: FeatureDetails[] = [
      {
        name: "Channel Divinity",
        text: "Channel your divine power",
        action: {
          name: "Preserve Life",
          text: "Heal allies within 30 feet",
          resource: "Channel Divinity",
          log: "@ {{actor}} channels divinity: Preserve Life on {{target}}",
        },
      },
    ];

    const cards = extractCards([makeSource(features)], "Elara");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: "Cleric:Preserve Life:action",
      name: "Preserve Life",
      bucket: "action",
      logTemplate: "@ {{actor}} channels divinity: Preserve Life on {{target}}",
      text: "Heal allies within 30 feet",
      resourceRef: "Channel Divinity",
      actor: "Elara",
      source: "Cleric",
    });
  });

  it("uses default log template when log field absent", () => {
    const features: FeatureDetails[] = [
      {
        name: "Shield of Faith",
        action: { text: "Grant +2 AC to a creature" },
      },
    ];

    const cards = extractCards([makeSource(features)], "Thorne");
    expect(cards[0].logTemplate).toBe("@({{actor}}) uses {{name}}");
    expect(cards[0].name).toBe("Shield of Faith");
  });

  it("extracts multiple aspects from same feature", () => {
    const features: FeatureDetails[] = [
      {
        name: "Versatile Ability",
        action: { text: "Use as action" },
        bonus: { text: "Use as bonus action", name: "Quick Versatile" },
      },
    ];

    const cards = extractCards([makeSource(features)], "Hero");
    expect(cards).toHaveLength(2);
    expect(cards[0].bucket).toBe("action");
    expect(cards[0].name).toBe("Versatile Ability");
    expect(cards[1].bucket).toBe("bonus");
    expect(cards[1].name).toBe("Quick Versatile");
  });

  it("falls back to feature.type when no aspect sub-objects present", () => {
    const features: FeatureDetails[] = [
      {
        name: "Uncanny Dodge",
        type: "reaction",
        text: "Halve damage from an attack",
        max: 1,
        recovery: "short rest",
      },
    ];

    const cards = extractCards([makeSource(features)], "Rogue");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      bucket: "reaction",
      name: "Uncanny Dodge",
      maxUses: 1,
      recovery: "short rest",
    });
  });

  it("resolves per-level max using source level", () => {
    const features: FeatureDetails[] = [
      {
        name: "Wild Shape",
        type: "resource",
        max: { 2: 2, 4: 3, 8: 4 },
        recovery: "short rest",
      },
    ];

    const cards = extractCards([makeSource(features, "Druid", 6)], "Fauna");
    expect(cards[0].maxUses).toBe(3);
  });

  it("skips features without any aspect or matching type", () => {
    const features: FeatureDetails[] = [
      { name: "Darkvision", text: "See in the dark" },
      { name: "Trait Only", type: "unknown_type" as any },
    ];

    const cards = extractCards([makeSource(features)], "Elf");
    expect(cards).toHaveLength(0);
  });

  it("combines cards from multiple sources", () => {
    const sources: ResolvedSourceSlice[] = [
      {
        source: "Fighter",
        level: 5,
        features: [{ name: "Action Surge", action: { max: 1, recovery: "short rest" } }],
      },
      {
        source: "Rogue",
        level: 3,
        features: [{ name: "Cunning Action", bonus: { text: "Dash, Disengage, or Hide" } }],
      },
    ];

    const cards = extractCards(sources, "Multiclass");
    expect(cards).toHaveLength(2);
    expect(cards[0].source).toBe("Fighter");
    expect(cards[1].source).toBe("Rogue");
  });
});

describe("buildCardStacks", () => {
  it("groups cards into stacks by bucket", () => {
    const cards = [
      { id: "a", name: "A", bucket: "action" as const, logTemplate: "", source: "X", actor: "Hero" },
      { id: "b", name: "B", bucket: "action" as const, logTemplate: "", source: "X", actor: "Hero" },
      { id: "c", name: "C", bucket: "bonus" as const, logTemplate: "", source: "X", actor: "Hero" },
    ];

    const stacks = buildCardStacks(cards, "Hero");
    expect(stacks).toHaveLength(2);
    expect(stacks[0].bucket).toBe("action");
    expect(stacks[0].cards).toHaveLength(2);
    expect(stacks[0].label).toBe("Action");
    expect(stacks[1].bucket).toBe("bonus");
    expect(stacks[1].cards).toHaveLength(1);
  });

  it("skips empty buckets", () => {
    const cards = [
      { id: "a", name: "A", bucket: "reaction" as const, logTemplate: "", source: "X", actor: "Hero" },
    ];

    const stacks = buildCardStacks(cards, "Hero");
    expect(stacks).toHaveLength(1);
    expect(stacks[0].bucket).toBe("reaction");
  });

  it("returns empty array when no cards", () => {
    expect(buildCardStacks([], "Nobody")).toEqual([]);
  });
});
