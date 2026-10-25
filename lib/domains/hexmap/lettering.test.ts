import { describe, expect, it } from "vitest";
import { arcPath, labelFamilies } from "./labels";
import { layoutHexMap, resolveHexMap } from "./layout";
import { buildPack, fontFaceOf, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";

const pack = buildPack(
  "basic",
  ["terrain/land/plains/a.webp", "fonts/Bookmania-Black.ttf"].map((path) => ({ path, url: `u:${path}` })),
  parsePackConfig(
    `labels:
  realm: { lettering: true, font: Bookmania, weight: black, color: "#141414", halo: "#f3efe2", spacing: 0.02 }`,
    "basic"
  )
);

describe("fontFaceOf", () => {
  it("reads family, weight and style from a font's name", () => {
    expect(fontFaceOf("fonts/Bookmania-Black.ttf")).toEqual({ family: "Bookmania", weight: 900, italic: false });
    expect(fontFaceOf("fonts/Bookmania-Semibold Italic.otf")).toEqual({
      family: "Bookmania",
      weight: 600,
      italic: true,
    });
    expect(fontFaceOf("fonts/Bookmania-Regular.woff2")?.weight).toBe(400);
    expect(fontFaceOf("label/title-1/left.webp")).toBeNull();
  });
});

describe("lettering", () => {
  it("is a label family named in labels: alone", () => {
    const realm = labelFamilies(pack).get("realm");
    expect(realm).toMatchObject({ lettering: true, tuning: { font: "Bookmania", weight: 900, halo: "#f3efe2" } });
  });

  it("draws just the text, bent along its arc", () => {
    const map = parseHexMap("grid: hex\n---\nt(0,0): plains\nl(0,0): (Dunlind) realm size=2 rot=-3 arc=22");
    expect(map.labels[0]).toMatchObject({ family: "realm", size: 2, rot: -3, arc: 22 });
    const layout = layoutHexMap(resolveHexMap(map, new Map([["basic", pack]]), "basic"), new Map());
    const [b] = layout.banners;
    expect(b.pieces).toEqual([]);
    expect(b.text).toMatchObject({ value: "Dunlind", font: "Bookmania", color: "#141414" });
    expect(b.lettering).toMatchObject({ weight: 900, halo: "#f3efe2", spacing: 0.02 });
    expect(b.lettering?.arc).toMatch(/^M-?[\d.]+,[\d.]+A/);
  });

  it("bows up for a positive arc and down for a negative one", () => {
    // Sweep 1 runs over the top, between level ends.
    expect(arcPath(100, 30).d).toMatch(/ 0 1 /);
    expect(arcPath(100, -30).d).toMatch(/ 0 0 /);
    expect(arcPath(100, 30).sag).toBeGreaterThan(0);
    expect(arcPath(100, 0)).toEqual({ d: "M-50,0L50,0", sag: 0 });
  });

  it("draws an arc longer than its text, so the end letters aren't cut off", () => {
    for (const bend of [20, 61, 180]) {
      const m = arcPath(100, bend).d.match(/A([\d.]+)/)!;
      const r = +m[1];
      expect(r * ((bend * Math.PI) / 180)).toBeGreaterThan(105);
    }
  });

  it("lets a region leave its name to the map's lettering", () => {
    const map = parseHexMap("grid: hex\nregions:\n  A: { label: false }\n---\nt(0,0): plains @A");
    const layout = layoutHexMap(resolveHexMap(map, new Map([["basic", pack]]), "basic"), new Map());
    expect(layout.regions[0].title).toBe("");
  });
});
