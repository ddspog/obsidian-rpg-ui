import { describe, expect, it } from "vitest";
import { hexCenter, neighbour, pixelToHex, SIDES } from "./axial";
import { hexAt, layoutHexMap, resolveHexMap } from "./layout";
import { buildPack, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";

describe("axial", () => {
  it("round-trips centres through pixelToHex", () => {
    for (const [q, r] of [
      [0, 0],
      [3, -2],
      [-4, 5],
      [7, 7],
    ]) {
      const { x, y } = hexCenter(q, r, 40);
      expect(pixelToHex(x + 5, y - 5, 40)).toEqual({ q, r });
    }
  });
  it("puts each neighbour on its side", () => {
    const c = hexCenter(0, 0, 40);
    const n = SIDES.map((s) => {
      const h = neighbour({ q: 0, r: 0 }, s);
      const p = hexCenter(h.q, h.r, 40);
      return Math.round((Math.atan2(p.x - c.x, -(p.y - c.y)) * 180) / Math.PI);
    });
    expect(n).toEqual([0, 60, 120, 180, -120, -60]);
  });
});

const pack = buildPack(
  "basic",
  [
    { path: "terrain/plains/a.webp", url: "u:plains" },
    { path: "stack/buildings/house.webp", url: "u:house" },
    { path: "path/roads/road.webp", url: "u:road" },
  ],
  parsePackConfig("defaults: { hexWidth: 477, borderWidth: 0 }", "basic")
);
const packs = new Map([["basic", pack]]);
const sizes = new Map([
  ["u:plains", { w: 932, h: 810 }],
  ["u:house", { w: 245, h: 168 }],
  ["u:road", { w: 932, h: 810 }],
]);

describe("resolveHexMap + layoutHexMap", () => {
  it("draws by height, then terrain < edge < path < stack, then top to bottom", () => {
    const map = parseHexMap(`grid: hex
---
0m:
  * p(0,0): roads
  * s(0,0): buildings
  * t(0,1): plains
  * t(0,0): plains
100m:
  * t(0,-1): plains`);
    const layout = layoutHexMap(resolveHexMap(map, packs, "basic"), sizes);
    expect(layout.items.map((i) => i.key.split(":")[0] + ":" + i.key.split(":")[1])).toEqual([
      "0,0:terrain",
      "0,1:terrain",
      "0,0:path",
      "0,0:stack",
      "0,-1:terrain",
    ]);
  });

  it("scales tiles so the hex face spans the hex: 932 px at hexWidth 477", () => {
    const layout = layoutHexMap(
      resolveHexMap(parseHexMap("grid: hex\n---\nt(0,0): plains"), packs, "basic"),
      sizes,
      40
    );
    const tile = layout.items[0];
    expect(tile.kind).toBe("tile");
    if (tile.kind === "tile") {
      expect(tile.w).toBeCloseTo((932 * 80) / 477);
      expect(tile.x + tile.w / 2).toBeCloseTo(0);
    }
  });

  it("falls back to a hatched colour for a missing tile and reports it", () => {
    const resolved = resolveHexMap(parseHexMap("grid: hex\n---\nt(0,0): lava + #ff3300"), packs, "basic");
    expect(resolved.errors.map((e) => e.message)).toEqual(['no terrain tile for "lava" in pack "basic"']);
    const fill = layoutHexMap(resolved, sizes).items[0];
    expect(fill).toMatchObject({ kind: "fill", color: "#ff3300", missing: true });
  });

  it("draws plain colours with the flat pack, without errors", () => {
    const resolved = resolveHexMap(parseHexMap("grid: hex\npack: flat\n---\nt(0,0): forest"), packs, "basic");
    expect(resolved.errors).toEqual([]);
    expect(layoutHexMap(resolved, sizes).items[0]).toMatchObject({ kind: "fill", color: "#2E7D32", missing: false });
  });

  it("names a linked place after its note", () => {
    const layout = layoutHexMap(
      resolveHexMap(
        parseHexMap("grid: hex\n---\nt(0,0): plains [[Places/Featherbark|the Holy City]]\nt(1,0): (Ford) plains"),
        packs,
        "basic"
      ),
      sizes
    );
    expect(layout.labels.map((l) => l.text)).toEqual(["the Holy City", "Ford"]);
  });

  it("scatters xN copies inside the hex, the same way each time", () => {
    const src = "grid: hex\n---\ns(0,0): buildings x3";
    const a = layoutHexMap(resolveHexMap(parseHexMap(src), packs, "basic"), sizes).items;
    const b = layoutHexMap(resolveHexMap(parseHexMap(src), packs, "basic"), sizes).items;
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
    for (const item of a)
      if (item.kind === "tile") expect(Math.hypot(item.x + item.w / 2, item.y + item.h / 2)).toBeLessThan(40 * 0.5);
  });
});

describe("bases and height", () => {
  const based = buildPack(
    "basic",
    [
      { path: "terrain/plains/a.webp", url: "u:plains" },
      { path: "terrain/hills/b.webp", url: "u:hills" },
      { path: "base/level.webp", url: "u:level" },
      { path: "base/rocky.webp", url: "u:rocky" },
    ],
    parsePackConfig(
      `defaults: { hexWidth: 400, step: 40, borderWidth: 0 }
terrains:
  hills: { hides: true }
base: level`,
      "basic"
    )
  );
  const all = new Map([["basic", based]]);
  const sz = new Map([
    ["u:plains", { w: 400, h: 400 }],
    ["u:hills", { w: 400, h: 400 }],
    ["u:level", { w: 400, h: 400 }],
    ["u:rocky", { w: 400, h: 400 }],
  ]);
  const tiles = (src: string) => {
    const layout = layoutHexMap(resolveHexMap(parseHexMap(src), all, "basic"), sz);
    return { layout, items: layout.items.filter((i) => i.kind === "tile") };
  };

  it("lifts a hex by its steps and gives it a slab per step above the ground", () => {
    const { layout, items } = tiles(`grid: hex
---
0m:
  * t(0,1): plains
200m: base=rocky
  * t(0,0): plains`);
    // A step is 40 / 400 of the hex width (2R = 80): 8 units; two steps lift 16.
    expect(layout.hexes.get("0,0")!.cy).toBeCloseTo(hexCenter(0, 0, 40).y - 16);
    const rocky = items.filter((i) => i.kind === "tile" && i.url === "u:rocky");
    // Two steps above the ground: two slabs, the lower one first, a step apart.
    expect(rocky).toHaveLength(2);
    expect(rocky[1].kind === "tile" && rocky[0].kind === "tile" && rocky[0].y - rocky[1].y).toBeCloseTo(8);
    // Every other slab is mirrored about the hex's centre: the top one isn't.
    const flips = rocky.map((i) => (i.kind === "tile" ? i.flipX : undefined));
    expect(flips[1]).toBeUndefined();
    expect(flips[0]).toBeCloseTo(hexCenter(0, 0, 40).x);
    // The 0m hex takes the pack's base, one slab.
    expect(items.filter((i) => i.kind === "tile" && i.url === "u:level")).toHaveLength(1);
    // A base draws just over its hex's terrain (covering the baked-in slab), and
    // higher groups after lower ones; a raised hex's lower slabs with the ground.
    expect(items.map((i) => (i.kind === "tile" ? i.url : ""))).toEqual([
      "u:rocky",
      "u:plains",
      "u:level",
      "u:plains",
      "u:rocky",
    ]);
  });

  it("stands a raised hex on its whole stack, down to the ground, behind the hexes in front", () => {
    const { items } = tiles(`grid: hex
---
400m: base=rocky
  * t(0,1): plains
500m: base=rocky
  * t(0,0): plains`);
    // A step above the hex in front, five above the ground: five slabs, drawn before that hex.
    const keys = items.map((i) => i.key.split(":").slice(0, 2).join(":"));
    expect(keys.filter((k) => k === "0,0:base")).toHaveLength(5);
    expect(keys.filter((k) => k === "0,1:base")).toHaveLength(4);
    // The lower four go behind the hex in front (the top one, under the face, stays with its hex).
    const back = items.flatMap((i, n) => (i.key.startsWith("0,0:base") ? [n] : []));
    for (const n of back.slice(0, 4)) expect(n).toBeLessThan(keys.indexOf("0,1:terrain"));
    expect(back[4]).toBeGreaterThan(keys.indexOf("0,1:terrain"));
  });

  it("draws each base right after its own hex's terrain, so the next row's face covers it", () => {
    const { items } = tiles(`grid: hex
---
t(0,1): hills
t(0,0): plains`);
    expect(items.map((i) => (i.kind === "tile" ? `${i.key.split(":")[0]}:${i.url}` : ""))).toEqual([
      "0,0:u:plains",
      "0,0:u:level",
      "0,1:u:hills",
      "0,1:u:level",
    ]);
  });

  it("a raised hex with no base repeats its own tile below, only under the face", () => {
    const bare = buildPack(
      "basic",
      [{ path: "terrain/plains/a.webp", url: "u:plains" }],
      parsePackConfig("defaults: { hexWidth: 400, step: 40, borderWidth: 0 }", "basic")
    );
    const layout = layoutHexMap(
      resolveHexMap(
        parseHexMap(`grid: hex
---
0m:
  * t(0,1): plains
300m:
  * t(0,0): plains`),
        new Map([["basic", bare]]),
        "basic"
      ),
      sz
    );
    const raised = layout.items.filter((i) => i.kind === "tile" && i.key.startsWith("0,0:"));
    // Three steps above the ground: the baked-in slab is one, two more under it, lowest first.
    expect(raised).toHaveLength(3);
    const [low, mid, face] = raised.map((i) => (i.kind === "tile" ? i : undefined)!);
    expect(low.y - mid.y).toBeCloseTo(8);
    expect(mid.y - face.y).toBeCloseTo(8);
    expect(face.below).toBeUndefined();
    expect(mid.below).toBeCloseTo(layout.hexes.get("0,0")!.cy);
    // The 0m hex stands on the ground: no copies.
    expect(layout.items.filter((i) => i.key.startsWith("0,1:"))).toHaveLength(1);
  });

  it("a hex's own b line beats its group's and the pack's base; none draws none", () => {
    const own = tiles(`grid: hex
---
100m: base=level
  * t(0,0): plains
  * b(0,0): rocky`);
    expect(own.items.some((i) => i.kind === "tile" && i.url === "u:rocky")).toBe(true);
    expect(own.items.some((i) => i.kind === "tile" && i.url === "u:level")).toBe(false);
    const none = layoutHexMap(resolveHexMap(parseHexMap("grid: hex\n---\nt(0,0): plains"), packs, "basic"), sizes);
    expect(none.items).toHaveLength(1);
  });

  it("crops terrain that hides its baked-in base, only where the hex has a base", () => {
    const { items } = tiles(`grid: hex
---
t(0,0): hills
t(1,0): plains`);
    const hills = items.find((i) => i.kind === "tile" && i.url === "u:hills");
    const plains = items.find((i) => i.kind === "tile" && i.url === "u:plains");
    expect(hills?.kind === "tile" && hills.crop).toBeTruthy();
    expect(plains?.kind === "tile" && plains.crop).toBeFalsy();
  });

  it("reports a missing group base once", () => {
    const resolved = resolveHexMap(
      parseHexMap(`grid: hex
---
100m: base=marble
  * t(0,0): plains
  * t(1,0): plains`),
      all,
      "basic"
    );
    expect(resolved.errors.filter((e) => e.message.includes("marble"))).toHaveLength(1);
  });

  it("finds a raised hex under the pointer", () => {
    const { layout } = tiles(`grid: hex
---
500m:
  * t(0,0): plains`);
    const h = layout.hexes.get("0,0")!;
    expect(hexAt(layout, h.cx, h.cy)).toBe(h);
  });
});

describe("labels on the map", () => {
  const labelled = buildPack(
    "basic",
    ["left", "fill", "right"].map((n) => ({ path: `label/title-4/${n}.webp`, url: `u:${n}` })),
    parsePackConfig("labels:\n  title-4: { overlap: 0 }", "basic")
  );
  const labelSizes = new Map([
    ["u:left", { w: 100, h: 200 }],
    ["u:fill", { w: 100, h: 200 }],
    ["u:right", { w: 100, h: 200 }],
  ]);

  it("grows the banner, centres it on its (fractional) spot and scales it to its size", () => {
    const map = parseHexMap("grid: hex\n---\nt(0,0): #88aa55\nl(0.5,0): (Featherbark) title-4 size=2 rot=10");
    const resolved = resolveHexMap(map, new Map([["basic", labelled]]), "basic");
    expect(resolved.errors).toEqual([]);
    const layout = layoutHexMap(resolved, labelSizes, 40, (t) => t.length * 0.5);
    const [b] = layout.banners;
    expect(b.cx).toBeCloseTo(hexCenter(0.5, 0, 40).x);
    expect(b.rot).toBe(10);
    // (11 letters × 0.5 em + 1 em of room) × 60 px = 390 px of text over 150 px: three strips.
    expect(b.pieces.map((p) => p.role)).toEqual(["left", "fill", "fill", "fill", "right"]);
    expect(b.scale * b.h).toBeCloseTo(1.1 * 40 * 2);
  });

  it("draws a plain tag, and says so, for a family the pack hasn't got", () => {
    const map = parseHexMap("grid: hex\n---\nl(0,0): (Ford) title-9");
    const resolved = resolveHexMap(map, new Map([["basic", labelled]]), "basic");
    expect(resolved.errors[0].message).toMatch(/no label family "title-9".*title-4/);
    const [b] = layoutHexMap(resolved, labelSizes).banners;
    expect(b.pieces).toEqual([]);
    expect(b.text.value).toBe("Ford");
  });
});

describe("markers on the map", () => {
  const marked = buildPack(
    "basic",
    ["pin/red", "pin/blue", "party/1"].map((n) => ({ path: `marker/${n}.webp`, url: `u:${n}` })),
    parsePackConfig("markers:\n  party: { anchor: [0.5, 0.5], size: 2 }", "basic")
  );
  const markerSizes = new Map([
    ["u:pin/red", { w: 50, h: 100 }],
    ["u:pin/blue", { w: 50, h: 100 }],
    ["u:party/1", { w: 100, h: 100 }],
  ]);
  const lay = (body: string) => {
    const resolved = resolveHexMap(parseHexMap(`grid: hex\n---\n${body}`), new Map([["basic", marked]]), "basic");
    return { resolved, layout: layoutHexMap(resolved, markerSizes, 40) };
  };

  it("stands a marker on its point by its anchor", () => {
    const { layout } = lay("m(1,0): pin[red] (Talon)");
    const [m] = layout.markers;
    const at = hexCenter(1, 0, 40);
    expect(m.x).toBeCloseTo(at.x);
    expect(m.box.h).toBeCloseTo(0.9 * 40);
    expect(m.box.y + m.box.h * 0.96).toBeCloseTo(at.y);
    expect(m.text).toBe("Talon");
  });

  it("uses the style's anchor and size", () => {
    const { layout } = lay("m(0,0): party[1]");
    const [m] = layout.markers;
    expect(m.box.h).toBeCloseTo(0.9 * 40 * 2);
    expect(m.box.y + m.box.h / 2).toBeCloseTo(0);
  });

  it("fans out markers on one spot", () => {
    const { layout } = lay("m(0,0): pin[red]\nm(0,0): pin[blue]");
    const [a, b] = layout.markers;
    // Centred on the spot, pictures side by side.
    expect(a.x).toBeCloseTo(-b.x);
    expect(b.box.x).toBeGreaterThan(a.box.x + a.box.w);
  });

  it("makes room for each one's name", () => {
    const { layout } = lay("m(0,0): pin[red] (Elara Windrunner)\nm(0,0): pin[blue] (Thorne)");
    const [a, b] = layout.markers;
    // roughEm: 16 letters × 0.55 em × 0.28 × 40 — half of each name either side of its marker.
    const half = (t: string) => (t.length * 0.55 * 0.28 * 40) / 2;
    expect(b.x - half("Thorne")).toBeGreaterThan(a.x + half("Elara Windrunner"));
  });

  it("draws a plain pin, and says so, for a style the pack hasn't got", () => {
    const { resolved, layout } = lay("m(0,0): signpost[skull]");
    expect(resolved.errors[0].message).toMatch(/no marker for "signpost\[skull\]"/);
    expect(layout.markers[0].url).toBeUndefined();
  });
});

describe("looks (size= shift= hue= sat=)", () => {
  it("scales a tile about the hex centre, shifts it in hex widths, and shares one filter per colour", () => {
    const draw = (line: string) => {
      const layout = layoutHexMap(resolveHexMap(parseHexMap(`grid: hex\n---\n${line}`), packs, "basic"), sizes);
      return { tile: layout.items[0] as { x: number; y: number; w: number; h: number; filter?: string }, layout };
    };
    const plain = draw("t(0,0): plains").tile;
    const big = draw("t(0,0): plains size=2").tile;
    expect(big.w).toBeCloseTo(plain.w * 2);
    expect(big.x + big.w / 2).toBeCloseTo(plain.x + plain.w / 2);
    const moved = draw("t(0,0): plains shift=0.5,0").tile;
    expect(moved.x - plain.x).toBeCloseTo(40); // half a hex width, R = 40
    const tinted = draw("t(0,0): plains hue=40 sat=0.5\nt(1,0): plains hue=40 sat=0.5");
    expect(tinted.layout.filters).toEqual([{ key: "h40s0_5b1", hue: 40, sat: 0.5, bright: 1 }]);
    expect(tinted.tile.filter).toBe("h40s0_5b1");
  });
});
