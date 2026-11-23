/**
 * A battle map's tokens as a row to draft an encounter from: each `rpg map`
 * fence whose `tokens:` link notes (`"[[Kobold, Elite]]": J3`, `"Fat [[Kobold,
 * A]]": C8`) is one row, its roll the map's title, its `linked` the linked
 * names and how many tokens each has. Tokens with no link (the PCs, an NPC
 * written by name) are left to the party. Pure: no Obsidian and no I/O.
 */

import { parse as parseYaml } from "yaml";
import { bookOf, frontmatterOf, kebab, plainHeading, type TableSource } from "./table-source";

const FENCE = /^(`{3,}|~{3,})\s*rpg\s+map\b[^\n]*\n([\s\S]*?)\n\1[ \t]*$/gm;
const LINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/;

/** The linked token names of a map's `tokens:`, with how many tokens each has, in the map's order. */
export function linkedTokens(tokens: unknown): Array<{ name: string; count: number }> {
  if (!tokens || typeof tokens !== "object") return [];
  const keys = Array.isArray(tokens)
    ? tokens.map((t) => (t && typeof t === "object" ? String((t as Record<string, unknown>).name ?? "") : String(t)))
    : Object.keys(tokens as Record<string, unknown>);
  const out: Array<{ name: string; count: number }> = [];
  for (const key of keys) {
    const m = key.match(LINK);
    if (!m) continue;
    const name = m[1].trim();
    const seen = out.find((o) => o.name === name);
    if (seen) seen.count += 1;
    else out.push({ name, count: 1 });
  }
  return out;
}

/** The maps of a note that put linked creatures on the board, one source each (slug `map`). */
export function mapsOfNote(path: string, text: string): TableSource[] {
  const book = bookOf(frontmatterOf(text).source);
  const base = (path.split("/").pop() ?? path).replace(/\.md$/i, "");
  const heading = text.match(/^#\s+(.*)$/m);
  const noteTitle = heading ? plainHeading(heading[1]) : base;
  const out: TableSource[] = [];
  for (const m of text.matchAll(FENCE)) {
    const yaml = m[2].split(/^---\s*$/m)[0];
    let data: Record<string, unknown> = {};
    try {
      data = (parseYaml(yaml) ?? {}) as Record<string, unknown>;
    } catch {
      continue;
    }
    const linked = linkedTokens(data.tokens);
    if (!linked.length) continue;
    const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : noteTitle;
    const words = linked.map((l) => `${l.count} ${l.name}`).join("; ");
    out.push({
      path,
      slug: "map",
      title,
      columns: ["Map", "Tokens"],
      line: text.slice(0, m.index).split("\n").length,
      tags: [...new Set(["map", kebab(title), ...(book ? [book] : [])].filter(Boolean))],
      ...(book ? { book } : {}),
      rows: [{ roll: "map", text: words, cells: [words], linked }],
    });
  }
  return out;
}
