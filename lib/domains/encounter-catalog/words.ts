/**
 * Loose matching of the words people and tables use for the same thing: a tag
 * written "Forests" by a table and "forest" by a bestiary habitat, a theme word
 * "wolves" for a note named "Wolf, Dire". Pure: no Obsidian and no I/O.
 */

/**
 * A word folded for loose matching: lower case, a plural "s"/"es" dropped, so
 * "Forests" and "forest", "Hills" and "hill" meet (table tags are often plural,
 * catalog and bestiary habitats singular).
 */
export function wordKey(word: string): string {
  const w = word.trim().toLowerCase();
  if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** The forms a theme word may take in a name: as written, and its singulars ("wolves": wolve, wolf). */
export function wordForms(word: string): string[] {
  const w = word.trim().toLowerCase();
  const forms = new Set([w, wordKey(w)]);
  if (w.length > 4 && w.endsWith("ves")) forms.add(`${w.slice(0, -3)}f`);
  if (w.length > 4 && w.endsWith("ies")) forms.add(`${w.slice(0, -3)}y`);
  return [...forms].filter((f) => f.length > 0);
}

/** Whether any of `words`, in any of its forms, appears (as a substring) in any of `texts`, ignoring case. */
export function anyWordIn(words: readonly string[], texts: readonly string[]): boolean {
  const hay = texts.map((t) => t.toLowerCase());
  return words.some((word) => wordForms(word).some((form) => hay.some((h) => h.includes(form))));
}

/** Whether two tags are the same tag, plural or not ("forests" and "Forest"). */
export const sameTag = (a: string, b: string): boolean => wordKey(a) === wordKey(b);

/**
 * Tags trimmed, lower-cased and with one spelling per folded word: when two
 * tags fold alike ("forests" from a table, "forest" from a habitat), the one
 * in `preferred` (the bestiary's habitats) is kept, else the first. Order is
 * otherwise kept.
 */
export function normaliseTags(tags: readonly string[], preferred: ReadonlySet<string> = new Set()): string[] {
  const chosen = new Map<string, string>();
  const order: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    const key = wordKey(tag);
    const had = chosen.get(key);
    if (had === undefined) {
      chosen.set(key, tag);
      order.push(key);
    } else if (!preferred.has(had) && preferred.has(tag)) {
      chosen.set(key, tag);
    }
  }
  // A preferred spelling that folds alike but was not among the tags (a "forests" table with no forest monster).
  const byKey = new Map([...preferred].map((p) => [wordKey(p), p] as const));
  return order.map((key) => {
    const tag = chosen.get(key) as string;
    return preferred.has(tag) ? tag : (byKey.get(key) ?? tag);
  });
}

/** The fewest and most a count rolled with these dice can be ("1d4 + 1": 2 to 5), or null for other text. */
export function diceRange(dice: string): { min: number; max: number } | null {
  const m = /^\s*(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(dice);
  if (!m) return null;
  const n = Number(m[1]);
  const sides = Number(m[2]);
  const flat = m[3] ? (m[3] === "+" ? 1 : -1) * Number(m[4]) : 0;
  if (n < 1 || sides < 1) return null;
  return { min: Math.max(1, n + flat), max: Math.max(1, n * sides + flat) };
}

/**
 * A note's name from its vault path: `…/Wolf, Dire.md` is "Wolf, Dire". A creature with its template
 * ("…/Mage.md with Void-Blessed") keeps the template: "Mage with Void-Blessed".
 */
export function noteStem(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md(?= with |$)/i, "");
}
