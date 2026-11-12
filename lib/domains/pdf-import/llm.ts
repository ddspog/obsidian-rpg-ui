/**
 * The one thing the import may ask a model: an icon and a colour for each tab,
 * from the titles alone. One request for the whole book, a few hundred short
 * lines in and one line of JSON per title out; everything else is done by code.
 */

import { ICON_NAMES } from "./looks";
import type { TabLook } from "./types";

const COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"];

export const LOOKS_SYSTEM =
  "You choose an icon and a colour for the tabs of a tabletop RPG rulebook that was imported into notes. " +
  "You get one tab title per line, numbered. Answer with JSON only, no prose: an object whose keys are the " +
  'line numbers and whose values are "icon color" strings, e.g. {"1":"swords red","2":"sparkles purple"}. ' +
  `Icons, pick from: ${ICON_NAMES.join(", ")}. Colours, pick from: ${COLORS.join(", ")}. ` +
  "Give neighbouring tabs different colours, and titles of one kind (spells, classes) the same icon.";

export function looksPrompt(titles: string[]): string {
  return titles.map((t, i) => `${i + 1}. ${t.slice(0, 60)}`).join("\n");
}

/** The model's picks by title. Anything it got wrong (an unknown icon, a missing line) is left out. */
export function parseLooks(answer: string, titles: string[]): Map<string, TabLook> {
  const out = new Map<string, TabLook>();
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start < 0 || end <= start) return out;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return out;
  }
  const icons = new Set(ICON_NAMES);
  for (const [key, value] of Object.entries(data)) {
    const title = titles[Number(key) - 1];
    if (!title || typeof value !== "string") continue;
    const [icon, color] = value.trim().split(/\s+/);
    if (!icons.has(icon) || !COLORS.includes(color)) continue;
    out.set(title, { icon, color: `var(--color-${color})` });
  }
  return out;
}
