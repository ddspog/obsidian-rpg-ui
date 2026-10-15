/**
 * Changing a fight's setup from its map — the log text edits behind clicking
 * a token on the Setup frame. The setup is what's written before the turns
 * start: the `[Init:]` list (each entry's roll, `@square` and emoji) and any
 * `[Pos:]` placing those not in it.
 *
 *   [Init: [[Kobold, Elite]] d20+[[Initiative]]=20 @N5; Talon d20+[[Initiative]]=14 @J14]
 *   [COMBAT: Clearing]
 *   T1
 *
 * Each edit takes the log's body and which fight (its `[COMBAT]` line, counted
 * from the top) and returns the body changed — or as it was, when there's
 * nothing to change.
 */

import { parseInitEntry, splitEntries } from "lib/domains/lonelog/tag-extractor";
import type { InitiativeEntry } from "lib/domains/lonelog/types";
import { matchActor } from "lib/domains/session-log/actors";
import { combatantKey } from "lib/domains/session-log/initiative";

const COMBAT_LINE = /^\[COMBAT(?::[^\]]*(?:\]\])?[^\]]*)?\]$/;
const isCombat = (l: string) => COMBAT_LINE.test(l.trim());
const isCombatEnd = (l: string) => l.trim() === "[/COMBAT]";
/** Where the turns begin: a turn or round marker, or the first action. */
const isTurnStart = (l: string) => /^(?:[TR]\d+|R\(.+\)|@\(|!|\?)/.test(l.trim());
const isInit = (l: string) => /^\[Init:\s*[^+-]/.test(l.trim());
const isPos = (l: string) => /^\[Pos:/.test(l.trim());

/** A fight's setup lines: its `[COMBAT]`, and the `[Init:]` / `[Pos:]` it uses. */
function locate(lines: string[], fight: number): { combat: number; init: number; pos: number } | null {
  let n = -1;
  const combat = lines.findIndex((l) => isCombat(l) && ++n === fight);
  if (combat < 0) return null;
  // The initiative list: written before the fight (since the last one), or in
  // its setup, before the turns start.
  let init = -1;
  for (let i = combat - 1; i >= 0 && !isCombat(lines[i]) && !isCombatEnd(lines[i]); i--) {
    if (isInit(lines[i])) {
      init = i;
      break;
    }
  }
  let pos = -1;
  for (let i = combat + 1; i < lines.length && !isTurnStart(lines[i]) && !isCombatEnd(lines[i]); i++) {
    if (init < 0 && isInit(lines[i])) init = i;
    if (pos < 0 && isPos(lines[i])) pos = i;
  }
  return { combat, init, pos };
}

/** An `[Init:]` entry, written back: name, roll and total, square, emoji. */
export function formatInitEntry(e: InitiativeEntry): string {
  const value = e.value != null ? ` ${e.roll ?? ""}${e.value}` : "";
  return `${e.name}${value}${e.at ? ` @${e.at}` : ""}${e.icon ? ` ${e.icon}` : ""}`;
}

/** The entries of an `[Init:]` line. */
const initEntries = (line: string): InitiativeEntry[] =>
  splitEntries(
    line
      .trim()
      .replace(/^\[Init:\s*/, "")
      .replace(/\]$/, "")
  ).map(parseInitEntry);

/** Which entry a name is: the same combatant, or the one it reads as. */
function entryOf(entries: Array<{ name: string }>, name: string): number {
  const key = combatantKey(name);
  const exact = entries.findIndex((e) => combatantKey(e.name) === key);
  return exact >= 0
    ? exact
    : matchActor(
        name,
        entries.map((e) => ({ name: combatantKey(e.name) }))
      );
}

/**
 * Change one combatant's initiative entry — adding it to the list (or the list
 * before the fight) when it isn't there.
 */
function changeEntry(
  body: string,
  fight: number,
  name: string,
  change: (e: InitiativeEntry) => InitiativeEntry
): string {
  const lines = body.split("\n");
  const at = locate(lines, fight);
  if (!at) return body;
  if (at.init < 0) {
    lines.splice(at.combat, 0, `[Init: ${formatInitEntry(change({ name }))}]`);
    return lines.join("\n");
  }
  const entries = initEntries(lines[at.init]);
  const i = entryOf(entries, name);
  if (i >= 0) entries[i] = change(entries[i]);
  else entries.push(change({ name }));
  const indent = lines[at.init].match(/^\s*/)?.[0] ?? "";
  lines[at.init] = `${indent}[Init: ${entries.map(formatInitEntry).join("; ")}]`;
  return lines.join("\n");
}

/** A combatant's initiative roll, written into its entry (`d20+[[Initiative]]=17`). */
export function setInitiative(body: string, fight: number, name: string, roll: string, total: number): string {
  return changeEntry(body, fight, name, (e) => ({ ...e, roll, value: total }));
}

/** A combatant's token emoji for the fight — or none, back to its page's. */
export function setIcon(body: string, fight: number, name: string, icon: string): string {
  return changeEntry(body, fight, name, (e) => {
    const rest = { ...e };
    delete rest.icon;
    return icon.trim() ? { ...rest, icon: icon.trim() } : rest;
  });
}

/**
 * Where a combatant starts: its `@square` in the initiative list — or, when it
 * isn't in the list, in the fight's `[Pos:]` (added after `[COMBAT]` if need be).
 */
export function setStartSquare(body: string, fight: number, name: string, square: string): string {
  const lines = body.split("\n");
  const at = locate(lines, fight);
  if (!at) return body;
  const sq = square.trim().toUpperCase();
  if (at.init >= 0 && entryOf(initEntries(lines[at.init]), name) >= 0) {
    return changeEntry(body, fight, name, (e) => ({ ...e, at: sq }));
  }
  if (at.pos < 0) {
    lines.splice(at.combat + 1, 0, `[Pos: ${name} ${sq}]`);
    return lines.join("\n");
  }
  const parts = splitEntries(
    lines[at.pos]
      .trim()
      .replace(/^\[Pos:\s*/, "")
      .replace(/\]$/, "")
  ).map((p) => {
    const m = p.match(/^(.+?)\s+([A-Za-z]{1,2}\d{1,3})$/);
    return m ? { name: m[1], at: m[2] } : { name: p, at: "" };
  });
  const i = entryOf(parts, name);
  if (i >= 0) parts[i] = { ...parts[i], at: sq };
  else parts.push({ name, at: sq });
  lines[at.pos] = `[Pos: ${parts.map((p) => `${p.name} ${p.at}`.trim()).join("; ")}]`;
  return lines.join("\n");
}
