import { describe, it, expect } from "vitest";
import { parseReference, matchAllReferences, REFERENCE_PATTERN } from "./parse";

describe("parseReference", () => {
  it("parses a simple metadata path", () => {
    const ref = parseReference("@[[Talon]].metadata.cssclasses[0]");
    expect(ref).not.toBeNull();
    expect(ref!.target).toBe("Talon");
    expect(ref!.steps).toEqual([
      { kind: "key", name: "metadata" },
      { kind: "key", name: "cssclasses" },
      { kind: "index", index: 0 },
    ]);
  });

  it("parses a fence-body path with implicit first-match", () => {
    const ref = parseReference("@[[Longsword]].item.element.cost");
    expect(ref!.steps).toEqual([
      { kind: "key", name: "item" },
      { kind: "key", name: "element" },
      { kind: "key", name: "cost" },
    ]);
  });

  it("parses explicit [N] indexing", () => {
    const ref = parseReference("@[[Longsword]].item.element[0].weapon.damage");
    expect(ref!.steps).toEqual([
      { kind: "key", name: "item" },
      { kind: "key", name: "element" },
      { kind: "index", index: 0 },
      { kind: "key", name: "weapon" },
      { kind: "key", name: "damage" },
    ]);
  });

  it("parses [Name] as a named match", () => {
    const ref = parseReference("@[[Cleric]].feature.details[Spellcasting].text");
    expect(ref!.steps).toEqual([
      { kind: "key", name: "feature" },
      { kind: "key", name: "details" },
      { kind: "named", name: "Spellcasting" },
      { kind: "key", name: "text" },
    ]);
  });

  it("tolerates aliases and paths inside the wikilink", () => {
    const ref = parseReference("@[[folder/Longsword|Alias]].item.element.cost");
    expect(ref!.target).toBe("folder/Longsword|Alias");
  });

  it("returns null on non-matching text", () => {
    expect(parseReference("not a ref")).toBeNull();
    expect(parseReference("@[[Foo]]")).toBeNull(); // no path
    expect(parseReference("@[[Foo]].")).toBeNull(); // trailing dot
  });
});

describe("matchAllReferences", () => {
  it("finds every reference in document order with offsets", () => {
    const text = "See @[[A]].metadata.key or @[[B]].feat.details[X].name for details.";
    const matches = matchAllReferences(text);
    expect(matches).toHaveLength(2);
    expect(matches[0].target).toBe("A");
    expect(matches[0].start).toBe(4);
    expect(matches[0].end).toBe(23);
    expect(text.slice(matches[0].start, matches[0].end)).toBe("@[[A]].metadata.key");
    expect(matches[1].target).toBe("B");
    expect(matches[1].steps.some((s) => s.kind === "named" && s.name === "X")).toBe(true);
  });

  it("resets across invocations (global-flag hazard guard)", () => {
    REFERENCE_PATTERN.lastIndex = 999; // simulate prior unrelated use
    const matches = matchAllReferences("@[[X]].a.b");
    expect(matches).toHaveLength(1);
  });

  it("returns empty for plain prose", () => {
    expect(matchAllReferences("no references here")).toEqual([]);
  });
});
