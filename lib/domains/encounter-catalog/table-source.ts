/**
 * The random tables of a note: each `rpg table.<slug>` fence read into rows,
 * with the tags its note, heading and slug give it (environment, tier, CR band,
 * level and difficulty, book). Only encounter tables unless asked for all.
 * Plain text scanning: no Obsidian and no I/O.
 */

import { parse as parseYaml } from "yaml";

export interface TableRow {
  /** The roll cell, ranges with a plain hyphen ("1-2"). */
  roll: string;
  /** The other cells, joined with " | ". */
  text: string;
  /** The other cells, one each. */
  cells: string[];
}

export interface TableSource {
  /** The note's vault path. */
  path: string;
  /** The block's slug: `rpg table.<slug>`. */
  slug: string;
  /** The note's first `#` heading (else its file name). */
  title: string;
  /** The nearest heading above the fence. */
  heading?: string;
  /** The header cells, roll column first. */
  columns: string[];
  /** 1-based line of the opening fence. */
  line: number;
  /** Every tag, e.g. ["arctic", "tier-1", "game-masters-guide"]. */
  tags: string[];
  /** The place the note is about: "arctic" for "Arctic Encounters". */
  environment?: string;
  /** The kebab-case title of the book the note's `source:` names. */
  book?: string;
  rows: TableRow[];
}

export interface TablesOfNoteOptions {
  /** Return every table, not only the encounter ones. */
  all?: boolean;
}

const FENCE_OPEN = /^(`{3,}|~{3,})\s*(.*)$/;
const TABLE_INFO = /^rpg\s+table\.([A-Za-z0-9_-]+)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/** Lowercase kebab-case: accents and apostrophes dropped, "&" read as "and". */
export function kebab(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Heading or title text as plain words: emphasis, links and trailing `#`s dropped. */
function plainHeading(text: string): string {
  return text
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

function frontmatterOf(text: string): Record<string, unknown> {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return {};
  try {
    const parsed: unknown = parseYaml(m[1]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The kebab-case title a `source:` line names: `From **X** "Game Master's Guide" by **Y**` -> "game-masters-guide". */
export function bookOf(source: unknown): string | undefined {
  if (typeof source !== "string") return undefined;
  const quoted = source.match(/["\u201C]([^"\u201D]+)["\u201D]/);
  if (quoted) return kebab(quoted[1]) || undefined;
  const bare = source
    .replace(/\*+/g, "")
    .replace(/^\s*from\s+/i, "")
    .replace(/\s+by\s+.*$/i, "");
  return kebab(bare) || undefined;
}

/** The cells of a `|a|b|` line; a pipe inside `[[a|b]]` or escaped as `\|` stays in its cell. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  let link = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (c === "[" && s[i + 1] === "[") {
      link++;
      cur += "[[";
      i++;
    } else if (c === "]" && s[i + 1] === "]" && link > 0) {
      link--;
      cur += "]]";
      i++;
    } else if (c === "|" && link === 0) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  cells.push(cur.trim());
  return cells;
}

const isSeparator = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
const isFooter = (cells: string[]) => cells.length === 1 && /\{\{.*\}\}/.test(cells[0]);

function parseBody(body: string[]): { columns: string[]; rows: TableRow[] } {
  const lines = body.filter((l) => l.trim().startsWith("|")).map(splitRow);
  let columns: string[] = [];
  let start = 0;
  if (lines.length > 1 && isSeparator(lines[1])) {
    columns = lines[0];
    start = 2;
  }
  const rows: TableRow[] = [];
  for (const cells of lines.slice(start)) {
    if (isSeparator(cells) || isFooter(cells) || cells.length < 2) continue;
    const roll = cells[0].replace(/[\u2013\u2014\u2212]/g, "-").replace(/\s+/g, "");
    const rest = cells.slice(1);
    if (!roll || rest.every((c) => c === "")) continue;
    rows.push({ roll, text: rest.join(" | "), cells: rest });
  }
  return { columns, rows };
}

function tiersIn(lo: string, hi?: string): string[] {
  const a = parseInt(lo, 10);
  const b = hi ? parseInt(hi, 10) : a;
  const out: string[] = [];
  for (let n = a; n <= Math.max(a, Math.min(b, a + 4)); n++) out.push(`tier-${n}`);
  return out;
}

/** Tier tags from heading-like text ("Tier 1", "Tiers 3-4"), else none. */
function tierFromText(text: string | undefined): string[] {
  const m = text?.match(/\btiers?\s*(\d+)(?:\s*[\u2013\u2014-]\s*(\d+))?/i);
  return m ? tiersIn(m[1], m[2]) : [];
}

function tierFromSlug(slug: string): string[] {
  const m = slug.match(/(?:^|-)tiers?-(\d+)(?:-(\d+))?(?=-|$)/);
  return m ? tiersIn(m[1], m[2]) : [];
}

function crFromText(text: string | undefined): string | undefined {
  const m = text?.match(/\bCR\s*(\d+)(?:\s*[\u2013\u2014-]\s*(\d+)|\s*\+)?/i);
  if (!m) return undefined;
  if (m[2]) return `cr-${m[1]}-${m[2]}`;
  return /\+/.test(m[0]) ? `cr-${m[1]}-plus` : `cr-${m[1]}`;
}

function crFromSlug(slug: string): string | undefined {
  const m = slug.match(/(?:^|-)cr-(\d+)(?:-(\d+)|-(plus))?(?=-|$)/);
  if (!m) return undefined;
  if (m[2]) return `cr-${m[1]}-${m[2]}`;
  return m[3] ? `cr-${m[1]}-plus` : `cr-${m[1]}`;
}

const DIFFICULTY = "easy|medium|moderate|challenging|hard|deadly";

function levelFromSlug(slug: string): string[] {
  const m = slug.match(new RegExp(`(?:^|-)level-(\\d+)-(${DIFFICULTY})(?=-|$)`));
  return m ? [`level-${m[1]}`, m[2]] : [];
}

function levelFromText(text: string | undefined): string[] {
  const m = text?.match(new RegExp(`\\blevel\\s*(\\d+)\\W+(${DIFFICULTY})\\b`, "i"));
  return m ? [`level-${m[1]}`, m[2].toLowerCase()] : [];
}

/** "Arctic Encounters (Tier 1)" -> "arctic"; "Encounters in Dungeons (CR 1-4)" -> "dungeons"; none when not an encounters title. */
function environmentOf(title: string): string | undefined {
  if (!/\bencounters?\b/i.test(title)) return undefined;
  const words = title
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bencounters?\b/gi, " ")
    .replace(/:.*$/, " ")
    .trim()
    .replace(/^(?:in|of|on|for|the)\s+/i, "");
  return kebab(words) || undefined;
}

const first = <T>(...values: (T | undefined)[]): T | undefined => values.find((v) => v !== undefined);

function tagsFor(
  slug: string,
  heading: string | undefined,
  title: string,
  environment?: string,
  book?: string
): string[] {
  const tier = [tierFromText(heading), tierFromText(title), tierFromSlug(slug)].find((t) => t.length > 0) ?? [];
  const cr = first(crFromText(heading), crFromText(title), crFromSlug(slug));
  const level = [levelFromSlug(slug), levelFromText(heading)].find((t) => t.length > 0) ?? [];
  const tags = [environment, ...tier, cr, ...level, book].filter((t): t is string => !!t);
  return [...new Set(tags)];
}

/**
 * The tables of a note. Only the ones about encounters (the word in the slug,
 * the nearest heading or the note's title) unless `all` is set.
 */
export function tablesOfNote(path: string, text: string, options: TablesOfNoteOptions = {}): TableSource[] {
  const lines = text.split(/\r?\n/);
  const book = bookOf(frontmatterOf(text).source);
  const base = (path.split("/").pop() ?? path).replace(/\.md$/i, "");

  // The title is the first top-level heading outside any fence.
  let title: string | undefined;
  {
    let fence: string | null = null;
    for (const line of lines) {
      const open = line.match(FENCE_OPEN);
      if (fence) {
        if (open && open[1][0] === fence[0] && open[1].length >= fence.length && open[2].trim() === "") fence = null;
        continue;
      }
      if (open) {
        fence = open[1];
        continue;
      }
      const h = line.match(HEADING);
      if (h && h[1].length === 1) {
        title = plainHeading(h[2]);
        break;
      }
    }
  }
  title = title || base;
  const environment = environmentOf(title);

  const out: TableSource[] = [];
  let heading: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(FENCE_OPEN);
    if (!open) {
      const h = lines[i].match(HEADING);
      if (h && h[1].length >= 2) heading = plainHeading(h[2]);
      continue;
    }
    const fence = open[1];
    const info = open[2].trim().match(TABLE_INFO);
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const close = lines[j].match(FENCE_OPEN);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length && close[2].trim() === "") break;
      body.push(lines[j]);
    }
    if (info) {
      const slug = info[1];
      const wanted = options.all || /encounter/i.test(`${slug} ${heading ?? ""} ${title}`);
      if (wanted) {
        const { columns, rows } = parseBody(body);
        out.push({
          path,
          slug,
          title,
          ...(heading ? { heading } : {}),
          columns,
          line: i + 1,
          tags: tagsFor(slug, heading, title, environment, book),
          ...(environment ? { environment } : {}),
          ...(book ? { book } : {}),
          rows,
        });
      }
    }
    i = j;
  }
  return out;
}
