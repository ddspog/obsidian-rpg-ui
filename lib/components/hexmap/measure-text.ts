/**
 * Text widths for fitting label banners, measured on a canvas in the weight
 * banner text is drawn in (`.rpg-hexmap-banner-text`).
 */

import { type MeasureEm, roughEm } from "lib/domains/hexmap/layout";

let ctx: CanvasRenderingContext2D | null | undefined;

export const measureEm: MeasureEm = (text, font, weight = 600, italic = false) => {
  if (ctx === undefined)
    ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!ctx) return roughEm(text, font);
  // A family name with spaces needs quotes; a list (`Georgia, serif`) is written as it is.
  const family = /[,"']/.test(font) ? font : `"${font}"`;
  ctx.font = `${italic ? "italic " : ""}${weight} 100px ${family}`;
  return ctx.measureText(text).width / 100;
};
