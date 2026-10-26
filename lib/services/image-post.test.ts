import { describe, expect, it } from "vitest";
import { frameWindow } from "./image-post";

/** A w×h image, opaque where `solid` says so. */
function image(w: number, h: number, solid: (x: number, y: number) => boolean): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = solid(x, y) ? 255 : 0;
  return d;
}

describe("frameWindow", () => {
  it("finds the hole the edges can't reach", () => {
    // A 10×10 frame, clear outside its 1px margin, with a 2px border round a 4×4 window.
    const d = image(10, 10, (x, y) => x >= 1 && x <= 8 && y >= 1 && y <= 8 && !(x >= 3 && x <= 6 && y >= 3 && y <= 6));
    expect(frameWindow(d, 10, 10)).toEqual({ top: 30, left: 30, right: 30, bottom: 30 });
  });
  it("has none when the frame is solid", () => {
    expect(
      frameWindow(
        image(4, 4, () => true),
        4,
        4
      )
    ).toBeUndefined();
  });
});
