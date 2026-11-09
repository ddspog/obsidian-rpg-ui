/**
 * The hex flowers written in a vault's notes (`rpg hexflower` blocks), for the map's Generate tool.
 */

import type { App } from "obsidian";
import { type HexFlower, parseHexFlower } from "./hex-flower";

export interface FoundFlower {
  /** The note's path. */
  path: string;
  /** The flower's title, else the note's name. */
  title: string;
  flower: HexFlower;
}

const FENCE = /^(`{3,}|~{3,})\s*rpg\s+hexflower\b[^\n]*\n([\s\S]*?)^\1\s*$/gm;

/** Each `rpg hexflower` block's source in a note's text. */
export function flowerSources(text: string): string[] {
  return [...text.matchAll(FENCE)].map((m) => m[2]);
}

export async function findFlowers(app: App): Promise<FoundFlower[]> {
  const out: FoundFlower[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const text = await app.vault.cachedRead(file);
    if (!text.includes("hexflower")) continue;
    for (const source of flowerSources(text)) {
      const flower = parseHexFlower(source);
      if (flower.cells.size) out.push({ path: file.path, title: flower.title ?? file.basename, flower });
    }
  }
  return out;
}

/** The flower a map's `generate:` names (its note, and title when the note has several), else the
 *  first wilderness one, else the first. */
export function chooseFlower(found: FoundFlower[], note?: string, title?: string): FoundFlower | undefined {
  const named = note
    ? found.filter((f) => {
        const base = f.path.replace(/\.md$/, "");
        return base === note || base.endsWith(`/${note}`) || f.title === note;
      })
    : found;
  return (
    (title ? named.find((f) => f.title.toLowerCase() === title.toLowerCase()) : undefined) ??
    named.find((f) => /wilderness/i.test(f.title)) ??
    named[0]
  );
}
