/**
 * Paging and filtering for folder calls (`@[[folder/]].magic()`), whose folders can hold
 * hundreds of notes: only a page of them is rendered at a time, and a search box and a
 * select per field (rarity, type, CR…) narrow what is listed.
 *
 * Chain options:
 *   .paginate(10)        a page of 10 (the default is DEFAULT_PAGE_SIZE)
 *   .paginate(0)         every note at once, no controls
 *   .facets(rarity, type) the fields offered as selects (views have defaults, see DEFAULT_FACETS)
 */

import type { FenceMatch } from "./fence-scan";
import type { ChainSegment } from "./parse-call";

export const DEFAULT_PAGE_SIZE = 12;

/** The fields a view's notes are usually told apart by. */
export const DEFAULT_FACETS: Record<string, string[]> = {
  magic: ["rarity", "type"],
  spell: ["circle", "school"],
  stat: ["type", "cr"],
  bare: ["type", "cr"],
};

export interface PagerOptions {
  /** Notes a page; 0 shows them all. */
  size: number;
  facets: string[];
  /** Set by the call itself (`.paginate(n)` or `.facets(…)`), not by default. */
  explicit: boolean;
}

export interface PagerItem {
  key: string;
  name: string;
  data: Record<string, unknown>;
}

export function pagerOptions(chain: ChainSegment[], view: string): PagerOptions {
  const paginate = chain.find((s) => s.fn === "paginate");
  const facets = chain.find((s) => s.fn === "facets");
  const size =
    paginate && paginate.args.length ? Math.max(0, Math.floor(Number(paginate.args[0]) || 0)) : DEFAULT_PAGE_SIZE;
  return {
    size,
    facets: facets ? facets.args.map((a) => String(a).trim()).filter(Boolean) : (DEFAULT_FACETS[view] ?? []),
    explicit: !!paginate || !!facets,
  };
}

/** A field's value as words to show and compare: `[[Rare]]` → `Rare`, a list joined. */
export function facetValue(data: Record<string, unknown>, field: string): string {
  const raw = field
    .split(".")
    .reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), data);
  // Values grouped as a reader picks them: `Weapon (Any Sword)` is a Weapon, `Medium Fiend (Demon)` a Fiend.
  const one = (v: unknown) =>
    String(v ?? "")
      .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2")
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/^(?:(?:tiny|small|medium|large|huge|gargantuan)(?:\s+or\s+|\s+))+/i, "")
      .trim();
  return Array.isArray(raw) ? raw.map(one).filter(Boolean).join(", ") : one(raw);
}

/** The values a field takes across the items, in order (numbers and fractions by value). */
export function facetChoices(items: PagerItem[], field: string): string[] {
  const seen = new Set<string>();
  for (const it of items) {
    const v = facetValue(it.data, field);
    if (v) seen.add(v);
  }
  const num = (s: string) => {
    const m = s.match(/^(\d+)(?:\/(\d+))?$/);
    return m ? Number(m[1]) / Number(m[2] ?? 1) : NaN;
  };
  return [...seen].sort((a, b) => {
    const na = num(a);
    const nb = num(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

/** The items whose name has the search words and whose fields have the values chosen. */
export function filterItems<T extends PagerItem>(items: T[], search: string, chosen: Record<string, string>): T[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((it) => {
    const name = it.name.toLowerCase();
    if (!words.every((w) => name.includes(w))) return false;
    for (const [field, value] of Object.entries(chosen)) {
      if (!value) continue;
      const v = facetValue(it.data, field);
      if (!v.split(", ").includes(value) && v !== value) return false;
    }
    return true;
  });
}

export function pageCount(total: number, size: number): number {
  return size > 0 ? Math.max(1, Math.ceil(total / size)) : 1;
}

/** The items of page `page` (0-based), the page kept in range. */
export function pageOf<T>(items: T[], page: number, size: number): { items: T[]; page: number } {
  if (size <= 0) return { items, page: 0 };
  const last = pageCount(items.length, size) - 1;
  const p = Math.min(Math.max(0, page), last);
  return { items: items.slice(p * size, p * size + size), page: p };
}

/**
 * The fields a note is told apart by: its frontmatter under its own entity's block (the stat
 * block, the magic item), not a side box beside it (a `rule.side` "Variant" with `type: rules`).
 * `fallback` is used when the note has no such block.
 */
export function pagerFields(
  fences: FenceMatch[],
  frontmatter: Record<string, unknown>,
  fallback: Record<string, unknown> = {}
): Record<string, unknown> {
  const top = fences.filter((f) => !fences.some((g) => g !== f && g.start < f.start && g.end > f.end));
  const own = top.find((f) => f.entity !== "rule" && f.body);
  return { ...frontmatter, ...(own?.body ?? fallback) };
}
