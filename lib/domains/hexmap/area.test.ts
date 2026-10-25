import { describe, expect, it } from "vitest";
import { hexesInPolygon, hexesInRect } from "./area";
import { hexCenter } from "./axial";
import { applyHexEdits } from "./edit-hex-map";
import { parseHexMap } from "./parse-hex-map";

describe("areas", () => {
  it("finds hexes whose centres lie in a box", () => {
    const a = hexCenter(0, 0, 40);
    const b = hexCenter(2, 0, 40);
    const keys = hexesInRect({ x: a.x - 1, y: a.y - 1 }, { x: b.x + 1, y: b.y + 1 }, 40).map((h) => `${h.q},${h.r}`);
    // x from 0 to 120, y from 0 to 69.3: these five centres.
    expect(keys.sort()).toEqual(["0,0", "0,1", "1,0", "2,-1", "2,0"]);
  });

  it("finds hexes inside a freehand loop", () => {
    // A triangle around (0,0), (1,0) and (0,1).
    const pts = [hexCenter(0, 0, 40), hexCenter(1, 0, 40), hexCenter(0, 1, 40)];
    const c = { x: (pts[0].x + pts[1].x + pts[2].x) / 3, y: (pts[0].y + pts[1].y + pts[2].y) / 3 };
    const loop = pts.map((p) => ({ x: c.x + (p.x - c.x) * 1.5, y: c.y + (p.y - c.y) * 1.5 }));
    expect(
      hexesInPolygon(loop, 40)
        .map((h) => `${h.q},${h.r}`)
        .sort()
    ).toEqual(["0,0", "0,1", "1,0"]);
    expect(hexesInPolygon(loop.slice(0, 2), 40)).toEqual([]);
  });
});

describe("header edits", () => {
  it("sets an object key on one line and removes it, keeping comments", () => {
    const src = "grid: hex\ntitle: T # the title\n---\nt(0,0): ocean";
    const out = applyHexEdits(src, [
      { kind: "header", key: "underlay", value: { image: "[[sketch.jpg]]", opacity: 0.5, width: 12, at: [0, 0] } },
    ]);
    expect(out).toContain('underlay: { image: "[[sketch.jpg]]", opacity: 0.5, width: 12, at: [ 0, 0 ] }');
    expect(out).toContain("# the title");
    expect(parseHexMap(out).underlay).toMatchObject({ image: "sketch.jpg", opacity: 0.5, width: 12, at: [0, 0] });
    expect(applyHexEdits(out, [{ kind: "header", key: "underlay", value: null }])).toBe(src);
  });
});
