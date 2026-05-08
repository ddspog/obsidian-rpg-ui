/**
 * Spellcasting helpers shared between the character entity's tag synthesiser
 * (system config) and the feature resolver (core lib).
 */

/**
 * Classify a spell's `circle` string into a broad band used for composite
 * tag emission and pool auto-derivation.
 *
 *   "Cantrip"           → "Cantrip"
 *   "1st-Circle"        → "Leveled"
 *   "3rd-Circle"        → "Leveled"
 *   "1st-Circle Ritual" → "Ritual"  (ritual wins over leveled)
 *
 * Returns `null` when the circle is empty or unrecognisable.
 */
export function classifySpellCircle(
  circle: string,
): "Cantrip" | "Ritual" | "Leveled" | null {
  const trimmed = (circle ?? "").trim();
  if (!trimmed) return null;
  if (/ritual/i.test(trimmed)) return "Ritual";
  if (/^cantrip$/i.test(trimmed)) return "Cantrip";
  return "Leveled";
}

/**
 * Strip `[[…]]` / alias from a wikilink-shaped string to get the bare tag
 * name (the stem Obsidian would navigate to). Returns the input unchanged
 * when it isn't a wikilink.
 *
 *   "[[Divine]]"                    → "Divine"
 *   "[[path/Divine|Divine magic]]"  → "Divine"
 *   "Divine"                        → "Divine"
 */
export function stripWikilinkToName(raw: string): string {
  const match = /^\[\[(.+?)\]\]$/.exec(raw?.trim() ?? "");
  if (!match) return raw?.trim() ?? "";
  const target = match[1].split("|")[0];
  return target.split("/").pop()!.trim();
}
