import { describe, it, expect } from "vitest";
import {
  colLetters,
  fitToImage,
  parseSquare,
  parseSquareMap,
  squareDistance,
  squareName,
  terrainColor,
} from "./square-map";

describe("square names — chessboard style", () => {
  it("reads and writes C4, AA10", () => {
    expect(parseSquare("C4")).toEqual({ col: 2, row: 3 });
    expect(parseSquare("aa10")).toEqual({ col: 26, row: 9 });
    expect(squareName({ col: 2, row: 3 })).toBe("C4");
    expect(colLetters(26)).toBe("AA");
  });

  it("rejects what isn't a square", () => {
    expect(parseSquare("4C")).toBeNull();
    expect(parseSquare("C0")).toBeNull();
    expect(parseSquare("Talon")).toBeNull();
  });

  it("counts distance the way the rules do — a diagonal is one step", () => {
    expect(squareDistance({ col: 0, row: 0 }, { col: 3, row: 2 })).toBe(3);
  });
});

describe("parseSquareMap", () => {
  const source = [
    "title: Kobold Ambush",
    "legend:",
    '  ".": { terrain: grass }',
    '  "^": { terrain: rocks, cover: half }',
    '  "#": cliff',
    "tokens:",
    "  Talon: C3",
    '  "[[Kobold, Elite]]": F2',
    "---",
    "# # # # # # #",
    "# . . ^ . . #",
    "# . . . . . #",
    "",
  ].join("\n");

  it("reads the grid, legend and default spots", () => {
    const map = parseSquareMap(source);
    expect([map.cols, map.rows, map.title, map.scale]).toEqual([7, 3, "Kobold Ambush", 5]);
    expect(map.cells[1]).toEqual(["#", ".", ".", "^", ".", ".", "#"]);
    expect(map.legend["^"]).toEqual({ terrain: "rocks", cover: "half" });
    expect(map.legend["#"]).toEqual({ terrain: "cliff" });
    expect(map.tokens).toEqual({ Talon: { col: 2, row: 2 }, "[[Kobold, Elite]]": { col: 5, row: 1 } });
  });

  it("reads rows written one character per square", () => {
    const map = parseSquareMap("---\n#..#\n#~~#\n");
    expect(map.cells).toEqual([
      ["#", ".", ".", "#"],
      ["#", "~", "~", "#"],
    ]);
  });

  it("pads short rows so the grid is rectangular", () => {
    expect(parseSquareMap("---\n# # #\n# .\n").cells[1]).toEqual(["#", ".", ""]);
  });
});

describe("picture maps", () => {
  const src = `grid: square
image: "[[ambush.webp]]"
cell: 33
offset: -1, -1
tokens:
  Talon: J14
---`;

  it("reads the picture, its square size and where its grid starts", () => {
    const map = parseSquareMap(src);
    expect(map.image).toEqual({ link: "[[ambush.webp]]", cell: 33, offsetX: -1, offsetY: -1 });
    expect(map.tokens.Talon).toEqual({ col: 9, row: 13 });
    expect(map.cols).toBe(0);
  });

  it("takes as many squares as the picture holds, once its size is known", () => {
    const map = fitToImage(parseSquareMap(src), 825, 724);
    expect([map.cols, map.rows]).toEqual([25, 22]);
    expect(map.cells).toHaveLength(22);
    expect(map.cells[0]).toHaveLength(25);
  });

  it("keeps a written size", () => {
    const map = parseSquareMap(src.replace("cell: 33", "cell: 33\nsize: 20x10"));
    expect([map.cols, map.rows]).toEqual([20, 10]);
    expect(fitToImage(map, 825, 724).cols).toBe(20);
  });

  it("needs a square size to use the picture", () => {
    expect(parseSquareMap(src.replace("cell: 33\n", "")).image).toBeUndefined();
  });
});

describe("terrainColor", () => {
  it("uses the legend's colour, then a built-in one, then a stable fallback", () => {
    expect(terrainColor({ terrain: "grass", color: "#123" }, ".")).toBe("#123");
    expect(terrainColor({ terrain: "water" }, "~")).toBe("#4a7fb5");
    expect(terrainColor({ terrain: "moss" }, "m")).toBe(terrainColor({ terrain: "moss" }, "m"));
    expect(terrainColor(undefined, "")).toBe("transparent");
  });
});
