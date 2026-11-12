import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hexDistance } from "lib/domains/hexmap/play";
import { generateHexes, placeFor, resultTerrain, tileFor } from "./generate";
import { parseHexFlower, startState } from "./hex-flower";

const wilderness = parseHexFlower(readFileSync(join(__dirname, "fixtures", "wilderness.yml"), "utf8"));

/** A fixed sequence of "random" numbers, repeated. */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("generating map hexes from a flower", () => {
  it("reads results as terrain types", () => {
    expect(resultTerrain("Hills")).toBe("hills");
    expect(resultTerrain("Tundra")).toBe("arctic");
    expect(resultTerrain("Military Ward")).toBe("ruins");
    expect(resultTerrain("Large Caverns")).toBe("underground");
    expect(resultTerrain("Something")).toBeNull();
  });

  it("turns results into tiles, the map's own first", () => {
    expect(tileFor("Mountains")).toEqual({ spec: "mountain[rocky][medium]" });
    expect(tileFor("Coastal")).toEqual({ spec: "plains[lush]", terrain: "coastal" });
    expect(tileFor("Mountains", { mountains: "mountain[snowy]" })).toEqual({
      spec: "mountain[snowy]",
      terrain: "mountain",
    });
    expect(tileFor("Something")).toBeNull();
  });

  it("puts the token on the cell a neighbour's result or terrain names", () => {
    expect(placeFor(wilderness, "Badlands")).toEqual({ at: { q: -1, r: 0 }, result: "Badlands" });
    // Hills: the one nearest Start.
    expect(placeFor(wilderness, "hills")?.at).toEqual({ q: 0, r: -1 });
    expect(placeFor(wilderness, "swamp")?.at).toEqual({ q: 0, r: 2 });
    expect(placeFor(wilderness, "urban")).toBeNull();
  });

  it("walks on from hex to hex, starting from a known neighbour", () => {
    // Every roll 3+3 = 6: south-east. From Badlands (-1,0), SE is Start, which repeats Badlands;
    // the token walks on SE to Farmland/Grassland (the d6 pick, 3, gives Farmland).
    const known = new Map([["0,0", "Badlands"]]);
    const targets = [
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ];
    const { generated } = generateHexes(wilderness, targets, known, startState(), seq(0.4));
    expect(generated.map((g) => g.step.result)).toEqual(["Badlands", "Farmland"]);
    expect(hexDistance(generated[0].hex, generated[1].hex)).toBe(1);
  });

  it("skips hexes that are already known", () => {
    const known = new Map([["1,0", "Forest"]]);
    const { generated } = generateHexes(wilderness, [{ q: 1, r: 0 }], known, startState(), seq(0.1));
    expect(generated).toEqual([]);
  });
});

describe("finding flowers in notes", () => {
  it("takes each rpg hexflower block's source", async () => {
    const { flowerSources, chooseFlower } = await import("./find-flowers");
    const text = "intro\n```rpg hexflower\ntitle: A\ncells:\n  N: X\n```\n\n````rpg hexflower\ntitle: B\n````\n";
    expect(flowerSources(text)).toEqual(["title: A\ncells:\n  N: X\n", "title: B\n"]);
    const found = [
      { path: "x/Ruins.md", title: "Ruins/Underground Terrain Elements", flower: wilderness },
      { path: "x/Hexcrawls.md", title: "Wilderness Terrain Elements", flower: wilderness },
    ];
    expect(chooseFlower(found)?.path).toBe("x/Hexcrawls.md");
    expect(chooseFlower(found, "Ruins")?.title).toBe("Ruins/Underground Terrain Elements");
    expect(chooseFlower(found, undefined, "ruins/underground terrain elements")?.path).toBe("x/Ruins.md");
  });
});

describe("a detail level keeps the big hex's character", () => {
  it("starts from the big hex's terrain when no neighbour is known", async () => {
    const { generateHexes } = await import("./generate");
    // 3+3 = 6: south-east. From Mountains (0,-2), SE is Hills (1,-2)… (0,-2)+SE = (1,-2): Hills.
    const { generated } = generateHexes(wilderness, [{ q: 10, r: 10 }], new Map(), startState(), seq(0.4), {
      anchorFor: () => "mountain",
    });
    expect(generated[0].step.from).toEqual({ q: 0, r: -2 });
    expect(generated[0].step.result).toBe("Hills");
  });

  it("pulls the token back when it strays past the tether", async () => {
    const { generateHexes } = await import("./generate");
    // A drag of four hexes, each roll 2d6 = 7 (south): from Mountains it walks down the flower;
    // with tether 1 it never gets further than one step from the mountains.
    const targets = [0, 1, 2, 3].map((q) => ({ q, r: 0 }));
    const rnd = seq(0.5, 0.0); // dice 4 and 1 = 5: SE; then 4+1 again
    const free = generateHexes(wilderness, targets, new Map(), startState(), rnd, { anchorFor: () => "mountain" });
    const tied = generateHexes(wilderness, targets, new Map(), startState(), seq(0.5, 0.0), {
      anchorFor: () => "mountain",
      tether: 1,
    });
    const far = (g: typeof free.generated) =>
      Math.max(...g.map((x) => Math.abs(x.step.to.q - 0) + Math.abs(x.step.to.r + 2)));
    expect(far(tied.generated)).toBeLessThanOrEqual(far(free.generated));
    for (const g of tied.generated) {
      const d =
        (Math.abs(g.step.from.q) + Math.abs(g.step.from.r + 2) + Math.abs(g.step.from.q + g.step.from.r + 2)) / 2;
      expect(d).toBeLessThanOrEqual(1);
    }
  });
});
