/**
 * Build the tag and folder indexes that back `[[WikiLink]]` and
 * `@folder/path` expansion inside `choose.options` arrays on the character
 * sheet.
 *
 * Callers feed in every compendium item they want reachable by either kind
 * of reference — typically every document returned by `wiki.folder(path)`
 * across the folders the system wants to index. Each input carries:
 *
 *   - `$name` — the item's file stem (the wikilink target)
 *   - `folder` — the folder path the file lives in, e.g. `"compendium/weapons/martial"`
 *   - `tags` — optional list of frontmatter tags
 *
 * The resulting maps hold `"[[Name]]"` wikilink strings so the resolver can
 * splice them directly into `choose.options` without further formatting.
 */

export interface IndexedDoc {
  $name: string;
  folder: string;
  tags?: string[];
}

export interface CompendiumIndex {
  tagIndex: Record<string, string[]>;
  folderIndex: Record<string, string[]>;
}

export function buildCompendiumIndex(docs: IndexedDoc[]): CompendiumIndex {
  const tagIndex: Record<string, string[]> = {};
  const folderIndex: Record<string, string[]> = {};

  const seenInTag = new Map<string, Set<string>>();
  const seenInFolder = new Map<string, Set<string>>();

  for (const doc of docs) {
    if (!doc || !doc.$name) continue;
    const wikilink = `[[${doc.$name}]]`;

    if (doc.folder) {
      if (!folderIndex[doc.folder]) {
        folderIndex[doc.folder] = [];
        seenInFolder.set(doc.folder, new Set());
      }
      const seen = seenInFolder.get(doc.folder)!;
      if (!seen.has(wikilink)) {
        seen.add(wikilink);
        folderIndex[doc.folder].push(wikilink);
      }
    }

    for (const raw of doc.tags ?? []) {
      const tag = typeof raw === "string" ? raw.replace(/^#/, "").trim() : "";
      if (!tag) continue;
      if (!tagIndex[tag]) {
        tagIndex[tag] = [];
        seenInTag.set(tag, new Set());
      }
      const seen = seenInTag.get(tag)!;
      if (!seen.has(wikilink)) {
        seen.add(wikilink);
        tagIndex[tag].push(wikilink);
      }
    }
  }

  return { tagIndex, folderIndex };
}

/**
 * Expand `[[WikiLink]]` and `@folder/path` references in a list of raw
 * option strings against the provided indexes.
 *
 * - `@folder/path` → looks up `folderIndex`; on miss, progressively strips
 *   leading segments to find a registered folder suffix.
 * - `[[Name]]` or `[[path|alias]]` → if the bare target name matches a key
 *   in `tagIndex`, expands to that tagged set. Otherwise passes through
 *   untouched (so literal references like `[[Insight]]` to a specific note
 *   stay intact).
 * - Anything else → passthrough.
 *
 * Results are deduplicated in authored order.
 */
export function expandOptionRefs(
  options: string[],
  tagIndex: Record<string, string[]> | undefined,
  folderIndex: Record<string, string[]> | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of options) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let expanded: string[] | null = null;
    if (trimmed.startsWith("@")) {
      const path = trimmed.slice(1).replace(/\/+$/, "");
      expanded = folderIndex?.[path] ?? [];
      // Fallback: progressively strip leading segments until we find a
      // registered folder suffix. Lets `@worldbuilding/cantrips` resolve
      // when the vault has moved the files to `worldbuilding/spells/
      // cantrips` — the index carries every suffix of every parent dir,
      // so `cantrips` alone still matches the set.
      if (expanded.length === 0 && path.includes("/")) {
        let remainder = path;
        while (remainder.includes("/")) {
          remainder = remainder.slice(remainder.indexOf("/") + 1);
          const attempt = folderIndex?.[remainder];
          if (attempt && attempt.length > 0) {
            expanded = attempt;
            break;
          }
        }
      }
    } else {
      const wikilinkMatch = /^\[\[(.+?)\]\]$/.exec(trimmed);
      if (wikilinkMatch) {
        // Strip path prefix and alias to get the bare target name, matching
        // how Obsidian resolves wikilinks. `[[foo/Divine|Div]]` → `Divine`.
        const inner = wikilinkMatch[1];
        const target = inner.split("|")[0];
        const name = target.split("/").pop()!.trim();
        const tagged = tagIndex?.[name];
        if (tagged && tagged.length > 0) {
          expanded = tagged;
        }
        // else: passthrough as a literal wikilink (e.g. `[[Insight]]` that
        // refers to a specific note, not a tag group).
      }
    }

    if (expanded) {
      for (const item of expanded) {
        if (!seen.has(item)) {
          seen.add(item);
          out.push(item);
        }
      }
    } else if (!seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}
