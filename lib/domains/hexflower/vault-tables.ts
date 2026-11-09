/**
 * Rolling an `rpg table.<name>` block somewhere in the vault from code: a hex flower's doubles roll
 * its Distinct Hex Elements table, and the map's Generate tool puts what came up on the hex.
 */

import type { App } from "obsidian";
import { parseTableBlock } from "lib/domains/tables/parse-table-block";
import { formatRollOutcome, rollOnce } from "lib/domains/tables/roll";
import type { TableDef } from "lib/domains/tables/types";

/** `[[Note]]#name`, `[[Note#^name]]`, or `#name` (this note) → the note's link text and the table's name. */
export function readTableRef(ref: string): { note?: string; name: string } | null {
  const t = ref.trim();
  const inner = t.match(/^\[\[([^\]|]*)(?:\|[^\]]*)?\]\](?:#\^?(.+))?$/);
  if (inner) {
    const [link, hash] = inner[1].split("#");
    const name = (inner[2] ?? hash ?? "").replace(/^\^/, "").trim();
    return name ? { note: link.trim() || undefined, name } : null;
  }
  const local = t.match(/^#\^?(.+)$/);
  return local ? { name: local[1].trim() } : null;
}

/** The `rpg table.<name>` block of that name in a note's text. */
export function tableIn(text: string, name: string): TableDef | null {
  const re = /^(`{3,}|~{3,})\s*rpg\s+table\.([^\s`]+)[^\n]*\n([\s\S]*?)^\1\s*$/gm;
  for (const m of text.matchAll(re)) if (m[2] === name) return parseTableBlock(name, m[3]);
  return null;
}

/** One roll's row as plain text, its first bold words as a short name (`**Haunted**\* – …` → Haunted). */
export function shortName(text: string): string {
  const bold = text.match(/\*\*([^*]+)\*\*/);
  const plain = (bold ? bold[1] : text.split(/\s[–—-]\s/)[0]).replace(/[*_[\]]/g, "").trim();
  return plain.length > 28 ? `${plain.slice(0, 27)}…` : plain;
}

/** A table in the vault, by reference. Null when the note or the table isn't found. */
export async function loadVaultTable(app: App, ref: string, sourcePath: string): Promise<TableDef | null> {
  const parsed = readTableRef(ref);
  if (!parsed) return null;
  const file = parsed.note
    ? app.metadataCache.getFirstLinkpathDest(parsed.note, sourcePath)
    : app.vault.getFileByPath(sourcePath);
  if (!file) return null;
  return tableIn(await app.vault.cachedRead(file), parsed.name);
}

/** One roll on a table: the row's text, a short name for it, and the die. Null on a gap. */
export function rollTable(
  table: TableDef,
  random: () => number = Math.random
): { text: string; name: string; rolled?: number } | null {
  const out = rollOnce(table, [], undefined, random);
  if (out.kind === "miss") return null;
  const text = formatRollOutcome(out).replace(/^\d+(?:[-–]\d+)?\s+—\s+/, "");
  return { text, name: shortName(text), ...(out.kind === "hit" ? { rolled: out.rolled } : {}) };
}
