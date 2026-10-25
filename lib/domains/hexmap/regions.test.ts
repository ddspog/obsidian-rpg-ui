import { describe, expect, it } from "vitest";
import { hexCenter } from "./axial";
import { parseHexMap } from "./parse-hex-map";
import { layoutRegions } from "./regions";

describe("layoutRegions", () => {
  const map = parseHexMap(
    [
      "grid: hex",
      "regions:",
      '  BellscarpRange: { color: "#c25560", tint: "#5f9a40", tintOpacity: 0.45, link: "[[Bellscarp Range]]", at: [1.5, -2] }',
      '  Dunlind: { color: "#7c8a33", label: "The Realm" }',
      "---",
      "t(0,0): hills @BellscarpRange",
      "t(1,0): plains @Dunlind",
    ].join("\n")
  );
  const members = new Map([
    ["BellscarpRange", new Set(["0,0"])],
    ["Dunlind", new Set(["1,0"])],
  ]);
  const drawn = layoutRegions(members, map.regions, new Set(), 10);
  const byName = Object.fromEntries(drawn.map((g) => [g.name, g]));

  it("writes the label, else the linked note's name", () => {
    expect(byName.BellscarpRange.title).toBe("Bellscarp Range");
    expect(byName.Dunlind.title).toBe("The Realm");
  });

  it("tints with tint, outlines with color", () => {
    expect(byName.BellscarpRange.color).toBe("#c25560");
    expect(byName.BellscarpRange.tint).toBe("#5f9a40");
    expect(byName.BellscarpRange.tintOpacity).toBe(0.45);
    expect(byName.Dunlind.tint).toBeUndefined();
  });

  it("puts the label where at says", () => {
    expect(byName.BellscarpRange.label).toEqual(hexCenter(1.5, -2, 10));
  });

  it("follows lifted faces, with a riser where members step between heights", () => {
    const lifted = layoutRegions(new Map([["Range", new Set(["0,0", "1,0"])]]), {}, new Set(), 10, (key) =>
      key === "1,0" ? 5 : 0
    )[0];
    const segments = lifted.edge.split("M").filter(Boolean);
    // 5 outer sides each, plus one riser at each end of the shared side.
    expect(segments).toHaveLength(12);
    const risers = segments.filter((seg) => {
      const [[x0], [x1]] = seg.split("L").map((p) => p.split(",").map(Number));
      return x0 === x1;
    });
    expect(risers).toHaveLength(2);
    for (const seg of risers) {
      const [[, y0], [, y1]] = seg.split("L").map((p) => p.split(",").map(Number));
      expect(Math.abs(y0 - y1)).toBeCloseTo(5);
    }
    expect(lifted.fill).toContain("M25,3.66L");
  });

  it("names a region on the same hex whatever order its hexes come in", () => {
    // Worthallow Forest's five hexes: two tie for nearest the middle.
    const keys = ["0,-1", "-1,0", "1,-1", "0,0", "2,-1"];
    const at = (order: string[]) => layoutRegions(new Map([["Forest", new Set(order)]]), {}, new Set(), 10)[0].label;
    expect(at([...keys].reverse())).toEqual(at(keys));
    expect(at(["0,0", "1,-1", "2,-1", "-1,0", "0,-1"])).toEqual(at(keys));
  });
});
