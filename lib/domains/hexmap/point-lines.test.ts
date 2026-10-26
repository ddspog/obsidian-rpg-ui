import { describe, expect, it } from "vitest";
import { applyHexEdits } from "./edit-hex-map";
import { parseHexMap } from "./parse-hex-map";
import { labelContent, markerContent } from "./point-lines";

describe("point lines", () => {
  it("writes a label's fields back as the parser reads them, defaults left out", () => {
    const src = "grid: hex\n---\nl(-3,2.95): (Dunlind) realm [[Dunlind]] size=2.9 rot=-3 arc=22";
    const [label] = parseHexMap(src).labels;
    expect(labelContent(label)).toBe("(Dunlind) realm [[Dunlind]] size=2.9 rot=-3 arc=22");
    expect(labelContent({ ...label, size: 1, rot: 0, arc: 0, link: "" })).toBe("(Dunlind) realm");
    expect(labelContent({ ...label, text: "Dun(lind)", color: "#a00" })).toContain("(Dunlind) realm");
  });

  it("writes a marker's fields back", () => {
    const [m] = parseHexMap("grid: hex\n---\nm(0,0): pedestal-gold[star] (Mervine) [[Mervine]]").markers;
    expect(markerContent(m)).toBe("pedestal-gold[star] (Mervine) [[Mervine]]");
    expect(markerContent({ ...m, size: 1.5, piece: true, text: "" })).toBe(
      "pedestal-gold[star] [[Mervine]] size=1.5 piece"
    );
  });

  it("rewrites a line's content, keeping its point and comment", () => {
    const src = "grid: hex\n---\n0m:\n  * l(1.5,-0.5): (Old) place  # keep me";
    const out = applyHexEdits(src, [{ kind: "content", line: 4, content: "(New) realm size=2" }]);
    expect(out.split("\n")[3]).toBe("  * l(1.5,-0.5): (New) realm size=2  # keep me");
    expect(parseHexMap(out).labels[0]).toMatchObject({ q: 1.5, r: -0.5, text: "New", family: "realm", size: 2 });
    // Not a marker or label line: left alone.
    expect(applyHexEdits(src, [{ kind: "content", line: 3, content: "x" }])).toBe(src);
  });
});
