/**
 * The keyed areas of an adventure as rows to draft encounters from: each
 * `*Creatures.*` (or `*Creature.*`) paragraph is a row, its roll the area's key
 * ("B3" for "Area B3. Main Hall", else the heading), its text the paragraph in
 * plain words, cross-references ("see the Appendix", "Area 9") dropped. One
 * source a note, with the slug `areas`, tagged `adventure` and the adventure's
 * name (its folder, for an adventure split into part notes). Pure: no
 * Obsidian and no I/O.
 */

import { bookOf, frontmatterOf, kebab, plainHeading, type TableSource } from "./table-source";

const FENCE_OPEN = /^(`{3,}|~{3,})\s*(.*)$/;
/** Fences whose body is markdown (tabs, side panels, callouts of rules): read through. */
const MARKDOWN_FENCE = /^rpg\s+rule\b/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const CREATURES = /^\*Creatures?\.\*\s*(.*)$/;
const ADVENTURES = "worldbuilding/adventures/";

/** "Area B3. Main Hall" is "B3", "Areas 4 and 6" is "4", any other heading itself. */
export function areaKey(heading: string): string {
  const m = heading.match(/^Areas?\s+([A-Za-z]?\d+[a-z]?)\b/i);
  return m ? m[1] : heading;
}

/** A paragraph in plain words: emphasis and links dropped, "(see the Appendix)" and area references gone. */
export function plainParagraph(text: string): string {
  return plainHeading(
    text
      .replace(/\s*\(see (?:the )?\*{0,2}Appendix\*{0,2}[^)]*\)/gi, "")
      .replace(
        /\bin\s+\*{0,2}Areas?\s+[A-Za-z]?\d+[a-z]?\*{0,2}(?:\s+and\s+\*{0,2}[A-Za-z]?\d+[a-z]?\*{0,2})?/g,
        "nearby"
      )
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** The phrases a paragraph sets in bold, "**Would**-**Be**-**King**" as one: the creatures an adventure means. */
export function boldNames(text: string): string[] {
  const joined = text.replace(/\*{2}([-\u2010\u2011])\*{2}/g, "$1");
  return [...joined.matchAll(/\*{2}([^*]+?)\*{2}/g)]
    .map((m) => plainHeading(m[1]).trim())
    .filter((name) => name && !/^(?:Areas?\b|Appendix\b)/i.test(name));
}

/** The adventure a note belongs to: the folder under `adventures/` it is in, else the note itself. */
function adventureOf(path: string): string {
  const at = path.indexOf(ADVENTURES);
  const rest = at >= 0 ? path.slice(at + ADVENTURES.length) : (path.split("/").pop() ?? path);
  const parts = rest.split("/");
  return kebab(parts.length > 1 ? parts[0] : parts[0].replace(/\.md$/i, ""));
}

/** The keyed areas of a note that hold creatures, as one source (none when it has no `*Creatures.*` paragraph). */
export function areasOfNote(path: string, text: string): TableSource[] {
  const lines = text.split(/\r?\n/);
  const book = bookOf(frontmatterOf(text).source);
  const base = (path.split("/").pop() ?? path).replace(/\.md$/i, "");
  let title: string | undefined;
  let heading: string | undefined;
  // Open fences, innermost last; a line counts only while every open fence holds markdown.
  const fences: Array<{ mark: string; markdown: boolean }> = [];
  let firstLine = 0;
  const rows: TableSource["rows"] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = line.match(FENCE_OPEN);
    const top = fences[fences.length - 1];
    if (open && top && open[1][0] === top.mark[0] && open[1].length >= top.mark.length && open[2].trim() === "") {
      fences.pop();
      continue;
    }
    if (top && !top.markdown) continue;
    if (open) {
      fences.push({ mark: open[1], markdown: MARKDOWN_FENCE.test(open[2].trim()) });
      continue;
    }
    const h = line.match(HEADING);
    if (h) {
      if (h[1].length === 1 && !title) title = plainHeading(h[2]);
      else heading = plainHeading(h[2]);
      continue;
    }
    const c = line.match(CREATURES);
    if (!c) continue;
    const words = plainParagraph(c[1]);
    if (!words) continue;
    if (!firstLine) firstLine = i + 1;
    // Two creature paragraphs under one heading: "B3", "B3 (2)".
    // A note that is one area ("Area 3. A Floor of Honey") keys it by its title.
    const key = heading
      ? areaKey(heading)
      : title && /^Areas?\s/i.test(title)
        ? areaKey(title)
        : String(rows.length + 1);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    const roll = n > 1 ? `${key} (${n})` : key;
    rows.push({ roll, text: words, cells: [words], named: boldNames(c[1]) });
  }
  if (!rows.length) return [];
  const adventure = adventureOf(path);
  const tags = [...new Set(["adventure", adventure, ...(book ? [book] : [])].filter(Boolean))];
  return [
    {
      path,
      slug: "areas",
      title: title || base,
      columns: ["Area", "Creatures"],
      line: firstLine,
      tags,
      ...(book ? { book } : {}),
      rows,
    },
  ];
}
