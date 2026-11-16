/**
 * What the GM's tools stand at in a log: each dial (the Chaos Factor, a
 * thread's track) and each list (Threads, Characters), read as the log block
 * reads them. And the two things a played card leaves for the reader to work
 * out, worked out: a Fate Question's answer, a roll on a list.
 */

import { answerFateQuestion } from "lib/domains/gm/fate-chart";
import { resolveDialOps, resourceDefaults } from "lib/domains/lonelog/dial-ops";
import { consultDice, resolveListOps } from "lib/domains/lonelog/list-ops";
import { parseOracleCallLine } from "lib/domains/lonelog/oracle-call";
import { parseLonelog } from "lib/domains/lonelog/parser";
import type { Screen } from "./screen";

export interface GmState {
  dials: Array<{ key: string; name: string; current: number; max?: number }>;
  lists: Array<{ name: string; entries: string[] }>;
}

export function gmState(screen: Screen, body: string): GmState {
  const entries = parseLonelog(body);
  const resources = screen.ctx.resources ?? {};
  const lists = screen.ctx.lists ?? {};
  const now: Record<string, { name: string; current: number; max?: number }> = {};
  for (const [key, value] of Object.entries(resourceDefaults(resources)))
    now[key] = { name: resources[key]?.name ?? key, current: value };
  for (const ops of resolveDialOps(entries, resources).values())
    for (const op of ops) now[op.key] = { name: op.name, current: op.current, ...(op.filling ? { max: op.max } : {}) };
  const live: Record<string, string[]> = {};
  for (const decl of Object.values(lists)) live[decl.name] = [...decl.entries];
  for (const ops of resolveListOps(entries, lists).values())
    for (const op of ops) if (op.sheet) live[op.name] = op.sheet.entries;
  return {
    dials: Object.entries(now).map(([key, v]) => ({ key, ...v })),
    lists: Object.entries(live).map(([name, e]) => ({ name, entries: e })),
  };
}

/**
 * A played card's lines, finished: `o: Fate Chart (Likely) d100=23` gains its
 * answer, `[Threads@]` its dice. `notes` says in words what each came to (and
 * when a roll calls a Random Event), for the one who played it.
 */
export function finishLines(
  screen: Screen,
  before: string,
  lines: string[],
  rng: () => number = Math.random
): { lines: string[]; notes: string[] } {
  const notes: string[] = [];
  const out: string[] = [];
  for (const raw of lines) {
    let line = raw;
    const sofar = [before, ...out].join("\n");
    const state = gmState(screen, sofar);
    const cf = state.dials.find((d) => d.key === "CF")?.current ?? 5;
    if (/^o:/.test(line) && !line.includes("->")) {
      const call = parseOracleCallLine(line.slice(2).trim());
      const roll = parseInt(call.roll?.match(/=(\d+)/)?.[1] ?? "", 10);
      if (call.likelihood && Number.isFinite(roll) && /fate chart/i.test(call.source)) {
        const a = answerFateQuestion(roll, cf, call.likelihood);
        line = `${line} -> ${a.wording}`;
        notes.push(
          `${a.result}: ${roll} against ${a.threshold} (${call.oddsText}, Chaos Factor ${cf}).` +
            (a.randomEvent
              ? " A double at or under the Chaos Factor: a Random Event happens too (play Random Event)."
              : "")
        );
      }
    }
    line = line.replace(/\[([\w' -]+?)@\s*\]/g, (all, name: string) => {
      const decl = Object.values(screen.ctx.lists ?? {}).find((d) => d.name === name.trim());
      if (!decl) return all;
      const entries = state.lists.find((l) => l.name === decl.name)?.entries ?? [];
      const dice = consultDice(decl, entries.length);
      const die = (sides: number) => 1 + Math.floor(rng() * sides);
      const rolls = dice.section == null ? [die(dice.row)] : [die(dice.section), die(dice.row)];
      const token = `[${decl.name}@ ${rolls.map((r, i) => `r${i + 1}=${r}`).join(" ")}]`;
      const probe = parseLonelog(`? ${token}`);
      const got = resolveListOps([...parseLonelog(sofar), ...probe], screen.ctx.lists ?? {});
      const last = [...got.values()].pop()?.pop();
      const entry = last?.entry ?? decl.default;
      const blank =
        entries.length === 0
          ? " (the list is empty)"
          : !entries.includes(entry)
            ? " (an empty row of the list: choose the entry that fits best)"
            : "";
      notes.push(`${decl.name}: ${entry}${blank}`);
      return token;
    });
    out.push(line);
  }
  return { lines: out, notes };
}
