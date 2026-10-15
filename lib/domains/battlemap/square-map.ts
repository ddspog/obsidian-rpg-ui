/**
 * A square battle map, from an `rpg map` block:
 *
 *   grid: square
 *   legend:
 *     ".": { terrain: grass }
 *     "^": { terrain: rocks, cover: half }
 *     "~": { terrain: water, difficult: true }
 *     "#": { terrain: cliff, blocks: true }
 *   tokens:
 *     Talon: C4
 *     "[[Kobold, Elite]]": H2
 *   ---
 *   # # # # # # # #
 *   # . . . ^ . . #
 *   # . . ~ ~ . . #
 *
 * Squares are 5 ft. They're named like a chessboard: columns A, B, C… left to
 * right, rows 1, 2, 3… top to bottom (`C4`). Cells in a row are separated by
 * spaces, or written one character each when a row has no spaces.
 *
 * Or the board is a picture — a battle map drawn elsewhere, with its own grid:
 *
 *   grid: square
 *   image: "[[ambush.webp]]"
 *   cell: 33          # pixels per square in the picture
 *   offset: -1, -1    # where the picture's first grid line falls (x, y)
 *   size: 25x22       # columns x rows; else as many as the picture holds
 *
 * The drawn grid is then optional: written, it only adds rules to squares
 * (cover, difficult ground) on top of the picture.
 */

import { parse as parseYaml } from "yaml";

export interface Terrain {
  terrain?: string;
  color?: string;
  /** Gives cover to a creature in it: `half`, `three-quarters`, `total`. */
  cover?: string;
  /** Costs extra movement to cross. */
  difficult?: boolean;
  /** Can't be entered (a wall, a cliff face). */
  blocks?: boolean;
  /** Shown on the square (a door, an altar). */
  label?: string;
}

export interface Square {
  col: number;
  row: number;
}

export interface MapImage {
  /** As written (`[[ambush.webp]]`). */
  link: string;
  /** Pixels per square in the picture. */
  cell: number;
  /** Where the picture's grid starts, in its pixels. */
  offsetX: number;
  offsetY: number;
  /** Resolved where it's drawn — a URL the page can load. */
  url?: string;
}

export interface SquareMap {
  title?: string;
  /** A picture to play on instead of painted terrain. */
  image?: MapImage;
  cols: number;
  rows: number;
  /** One terrain key per square, row by row (`.` → the legend's grass). */
  cells: string[][];
  legend: Record<string, Terrain>;
  /** Default starting squares, by the name a combatant is written with. */
  tokens: Record<string, Square>;
  /** Feet per square. */
  scale: number;
  /** How diagonals count: each one a square (the default), or `alternate` —
   *  every second one twice (5, 10, 5…). */
  diagonals?: "alternate";
}

/** `A` → 0, `Z` → 25, `AA` → 26 — the column letters, spreadsheet-style. */
function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 0 → `A`, 26 → `AA`. */
export function colLetters(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** `C4` → `{ col: 2, row: 3 }`; null for anything that isn't a square's name. */
export function parseSquare(text: string): Square | null {
  const m = text.trim().match(/^([A-Za-z]{1,2})\s*(\d{1,3})$/);
  if (!m) return null;
  const row = parseInt(m[2], 10) - 1;
  if (row < 0) return null;
  return { col: colIndex(m[1]), row };
}

/** `{ col: 2, row: 3 }` → `C4`. */
export function squareName(sq: Square): string {
  return `${colLetters(sq.col)}${sq.row + 1}`;
}

/** Distance in squares the way the rules count it: every step, diagonals too, is one. */
export function squareDistance(a: Square, b: Square): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/** The cells of one drawn row: space-separated, or one character each. */
function rowCells(line: string): string[] {
  const trimmed = line.trim();
  return /\s/.test(trimmed) ? trimmed.split(/\s+/) : [...trimmed];
}

/** `image:` with its `cell:` and `offset:` — the picture a map is played on. */
function parseImage(meta: Record<string, unknown>): MapImage | undefined {
  if (typeof meta.image !== "string" || !meta.image.trim()) return undefined;
  const cell = typeof meta.cell === "number" && meta.cell > 0 ? meta.cell : 0;
  if (!cell) return undefined;
  const raw = meta.offset;
  const nums = (
    Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,]+/) : typeof raw === "number" ? [raw, raw] : []
  )
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
  return { link: meta.image.trim(), cell, offsetX: nums[0] ?? 0, offsetY: nums[1] ?? nums[0] ?? 0 };
}

/**
 * The size a picture map takes once the picture's own size is known: as many
 * squares as it holds (a sliver of half a square or less doesn't count).
 */
export function fitToImage(map: SquareMap, width: number, height: number): SquareMap {
  if (!map.image || (map.cols > 0 && map.rows > 0)) return map;
  const { cell, offsetX, offsetY } = map.image;
  const cols = map.cols || Math.round((width - offsetX) / cell);
  const rows = map.rows || Math.round((height - offsetY) / cell);
  const cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => map.cells[r]?.[c] ?? ""));
  return { ...map, cols, rows, cells };
}

/** Parse an `rpg map` block's source (YAML head, `---`, the drawn grid). */
export function parseSquareMap(source: string): SquareMap {
  const sep = source.search(/^---\s*$/m);
  const head = sep >= 0 ? source.slice(0, sep) : "";
  const bodyAt = sep >= 0 ? source.indexOf("\n", sep) : -1;
  // A picture map may end at its `---`, with no grid drawn below it.
  const body = sep < 0 ? source : bodyAt < 0 ? "" : source.slice(bodyAt + 1);

  let meta: Record<string, unknown> = {};
  try {
    meta = (parseYaml(head) as Record<string, unknown>) ?? {};
  } catch {
    meta = {};
  }

  const cells = body
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map(rowCells);
  const image = parseImage(meta);
  const size = typeof meta.size === "string" ? meta.size.match(/^\s*(\d+)\s*[x×]\s*(\d+)\s*$/) : null;
  const cols = size ? parseInt(size[1], 10) : Math.max(0, ...cells.map((r) => r.length));
  const rows = size ? parseInt(size[2], 10) : cells.length;
  while (cells.length < rows) cells.push([]);

  const legend: Record<string, Terrain> = {};
  for (const [key, value] of Object.entries((meta.legend as Record<string, unknown>) ?? {})) {
    legend[key] = typeof value === "string" ? { terrain: value } : ((value ?? {}) as Terrain);
  }

  const tokens: Record<string, Square> = {};
  for (const [name, at] of Object.entries((meta.tokens as Record<string, unknown>) ?? {})) {
    const sq = typeof at === "string" ? parseSquare(at) : null;
    if (sq) tokens[name] = sq;
  }

  return {
    ...(typeof meta.title === "string" ? { title: meta.title } : {}),
    ...(image ? { image } : {}),
    cols,
    rows,
    cells: cells.slice(0, rows).map((r) => [...r.slice(0, cols), ...Array(Math.max(0, cols - r.length)).fill("")]),
    legend,
    tokens,
    scale: typeof meta.scale === "number" ? meta.scale : 5,
    ...(meta.diagonals === "alternate" ? { diagonals: "alternate" as const } : {}),
  };
}

/** Built-in colours for common terrain, when a legend names no colour. */
const TERRAIN_COLORS: Record<string, string> = {
  grass: "#7d9a5c",
  forest: "#4f6b3e",
  tree: "#4f6b3e",
  rocks: "#8c857a",
  stone: "#77726b",
  floor: "#b8ad98",
  wall: "#3e3a35",
  cliff: "#3e3a35",
  water: "#4a7fb5",
  mud: "#7a6248",
  sand: "#d8c18f",
  road: "#a99a7c",
  lava: "#c4492b",
  ice: "#bcd8e4",
};

/** The colour a square is painted. */
export function terrainColor(t: Terrain | undefined, key: string): string {
  if (t?.color) return t.color;
  const known = t?.terrain ? TERRAIN_COLORS[t.terrain.toLowerCase()] : undefined;
  if (known) return known;
  if (!key || key === " ") return "transparent";
  // An unknown key still gets a stable, muted colour of its own.
  let h = 0;
  for (const ch of key + (t?.terrain ?? "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 18% 55%)`;
}
