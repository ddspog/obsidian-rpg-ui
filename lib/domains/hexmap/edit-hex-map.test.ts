import { describe, expect, it } from "vitest";
import { applyHexEdits, formatCoord } from "./edit-hex-map";
import { parseHexMap } from "./parse-hex-map";

const HEAD = "grid: hex\npack: basic\n---";

describe("applyHexEdits: paint", () => {
  it("swaps only the spec of the hex's terrain line", () => {
    const src = `${HEAD}\nt(1,1): (Featherbark) [[Holy City]] city @Dunlind + #ccc # capital`;
    const out = applyHexEdits(src, [{ kind: "paint", layer: "terrain", q: 1, r: 1, spec: "ruin" }]);
    expect(out.split("\n").pop()).toBe("t(1,1): (Featherbark) [[Holy City]] ruin @Dunlind + #ccc # capital");
  });

  it("adds a spec to a terrain line that had none, after its label", () => {
    const src = `${HEAD}\nt(0,0): (Ford) @Dunlind`;
    const out = applyHexEdits(src, [{ kind: "paint", layer: "terrain", q: 0, r: 0, spec: "plains" }]);
    expect(out.split("\n").pop()).toBe("t(0,0): (Ford) plains @Dunlind");
  });

  it("puts a new hex in its height group, written like that group's lines", () => {
    const src = `${HEAD}\n0m:\n  * t(0,0): ocean\n100m: base=rocky\n  * t(2,0): mountain\nl(1,0): (Coast) title-1`;
    const out = applyHexEdits(src, [
      { kind: "paint", layer: "terrain", q: 1, r: 0, spec: "plains", height: 0 },
      { kind: "paint", layer: "terrain", q: 3, r: 0, spec: "peak", height: 100 },
    ]);
    expect(out).toBe(
      `${HEAD}\n0m:\n  * t(0,0): ocean\n  * t(1,0): plains\n100m: base=rocky\n  * t(2,0): mountain\n  * t(3,0): peak\nl(1,0): (Coast) title-1`
    );
    const map = parseHexMap(out);
    expect(map.cells.find((c) => c.q === 3)?.height).toBe(100);
    expect(map.cells.find((c) => c.q === 1)?.height).toBe(0);
  });

  it("starts a group for a height the map doesn't have", () => {
    const src = `${HEAD}\n0m:\n  * t(0,0): ocean`;
    const out = applyHexEdits(src, [{ kind: "paint", layer: "terrain", q: 1, r: 0, spec: "hills", height: 200 }]);
    expect(out).toBe(`${HEAD}\n0m:\n  * t(0,0): ocean\n200m:\n  * t(1,0): hills`);
  });

  it("writes bare lines in a map without groups", () => {
    const out = applyHexEdits(`${HEAD}\nt(0,0): ocean`, [
      { kind: "paint", layer: "terrain", q: 1, r: 0, spec: "plains" },
    ]);
    expect(out).toBe(`${HEAD}\nt(0,0): ocean\nt(1,0): plains`);
  });

  it("puts other layers at the hex's own height", () => {
    const src = `${HEAD}\n0m:\n  * t(0,0): ocean\n100m:\n  * t(2,0): mountain`;
    const out = applyHexEdits(src, [{ kind: "paint", layer: "path", q: 2, r: 0, spec: "roads", height: 0 }]);
    expect(parseHexMap(out).cells.find((c) => c.layer === "path")?.height).toBe(100);
  });

  it("adds a path once, and a stack again as another copy", () => {
    const src = `${HEAD}\nt(0,0): plains`;
    const twice = (layer: "path" | "stack", spec: string) =>
      applyHexEdits(src, [
        { kind: "paint", layer, q: 0, r: 0, spec },
        { kind: "paint", layer, q: 0, r: 0, spec },
        { kind: "paint", layer, q: 0, r: 0, spec },
      ]);
    expect(twice("path", "roads")).toBe(`${src}\np(0,0): roads`);
    expect(twice("stack", "buildings")).toBe(`${src}\ns(0,0): buildings x3`);
  });

  it("replaces a hex's own base", () => {
    const src = `${HEAD}\nt(0,0): plains\nb(0,0): level`;
    const out = applyHexEdits(src, [{ kind: "paint", layer: "base", q: 0, r: 0, spec: "rocky" }]);
    expect(out).toBe(`${HEAD}\nt(0,0): plains\nb(0,0): rocky`);
  });
});

describe("applyHexEdits: erase and remove", () => {
  it("takes the top item of the layer off the hex", () => {
    const src = `${HEAD}\nt(0,0): plains\ns(0,0): trees\ns(0,0): buildings\nt(1,0): forest`;
    expect(applyHexEdits(src, [{ kind: "erase", layer: "stack", q: 0, r: 0 }])).toBe(
      `${HEAD}\nt(0,0): plains\ns(0,0): trees\nt(1,0): forest`
    );
    expect(applyHexEdits(src, [{ kind: "erase", layer: "terrain", q: 1, r: 0 }])).toBe(
      `${HEAD}\nt(0,0): plains\ns(0,0): trees\ns(0,0): buildings`
    );
    expect(applyHexEdits(src, [{ kind: "erase", layer: "path", q: 0, r: 0 }])).toBe(src);
  });

  it("drops a line by number", () => {
    const src = `${HEAD}\nt(0,0): plains\nm(0.5,0): pin[red] (Camp)`;
    expect(applyHexEdits(src, [{ kind: "remove", line: 5 }])).toBe(`${HEAD}\nt(0,0): plains`);
  });
});

describe("applyHexEdits: points, regions, height", () => {
  it("writes markers and labels at fractional points, after the last item", () => {
    const src = `${HEAD}\n0m:\n  * t(0,0): plains\n`;
    const out = applyHexEdits(src, [
      { kind: "point", layer: "marker", q: 0.333333, r: 0.5, content: "pin[red] (Camp)" },
      { kind: "point", layer: "label", q: 1, r: -0.25, content: "(The Coast) title-1" },
    ]);
    expect(out).toBe(
      `${HEAD}\n0m:\n  * t(0,0): plains\n  * m(0.33,0.5): pin[red] (Camp)\n  * l(1,-0.25): (The Coast) title-1\n`
    );
    const map = parseHexMap(out);
    expect(map.markers[0]).toMatchObject({ q: 0.33, r: 0.5, spec: "pin[red]", text: "Camp" });
    expect(map.labels[0]).toMatchObject({ text: "The Coast", family: "title-1" });
  });

  it("toggles a region on the terrain line, or makes one", () => {
    const src = `${HEAD}\nt(0,0): plains @Dunlind`;
    expect(applyHexEdits(src, [{ kind: "region", q: 0, r: 0, name: "Dunlind" }])).toBe(`${HEAD}\nt(0,0): plains`);
    expect(applyHexEdits(src, [{ kind: "region", q: 0, r: 0, name: "Caulkin" }])).toBe(
      `${HEAD}\nt(0,0): plains @Dunlind @Caulkin`
    );
    expect(applyHexEdits(src, [{ kind: "region", q: 0, r: 0, name: "Dunlind", on: true }])).toBe(src);
    expect(applyHexEdits(src, [{ kind: "region", q: 2, r: 0, name: "Dunlind" }])).toBe(`${src}\nt(2,0): @Dunlind`);
  });

  it("moves a hex's lines into another height group", () => {
    const src = `${HEAD}\n0m:\n  * t(0,0): plains\n  * s(0,0): trees\n  * t(1,0): ocean\n100m:\n  * t(2,0): hills`;
    const out = applyHexEdits(src, [{ kind: "height", q: 0, r: 0, height: 100 }]);
    expect(out).toBe(
      `${HEAD}\n0m:\n  * t(1,0): ocean\n100m:\n  * t(2,0): hills\n  * t(0,0): plains\n  * s(0,0): trees`
    );
    const moved = parseHexMap(out).cells.filter((c) => c.q === 0);
    expect(moved.map((c) => c.height)).toEqual([100, 100]);
  });

  it("formats coordinates with at most two decimals", () => {
    expect(formatCoord(1)).toBe("1");
    expect(formatCoord(-0.5)).toBe("-0.5");
    expect(formatCoord(2 / 3)).toBe("0.67");
  });
});

describe("applyHexEdits: looks", () => {
  it("sets a line's look, dropping defaults, and the parser reads it back", () => {
    const src = `${HEAD}\nt(0,0): (Ford) plains size=2 @Dunlind`;
    const out = applyHexEdits(src, [
      { kind: "look", line: 4, look: { size: 1.5, shift: [0.1, -0.2], hue: 40, sat: 1 } },
    ]);
    expect(out.split("\n").pop()).toBe("t(0,0): (Ford) plains @Dunlind size=1.5 shift=0.1,-0.2 hue=40");
    expect(parseHexMap(out).cells[0]).toMatchObject({
      spec: "plains",
      look: { size: 1.5, shift: [0.1, -0.2], hue: 40 },
    });
    expect(
      applyHexEdits(out, [{ kind: "look", line: 4, look: {} }])
        .split("\n")
        .pop()
    ).toBe("t(0,0): (Ford) plains @Dunlind");
  });

  it("keeps the spec when a line has look tokens before it", () => {
    const src = `${HEAD}\nt(0,0): size=2 forest`;
    expect(
      applyHexEdits(src, [{ kind: "paint", layer: "terrain", q: 0, r: 0, spec: "hills" }])
        .split("\n")
        .pop()
    ).toBe("t(0,0): size=2 hills");
  });
});

describe("applyHexEdits: tints", () => {
  it("recolours every path line on the hex, keeping its size and shift", () => {
    const src = `${HEAD}\nt(0,0): plains\np(0,0): river size=1.2\np(0,0): roads`;
    const out = applyHexEdits(src, [{ kind: "tint", layer: "path", q: 0, r: 0, tint: { hue: 30, bright: 0.8 } }]);
    expect(out.split("\n").slice(-2)).toEqual([
      "p(0,0): river size=1.2 hue=30 bright=0.8",
      "p(0,0): roads hue=30 bright=0.8",
    ]);
    expect(parseHexMap(out).cells[1].look).toEqual({ size: 1.2, hue: 30, bright: 0.8 });
  });

  it("gives a coast that lays itself a colour line, dropped when it's reset", () => {
    const src = `${HEAD}\nt(0,0): water`;
    const out = applyHexEdits(src, [{ kind: "tint", layer: "edge", q: 0, r: 0, tint: { sat: 0.5 } }]);
    expect(out.split("\n").pop()).toBe("e(0,0): sat=0.5");
    const again = applyHexEdits(out, [{ kind: "tint", layer: "edge", q: 0, r: 0, tint: { sat: 0.5, hue: -20 } }]);
    expect(again.split("\n").pop()).toBe("e(0,0): hue=-20 sat=0.5");
    expect(applyHexEdits(again, [{ kind: "tint", layer: "edge", q: 0, r: 0, tint: {} }])).toBe(src);
    // Nothing on an empty hex, and a tint line isn't an edge for Erase to take off.
    expect(applyHexEdits(src, [{ kind: "tint", layer: "edge", q: 5, r: 5, tint: { sat: 0.5 } }])).toBe(src);
    expect(
      applyHexEdits(out, [{ kind: "erase", layer: "edge", q: 0, r: 0 }])
        .split("\n")
        .pop()
    ).toBe("e(0,0): none");
  });
});

describe("applyHexEdits: moving markers and labels", () => {
  it("rewrites only the point's coordinates", () => {
    const src = `${HEAD}\n0m:\n  * t(0,0): plains\n  * m(0.5,0): party[1] (Elara) [[Elara]]\nl(1,-0.5): (Coast) title-1`;
    const out = applyHexEdits(src, [
      { kind: "move", line: 6, q: 2, r: -1 },
      { kind: "move", line: 7, q: 1.333, r: 0 },
      { kind: "move", line: 5, q: 9, r: 9 },
    ]);
    expect(out).toBe(
      `${HEAD}\n0m:\n  * t(0,0): plains\n  * m(2,-1): party[1] (Elara) [[Elara]]\nl(1.33,0): (Coast) title-1`
    );
    const map = parseHexMap(out);
    expect(map.markers[0]).toMatchObject({ q: 2, r: -1, text: "Elara" });
  });
});
