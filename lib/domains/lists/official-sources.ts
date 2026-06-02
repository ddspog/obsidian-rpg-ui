/**
 * Per-system "official sources" lookup for homebrew classification.
 *
 * The plugin's settings store, per system mapping, a list of official source
 * patterns (e.g. `"Tales of the Valiant"`, or `"%Kobold Press%"`). A note/spell
 * whose `source:` frontmatter matches one of them is official; anything else
 * (or a missing source) is homebrew — when the list is empty the feature is off
 * and nothing is flagged. Patterns use `%` as the "any text" wildcard (SQL
 * LIKE style); everything else — including `*` (so the markdown `**bold**`
 * markers in source strings stay literal) — is matched verbatim. A pattern with
 * no `%` is a plain case-insensitive substring.
 *
 * `main.ts` installs a resolver (closing over settings + the system registry)
 * that maps a note path to that system's official sources; the list resolver
 * reads it via `officialSourcesForPath` to compute each record's `homebrew`.
 */

let resolver: ((sourcePath: string) => string[]) | null = null;

export function setOfficialSourcesResolver(fn: ((sourcePath: string) => string[]) | null): void {
  resolver = fn;
}

export function officialSourcesForPath(sourcePath: string): string[] {
  try {
    return resolver ? resolver(sourcePath) : [];
  } catch {
    return [];
  }
}

/**
 * Compile an official-source pattern to a regex. `%` is the only wildcard
 * (matches any run of characters); everything else is literal (regex specials
 * — including `*`, so markdown `**bold**` in source strings is matched as-is —
 * are escaped). Unanchored + case-insensitive, so a `%`-free pattern behaves
 * exactly like a case-insensitive substring match.
 */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = escaped.replace(/%/g, ".*");
  return new RegExp(body, "i");
}

/**
 * Classify a `source:` value as homebrew given the official source patterns.
 * No official sources configured → feature off (never homebrew). Missing /
 * blank source with sources configured → homebrew. Otherwise homebrew iff the
 * source matches none of the patterns (`%` = any text; plain text =
 * case-insensitive substring; `*` is literal).
 */
export function isHomebrewSource(source: unknown, officialSources: string[]): boolean {
  if (!officialSources || officialSources.length === 0) return false;
  if (typeof source !== "string" || !source.trim()) return true;
  return !officialSources.some((o) => {
    if (!o) return false;
    try {
      return globToRegExp(o).test(source);
    } catch {
      return source.toLowerCase().includes(o.toLowerCase());
    }
  });
}

/**
 * Setting-driven homebrew verdict for a note/block, used by ALL block types
 * (lists, rule.content, feature.details, imported magic/tab cards) so a single
 * "official sources" setting governs homebrew highlighting everywhere.
 *
 * Returns `null` when the file's system declares NO official sources — the
 * caller should then fall back to its own (context-relative) classification.
 * Otherwise returns whether `source` matches none of the official patterns.
 *
 * `source` is the effective free-text `source:` of the content; `sourcePath`
 * is the file the content lives in (its system mapping supplies the patterns).
 */
export function homebrewBySetting(source: unknown, sourcePath: string): boolean | null {
  const official = officialSourcesForPath(sourcePath);
  if (!official || official.length === 0) return null;
  return isHomebrewSource(source, official);
}
