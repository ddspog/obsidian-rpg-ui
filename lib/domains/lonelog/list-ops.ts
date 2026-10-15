/**
 * List-tag registry + consult resolution (Characters / Threads and other
 * lonelog LISTS).
 *
 * A list is a named collection the log grows and consults:
 *   - `[<name>+ entry]` appends an entry,
 *   - `[<name>- entry]` removes one,
 *   - `[<name>?]`       consults it (rolls a live entry, or falls back to the
 *                        list's declared `default` when empty — the testing path).
 * Declared once as a `feature.gm` `list:` aspect (like a `dial:`) and imported
 * via `reads:`, so a log block references it by name without re-stating it.
 *
 * This module currently supplies the registry (`collectLists`) plus the
 * consult→default resolution (`resolveConsult`) used by the generator
 * ramification: an Event Focus "NPC Action" result consults `[Characters?]`,
 * which resolves to the Characters list's default. The add/remove running-state
 * fold lands alongside the lonelog `list-op` tag (next increment).
 */

import type { GMFeature } from "../features/types";
import type { ListOpTag, LonelogEntry, PersistentTag } from "./types";

/** A declared list the resolver consults. */
export interface ListDecl {
  /** Registry key + display name (the list's name). */
  name: string;
  /** Consult fallback returned when the list has no live entries. */
  default: string;
  /** Seed entries (used by live entry-rolls; consult→default ignores). */
  entries: string[];
  /** Rows per section (Mythic X = 5); defaults to `LIST_SECTION`. */
  section?: number;
  /** Sheet capacity (Mythic Y = 25) → `max / section` sections. */
  max?: number;
}

/** Mythic's list sheet defaults: 25 slots in sections of 5. */
export const LIST_SECTION = 5;
export const LIST_MAX = 25;

/**
 * The dice a consult rolls, given how many entries are live.
 *
 * Mythic reads each die in PAIRS (1-2 → 1, 3-4 → 2, …), so a d10 selects one of
 * five rows and the section die scales with how far the list reaches: one
 * section needs no roll, two → d4, three → d6, four → d8, five → d10. Returns
 * `section: null` when a single section covers every entry.
 */
export function consultDice(decl: ListDecl, count: number): { section: number | null; row: number } {
  const size = decl.section || LIST_SECTION;
  const sections = Math.max(1, Math.ceil(count / size));
  return { section: sections > 1 ? sections * 2 : null, row: size * 2 };
}

/** A die read in Mythic's paired ranges: 1-2 → 1, 3-4 → 2, 5-6 → 3, … */
export function pairedIndex(roll: number): number {
  return Math.ceil(roll / 2);
}

/**
 * The 1-based slot a section/row roll addresses: `(section-1) × size + row`.
 * With no section die the list is one section, so the slot is just the row.
 */
export function consultSlot(decl: ListDecl, sectionRoll: number | null, rowRoll: number): number {
  const size = decl.section || LIST_SECTION;
  const sec = sectionRoll == null ? 1 : pairedIndex(sectionRoll);
  return (sec - 1) * size + pairedIndex(rowRoll);
}

/**
 * Map the log's ORDERED roll values onto the dice this list currently needs.
 * A one-section list rolls once (the row); a larger one rolls section-then-row.
 * Keeping the log die-agnostic means a draw recorded when the list held 6
 * entries still reads correctly after it grows past 10 — the same `r1`/`r2` are
 * simply re-interpreted against the bigger sheet.
 */
export function slotFromRolls(decl: ListDecl, count: number, rolls: number[]): number | undefined {
  if (rolls.length === 0) return undefined;
  const { section } = consultDice(decl, count);
  return section == null ? consultSlot(decl, null, rolls[0]) : consultSlot(decl, rolls[0], rolls[1] ?? rolls[0]);
}

/** One row of the printed list sheet: the row-die range that selects it, its
 *  1-based slot, and whatever entry currently occupies that slot. */
export interface ListSheetRow {
  /** The row die's paired range, e.g. `"7-8"`. */
  range: string;
  /** 1-based slot on the sheet. */
  slot: number;
  /** The live entry in this slot, or undefined for a void cell. */
  entry?: string;
}

/** One section of the sheet: the section-die range that selects it, the die you
 *  roll to reach it (null for the first section), and its rows. */
export interface ListSheetSection {
  /** 1-based section index. */
  index: number;
  /** The section die's paired range, e.g. `"3-4"`. */
  range: string;
  /** The die used when the list extends this far — null for the first section
   *  (a list inside one section needs no section roll). */
  die: number | null;
  rows: ListSheetRow[];
}

/** The paired range a die value must fall in to select index `i` (1-based):
 *  1 → "1-2", 2 → "3-4", … (the sheet's two-values-per-row reading). */
function pairedRange(i: number): string {
  return `${i * 2 - 1}-${i * 2}`;
}

/**
 * The full printed sheet for a list — every section and slot, with the dice that
 * address them and the entries currently filling them. Mirrors the Mythic list
 * page: `max / section` sections of `section` rows, each row selected by a
 * paired range. Pure, so the modal just renders it.
 */
export function listSheet(decl: ListDecl, entries: string[]): ListSheetSection[] {
  const size = decl.section || LIST_SECTION;
  const total = decl.max || LIST_MAX;
  const count = Math.max(1, Math.ceil(total / size));
  return Array.from({ length: count }, (_, s) => ({
    index: s + 1,
    range: pairedRange(s + 1),
    // Section 1 needs no roll; beyond it the die is the one that reaches this far.
    die: s === 0 ? null : (s + 1) * 2,
    rows: Array.from({ length: size }, (_, r) => {
      const slot = s * size + r + 1;
      return { range: pairedRange(r + 1), slot, entry: entries[slot - 1] };
    }),
  }));
}

/** Build a list registry (keyed by list name) from a set of features: each
 *  feature's `list:` aspect. First declaration of a name wins. */
export function collectLists(features: GMFeature[]): Record<string, ListDecl> {
  const out: Record<string, ListDecl> = {};
  for (const f of features) {
    if (!f.list) continue;
    const name = f.list.name ?? f.name;
    if (!name || out[name]) continue;
    out[name] = {
      name,
      default: f.list.default,
      entries: f.list.entries ?? [],
      section: f.list.section ?? LIST_SECTION,
      max: f.list.max ?? LIST_MAX,
    };
  }
  return out;
}

/** The list name a read ref targets — `[Name?]` (inspect) or `[Name@]` (roll) —
 *  or null when `ref` isn't one. Used by the generator ramification, which
 *  chains e.g. an Event Focus `NPC` result to `[Characters@]`. */
export function consultName(ref: string): string | null {
  const m = ref.match(/^\[([^\]?@]+)\s*[?@]\]$/);
  return m ? m[1].trim() : null;
}

/**
 * Resolve a read ref (`[Name?]` / `[Name@]`) against the registry → the display
 * line body (`<Name>: <result>`), or null when it isn't one / the list is
 * unknown. The result is the list's declared `default` (the testing path; a live
 * entry-roll happens once the log carries real entries).
 */
export function resolveConsult(ref: string, lists?: Record<string, ListDecl>): string | null {
  const name = consultName(ref);
  if (!name) return null;
  const decl = lists?.[name];
  if (!decl) return null;
  return `${decl.name}: ${decl.default}`;
}

/** One resolved list op: the running entries at this point, for the pill. */
export interface ResolvedListOp {
  name: string;
  op: ListOpTag["op"];
  /** The entry added/removed, or the entry a roll landed on. */
  entry?: string;
  /** Every entry this op touched — several when same-list ops on ONE line are
   *  merged (`[Characters+ A Mouse][Characters+ Brian]`). */
  entries?: string[];
  /** Entry count after this op. */
  count: number;
  /** A roll whose result is baked in the log (`[Name@ entry]`) — editable. */
  rolled?: boolean;
  /** For a consult: the live entries to offer as picker options (plus the
   *  declared `default` when the list is empty). */
  options?: string[];
  /** The dice this consult should roll at the current entry count — `section`
   *  is null when one section covers the list. */
  dice?: { section: number | null; row: number };
  /** The 1-based sheet slot a rolled consult addressed. */
  slot?: number;
  /** The ordered roll values, echoed for the pill's die badges. */
  rolls?: number[];
  /** The list's live entries AT THIS POINT plus its declaration — lets the pill
   *  open the printed sheet showing exactly which rolls land where. */
  sheet?: { decl: ListDecl; entries: string[] };
}

/** Tags carried by an entry — persistent tags on consequence/world_event, plus
 *  ops on an oracle-question line. */
function entryTags(entry: LonelogEntry): PersistentTag[] {
  if (entry.type === "consequence" || entry.type === "world_event") return entry.tags;
  if (entry.type === "oracle_question") return entry.dialOps ?? [];
  return [];
}

/**
 * Pick a live entry for a consult. Mythic rolls a "variable die" across the
 * list; with N entries the index is derived from `roll` (1-based, wrapping) so
 * the choice is DETERMINISTIC for a given roll — the log stays stable across
 * re-renders. Falls back to the declared `default` when the list is empty.
 */
export function consultEntry(decl: ListDecl, entries: string[], slot?: number): string {
  if (entries.length === 0) return decl.default;
  if (slot == null) return entries[0];
  // A slot past the last live entry is a VOID cell on the sheet — the roll is
  // valid, there is just nothing written there yet.
  return entries[slot - 1] ?? decl.default;
}

/**
 * Fold every list op in `entries` onto its list's running entry set. Returns a
 * map from entry index → the ops resolved on that entry (in order), so the
 * render layer can attach the running state to the matching sidebar item.
 * Mirrors `resolveDialOps` for resources. Ops naming an undeclared list are
 * inert; a `remove` of an absent entry is a no-op.
 */
export function resolveListOps(
  entries: LonelogEntry[],
  decls: Record<string, ListDecl>
): Map<number, ResolvedListOp[]> {
  const running: Record<string, string[]> = {};
  const out = new Map<number, ResolvedListOp[]>();

  entries.forEach((entry, i) => {
    for (const tag of entryTags(entry)) {
      if (tag.kind !== "list-op") continue;
      const decl = decls[tag.name];
      if (!decl) continue; // unmatched → inert
      const live = (running[tag.name] ??= [...decl.entries]);
      let resolvedEntry = tag.entry;
      let options: string[] | undefined;
      let dice: { section: number | null; row: number } | undefined;
      let slot: number | undefined;
      if (tag.op === "add" && tag.entry) {
        // DUPLICATES ARE MEANINGFUL: the sheet has one slot per row, so writing a
        // name twice gives it two slots and twice the chance of being drawn.
        live.push(tag.entry);
      } else if (tag.op === "remove" && tag.entry) {
        // Removes exactly ONE occurrence, so two removes thin a doubled entry
        // back to single — the inverse of adding twice.
        const at = live.indexOf(tag.entry);
        if (at >= 0) live.splice(at, 1);
      } else if (tag.op === "inspect") {
        // `[Characters?]` — show the WHOLE list (or the default when empty).
        options = live.length > 0 ? [...live] : [decl.default];
        resolvedEntry = live.length > 0 ? live.join(", ") : decl.default;
      } else if (tag.op === "roll") {
        // `[Characters@]` — draw ONE entry. Three forms, in precedence order:
        //  1. `@ Tocky`         an explicit pick — the reader's word is final;
        //  2. `@ d4=3 d10=7`    rolled — section+row address a slot on the sheet
        //                       (a slot past the last entry is void → default);
        //  3. `@`               unrolled — show the first live entry.
        options = live.length > 0 ? [...live] : [decl.default];
        dice = consultDice(decl, live.length);
        if (tag.rolled && tag.entry) {
          resolvedEntry = tag.entry;
        } else if (tag.rolls?.length) {
          slot = slotFromRolls(decl, live.length, tag.rolls);
          resolvedEntry = consultEntry(decl, live, slot);
        } else {
          resolvedEntry = consultEntry(decl, live);
        }
      }
      const resolved: ResolvedListOp = {
        name: decl.name,
        op: tag.op,
        // Snapshot the list as it stands after this op, for the sheet modal.
        sheet: { decl, entries: [...live] },
        entry: resolvedEntry,
        count: live.length,
        ...(tag.op === "roll" || tag.op === "inspect"
          ? {
              rolled: tag.rolled,
              options,
              dice,
              slot,
              rolls: tag.rolls,
            }
          : {}),
      };
      const list = out.get(i);
      if (list) list.push(resolved);
      else out.set(i, [resolved]);
    }
    // Same-line ops on the same list COALESCE into one entry, so
    // `[Characters+ A Mouse][Characters+ Brian]` reads as a single change
    // rather than two adjacent pills. Only add/remove merge — a roll and an
    // inspect each report their own result.
    const ops = out.get(i);
    if (ops && ops.length > 1) out.set(i, mergeSameLineOps(ops));
  });

  return out;
}

/** Coalesce adjacent add/remove ops that name the same list, keeping the LAST
 *  op's running count (the state after all of them applied). */
function mergeSameLineOps(ops: ResolvedListOp[]): ResolvedListOp[] {
  const out: ResolvedListOp[] = [];
  for (const op of ops) {
    const prev = out[out.length - 1];
    const mergeable = op.op === "add" || op.op === "remove";
    if (prev && mergeable && prev.name === op.name && prev.op === op.op) {
      prev.entries = [...(prev.entries ?? [prev.entry ?? ""]), op.entry ?? ""].filter(Boolean);
      // Adopt the LAST op's state — the count and sheet snapshot after all of
      // the merged ops applied, not after just the first.
      prev.count = op.count;
      prev.sheet = op.sheet;
      continue;
    }
    out.push({ ...op });
  }
  return out;
}
