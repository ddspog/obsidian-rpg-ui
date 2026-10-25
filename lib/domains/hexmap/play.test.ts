import { describe, expect, it } from "vitest";
import { parseDistance } from "./parse-hex-map";
import { explored, hexDistance, hexLine, travel, travelText } from "./play";

describe("play: moves, distance, fog", () => {
  it("counts hex steps and walks straight lines", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    const line = hexLine({ q: 0, r: 0 }, { q: 3, r: 0 });
    expect(line).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 3, r: 0 },
    ]);
    const diag = hexLine({ q: 0, r: 0 }, { q: 2, r: 2 });
    expect(diag).toHaveLength(5);
    // Each step is to a neighbour.
    for (let i = 1; i < diag.length; i++) expect(hexDistance(diag[i - 1], diag[i])).toBe(1);
  });

  it("gives distance and days by the map's scale", () => {
    const t = travel(
      [
        { q: 0, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: -1 },
      ],
      parseDistance("30 mi")
    );
    expect(t.hexes).toBe(3);
    expect(t.miles).toBeCloseTo(90);
    expect(travelText(t)).toBe("3 hexes · 90 mi · 3¾ days");
    expect(
      travelText(
        travel(
          [
            { q: 0, r: 0 },
            { q: 1, r: 0 },
          ],
          parseDistance("5/6 mi")
        )
      )
    ).toBe("1 hex · 0.8 mi · 17 min");
    expect(
      travelText(
        travel(
          [
            { q: 0, r: 0 },
            { q: 3, r: 0 },
          ],
          parseDistance("5 mi")
        )
      )
    ).toBe("3 hexes · 15 mi · 5 h");
    expect(
      travelText(
        travel([
          { q: 0, r: 0 },
          { q: 1, r: 0 },
        ])
      )
    ).toBe("1 hex");
  });

  it("sees the hexes stood on and the ring around them", () => {
    const seen = explored([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ]);
    expect(seen.has("0,0") && seen.has("1,0") && seen.has("2,0") && seen.has("-1,0")).toBe(true);
    expect(seen.has("3,0")).toBe(false);
    expect(explored([{ q: 0, r: 0 }], 0)).toEqual(new Set(["0,0"]));
  });
});
