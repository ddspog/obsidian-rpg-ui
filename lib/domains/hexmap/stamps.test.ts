import { describe, expect, it } from "vitest";
import { applyHexEdits } from "./edit-hex-map";
import { parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";
import { expandStamps, moveItem, rotateAxial, stampFromHexes, stampItems } from "./stamps";

const stamps = parsePackConfig(
  `custom:
  town:
    - t(0,0): city
    - "s(0,0): buildings x3"
    - "t(1,0): fields"
    - "p(0,0): roads"
    - "100m:"
    - "t(0,1): hills"
    - "m(0.5,0): pin[red] (Gate)"`,
  "basic"
).stamps;

describe("stamps", () => {
  it("reads stamps from pack.yml, quoted or not", () => {
    expect(stamps.town[0]).toBe("t(0,0): city");
    expect(stamps.town).toHaveLength(7);
  });

  it("turns axial points in 60° steps, six of them a full turn", () => {
    expect(rotateAxial(1, 0, 1)).toEqual({ q: 0, r: 1 });
    expect(rotateAxial(1, 0, 3)).toEqual({ q: -1, r: 0 });
    expect(rotateAxial(2, -1, 6)).toEqual({ q: 2, r: -1 });
  });

  it("puts a stamp down at its spot and height; the map's own terrain wins", () => {
    const map = parseHexMap(`grid: hex\n---\n0m:\n  * t(5,5): ocean\n100m:\n  * c(4,5): town\n  * t(5,5): plains`);
    const out = expandStamps(map, stamps);
    const at = (q: number, r: number, layer = "terrain") =>
      out.cells.filter((c) => c.q === q && c.r === r && c.layer === layer).map((c) => [c.spec, c.height, c.stamp]);
    expect(at(4, 5)).toEqual([["city", 100, "town"]]);
    expect(at(4, 6)).toEqual([["hills", 200, "town"]]);
    // (5,5) is the map's: its own lines only.
    expect(at(5, 5)).toEqual([
      ["ocean", 0, undefined],
      ["plains", 100, undefined],
    ]);
    expect(out.markers[0]).toMatchObject({ q: 4.5, r: 5, text: "Gate" });
    expect(out.cells.every((c) => c.stamp === undefined || c.line === 6)).toBe(true);
  });

  it("reports a stamp the pack doesn't have", () => {
    const out = expandStamps(parseHexMap(`grid: hex\n---\nc(0,0): castle`), stamps);
    expect(out.errors[0]).toMatchObject({ line: 3, message: expect.stringContaining('no custom tile "castle"') });
  });

  it("moves an item's coordinates", () => {
    expect(moveItem("t(2,1): forest @X", -1, 3)).toBe("t(-1,3): forest @X");
    expect(moveItem("3,4: plains", 0, 0)).toBe("t(0,0): plains");
    expect(moveItem("m(0.5,0): pin[red]", 1.25, -2)).toBe("m(1.25,-2): pin[red]");
    expect(moveItem("c(1,1): town rot=2", 0, 0)).toBe("c(0,0): town rot=2");
    expect(moveItem("stamp(1,1): town", 0, 0)).toBe("stamp(0,0): town");
  });

  it("saves selected hexes as a stamp around their middle, heights from 0", () => {
    const src = `grid: hex\n---\n0m:\n  * t(0,0): ocean\n100m:\n  * t(2,0): hills\n  * s(2,0): trees\n  * t(3,0): peak\n  * m(2.4,0): pin[red]`;
    expect(stampFromHexes(src, new Set(["2,0", "3,0"]))).toEqual([
      "t(0,0): hills",
      "s(0,0): trees",
      "t(1,0): peak",
      "m(0.4,0): pin[red]",
    ]);
    expect(stampFromHexes(src, new Set(["0,0", "2,0"]))[0]).toBe("0m:");
  });

  it("expands a stamp line into ordinary lines in place", () => {
    const src = `grid: hex\n---\n0m:\n  * t(0,0): ocean\n  * c(3,0): town rot=1`;
    const sl = parseHexMap(src).stamps![0];
    const out = applyHexEdits(src, [{ kind: "replace", line: sl.line, items: stampItems(stamps.town, sl) }]);
    expect(out).toContain("  * t(3,0): city");
    expect(out).toContain("  * t(3,1): fields"); // (1,0) turned once is (0,1)
    expect(out).toContain("100m:\n  * t(2,1): hills");
    expect(out).not.toContain("c(");
  });

  it("writes a stamp line in its height group", () => {
    const out = applyHexEdits(`grid: hex\n---\n0m:\n  * t(0,0): ocean`, [
      { kind: "stamp", q: 2, r: 0, name: "town", rot: 7 },
    ]);
    expect(out).toBe(`grid: hex\n---\n0m:\n  * t(0,0): ocean\n  * c(2,0): town rot=1`);
    expect(parseHexMap(out).stamps).toEqual([{ q: 2, r: 0, name: "town", rot: 1, height: 0, line: 5 }]);
  });
});

describe("custom tiles painted", () => {
  it("puts one per hex: the same again is a no-op, another replaces it", () => {
    const src = `grid: hex\n---\n0m:\n  * t(0,0): ocean`;
    const once = applyHexEdits(src, [{ kind: "stamp", q: 1, r: 0, name: "town", rot: 0 }]);
    expect(applyHexEdits(once, [{ kind: "stamp", q: 1, r: 0, name: "town", rot: 0 }])).toBe(once);
    expect(applyHexEdits(once, [{ kind: "stamp", q: 1, r: 0, name: "farm", rot: 2 }])).toBe(
      `${src}\n  * c(1,0): farm rot=2`
    );
  });
});
