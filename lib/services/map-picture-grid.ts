/** The grid a battle-map picture holds, found from the picture itself (see detect-grid). */

import type { App, TFile } from "obsidian";
import { brightnessProfiles, gridFromProfiles, type DetectedGrid } from "lib/domains/battlemap/detect-grid";

export async function detectPictureGrid(app: App, file: TFile): Promise<DetectedGrid | null> {
  const img = new Image();
  img.src = app.vault.getResourcePath(file);
  try {
    await img.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = brightnessProfiles(data, canvas.width, canvas.height);
  return gridFromProfiles(p.columns, p.rows);
}
