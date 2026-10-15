import { describe, it, expect } from "vitest";
import { brightnessProfiles, gridFromProfiles } from "./detect-grid";

/** A picture-like profile: uneven art, with faint lines every `cell` from `offset`. */
function profile(length: number, cell: number, offset: number, seed = 1): number[] {
  // mulberry32 — noise that doesn't repeat at grid-like spacings.
  let s = seed >>> 0;
  const noise = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5) * 30;
  };
  return Array.from({ length }, (_, x) => {
    const art = 90 + 40 * Math.sin(x / 47) + noise();
    const d = (((x - offset) % cell) + cell) % cell;
    return art + (d < 1 || d > cell - 1 ? 18 : 0);
  });
}

describe("gridFromProfiles", () => {
  it("finds a 33px grid starting a pixel before the edge", () => {
    expect(gridFromProfiles(profile(825, 33, -1), profile(724, 33, -1, 7))).toEqual({
      cell: 33,
      offsetX: -1,
      offsetY: -1,
    });
  });

  it("finds other sizes and offsets", () => {
    const g = gridFromProfiles(profile(1400, 70, 12, 3), profile(1000, 70, 30, 5));
    expect(g).toEqual({ cell: 70, offsetX: 12, offsetY: 30 });
  });

  it("finds nothing in art without a grid", () => {
    const art = (n: number, seed: number) => profile(n, 10_000, 5_000, seed);
    expect(gridFromProfiles(art(825, 2), art(724, 9))).toBeNull();
  });
});

describe("brightnessProfiles", () => {
  it("averages each column and row of RGBA pixels", () => {
    // 2×2: white, black / black, black.
    const px = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    expect(brightnessProfiles(px, 2, 2)).toEqual({ columns: [127.5, 0], rows: [127.5, 0] });
  });
});
