/**
 * Wikilink Reference Normalization
 *
 * When a YAML value like `attributes: [[Ability Modifier]]` is parsed,
 * the `[[...]]` is interpreted as a nested flow sequence: `[["Ability Modifier"]]`.
 * This utility detects that pattern and extracts the inner string so the
 * parser can treat it as a file path reference.
 */

/**
 * Extract a file path from a YAML value that was written as a wikilink `[[path]]`.
 *
 * YAML parses `[[path]]` as `[["path"]]` (array containing an array with one string).
 * This function detects that shape and returns the inner string.
 *
 * @returns The extracted path string, or `null` if the value is not a wikilink reference.
 */
export function extractWikilinkRef(value: unknown): string | null {
  if (
    Array.isArray(value) &&
    value.length === 1 &&
    Array.isArray(value[0]) &&
    value[0].length === 1 &&
    typeof value[0][0] === "string"
  ) {
    return value[0][0];
  }
  return null;
}

/**
 * Normalize a YAML field value that may be a wikilink reference, a plain string,
 * or already the correct type. Returns the normalized value.
 *
 * - `[[File Path]]`  → (parsed as `[["File Path"]]`) → `"File Path"`
 * - `"plain string"` → `"plain string"` (unchanged)
 * - other            → returned as-is
 */
export function normalizeRef(value: unknown): unknown {
  return extractWikilinkRef(value) ?? value;
}
