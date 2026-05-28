import { describe, expect, it } from "vitest";
import { splitFenceBody, stripRpgFences } from "./fence-split";

describe("splitFenceBody", () => {
  it("splits on first --- separator", () => {
    const result = splitFenceBody("name: Test\nicon: star\n---\nSome **markdown** body.");
    expect(result.yaml).toBe("name: Test\nicon: star");
    expect(result.text).toBe("Some **markdown** body.");
  });

  it("returns full source as yaml when no separator", () => {
    const result = splitFenceBody("name: Test\nvalue: 42");
    expect(result.yaml).toBe("name: Test\nvalue: 42");
    expect(result.text).toBeUndefined();
  });

  it("trims leading/trailing blank lines from text", () => {
    const result = splitFenceBody("key: val\n---\n\n\nBody here.\n\n\n");
    expect(result.text).toBe("Body here.");
  });

  it("returns undefined text for empty body after separator", () => {
    const result = splitFenceBody("key: val\n---\n");
    expect(result.text).toBeUndefined();
  });

  it("handles separator on first line (empty yaml head)", () => {
    const result = splitFenceBody("---\nJust markdown.");
    expect(result.yaml).toBe("");
    expect(result.text).toBe("Just markdown.");
  });

  it("preserves internal --- in body (only splits on first)", () => {
    const result = splitFenceBody("key: val\n---\nLine 1\n---\nLine 2");
    expect(result.yaml).toBe("key: val");
    expect(result.text).toBe("Line 1\n---\nLine 2");
  });
});

describe("stripRpgFences", () => {
  it("removes a simple fence without body", () => {
    const input = "Intro.\n```rpg rule.content\nname: Test\n```\nAfter.";
    expect(stripRpgFences(input)).toBe("Intro.\nAfter.");
  });

  it("preserves body text after --- separator", () => {
    const input = "Before.\n```rpg rule.content\nname: Test\n---\nBody text here.\n```\nAfter.";
    expect(stripRpgFences(input)).toBe("Before.\nBody text here.\nAfter.");
  });

  it("handles nested fences (4-backtick wrapping 3-backtick)", () => {
    const input = [
      "Intro.",
      "````rpg rule.content",
      "name: Outer",
      "---",
      "Outer body.",
      "",
      "```rpg table.weapons",
      "| A | B |",
      "```",
      "````",
      "After.",
    ].join("\n");
    expect(stripRpgFences(input)).toBe(
      "Intro.\nOuter body.\n\n```rpg table.weapons\n| A | B |\n```\nAfter."
    );
  });

  it("handles deeply nested fences (5-backtick wrapping 4 wrapping 3)", () => {
    const input = [
      "`````rpg rule.content",
      "name: Outer",
      "---",
      "Outer body.",
      "",
      "````rpg rule.content",
      "id: inner",
      "---",
      "Inner body.",
      "```rpg table.data",
      "| X |",
      "```",
      "````",
      "Trailing prose.",
      "`````",
    ].join("\n");
    const result = stripRpgFences(input);
    expect(result).toContain("Outer body.");
    expect(result).toContain("````rpg rule.content");
    expect(result).toContain("Inner body.");
    expect(result).toContain("Trailing prose.");
  });

  it("removes fence without separator entirely", () => {
    const input = "Before.\n```rpg stat.vehicle\nname: Ship\nsize: Large\n```\nAfter.";
    expect(stripRpgFences(input)).toBe("Before.\nAfter.");
  });

  it("returns source unchanged when no rpg fences present", () => {
    const input = "Just some markdown.\n\n```js\nconsole.log('hi');\n```\n";
    expect(stripRpgFences(input)).toBe(input);
  });

  it("handles multiple consecutive fences", () => {
    const input = [
      "```rpg rule.content",
      "id: a",
      "---",
      "Body A.",
      "```",
      "```rpg rule.content",
      "id: b",
      "---",
      "Body B.",
      "```",
    ].join("\n");
    expect(stripRpgFences(input)).toBe("Body A.\nBody B.");
  });

  it("handles real-world nested pattern (Ammunition.md)", () => {
    const input = [
      "# Ammunition",
      "`````rpg rule.content",
      "name: Ammunition",
      "---",
      "You can use a weapon that has the Ammunition property.",
      "",
      "````rpg rule.content",
      "source: From D&D 5e",
      "---",
      "The Ammunition table lists types.",
      "```rpg table.ammunition",
      "| TYPE | AMOUNT |",
      "| --- | --- |",
      "```",
      "````",
      "If you use a weapon with this property, treat it as improvised.",
      "`````",
    ].join("\n");
    const result = stripRpgFences(input);
    expect(result).toContain("# Ammunition");
    expect(result).toContain("You can use a weapon that has the Ammunition property.");
    expect(result).toContain("````rpg rule.content");
    expect(result).toContain("The Ammunition table lists types.");
    expect(result).toContain("If you use a weapon with this property, treat it as improvised.");
  });
});
