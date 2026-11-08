/**
 * Creativity prompts for a page's margin: the words of a prompts note, and which of them a page shows.
 * Pure: the plugin reads the note and draws the strip (`lib/plugin/margin-prompts.ts`).
 */
import type { MarginPromptSet } from "settings";

/** The prompts of a note: one a line, its front matter, headings, empty lines and list markers left out. */
export function parsePrompts(text: string): string[] {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const out: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
      .replace(/^\s*>\s?/, "")
      .trim();
    if (!line || line.startsWith("#") || line.startsWith("```") || line.startsWith("%%")) continue;
    if (!out.includes(line)) out.push(line);
  }
  return out;
}

/** The set a note belongs to: the one whose folder holds it, the longest folder winning. */
export function promptSetFor(path: string, sets: MarginPromptSet[]): MarginPromptSet | undefined {
  const norm = (f: string) => f.replace(/^\/+|\/+$/g, "");
  return sets
    .filter(
      (s) => s.wordsFile.trim() && norm(s.folder) && (path === norm(s.folder) || path.startsWith(norm(s.folder) + "/"))
    )
    .sort((a, b) => norm(b.folder).length - norm(a.folder).length)[0];
}

/**
 * The prompts note a page shows, from its own `margin-prompts` property and the folder sets.
 * - `false` (or `off`, `no`): none, whatever the folder.
 * - A link or path (`"[[My prompts]]"`): that note, in any folder. The caller resolves it.
 * - `true` (or `on`, `yes`): the folder's set, else the first set in the settings.
 * - Absent: the folder's set, if any.
 * Returns `{ link }` for a note named in the property, `{ path }` for a set's note.
 */
export function promptSourceFor(
  path: string,
  sets: MarginPromptSet[],
  property: unknown
): { path: string } | { link: string } | undefined {
  const folderSet = promptSetFor(path, sets);
  const word = typeof property === "string" ? property.trim().toLowerCase() : property;
  if (property === false || word === "false" || word === "off" || word === "no") return undefined;
  if (property === true || word === "true" || word === "on" || word === "yes") {
    const set = folderSet ?? sets.find((s) => s.wordsFile.trim());
    return set ? { path: set.wordsFile.trim() } : undefined;
  }
  if (typeof property === "string" && property.trim()) {
    const link = property
      .trim()
      .replace(/^\[\[|\]\]$/g, "")
      .split("|")[0]
      .trim();
    if (link) return { link };
  }
  return folderSet ? { path: folderSet.wordsFile.trim() } : undefined;
}

/** A small seeded generator, so a page shows the same prompts each time it opens. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** `count` prompts for the page `seed` (its path), none twice until the list runs out. */
export function pickPrompts(prompts: string[], seed: string, count: number): string[] {
  if (prompts.length === 0 || count <= 0) return [];
  const rand = seeded(seed);
  const deck = [...prompts];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return Array.from({ length: count }, (_, i) => deck[i % deck.length]);
}
