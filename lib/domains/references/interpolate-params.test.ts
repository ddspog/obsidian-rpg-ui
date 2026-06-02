import { describe, expect, it } from "vitest";
import { interpolateParams } from "./interpolate-params";

describe("interpolateParams", () => {
  it("returns params unchanged when no templates present", () => {
    const result = interpolateParams({ name: "Custom" }, { name: "Grapple" });
    expect(result).toEqual({ name: "Custom" });
  });

  it("interpolates a simple ${field} reference", () => {
    const result = interpolateParams(
      { name: "${name}" },
      { name: "Fireball", level: 3 },
    );
    expect(result).toEqual({ name: "Fireball" });
  });

  it("interpolates multiple fields in one string", () => {
    const result = interpolateParams(
      { name: "${name} (${cost})" },
      { name: "Fireball", cost: "3 MP" },
    );
    expect(result).toEqual({ name: "Fireball (3 MP)" });
  });

  it("resolves dot-path references", () => {
    const result = interpolateParams(
      { label: "${stats.hp}" },
      { stats: { hp: 42, ac: 15 } },
    );
    expect(result).toEqual({ label: "42" });
  });

  it("replaces missing fields with empty string", () => {
    const result = interpolateParams(
      { name: "${name} (${missing})" },
      { name: "Grapple" },
    );
    expect(result).toEqual({ name: "Grapple ()" });
  });

  it("passes through non-string values unchanged", () => {
    const result = interpolateParams(
      { level: 3, active: true, name: "${name}" },
      { name: "Test" },
    );
    expect(result).toEqual({ level: 3, active: true, name: "Test" });
  });

  it("passes through undefined values", () => {
    const result = interpolateParams(
      { content: undefined },
      { name: "Test" },
    );
    expect(result).toEqual({ content: undefined });
  });

  it("does not interpolate strings without ${} pattern", () => {
    const result = interpolateParams(
      { name: "Static Name" },
      { name: "Ignored" },
    );
    expect(result).toEqual({ name: "Static Name" });
  });
});
