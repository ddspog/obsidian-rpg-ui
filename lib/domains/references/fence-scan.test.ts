import { describe, it, expect } from "vitest";
import { extractAllRpgFences, groupFences } from "./fence-scan";

describe("extractAllRpgFences", () => {
  it("finds every rpg fence and parses its body", () => {
    const doc = [
      "# Longsword",
      "```rpg item.element",
      "type: Martial Melee Weapons",
      "cost: 15 gp",
      "weapon:",
      "  damage: 1d8/1d10 slashing",
      "```",
      "",
      "```rpg item.magic",
      'name: "Flame Tongue"',
      "bonus: +1",
      "```",
      "",
    ].join("\n");

    const fences = extractAllRpgFences(doc);
    expect(fences).toHaveLength(2);
    expect(fences[0].entity).toBe("item");
    expect(fences[0].block).toBe("element");
    expect(fences[0].body?.cost).toBe("15 gp");
    expect((fences[0].body?.weapon as any).damage).toBe("1d8/1d10 slashing");
    expect(fences[1].name).toBe("Flame Tongue");
  });

  it("tolerates 4+ backticks and whitespace in the info tag", () => {
    const doc = "````  rpg  feature.details  \nname: Foo\n````";
    const fences = extractAllRpgFences(doc);
    expect(fences).toHaveLength(1);
    expect(fences[0].entity).toBe("feature");
    expect(fences[0].block).toBe("details");
  });

  it("returns null body on malformed YAML", () => {
    const doc = "```rpg item.element\n::: not yaml :::\n```";
    const fences = extractAllRpgFences(doc);
    expect(fences).toHaveLength(1);
    expect(fences[0].body).toBeNull();
  });

  it("returns an empty array for empty input", () => {
    expect(extractAllRpgFences("")).toEqual([]);
    expect(extractAllRpgFences("plain markdown with no fences")).toEqual([]);
  });
});

describe("groupFences", () => {
  it("buckets by <entity>.<block> keeping doc order", () => {
    const doc = [
      "```rpg item.element",
      "name: first",
      "```",
      "",
      "```rpg feature.details",
      "name: FeatureA",
      "```",
      "",
      "```rpg item.element",
      "name: second",
      "```",
    ].join("\n");
    const grouped = groupFences(extractAllRpgFences(doc));
    expect(Object.keys(grouped)).toEqual(["item.element", "feature.details"]);
    expect(grouped["item.element"]).toHaveLength(2);
    expect(grouped["item.element"][0].name).toBe("first");
    expect(grouped["item.element"][1].name).toBe("second");
  });
});
