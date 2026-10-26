import { describe, expect, it } from "vitest";
import { applyHexEdits } from "./edit-hex-map";
import { layoutHexMap, resolveHexMap } from "./layout";
import { buildPack, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";
import { markerContent } from "./point-lines";
import { spaced } from "./regions";

const pack = buildPack(
  "basic",
  [{ path: "terrain/land/plains/a.webp", url: "a" }],
  parsePackConfig(
    `labels:\n  place: { lettering: true, font: Bookmania, weight: semibold, color: "#141414", halo: "#fff" }`,
    "basic"
  )
);
const draw = (src: string) =>
  layoutHexMap(resolveHexMap(parseHexMap(src), new Map([["basic", pack]]), "basic"), new Map());

describe("region declarations", () => {
  const src =
    'grid: hex\nregions:\n  Dunlind: { color: "#7c8a33" }\n---\nt(0,0): plains @Dunlind @TheClodgate\nt(0,1): plains @TheClodgate';

  it("set one region's line and leave the others", () => {
    const out = applyHexEdits(src, [
      {
        kind: "region-decl",
        id: "TheClodgate",
        value: { label: "The Clodgate", labelAt: "border", parent: "Dunlind" },
      },
    ]);
    const map = parseHexMap(out);
    expect(map.regions.Dunlind.color).toBe("#7c8a33");
    expect(map.regions.TheClodgate).toMatchObject({ label: "The Clodgate", labelAt: "border", parent: "Dunlind" });
    expect(out).toContain("TheClodgate: { label: The Clodgate, labelAt: border, parent: Dunlind }");
    expect(
      parseHexMap(applyHexEdits(out, [{ kind: "region-decl", id: "TheClodgate", value: null }])).regions.TheClodgate
    ).toBeUndefined();
  });

  it("read a one-word tag as words when undeclared", () => {
    expect(spaced("TheClodgate")).toBe("The Clodgate");
    expect(spaced("Dunlind")).toBe("Dunlind");
    expect(draw(src).regions.find((g) => g.name === "TheClodgate")?.title).toBe("The Clodgate");
  });

  it("put a border label under the top border, inside", () => {
    const g = draw(
      `grid: hex\nregions:\n  A: { labelAt: border, labelColor: "#a00" }\n---\nt(0,0): plains @A\nt(0,1): plains @A`
    ).regions[0];
    expect(g).toMatchObject({ labelAt: "border", labelColor: "#a00" });
    // Hex (0,0)'s top side is at -√3/2·R; the label sits just below it.
    expect(g.label.y).toBeGreaterThan((-Math.sqrt(3) / 2) * 40);
    expect(g.label.y).toBeLessThan(0);
  });
});

describe("marker captions", () => {
  const line = "m(0,0): pin[white] (Mervine) [[Mervine]] text=place tsize=1.4 toff=0.2,-0.6 arc=12 #a33";

  it("read their style, size, offset, bend and colour, and write them back", () => {
    const [m] = parseHexMap(`grid: hex\n---\n${line}`).markers;
    expect(m).toMatchObject({
      spec: "pin[white]",
      text: "Mervine",
      caption: { style: "place", size: 1.4, offset: [0.2, -0.6], arc: 12, color: "#a33" },
    });
    expect(markerContent(m)).toBe("pin[white] (Mervine) [[Mervine]] text=place tsize=1.4 toff=0.2,-0.6 arc=12 #a33");
  });

  it("draw in their lettering style where they were put", () => {
    const [d] = draw(`grid: hex\n---\nt(0,0): plains\n${line}`).markers;
    expect(d.caption).toMatchObject({ font: "Bookmania", weight: 600, color: "#a33", halo: "#fff" });
    expect(d.caption!.y).toBeCloseTo(d.y + 40 * 0.2 - 0.6 * 40);
    expect(d.caption!.arc).toMatch(/A/);
  });
});

describe("region label objects", () => {
  it("read every field, over the flat keys", () => {
    const map = parseHexMap(
      'grid: hex\nregions:\n  A: { labelColor: "#000", label: { text: The A, at: border, color: "#fff", size: 0.8, offset: [0, 0.1], rot: -4, style: place, halo: false, caps: false, spacing: 0.05 } }\n---\nt(0,0): plains @A'
    );
    expect(map.regions.A).toMatchObject({
      label: "The A",
      labelAt: "border",
      labelColor: "#fff",
      labelLook: { size: 0.8, offset: [0, 0.1], rot: -4, style: "place", halo: false, caps: false, spacing: 0.05 },
    });
    expect(parseHexMap("grid: hex\nregions:\n  A: { label: { at: none } }\n---\n").regions.A.label).toBe(false);
    expect(parseHexMap("grid: hex\nregions:\n  A: { label: { at: [2, 1.5] } }\n---\n").regions.A.at).toEqual([2, 1.5]);
  });

  it("take a lettering style's letters", () => {
    const g = draw("grid: hex\nregions:\n  A: { label: { style: place, size: 2 } }\n---\nt(0,0): plains @A").regions[0];
    expect(g.labelFont).toMatchObject({ family: "Bookmania", weight: 600, color: "#141414" });
    expect(g.labelLook?.size).toBe(2);
  });
});

describe("region label placement and lettering", () => {
  it("reads case, bend, bottom and a pinned hex", () => {
    const map = parseHexMap(
      "grid: hex\nregions:\n  A: { label: { at: bottom, case: title, arc: 20, on: [1, 0] } }\n---\nt(0,0): plains @A"
    );
    expect(map.regions.A).toMatchObject({ labelAt: "bottom", labelOn: [1, 0], labelLook: { case: "title", arc: 20 } });
    expect(parseHexMap("grid: hex\nregions:\n  A: { label: { at: top } }\n---\n").regions.A.labelAt).toBe("border");
  });

  it("puts a bottom label just inside the lowest south border", () => {
    const g = draw("grid: hex\nregions:\n  A: { label: { at: bottom } }\n---\nt(0,0): plains @A\nt(0,1): plains @A")
      .regions[0];
    // Hex (0,1) is the lowest: its bottom side is at √3·R·1.5; the label sits just above it.
    const bottom = Math.sqrt(3) * 40 * 1.5;
    expect(g.label.y).toBeLessThan(bottom);
    expect(g.label.y).toBeGreaterThan(bottom - 0.5 * 40);
  });

  it("puts a label on its pinned hex: top, bottom or middle", () => {
    const at = (where: string) =>
      draw(
        `grid: hex\nregions:\n  A: { label: { at: ${where}, on: [0, 1] } }\n---\nt(0,0): plains @A\nt(0,1): plains @A`
      ).regions[0].label;
    const c = Math.sqrt(3) * 40; // the middle of (0,1)
    expect(at("middle").y).toBeCloseTo(c);
    expect(at("top").y).toBeLessThan(c);
    expect(at("bottom").y).toBeGreaterThan(c);
  });
});

describe("caption outline, case, turn and spacing", () => {
  it("read and write tline, tcase, trot and tspace", () => {
    const line = "m(0,0): pin[white] (Mervine) tline=none tcase=title trot=-5 tspace=0.1";
    const [m] = parseHexMap(`grid: hex\n---\n${line}`).markers;
    expect(m.caption).toMatchObject({ halo: false, case: "title", rot: -5, spacing: 0.1 });
    expect(markerContent(m)).toBe("pin[white] (Mervine) tline=none tcase=title trot=-5 tspace=0.1");
    const [d] = draw(`grid: hex\n---\nt(0,0): plains\n${line}`).markers;
    expect(d.caption).toMatchObject({ halo: false, case: "title", rot: -5, spacing: 0.1 });
    expect(parseHexMap("grid: hex\n---\nm(0,0): pin (A) tline=#222").markers[0].caption?.halo).toBe("#222");
  });
});

describe("text widths", () => {
  it("break text between words to fit, a long word on a line of its own", async () => {
    const { wrapText, withCase } = await import("./labels");
    const em = (t: string) => t.length * 0.5;
    expect(wrapText("Holy City of Featherbark", 5, em)).toEqual(["Holy City", "of", "Featherbark"]);
    expect(wrapText("Holy City of Featherbark", 0, em)).toEqual(["Holy City of Featherbark"]);
    expect(withCase("holy city", "title")).toBe("Holy City");
  });

  it("wrap a caption, a lettering label and a region name at their width", () => {
    const d = draw(
      "grid: hex\nregions:\n  A: { label: { text: The Long Duchy Name, width: 1 } }\n---\nt(0,0): plains @A\nm(0,0): pin (Holy City of Featherbark) twidth=1\nl(0,0): (The Sunken Coast) place width=1"
    );
    expect(d.markers[0].caption?.lines?.length).toBeGreaterThan(1);
    expect(d.banners[0].lettering?.lines?.length).toBeGreaterThan(1);
    expect(d.regions[0].labelLines?.length).toBeGreaterThan(1);
    const [m] = parseHexMap("grid: hex\n---\nm(0,0): pin (A) twidth=2.5").markers;
    expect(markerContent(m)).toBe("pin (A) twidth=2.5");
  });
});

describe("lettering label outline, case and spacing", () => {
  it("read and write line, case and space, and draw them", async () => {
    const { labelContent } = await import("./point-lines");
    const line = "l(0,0): (Dunlind) place line=none case=upper space=0.05";
    const [l] = parseHexMap(`grid: hex\n---\n${line}`).labels;
    expect(l).toMatchObject({ halo: false, case: "upper", spacing: 0.05 });
    expect(labelContent(l)).toBe("(Dunlind) place line=none case=upper space=0.05");
    const [b] = draw(`grid: hex\n---\nt(0,0): plains\n${line}`).banners;
    expect(b.text.value).toBe("DUNLIND");
    expect(b.lettering).toMatchObject({ halo: "none", spacing: 0.05 });
  });
});
