import { describe, expect, it } from "vitest";
import { type Surroundings, pathMouths, pickAutotileTurned } from "./autotile";
import { layoutHexMap, resolveHexMap } from "./layout";
import { buildPack, parsePackConfig } from "./packs";
import { parseHexMap } from "./parse-hex-map";

const pack = buildPack(
  "basic",
  ["terrain/land/plains/a.webp", "path/rivers/turn120-2.webp", "path/rivers/straight-0.webp"].map((path) => ({
    path,
    url: `u:${path}`,
  })),
  parsePackConfig(
    `autotile:
  rivers:
    connectsTo: [water]
    except: [swamp]
    tiles:
      turn120-2: rivers/turn120-2
      straight-0: rivers/straight-0`,
    "basic"
  )
);

describe("pickAutotileTurned", () => {
  it("uses the tile for the sides when there is one", () => {
    expect(pickAutotileTurned(pack, "rivers", ["N", "S"], "s")).toMatchObject({ turn: 0 });
  });

  it("turns another slot of the shape into place when there isn't", () => {
    // N,SE is turn120-0: turn120-2 turned back… forward four sides (2 + 4 = 6 = 0).
    const got = pickAutotileTurned(pack, "rivers", ["N", "SE"], "s");
    expect(got?.file.name).toBe("turn120-2");
    expect(got?.turn).toBe(4);
    // straight has three slots: NE,SW is straight-1, straight-0 turned one side.
    expect(pickAutotileTurned(pack, "rivers", ["NE", "SW"], "s")?.turn).toBe(1);
  });

  it("draws the turned tile rotated about its hex", () => {
    const map = parseHexMap(
      "grid: hex\n---\nt(0,0): plains\nt(0,-1): plains\nt(1,0): plains\np(0,-1): rivers\np(0,0): rivers\np(1,0): rivers"
    );
    const layout = layoutHexMap(
      resolveHexMap(map, new Map([["basic", pack]]), "basic"),
      new Map([["u:path/rivers/turn120-2.webp", { w: 932, h: 810 }]])
    );
    const turned = layout.items.find((i) => i.kind === "tile" && i.url.endsWith("turn120-2.webp"));
    expect(turned && turned.kind === "tile" && turned.rotate?.deg).toBe(240);
  });
});

describe("pathMouths except", () => {
  it("doesn't open a river into a terrain its except names", () => {
    const around: Surroundings = {
      paths: new Map([["0,0", new Set(["rivers"])]]),
      terrain: new Map([
        ["0,0", "plains"],
        ["0,1", "water"],
      ]),
      ground: new Map([
        ["0,0", "land"],
        ["0,1", "water"],
      ]),
      folder: new Map([["0,1", "swamp"]]),
    };
    expect(pathMouths("rivers", around, ["water"], ["0,0"]).get("0,0")).toBe("S");
    expect(pathMouths("rivers", around, ["water"], ["0,0"], ["swamp"]).size).toBe(0);
  });
});
