/**
 * Wiki File Utilities
 *
 * Inspired by obsidian-dataview's `parsePage` / `dv.page`, this module provides
 * helpers for parsing raw vault file content into structured descriptors that are
 * surfaced through the `wiki.file` and `wiki.folder` APIs consumed by user-authored
 * TypeScript system definitions.
 *
 * Unlike dataview, which relies on Obsidian's `CachedMetadata` (available only at
 * runtime inside the plugin), these helpers work purely from raw string content so
 * they are also usable in tests and Node scripts.
 */

import { getFrontMatterInfo, type Vault } from "obsidian";
import { parse as parseYAML } from "yaml";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A parsed vault-file descriptor.
 *
 * - All frontmatter keys are promoted to the top level (like `dv.page`).
 * - Reserved `$`-prefixed keys carry structural metadata:
 *   - `$path`     – vault-relative file path
 *   - `$name`     – bare file name (without extension)
 *   - `$contents` – body text that follows the frontmatter block
 *   - `$tags`     – deduplicated list of tags from frontmatter (normalised to `#tag` form)
 *   - `$aliases`  – list of aliases from frontmatter
 */
export interface WikiFileDescriptor {
  [key: string]: unknown;
  $path: string;
  $name: string;
  $contents: string;
  $tags: string[];
  $aliases: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise a single tag value to `#tag` form.
 * Handles numbers, booleans, and strings.
 */
function normaliseTag(raw: unknown): string {
  const s = String(raw).trim();
  return s.startsWith("#") ? s : `#${s}`;
}

/**
 * Extract tags from the frontmatter object.
 * Handles `tags` / `tag` keys containing arrays, comma-separated strings, or
 * single values — matching the behaviour of dataview's `extractTags`.
 */
function extractTags(frontmatter: Record<string, unknown>): string[] {
  const keys = Object.keys(frontmatter).filter(
    (k) => k.toLowerCase() === "tags" || k.toLowerCase() === "tag",
  );

  const result: string[] = [];
  for (const key of keys) {
    const value = frontmatter[key];
    if (value == null) continue;

    if (Array.isArray(value)) {
      result.push(...value.filter(Boolean).map(normaliseTag));
    } else {
      // Comma/space-separated string or single value
      result.push(
        ...String(value)
          .split(/[,\s]+/)
          .filter(Boolean)
          .map(normaliseTag),
      );
    }
  }

  // Deduplicate while preserving order
  return [...new Set(result)];
}

/**
 * Extract aliases from the frontmatter object.
 * Handles `alias` / `aliases` keys — matching dataview's `extractAliases`.
 */
function extractAliases(frontmatter: Record<string, unknown>): string[] {
  const keys = Object.keys(frontmatter).filter(
    (k) => k.toLowerCase() === "alias" || k.toLowerCase() === "aliases",
  );

  const result: string[] = [];
  for (const key of keys) {
    const value = frontmatter[key];
    if (value == null) continue;

    if (Array.isArray(value)) {
      result.push(...value.map((v) => String(v).trim()).filter(Boolean));
    } else {
      result.push(
        ...String(value)
          .split(/,/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }

  return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse raw vault-file content into a {@link WikiFileDescriptor}.
 *
 * This is the core utility used by `wiki.file` and `wiki.folder`.  It mirrors
 * what dataview's `dv.page` provides but works from raw string content without
 * requiring Obsidian's metadata cache:
 *
 * 1. Uses `getFrontMatterInfo` to locate the YAML front-matter block.
 * 2. Parses the YAML and promotes all keys onto the descriptor.
 * 3. Extracts `$tags` and `$aliases` from well-known frontmatter keys.
 * 4. Sets `$contents` to the body text that follows the frontmatter.
 *
 * @param raw   - Raw file contents as a string.
 * @param $path - Vault-relative path to the file (e.g. `systems/dnd5e/conditions/Poisoned.md`).
 * @returns A {@link WikiFileDescriptor} ready to be consumed by system definitions.
 *
 * @example
 * ```ts
 * const descriptor = parseWikiFile(rawMarkdown, "systems/dnd5e/conditions/Poisoned.md");
 * console.log(descriptor.$name);     // "Poisoned"  (derived from path)
 * console.log(descriptor.name);      // from frontmatter
 * console.log(descriptor.$contents); // body text after frontmatter
 * console.log(descriptor.$tags);     // ["#condition", "#debuff"]
 * ```
 */
/**
 * Resolve and read a vault file by wikilink-style name — pass anything you'd
 * put inside `[[]]` in Obsidian.
 *
 * Resolution order (mirrors Obsidian's own wikilink resolution):
 *  1. Exact vault path match (`name.md` or `name` as-is).
 *  2. Vault-wide basename search: finds the shortest-path file whose stem
 *     equals the last segment of `name` (extension stripped).
 *
 * @param vault - Obsidian vault instance (or undefined outside the plugin).
 * @param name  - Wikilink-style reference, e.g. `"Poisoned"`, `"conditions/Poisoned"`.
 * @returns A resolved {@link WikiFileDescriptor}, or a minimal empty descriptor if not found.
 */
export async function resolveWikiFile(
  vault: Vault | undefined,
  name: string,
): Promise<WikiFileDescriptor> {
  if (vault) {
    // 1. Exact path — handles fully-qualified paths like "systems/dnd5e/Poisoned"
    const exactAttempts = [`${name}.md`, name];
    for (const p of exactAttempts) {
      const f = vault.getAbstractFileByPath(p);
      if (f && (f as any).path) {
        try {
          const raw = await (vault as any).cachedRead(f as any);
          return parseWikiFile(raw ?? "", (f as any).path);
        } catch {
          return parseWikiFile("", (f as any).path);
        }
      }
    }

    // 2. Wikilink-style: search all vault files for a matching basename
    //    e.g. resolveWikiFile(vault, "Poisoned") → resolves conditions/Poisoned.md
    const stem = name.split("/").pop()!.replace(/\.md$/i, "");
    const allFiles = ((vault as any).getFiles?.() as any[]) ?? [];
    const match = allFiles
      .filter(
        (f: any) => ((f as any).basename ?? (f as any).name?.replace(/\.[^.]+$/, "")) === stem,
      )
      .sort((a: any, b: any) => a.path.length - b.path.length)[0];

    if (match) {
      try {
        const raw = await (vault as any).cachedRead(match);
        return parseWikiFile(raw ?? "", match.path);
      } catch {
        return parseWikiFile("", match.path);
      }
    }
  }

  // Fallback: nothing found
  return parseWikiFile("", `${name}.md`);
}

/**
 * Resolve and read all vault files inside a folder by wikilink-style path —
 * pass anything you'd put inside a folder reference in Obsidian.
 *
 * Resolution order (mirrors how `resolveWikiFile` handles files):
 *  1. Exact prefix match: files whose path starts with `name/` (or `name` itself).
 *  2. Vault-wide folder suffix search: finds the shortest matching folder whose
 *     path ends with `/<name>` or `/<segment>/<name>` etc., then returns all
 *     files inside it. This lets you write `"skills"` or `"compendium/skills"`
 *     instead of the full `"systems/my-system/compendium/skills"`.
 *
 * @param vault     - Obsidian vault instance (or undefined outside the plugin).
 * @param folderPath - Partial or full folder path, e.g. `"skills"`, `"compendium/skills"`.
 * @returns Array of {@link WikiFileDescriptor} for each `.md` file in the folder.
 */
export async function resolveWikiFolder(
  vault: Vault | undefined,
  folderPath: string,
): Promise<WikiFileDescriptor[]> {
  const name = folderPath.replace(/^\/+/, "").replace(/\/+$/, "");

  if (!vault || !(vault as any).getFiles) {
    return [parseWikiFile("", name)];
  }

  const allFiles: any[] = ((vault as any).getFiles() as any[]).filter(
    (f: any) => typeof f.path === "string" && f.path.endsWith(".md"),
  );

  // 1. Exact prefix match
  let matched = allFiles.filter(
    (f: any) => f.path === name || f.path.startsWith(name + "/"),
  );

  // 2. Folder suffix search — find the shortest folder whose path ends with /name
  if (matched.length === 0) {
    // Build the set of unique folder paths that end with the given suffix
    matched = allFiles.filter((f: any) => {
      const dir = f.path.substring(0, f.path.lastIndexOf("/"));
      // Check if `dir` ends with /name or equals name
      return dir === name || dir.endsWith("/" + name);
    });

    // If still nothing, try matching any path segment sequence as a suffix
    // e.g. "compendium/skills" matches "systems/tales-of-the-valiant/compendium/skills/Foo.md"
    if (matched.length === 0) {
      matched = allFiles.filter((f: any) => {
        const dir = f.path.substring(0, f.path.lastIndexOf("/"));
        return dir.endsWith("/" + name) || dir === name;
      });
    }

    // Pick the shortest matching folder (most specific, shallowest depth)
    if (matched.length > 0) {
      const dirs = [...new Set(matched.map((f: any) =>
        f.path.substring(0, f.path.lastIndexOf("/")),
      ))];
      const shortest = dirs.sort((a, b) => a.length - b.length)[0];
      matched = allFiles.filter((f: any) =>
        f.path.startsWith(shortest + "/") || f.path === shortest,
      );
    }
  }

  const results: WikiFileDescriptor[] = [];
  for (const f of matched) {
    try {
      const raw = await (vault as any).cachedRead(f);
      results.push(parseWikiFile(raw ?? "", f.path));
    } catch {
      results.push(parseWikiFile("", f.path));
    }
  }
  return results;
}

export function parseWikiFile(raw: string, $path: string): WikiFileDescriptor {
  // Derive the bare filename (no directory, no extension) from the path,
  // matching the way Obsidian resolves [[wikilinks]].
  const $name = $path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? $path;
  try {
    const info = getFrontMatterInfo(raw);

    let frontmatter: Record<string, unknown> = {};
    if (info.exists) {
      try {
        frontmatter = (parseYAML(info.frontmatter) as Record<string, unknown>) ?? {};
      } catch {
        // Malformed YAML — fall back to empty frontmatter
      }
    }

    const $tags = extractTags(frontmatter);
    const $aliases = extractAliases(frontmatter);
    const $contents = raw.slice(info.contentStart);

    // Strip null, undefined, empty arrays, and empty objects from frontmatter before spreading
    const cleanFrontmatter = Object.fromEntries(
      Object.entries(frontmatter).filter(([, v]) => {
        if (v === null || v === undefined) return false;
        if (Array.isArray(v) && v.length === 0) return false;
        if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) return false;
        return true;
      }),
    );

    return {
      ...cleanFrontmatter,
      $path,
      $name,
      $contents,
      $tags,
      $aliases,
    };
  } catch {
    // If something goes catastrophically wrong, return a minimal descriptor
    const $name = $path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? $path;
    return { $path, $name, $contents: raw, $tags: [], $aliases: [] };
  }
}
