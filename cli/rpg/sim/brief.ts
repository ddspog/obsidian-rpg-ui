/**
 * The short forms `--brief` prints and `plan` returns: what a Game Master model
 * needs to choose an encounter and nothing else (no per-trial arrays, no
 * statblock summaries, no paths where a name is enough). A group is written as
 * the `--monster` flag takes it ("Thug:3"), so an option can be passed back to
 * `rpg sim run` or `rpg sim catalog add` as it is.
 */

import { classifyFit, type Fit, type FitDifficulty } from "lib/domains/encounter-sim/fit";
import type { FidelityRecord } from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";

const stemOf = (path: string): string => (path.split("/").pop() ?? path).replace(/\.md$/i, "");

/**
 * The shortest reference to a note that resolves back to it: its name when the
 * name alone finds that note, else its vault path without `.md`.
 */
export function noteRef(ctx: Ctx, path: string): string {
  const stem = stemOf(path);
  const found = ctx.vault.getFileByPath(`${stem}.md`) ?? ctx.vault.resolveLink(stem);
  return found?.path === path ? stem : path.replace(/\.md$/i, "");
}

/** A group in the `--monster` form: "Thug:3", or just "Thug" for one. */
export function groupRef(ctx: Ctx, path: string, count: number): string {
  const ref = noteRef(ctx, path);
  return count === 1 ? ref : `${ref}:${count}`;
}

/** The fit of one outcome against every difficulty, so one run answers "what is this for this party?". */
export function fitByDifficulty(summary: { avgHpLost: number; tpkRate: number }): Record<FitDifficulty, Fit> {
  return {
    easy: classifyFit(summary, "easy"),
    challenging: classifyFit(summary, "challenging"),
    deadly: classifyFit(summary, "deadly"),
  };
}

/**
 * What the simulation left out that may matter to the outcome, by owner:
 * "Entangle (control-spell)". Utility spells (Message, Light…) never change a
 * fight and are left out; an owner with nothing else skipped is not listed.
 * `ownerName` renames an owner (a monster's is its note path).
 */
export function skippedByOwner(
  fidelity: Record<string, FidelityRecord[]>,
  ownerName: (owner: string) => string = (owner) => owner
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [owner, records] of Object.entries(fidelity)) {
    const skipped = records
      .filter((r) => r.status === "skipped" && r.reason !== "utility-spell")
      .map((r) => (r.reason ? `${r.name} (${r.reason})` : r.name));
    if (skipped.length > 0) out[ownerName(owner)] = skipped;
  }
  return out;
}

/**
 * A word folded for loose matching: lower case, a plural "s"/"es" dropped, so
 * "Forests" and "forest", "Hills" and "hill" meet (table tags are often plural,
 * catalog and bestiary habitats singular).
 */
export function wordKey(word: string): string {
  const w = word.trim().toLowerCase();
  if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** The forms a theme word may take in a name: as written, and its singulars ("wolves": wolve, wolf). */
export function wordForms(word: string): string[] {
  const w = word.trim().toLowerCase();
  const forms = new Set([w, wordKey(w)]);
  if (w.length > 4 && w.endsWith("ves")) forms.add(`${w.slice(0, -3)}f`);
  if (w.length > 4 && w.endsWith("ies")) forms.add(`${w.slice(0, -3)}y`);
  return [...forms].filter((f) => f.length > 0);
}

/** Whether any of `words`, in any of its forms, appears (as a substring) in any of `texts`, ignoring case. */
export function anyWordIn(words: readonly string[], texts: readonly string[]): boolean {
  const hay = texts.map((t) => t.toLowerCase());
  return words.some((word) => wordForms(word).some((form) => hay.some((h) => h.includes(form))));
}

/**
 * JSON laid out for a reader that pays per token: the document's keys one to a
 * line, the items of a list or map under them one to a line, and anything
 * deeper written on that line. Still one valid JSON document.
 */
export function briefJson(value: unknown, depth = 0): string {
  if (value === null || typeof value !== "object" || depth >= 2) return JSON.stringify(value);
  const pad = "  ".repeat(depth + 1);
  const end = "  ".repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => pad + briefJson(v, depth + 1)).join(",\n")}\n${end}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "{}";
  return `{\n${entries.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${briefJson(v, depth + 1)}`).join(",\n")}\n${end}}`;
}
