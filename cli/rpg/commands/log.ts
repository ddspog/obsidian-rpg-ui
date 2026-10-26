/**
 * `rpg log <note>` — what a session log adds up to, folded the way the log
 * block folds it: its scenes, the party's HP (from their sheets, less what the
 * log did to them), conditions and resources spent, foes in play, the fight
 * (initiative, turn, who stands where), the journey (map and positions), and
 * the clock. Then its last lines, so a reader picks up where play stopped.
 */

import { parseSessionLogBlock, processSessionLog } from "lib/domains/session-log";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { foldBattles } from "lib/domains/battlemap/battle";
import { squareName } from "lib/domains/battlemap/square-map";
import { clockText, foldClock } from "lib/domains/session-log/clock";
import { conditionsNow, resourcesSpent } from "lib/domains/session-log/conditions";
import { foesInPlay, foldFoes } from "lib/domains/session-log/foes";
import { foldHealth } from "lib/domains/session-log/health";
import { foldInitiative } from "lib/domains/session-log/initiative";
import { assembleProse } from "lib/domains/session-log/prose-model";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import { combatClock } from "lib/domains/session-log/turns";
import { foldTravelTrack } from "lib/domains/session-log/travel";
import type { Ctx } from "../app";
import { fencesOf } from "../fences";
import { characterSheet } from "./character";

export interface LogState {
  note: string;
  log: number;
  logs: number;
  gm?: string;
  scenes: Array<{ number: string; context: string }>;
  party: Array<{
    name: string;
    note: string;
    hp?: { current: number; max: number; life?: unknown };
    ac?: number;
    conditions: string[];
    spent: Array<{ resource: string; change: number }>;
  }>;
  others: Array<{ name: string; conditions: string[] }>;
  foes: Array<{ name: string; current?: number; max?: number; state?: string; conditions?: string[] }>;
  combat?: {
    open: boolean;
    map: string;
    round?: number;
    next: string[];
    order: Array<{ name: string; init?: number }>;
    placements: Array<{ name: string; at: string }>;
  };
  travel?: {
    map?: string;
    level: number;
    travelling: boolean;
    positions: Record<string, [number, number]>;
    groups: Record<string, string[]>;
  };
  /** Clocks, tracks and timers as they stand, and threads with their state. */
  progress: Array<{ name: string; kind: string; current: number; max?: number }>;
  threads: Array<{ name: string; state: string }>;
  time: string;
  tail: string[];
}

const linkTarget = (ref: string) =>
  ref
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")[0]
    .trim();

export async function logState(ctx: Ctx, ref: string, nth = 1): Promise<LogState> {
  const file = ctx.note(ref);
  const text = ctx.vault.readSync(file);
  const logs = fencesOf(text, "log");
  if (logs.length === 0) throw new Error(`${file.path} has no rpg log block.`);
  const index = Math.min(Math.max(1, nth), logs.length);
  const block = parseSessionLogBlock(logs[index - 1]);
  const segments = groupIntoProse(parseLonelog(block.body));
  const fm = ctx.metadataCache.frontmatterOf(file) ?? {};

  // The party: the note's `pcs:` and the block's `entities:`, with their sheets.
  const refs = [
    ...((Array.isArray(fm.pcs) ? fm.pcs : []) as unknown[]).map(String),
    ...(block.entities ?? []).filter((e) => !e.type || e.type === "pc").map((e) => e.file),
  ];
  const pcs: Array<{ note: string; names: string[]; hp?: { current: number; max: number }; ac?: number }> = [];
  for (const r of [...new Set(refs.map(linkTarget))]) {
    const pcFile = ctx.vault.resolveLink(r, file.path);
    if (!pcFile) continue;
    let hp: { current: number; max: number } | undefined;
    let ac: number | undefined;
    try {
      const sheet = await characterSheet(ctx, pcFile.path);
      hp = sheet.hitPoints;
      ac = sheet.armorClass;
    } catch {
      /* a PC note the system can't read: no sheet numbers */
    }
    pcs.push({ note: pcFile.path, names: [pcFile.basename, pcFile.basename.split(/\s+/)[0]], hp, ac });
  }
  const pcOf = (name: string) => {
    const n = linkTarget(name).toLowerCase();
    return pcs.find((p) => p.names.some((x) => x.toLowerCase() === n));
  };
  // Foes start at the HP their tags first give them (`[F:Kobold, Elite|26/26]`).
  const foeStart = new Map<string, { current: number; max: number }>();
  for (const foes of foldFoes(segments).values())
    for (const f of foes) {
      const k = linkTarget(f.name).toLowerCase();
      if (!foeStart.has(k) && f.max !== undefined) foeStart.set(k, { current: f.current ?? f.max, max: f.max });
    }
  const health = foldHealth(
    segments,
    (name) => pcOf(name)?.hp ?? foeStart.get(linkTarget(name).toLowerCase()),
    (name) => pcOf(name)?.ac,
    (name) => !!pcOf(name)
  );
  const conditions = conditionsNow(segments);
  const spent = resourcesSpent(segments);
  const conditionsOf = (names: string[]) => {
    const out = new Set<string>();
    for (const [who, map] of conditions)
      if (names.some((n) => n.toLowerCase() === linkTarget(who).toLowerCase())) for (const c of map.keys()) out.add(c);
    return [...out];
  };

  const party = pcs.map((p) => {
    const short = p.names[1];
    return {
      name: short,
      note: p.note,
      hp: health.now(short) ?? health.now(p.names[0]) ?? p.hp,
      ac: p.ac,
      conditions: conditionsOf(p.names),
      spent: spent
        .filter((s) => p.names.some((n) => n.toLowerCase() === linkTarget(s.who).toLowerCase()))
        .map((s) => ({ resource: s.resource, change: s.change })),
    };
  });
  const others = [...conditions.keys()]
    .filter((who) => !pcOf(who))
    .map((who) => ({ name: who, conditions: [...(conditions.get(who)?.keys() ?? [])] }))
    .filter((o) => o.conditions.length);

  const battles = foldBattles(segments);
  const battle = battles[battles.length - 1];
  const frame = battle?.frames[battle.frames.length - 1];
  const inits = [...foldInitiative(segments).values()];
  const clock = battle && battle.end === undefined ? combatClock(segments, (n) => health.now(n)?.current === 0) : null;
  const order = (inits[inits.length - 1]?.order ?? []) as Array<{
    name: string;
    value?: number;
    init?: number;
    total?: number;
  }>;

  const track = foldTravelTrack(segments);
  const last = track.frames[track.frames.length - 1];

  const lines = block.body.split("\n").filter((l) => l.trim());
  return {
    note: file.path,
    log: index,
    logs: logs.length,
    ...(block.gm ? { gm: block.gm } : {}),
    scenes: assembleProse(segments)
      .filter((s) => s.head)
      .map((s) => ({ number: s.head!.number, context: s.head!.context })),
    party,
    others,
    foes: foesInPlay(segments).map((f) => {
      const now = health.now(f.name) ?? health.now(linkTarget(f.name));
      return {
        ...f,
        ...(now
          ? {
              current: now.current,
              max: now.max,
              ...(now.life ? { state: String((now.life as { state?: string }).state ?? "down") } : {}),
            }
          : {}),
      };
    }),
    ...(battle
      ? {
          combat: {
            open: battle.end === undefined,
            map: battle.map,
            ...(clock ? { round: clock.round, next: clock.next } : { next: [] }),
            order: order.map((o) => ({ name: o.name, init: o.value ?? o.init ?? o.total })),
            placements: (frame?.placements ?? battle.opening).map((p) => ({ name: p.name, at: squareName(p.at) })),
          },
        }
      : {}),
    ...(last
      ? {
          travel: {
            map: last.map,
            level: last.level?.length ?? 0,
            travelling: !!last.travelling,
            positions: last.positions as Record<string, [number, number]>,
            groups: last.groups,
          },
        }
      : {}),
    ...(() => {
      const { progressChanges, threadChanges } = processSessionLog(block);
      const progress = new Map<string, { name: string; kind: string; current: number; max?: number }>();
      for (const c of progressChanges)
        progress.set(c.name, {
          name: c.name,
          kind: c.kind,
          current: c.current,
          ...(c.max !== undefined ? { max: c.max } : {}),
        });
      const threads = new Map<string, string>();
      for (const t of threadChanges) threads.set(t.name, t.to);
      return { progress: [...progress.values()], threads: [...threads].map(([name, state]) => ({ name, state })) };
    })(),
    time: clockText(foldClock(segments).now),
    tail: lines.slice(-25),
  };
}

export function renderLog(s: LogState): string {
  const out: string[] = [`# Session log: ${s.note}${s.logs > 1 ? ` (log ${s.log} of ${s.logs})` : ""}`, ""];
  out.push(`Time: ${s.time}`, "");
  if (s.scenes.length) {
    out.push("## Scenes");
    for (const sc of s.scenes) out.push(`- ${sc.number} ${sc.context}`);
    out.push("");
  }
  if (s.progress.length || s.threads.length) {
    out.push("## Clocks and threads");
    for (const p of s.progress)
      out.push(`- ${p.name} (${p.kind}): ${p.current}${p.max !== undefined ? `/${p.max}` : ""}`);
    for (const t of s.threads) out.push(`- Thread: ${t.name} — ${t.state}`);
    out.push("");
  }
  if (s.party.length) {
    out.push("## Party");
    for (const p of s.party) {
      const hp = p.hp ? `HP ${p.hp.current}/${p.hp.max}${p.hp.life ? ` (${JSON.stringify(p.hp.life)})` : ""}` : "HP ?";
      const bits = [
        hp,
        p.ac !== undefined ? `AC ${p.ac}` : "",
        p.conditions.length ? `conditions: ${p.conditions.join(", ")}` : "",
        p.spent.length ? `spent: ${p.spent.map((x) => `${x.resource} ${x.change}`).join(", ")}` : "",
      ].filter(Boolean);
      out.push(`- **${p.name}** (${p.note}): ${bits.join(" · ")}`);
    }
    out.push("");
  }
  if (s.others.length) {
    out.push("## Others with conditions");
    for (const o of s.others) out.push(`- ${o.name}: ${o.conditions.join(", ")}`);
    out.push("");
  }
  if (s.foes.length) {
    out.push("## Foes in play");
    for (const f of s.foes)
      out.push(
        `- ${f.name}: ${f.current !== undefined ? `HP ${f.current}${f.max ? `/${f.max}` : ""}` : "HP ?"}${f.state ? ` · ${f.state}` : ""}${f.conditions?.length ? ` · ${f.conditions.join(", ")}` : ""}`
      );
    out.push("");
  }
  if (s.combat) {
    const c = s.combat;
    out.push(`## Combat on ${c.map} — ${c.open ? "still on" : "over"}`);
    if (c.open && c.round !== undefined) out.push(`Turn ${c.round}; up next: ${c.next.join(", ") || "?"}`);
    if (c.order.length)
      out.push(`Initiative: ${c.order.map((o) => `${o.name}${o.init !== undefined ? ` ${o.init}` : ""}`).join(", ")}`);
    if (c.placements.length) out.push(`Positions: ${c.placements.map((p) => `${p.name} @${p.at}`).join(", ")}`);
    out.push("");
  }
  if (s.travel) {
    const t = s.travel;
    out.push(
      `## Travel on ${t.map ?? "?"}${t.level ? ` (level ${t.level})` : ""}${t.travelling ? " — on the road" : ""}`
    );
    for (const [who, [q, r]] of Object.entries(t.positions))
      out.push(`- ${who} at hex (${q},${r})${t.groups[who] ? ` — ${t.groups[who].join(", ")}` : ""}`);
    out.push("");
  }
  out.push("## Last lines", "```", ...s.tail, "```");
  return out.join("\n");
}
