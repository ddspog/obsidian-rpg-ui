/**
 * Parser for `rpg list.<name>` fence bodies (pure YAML).
 *
 * The free-form name after the dot in the fence meta (e.g. `cantrips` in
 * `rpg list.cantrips`) seeds the default `id` and a title-cased `name`.
 * Both are overridable via `name:` / `id:` in the YAML body.
 */

import { parse as parseYAML } from "yaml";
import type { ListBlock, ListColumns, ListEntry } from "./types";

/** True when a fence meta selects the list family (`list` or `list.<name>`). */
export function isListMeta(meta: string): boolean {
  return meta === "list" || meta.startsWith("list.");
}

/** Extract the free-form name after `list.` (`""` for a bare `list`). */
export function listNameFromMeta(meta: string): string {
  return meta.startsWith("list.") ? meta.slice("list.".length) : "";
}

function coerceColumns(raw: unknown): ListColumns {
  if (raw === 1 || raw === "1") return 1;
  if (raw === 2 || raw === "2") return 2;
  if (raw === 3 || raw === "3") return 3;
  return "auto";
}

/** Coerce one YAML array element into a cell string: strings trim; numbers /
 *  booleans stringify (so `[Ankheg, 2]` keeps the `2`); YAML's unquoted `[[X]]`
 *  → `[["X"]]` quirk collapses back to the wikilink. Anything else → "". */
function cellFromYaml(x: unknown): string {
  if (typeof x === "string") return x.trim();
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (Array.isArray(x) && x.length === 1 && typeof x[0] === "string") return `[[${x[0]}]]`;
  return "";
}

/** Resolve the heading `name`. An array (`name: [A, B]`) becomes a two-label
 *  bar: `titleCells` holds the cells (left → right) and `name` the joined form
 *  for pills / keys / fallback. YAML's unquoted `[[X]]` → `[["X"]]` quirk is
 *  collapsed back, matching the entry-pair parsing. */
function coerceName(raw: unknown, blockName: string): { name: string; titleCells?: string[] } {
  if (Array.isArray(raw)) {
    const cells = raw.map(cellFromYaml).filter(Boolean);
    if (cells.length >= 2) return { name: cells.join(" "), titleCells: cells };
    if (cells.length === 1) return { name: cells[0] };
    return { name: titleFromSlug(blockName) };
  }
  if (typeof raw === "string" && raw.trim()) return { name: raw.trim() };
  return { name: titleFromSlug(blockName) };
}

function coerceEntries(raw: unknown): ListEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ListEntry[] = [];
  for (const item of raw) {
    // Bare string → a literal line.
    if (typeof item === "string") {
      const text = item.trim();
      if (text) out.push({ text });
      continue;
    }
    // Array → an explicit multi-cell row (`- [A, B]`). Each element is a
    // literal item. YAML parses an unquoted `[[X]]` as `[["X"]]`, so collapse
    // a 1-element string array back to the `[[X]]` wikilink form.
    if (Array.isArray(item)) {
      const items = item.map(cellFromYaml).filter(Boolean);
      if (items.length > 0) out.push({ items });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    // `text:` → a literal line (takes precedence over a call).
    if (typeof obj.text === "string" && obj.text.trim()) {
      out.push({ text: obj.text });
      continue;
    }
    const call = typeof obj.call === "string" ? obj.call.trim() : "";
    if (!call) continue;
    // Array `format` → a multi-cell call row: each element is a cell template.
    if (Array.isArray(obj.format)) {
      const formatCells = obj.format
        .map((x) =>
          typeof x === "string"
            ? x
            : Array.isArray(x) && x.length === 1 && typeof x[0] === "string"
              ? `[[${x[0]}]]`
              : ""
        )
        .filter(Boolean);
      if (formatCells.length > 0) {
        out.push({ call, formatCells });
        continue;
      }
    }
    const format = typeof obj.format === "string" && obj.format ? obj.format : "${name}";
    out.push({ call, format });
  }
  return out;
}

/** Enable pagination for `paginate: true`, `paginate: auto`, or any positive
 *  number (the number is legacy — height now drives page size). */
function coercePaginate(raw: unknown): boolean | undefined {
  if (raw === true) return true;
  if (typeof raw === "string" && raw.trim().toLowerCase() === "auto") return true;
  if (typeof raw === "number" && raw > 0) return true;
  return undefined;
}
function titleFromSlug(slug: string): string {
  if (!slug) return "List";
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Slugify a display name for use as a fallback id. */
function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

/**
 * Parse a `rpg list.<name>` fence body into a {@link ListBlock}.
 *
 * `blockName` is the free-form name after the dot in the fence meta; it
 * seeds the default `id` and `name`. Malformed YAML degrades gracefully to
 * an empty body (the block still renders its heading).
 */
export function parseListBlock(blockName: string, source: string): ListBlock {
  let parsed: unknown;
  try {
    parsed = parseYAML(source);
  } catch {
    parsed = null;
  }
  const fm: Record<string, unknown> =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  const { name, titleCells } = coerceName(fm.name, blockName);
  const id =
    typeof fm.id === "string" && fm.id.trim() ? fm.id.trim() : blockName || slugify(name);
  const subtitle =
    typeof fm.subtitle === "string" && fm.subtitle.trim() ? fm.subtitle.trim() : undefined;
  const paginate = coercePaginate(fm.paginate);

  return {
    name,
    titleCells,
    subtitle,
    id,
    columns: coerceColumns(fm.columns),
    paginate,
    entries: coerceEntries(fm.entries),
  };
}
