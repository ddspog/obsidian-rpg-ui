import { describe, expect, it } from "vitest";
import {
  composeLabel,
  labelFamilies,
  labelRole,
  legacyLabelRole,
  planLabelRenames,
  type ImageSizeLike,
} from "./labels";
import { buildPack, parsePackConfig, type TileFile } from "./packs";

const paths = [
  "label/title-1/left.webp",
  "label/title-1/fill-left.webp",
  "label/title-1/centre.webp",
  "label/title-1/fill-right.webp",
  "label/title-1/right.webp",
  "label/title-1/small.webp",
  "label/title-4/left.webp",
  "label/title-4/fill.webp",
  "label/title-4/fill-2.webp",
  "label/title-4/right.webp",
  "label/title-4/notes.webp",
];
const SIZES: Record<string, ImageSizeLike> = {
  "title-1/left": { w: 180, h: 300 },
  "title-1/fill-left": { w: 140, h: 300 },
  "title-1/centre": { w: 400, h: 300 },
  "title-1/fill-right": { w: 140, h: 300 },
  "title-1/right": { w: 150, h: 300 },
  "title-4/left": { w: 270, h: 250 },
  "title-4/fill": { w: 200, h: 250 },
  "title-4/fill-2": { w: 200, h: 250 },
  "title-4/right": { w: 250, h: 250 },
};
const config = parsePackConfig(
  `labels:
  title-1: { inset: [120, 60, 50, 75], size: 0.3, overlap: 0 }
  title-4: { overlap: 0 }`,
  "basic"
);
const pack = buildPack(
  "basic",
  paths.map((path) => ({ path, url: path.replace(/^label\//, "").replace(/\.webp$/, "") })),
  config
);
const sizeOf = (url: string) => SIZES[url];
const families = labelFamilies(pack);
const roles = (c: ReturnType<typeof composeLabel>) => c?.pieces.map((p) => p.role).join(" ");

describe("label roles", () => {
  it("reads a role from a file name, numbered or lettered", () => {
    expect(labelRole("fill")).toBe("fill");
    expect(labelRole("fill-2")).toBe("fill");
    expect(labelRole("fillb")).toBe("fill");
    expect(labelRole("fill-left")).toBe("fill-left");
    expect(labelRole("Center")).toBe("centre");
    expect(labelRole("notes")).toBeNull();
  });

  it("reads an imported pack's names, the mid by whether there are extensions", () => {
    expect(legacyLabelRole("Title Banner 1 (flex) left extension", true)).toBe("fill-left");
    expect(legacyLabelRole("Title Banner 1 (flex) mid", true)).toBe("centre");
    expect(legacyLabelRole("Title Banner 4 (flex) mid", false)).toBe("fill");
    expect(legacyLabelRole("Title Banner 4 (flex) right", false)).toBe("right");
    expect(legacyLabelRole("Title Banner 4 (long)", false)).toBeNull();
    // Standard names keep their role.
    expect(legacyLabelRole("fill-left", true)).toBe("fill-left");
    expect(legacyLabelRole("left-2", true)).toBe("left");
    expect(legacyLabelRole("notes", true)).toBeNull();
  });

  it("plans nothing for a folder already named by role", () => {
    const f = [...families.get("title-1")!.pieces.left!, ...families.get("title-1")!.pieces["fill-left"]!];
    expect(planLabelRenames(f, (x) => legacyLabelRole(x.name, true))).toEqual([]);
  });

  it("plans names by role, numbering repeats", () => {
    const files = ["a/x", "a/y", "a/z"].map((path): TileFile => ({ name: path.slice(2), path, url: path }));
    expect(planLabelRenames(files, () => "fill")).toEqual([
      { from: "a/x", to: "a/fill" },
      { from: "a/y", to: "a/fill-2" },
      { from: "a/z", to: "a/fill-3" },
    ]);
  });

  it("sorts a folder's files by role, ignoring the rest", () => {
    const f = families.get("title-4")!;
    expect(f.pieces.fill?.map((x) => x.name)).toEqual(["fill", "fill-2"]);
    expect(Object.keys(f.pieces).sort()).toEqual(["fill", "left", "right"]);
    expect(families.get("title-1")!.tuning.inset).toEqual([120, 60, 50, 75]);
  });
});

describe("composeLabel", () => {
  const t4 = families.get("title-4")!;
  const t1 = families.get("title-1")!;

  it("adds strips until the text fits", () => {
    // Text box with no strips: 270 + 250 − insets (62.5 + 67.5) = 390 px; text 0.3 × 250 = 75 px per em.
    expect(roles(composeLabel(t4, 4, sizeOf, "s"))).toBe("left right");
    expect(roles(composeLabel(t4, 6, sizeOf, "s"))).toBe("left fill right");
    expect(roles(composeLabel(t4, 8, sizeOf, "s"))).toBe("left fill fill right");
    const c = composeLabel(t4, 8, sizeOf, "s")!;
    expect(c.w).toBe(270 + 400 + 250);
    expect(c.text.size).toBe(75);
  });

  it("grows a banner with a centre on both sides, keeping the centre in the middle", () => {
    const c = composeLabel(t1, 12, sizeOf, "s")!;
    const r = roles(c)!.split(" ");
    const mid = r.indexOf("centre");
    expect(r.filter((x) => x === "fill-left").length).toBe(r.filter((x) => x === "fill-right").length);
    expect(r.slice(1, mid).every((x) => x === "fill-left")).toBe(true);
    expect(r[0]).toBe("left");
    expect(r[r.length - 1]).toBe("right");
    // Text is centred in the inset box.
    expect(c.text.x).toBe(75 + (c.w - 75 - 60) / 2);
    expect(c.text.y).toBe(120 + (300 - 120 - 50) / 2);
  });

  it("ignores files named for no role (an old finished banner)", () => {
    expect(Object.keys(families.get("title-1")!.pieces)).not.toContain("small");
    expect(composeLabel(t1, 2, sizeOf, "s")?.pieces.every((p) => p.url !== "title-1/small")).toBe(true);
  });

  it("is null with nothing measured", () => {
    expect(composeLabel(t4, 3, () => undefined, "s")).toBeNull();
  });
});
