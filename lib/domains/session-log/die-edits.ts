/**
 * Pending die edits → token swaps on their source lines.
 *
 * A die typed or rolled in the Log (or in a card's preview) is held as a
 * pending edit, keyed by its line, its token and its slot. This turns those
 * into the swaps that write them into the text: `d20=` → `d20=14` on
 * `d: d20+[[Insight]]= vs DC 10 ->`. Shared by the live Log (written on Save)
 * and a card's preview (written on Append).
 */

import { combineTermValue, editableTerms, parseFormula, setTermRaw, termSlotInitial, termSlots } from "./formula";
import { dieEditKey, type SidebarItem } from "./prose-model";

export interface TokenSwap {
  line: string;
  from: string;
  to: string;
  /** Which occurrence of `line` (0-based): a log may repeat a line verbatim. */
  nth?: number;
}

/**
 * Each term whose edited slots combine to a different value than it has now
 * becomes a swap on its source line. A term with no pending slot is skipped, so
 * a pool's blank per-die boxes never clobber its recorded total.
 */
export function pendingTermSwaps(items: SidebarItem[], dieEdits: Record<string, string>): TokenSwap[] {
  const out: TokenSwap[] = [];
  for (const item of items) {
    for (const row of item.rows) {
      if (!(row.detail || row.rollable) || !row.source) continue;
      const formula = parseFormula(row.content);
      if (!formula) continue;
      for (const term of editableTerms(formula)) {
        const nth = row.sourceNth ?? 0;
        const keys = Array.from({ length: termSlots(term) }, (_, i) => dieEditKey(row.source!, term.raw, i, nth));
        if (!keys.some((k) => k in dieEdits)) continue; // untouched
        const slots = keys.map((k, i) => dieEdits[k] ?? termSlotInitial(term, i));
        const next = combineTermValue(term, slots);
        const original = term.value != null ? String(term.value) : "";
        if (next !== original) out.push({ line: row.source, from: term.raw, to: setTermRaw(term, next), nth });
      }
    }
  }
  return out;
}

/** Apply swaps to a bare lonelog body (not wrapped in its code block). */
export function applySwapsToBody(body: string, swaps: TokenSwap[]): string {
  if (swaps.length === 0) return body;
  const original = body.split("\n");
  const lines = [...original];
  // Each swap finds its line in the text as it was: a copy written first no
  // longer reads like its twin, which would shift every later copy's count.
  for (const { line, from, to, nth } of swaps) {
    const i = nthLineIndex(original, line, nth ?? 0);
    if (i >= 0) lines[i] = lines[i].replace(from, to);
  }
  return lines.join("\n");
}

/**
 * Write each check's worked-out result into the text — `d: d20+5=14 vs DC 10 ->`
 * becomes `… -> Success` — for the rows that have one and no result of their own.
 */
export function fillDerivedResults(body: string, items: SidebarItem[]): string {
  const original = body.split("\n");
  const lines = [...original];
  for (const row of items.flatMap((i) => i.rows)) {
    if (!row.derivedResult || !row.source) continue;
    const i = nthLineIndex(original, row.source, row.sourceNth ?? 0);
    if (i >= 0) lines[i] = lines[i].replace(/\s*->\s*$/, ` -> ${row.derivedResult}`);
  }
  return lines.join("\n");
}

/** The index of the `nth` line (0-based) whose trimmed text is `line`, or -1. */
function nthLineIndex(lines: string[], line: string, nth: number): number {
  let seen = 0;
  return lines.findIndex((l) => l.trim() === line && seen++ === nth);
}
