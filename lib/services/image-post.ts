/**
 * A made image, finished as the vault keeps its art: the flat magenta it was
 * painted on keyed out to transparency (all around a cut-out, or only outside
 * a card's frame), cropped close when the kind is, and saved as WebP at the
 * best quality the browser's encoder gives.
 */

import type { ImageKind } from "lib/domains/image-studio/kinds";

export interface FinishedImage {
  data: ArrayBuffer;
  mime: "image/webp";
  width: number;
  height: number;
}

/** How far (0–441) a colour is from another, in RGB. */
const dist = (r: number, g: number, b: number, k: [number, number, number]) => Math.hypot(r - k[0], g - k[1], b - k[2]);

/** The background's colour: what most of the border is (it should be magenta). */
function borderColour(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const counts = new Map<string, { n: number; c: [number, number, number] }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    // Quantised, so near-identical pixels count as one colour.
    const c: [number, number, number] = [d[i] & 0xf0, d[i + 1] & 0xf0, d[i + 2] & 0xf0];
    const key = c.join(",");
    const e = counts.get(key) ?? { n: 0, c: [d[i], d[i + 1], d[i + 2]] };
    e.n++;
    counts.set(key, e);
  };
  for (let x = 0; x < w; x += 2) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 0; y < h; y += 2) {
    add(0, y);
    add(w - 1, y);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.c ?? [255, 0, 255];
}

/**
 * The background keyed out: every pixel near its colour that the border reaches
 * goes clear (a flood from the edges, so the same colour inside the subject
 * stays); the edge in between fades, its magenta fringe drawn out.
 */
function keyOut(img: ImageData): void {
  const { data: d, width: w, height: h } = img;
  const key = borderColour(d, w, h);
  const hard = 70; // this close: background
  const soft = 150; // up to this: the edge, partly clear
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => {
    if (seen[p]) return;
    const i = p * 4;
    if (dist(d[i], d[i + 1], d[i + 2], key) > soft) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    const k = dist(d[i], d[i + 1], d[i + 2], key);
    if (k <= hard) {
      d[i + 3] = 0;
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < w * (h - 1)) push(p + w);
    } else {
      // The edge: as clear as it's near the key, its key colour pulled out.
      const a = (k - hard) / (soft - hard);
      d[i + 3] = Math.round(d[i + 3] * a);
      const spill = Math.min(d[i], d[i + 2]) - d[i + 1];
      if (spill > 0) {
        d[i] -= spill * (1 - a);
        d[i + 2] -= spill * (1 - a);
      }
    }
  }
}

/**
 * A tile's corners cleared: from each corner that's light (the margin the
 * model painted around a rounded tile), every pixel near its colour it reaches
 * goes transparent — the tile's edge softened, its full size kept.
 */
function keyCorners(img: ImageData): boolean {
  const { data: d, width: w, height: h } = img;
  const hard = 60;
  const soft = 120;
  let cleared = false;
  for (const [cx, cy] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]) {
    const i0 = (cy * w + cx) * 4;
    if (d[i0 + 3] === 0) continue;
    const key: [number, number, number] = [d[i0], d[i0 + 1], d[i0 + 2]];
    if (Math.min(...key) < 170) continue; // a dark corner is the stone itself
    cleared = true;
    const seen = new Uint8Array(w * h);
    const stack = [cy * w + cx];
    seen[stack[0]] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const i = p * 4;
      const k = dist(d[i], d[i + 1], d[i + 2], key);
      if (k > soft) continue;
      if (k > hard) {
        // The tile's edge: partly clear, as near as it is to the margin.
        d[i + 3] = Math.min(d[i + 3], Math.round(255 * ((k - hard) / (soft - hard))));
        continue;
      }
      d[i + 3] = 0;
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < w * (h - 1) ? p + w : -1]) {
        if (q >= 0 && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
  }
  return cleared;
}

/** The box around what's painted (alpha over a sliver), with a little room. */
function contentBox(img: ImageData): { x: number; y: number; w: number; h: number } {
  const { data: d, width: w, height: h } = img;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w, h };
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
  const x = Math.max(0, x0 - pad);
  const y = Math.max(0, y0 - pad);
  return { x, y, w: Math.min(w, x1 + pad + 1) - x, h: Math.min(h, y1 + pad + 1) - y };
}

/**
 * Where a tile sits inside a plain margin: the box of what differs from the
 * border's colour, cut in a little to lose rounded corners, made square.
 * Nothing when the image already fills to its edges.
 */
function tileBox(img: ImageData): { x: number; y: number; size: number } | null {
  const { data: d, width: w, height: h } = img;
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };
  let key = borderColour(d, w, h);
  // A border that's mostly one flat colour is a margin; a textured one is the tile itself.
  let flat = 0,
    seen = 0;
  for (let x = 0; x < w; x += 4) {
    for (const y of [0, h - 1]) {
      seen++;
      if (dist(...at(x, y), key) < 30) flat++;
    }
  }
  const margin = flat / seen >= 0.8;
  if (!margin) {
    // No margin — but its corners may still show one (a tile cut off at the
    // corners): all four alike, and unlike the tile just inside them.
    const corners = [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)];
    const alike = corners.every((c) => dist(...c, corners[0]) < 30);
    const inside = at(Math.round(w * 0.15), Math.round(h * 0.15));
    if (!alike || dist(...inside, corners[0]) < 60) return null;
    key = corners[0];
  }
  // The margins painted around a tile are light — a dark edge is the stone's own vignette.
  if (Math.min(...key) < 170) return null;
  const differs = (x: number, y: number) => dist(...at(x, y), key) > 45;
  // Scan in from each side along the middle, where rounded corners don't reach.
  const mid = (n: number) => Math.floor(n / 2);
  let left = 0;
  while (left < w && !differs(left, mid(h))) left++;
  let right = w - 1;
  while (right > left && !differs(right, mid(h))) right--;
  let top = 0;
  while (top < h && !differs(mid(w), top)) top++;
  let bottom = h - 1;
  while (bottom > top && !differs(mid(w), bottom)) bottom--;
  const tw = right - left + 1;
  const th = bottom - top + 1;
  if (tw < w * 0.4 || th < h * 0.4) return null;
  // The tile's own bounds, as a square — its corners are cleared after, not cut off.
  const size = Math.min(tw, th);
  return { x: left + Math.round((tw - size) / 2), y: top + Math.round((th - size) / 2), size };
}

/** The picture drawn at exactly `w`×`h`: stretched when the shape is nearly right, else cropped to fit (centred). */
function fitExact(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  const want = w / h;
  const have = src.width / src.height;
  if (Math.abs(have / want - 1) <= 0.12) {
    // A card drawn a little off the shape: stretched, its border kept whole.
    g.drawImage(src, 0, 0, w, h);
  } else {
    // Far off: the shape cropped out of the middle.
    const sw = have > want ? src.height * want : src.width;
    const sh = have > want ? src.height : src.width / want;
    g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, w, h);
  }
  return out;
}

/** The picture with its long side `long` pixels — its proportions kept. */
function scaleLong(src: HTMLCanvasElement, long: number): HTMLCanvasElement {
  const k = long / Math.max(src.width, src.height);
  if (Math.abs(k - 1) < 0.005) return src;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(src.width * k));
  out.height = Math.max(1, Math.round(src.height * k));
  const g = out.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** The most pixels a side a made picture is given, whatever it replaces. */
const LIMIT = 4096;

/**
 * `target` is the size of the picture being replaced: a fixed layout comes out
 * exactly that size and shape; a cut-out keeps its own shape, its long side
 * the same. With nothing to replace, the kind's own size.
 */
export async function finishImage(
  data: ArrayBuffer,
  mime: string,
  kind: Pick<ImageKind, "cutout" | "trim" | "maxSize" | "size" | "fill">,
  target?: { w: number; h: number }
): Promise<FinishedImage> {
  const bitmap = await createImageBitmap(new Blob([data], { type: mime }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bitmap, 0, 0);
  let out = canvas;
  if (kind.cutout) {
    const img = g.getImageData(0, 0, canvas.width, canvas.height);
    keyOut(img);
    g.putImageData(img, 0, 0);
    if (kind.trim) {
      const box = contentBox(img);
      const cropped = document.createElement("canvas");
      cropped.width = box.w;
      cropped.height = box.h;
      cropped.getContext("2d")!.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      out = cropped;
    }
  }
  // A tile painted on a plain margin (white, often with rounded corners): the
  // tile found, cropped just inside its corners, squared — so it fills the icon.
  if (kind.fill) {
    const box = tileBox(g.getImageData(0, 0, out.width, out.height));
    if (box) {
      const square = document.createElement("canvas");
      square.width = box.size;
      square.height = box.size;
      square.getContext("2d")!.drawImage(out, box.x, box.y, box.size, box.size, 0, 0, box.size, box.size);
      out = square;
    }
    // What's left of the margin in its corners (a rounded tile's), made transparent.
    const og = out.getContext("2d", { willReadFrequently: true })!;
    const corners = og.getImageData(0, 0, out.width, out.height);
    if (keyCorners(corners)) og.putImageData(corners, 0, 0);
  }
  // The size and shape the kind keeps — or the picture it replaces has.
  if (kind.size) {
    const want = target ?? kind.size;
    out = fitExact(out, Math.min(LIMIT, want.w), Math.min(LIMIT, want.h));
  } else {
    const long = target ? Math.max(target.w, target.h) : kind.maxSize;
    if (long) out = scaleLong(out, Math.min(LIMIT, long));
  }
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/webp", 1));
  if (!blob) throw new Error("Couldn't encode the image as WebP.");
  return { data: await blob.arrayBuffer(), mime: "image/webp", width: out.width, height: out.height };
}

export interface FinishedFrame extends FinishedImage {
  /** Where the art shows through, as percentages of the frame. */
  window: { top: number; right: number; bottom: number; left: number };
  /** The frame's width / height. */
  aspect: number;
}

/**
 * A made frame, finished: the magenta outside it cleared, the magenta in its
 * window cleared too — where the art will show — cropped to the frame's edge,
 * and the window's place measured. Painted by the model once, in the settings;
 * every framed picture is drawn behind it.
 */
export async function finishFrame(data: ArrayBuffer, mime: string): Promise<FinishedFrame> {
  const bitmap = await createImageBitmap(new Blob([data], { type: mime }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bitmap, 0, 0);
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const { data: d, width: w, height: h } = img;
  const key = borderColour(d, w, h);
  keyOut(img);
  // The window: magenta the flood from the edges never reached.
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 0 && dist(d[i], d[i + 1], d[i + 2], key) <= 90) {
        d[i + 3] = 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("No window found in the frame — the model left no magenta inside it. Make another.");
  g.putImageData(img, 0, 0);
  // Cropped to the frame's own edge; the window measured from there.
  const box = contentBox(img);
  const cropped = document.createElement("canvas");
  cropped.width = box.w;
  cropped.height = box.h;
  cropped.getContext("2d")!.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  const pct = (n: number, of: number) => Math.round((n / of) * 1000) / 10;
  const window = {
    top: pct(y0 - box.y, box.h),
    left: pct(x0 - box.x, box.w),
    right: pct(box.x + box.w - 1 - x1, box.w),
    bottom: pct(box.y + box.h - 1 - y1, box.h),
  };
  const out = scaleLong(cropped, 1600);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/webp", 1));
  if (!blob) throw new Error("Couldn't encode the frame as WebP.");
  return {
    data: await blob.arrayBuffer(),
    mime: "image/webp",
    width: out.width,
    height: out.height,
    window,
    aspect: out.width / out.height,
  };
}
