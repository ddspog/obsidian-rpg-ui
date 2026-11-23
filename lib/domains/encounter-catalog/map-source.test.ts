import { describe, expect, it } from "vitest";
import { linkedTokens, mapsOfNote } from "./map-source";

const NOTE = [
  "# Kobold Ambush",
  "```rpg map",
  "grid: square",
  "title: Kobold Ambush",
  "tokens:",
  "  Talon: F5",
  '  "[[Kobold, Elite]]": J3',
  '  "Fat [[Kobold, A]]": C8',
  '  "Thin [[Kobold, A|kobold]]": K8',
  "---",
  "# # #",
  "```",
].join("\n");

describe("mapsOfNote", () => {
  it("reads the linked tokens of a map as one row, the PCs left out", () => {
    const [map] = mapsOfNote("atlas/maps/Kobold Ambush.md", NOTE);
    expect(map.slug).toBe("map");
    expect(map.title).toBe("Kobold Ambush");
    expect(map.rows[0].linked).toEqual([
      { name: "Kobold, Elite", count: 1 },
      { name: "Kobold, A", count: 2 },
    ]);
    expect(map.tags).toEqual(["map", "kobold-ambush"]);
  });

  it("has no row for a map with no linked token", () => {
    expect(mapsOfNote("m.md", "```rpg map\ntokens:\n  Talon: A1\n```")).toEqual([]);
  });

  it("reads a list of tokens too", () => {
    expect(linkedTokens([{ name: "[[Wolf]]" }, "[[Wolf]]"])).toEqual([{ name: "Wolf", count: 2 }]);
  });
});
