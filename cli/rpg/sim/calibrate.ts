/**
 * `rpg sim calibrate [<session note or folder>...]`: the simulator against
 * real play (item 23 of the follow-up). Each fight a session log records
 * (`[COMBAT]` … `[/COMBAT]`) is read the way the log block reads it: its foes
 * (the `[F:…]` tags first written since the fight before), the party (the
 * note's `pcs`), the party's HP as the fight opened and closed (sheets, less
 * what the log did to them), its rounds and who dropped. The same fight is then
 * simulated, and the real outcome placed among the simulated ones: its HP lost
 * against the simulated average and spread, and the share of simulated fights
 * that cost the party no more than the real one did (its percentile). Across
 * fights, a percentile that keeps low says the simulator makes fights harder
 * than play finds them, a high one easier. Read-only.
 */

import { parseSessionLogBlock } from "lib/domains/session-log";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { foldBattles } from "lib/domains/battlemap/battle";
import { foldFoes } from "lib/domains/session-log/foes";
import { foldHealth } from "lib/domains/session-log/health";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import { classifyFit, FIT_TOLERANCE, OUTCOME_PROFILES, type FitDifficulty } from "lib/domains/encounter-sim/fit";
import { runMonteCarlo, round4 } from "lib/domains/encounter-sim/montecarlo";
import type { Ctx } from "../app";
import { characterSheet } from "../commands/character";
import { fencesOf } from "../fences";
import { listSessions } from "../session/lines";
import { notesOf } from "./catalog-draft";
import type { SimHandler } from "./dispatch";
import { rulesOf, type SimOptions } from "./flags";
import { loadMonster, type LoadedMonster } from "./monsters";
import { loadParty } from "./party";

/** Fewer fights than this cannot move the outcome profiles: the summary says so. */
const FIGHTS_TO_TUNE = 10;

const linkTarget = (ref: string) =>
  ref
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")[0]
    .trim();

/** The bestiary note a foe's name links ("Fat [[Kobold, A]]" is `Kobold, A`), or its name. */
const foeNote = (name: string): string => name.match(/\[\[([^\]|]+)/)?.[1]?.trim() ?? name.trim();

export interface FightRecord {
  note: string;
  /** Which `[COMBAT]` of the log (from 1), and its map. */
  fight: number;
  map: string;
  foes: string[];
  pcs: string[];
  actual: {
    /** The party's HP lost in the fight (healing in it counted), as a share of its maximum. */
    hpLost: number;
    rounds: number;
    knockedOut: string[];
    tpk: boolean;
    /** The fight opened with the party short of its maximum by this share (the simulation starts it full). */
    startedDown?: number;
  };
  predicted: {
    avgHpLost: number;
    hpLostStdDev: number;
    winRate: number;
    tpkRate: number;
    avgRounds: number;
    koRate: Record<string, number>;
  };
  /** The share of simulated fights that cost the party no more HP than the real one. */
  percentile: number;
  /** (actual - predicted) / spread: how many standard deviations of one fight the real one was off. */
  z: number;
  /** The fit the simulation gives the fight for the difficulty, and the one the real outcome would. */
  fit: { predicted: string; actual: string };
  /** Why a fight could not be compared. */
  skipped?: string;
}

/** The session notes to read: those given (notes or folders), else every note with `pcs` and an `rpg log`. */
function sessionNotes(ctx: Ctx, args: string[]): string[] {
  const all = new Set(listSessions(ctx));
  if (args.length === 0) return [...all].sort();
  return [...new Set(args.flatMap((a) => notesOf(ctx, a)))].filter((p) => all.has(p));
}

export const simCalibrate: SimHandler = async (ctx: Ctx, options: SimOptions) => {
  const difficulty = options.difficulty as FitDifficulty;
  const fights: FightRecord[] = [];
  const skipped: Array<{ note: string; fight: number; why: string }> = [];
  const monsters = new Map<string, LoadedMonster>();

  for (const path of sessionNotes(ctx, options.args)) {
    const file = ctx.note(path);
    const text = ctx.vault.readSync(file);
    const fm = ctx.metadataCache.frontmatterOf(file) ?? {};
    const pcRefs = ((Array.isArray(fm.pcs) ? fm.pcs : []) as unknown[]).map((r) => linkTarget(String(r)));
    const pcs: Array<{ note: string; names: string[]; hp?: { current: number; max: number }; ac?: number }> = [];
    for (const r of pcRefs) {
      const pcFile = ctx.vault.resolveLink(r, file.path);
      if (!pcFile) continue;
      try {
        const sheet = await characterSheet(ctx, pcFile.path);
        pcs.push({
          note: pcFile.path,
          names: [pcFile.basename, pcFile.basename.split(/\s+/)[0]],
          hp: sheet.hitPoints,
          ac: sheet.armorClass,
        });
      } catch {
        pcs.push({ note: pcFile.path, names: [pcFile.basename, pcFile.basename.split(/\s+/)[0]] });
      }
    }
    if (pcs.length === 0) continue;
    const pcOf = (name: string) => {
      const n = linkTarget(name).toLowerCase();
      return pcs.find((p) => p.names.some((x) => x.toLowerCase() === n));
    };

    for (const body of fencesOf(text, "log")) {
      const segments = groupIntoProse(parseLonelog(parseSessionLogBlock(body).body));
      // Each foe once, at the entry that first names it.
      const firstSeen = new Map<string, { id: number; name: string; max?: number }>();
      for (const [id, foes] of foldFoes(segments))
        for (const f of foes) {
          const key = f.name.toLowerCase();
          if (!firstSeen.has(key)) firstSeen.set(key, { id, name: f.name, max: f.max });
        }
      const foeStart = new Map<string, { current: number; max: number }>();
      for (const f of firstSeen.values())
        if (f.max !== undefined) foeStart.set(linkTarget(f.name).toLowerCase(), { current: f.max, max: f.max });
      const health = foldHealth(
        segments,
        (name) => pcOf(name)?.hp ?? foeStart.get(linkTarget(name).toLowerCase()),
        (name) => pcOf(name)?.ac,
        (name) => !!pcOf(name)
      );

      let since = -1;
      for (const battle of foldBattles(segments)) {
        const from = since;
        since = battle.end ?? Number.MAX_SAFE_INTEGER;
        const fight = battle.fight + 1;
        if (battle.end === undefined) {
          skipped.push({ note: path, fight, why: "the fight is still open (no [/COMBAT])" });
          continue;
        }
        const foes = [...firstSeen.values()].filter((f) => f.id > from && f.id <= battle.end!).map((f) => f.name);
        if (foes.length === 0) {
          skipped.push({ note: path, fight, why: "no [F:…] foe tags before or in the fight" });
          continue;
        }
        const counts = new Map<string, number>();
        for (const f of foes) counts.set(foeNote(f), (counts.get(foeNote(f)) ?? 0) + 1);
        const groups: Array<{ actor: LoadedMonster["actor"]; count: number }> = [];
        let missing: string | undefined;
        for (const [note, count] of counts) {
          try {
            let m = monsters.get(note);
            if (!m) {
              m = await loadMonster(ctx, note);
              monsters.set(note, m);
            }
            groups.push({ actor: m.actor, count });
          } catch (e) {
            missing = `${note}: ${(e as Error).message}`;
          }
        }
        if (missing) {
          skipped.push({ note: path, fight, why: `a foe cannot be simulated (${missing})` });
          continue;
        }

        const hpAt = (id: number, p: (typeof pcs)[number]) =>
          health.at(id, p.names[1]) ?? health.at(id, p.names[0]) ?? p.hp;
        const atStart = pcs.map((p) => hpAt(battle.start, p));
        const atEnd = pcs.map((p) => hpAt(battle.end!, p));
        if (atStart.some((h) => !h) || atEnd.some((h) => !h)) {
          skipped.push({ note: path, fight, why: "a PC's hit points cannot be read from its sheet" });
          continue;
        }
        const max = atStart.reduce((a, h) => a + h!.max, 0);
        const startSum = atStart.reduce((a, h) => a + h!.current, 0);
        const endSum = atEnd.reduce((a, h) => a + h!.current, 0);
        const hpLost = round4(Math.max(0, startSum - endSum) / max);
        const knockedOut = pcs.filter((_, i) => atEnd[i]!.current === 0).map((p) => p.names[1]);
        const rounds = Math.max(0, ...battle.frames.map((f) => f.round));

        const { actors } = await loadParty(
          ctx,
          pcs.map((p) => p.note)
        );
        const sim = runMonteCarlo({
          party: actors,
          monsters: groups,
          seed: options.seed,
          trials: options.trials,
          roundCap: options.rounds,
          rules: rulesOf(options),
        });
        const simMax = actors.reduce((a, p) => a + p.maxHp, 0);
        const lostPerTrial = sim.hpRemainingPerTrial.map((h) => (simMax > 0 ? 1 - h / simMax : 0));
        const percentile = round4(lostPerTrial.filter((l) => l <= hpLost + 1e-9).length / lostPerTrial.length);
        const tpk = knockedOut.length === pcs.length;
        fights.push({
          note: path,
          fight,
          map: battle.map,
          foes,
          pcs: pcs.map((p) => p.names[1]),
          actual: {
            hpLost,
            rounds,
            knockedOut,
            tpk,
            ...(startSum < max ? { startedDown: round4(1 - startSum / max) } : {}),
          },
          predicted: {
            avgHpLost: sim.avgHpLost,
            hpLostStdDev: sim.hpLostStdDev,
            winRate: sim.winRate,
            tpkRate: sim.tpkRate,
            avgRounds: sim.avgRounds,
            koRate: sim.koRate,
          },
          percentile,
          z: round4(sim.hpLostStdDev > 0 ? (hpLost - sim.avgHpLost) / sim.hpLostStdDev : 0),
          fit: {
            predicted: classifyFit(sim, difficulty),
            actual: classifyFit({ avgHpLost: hpLost, tpkRate: tpk ? 1 : 0 }, difficulty),
          },
        });
      }
    }
  }

  const n = fights.length;
  const mean = (xs: number[]) => (xs.length ? round4(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const notes: string[] = [];
  const meanPercentile = mean(fights.map((f) => f.percentile));
  if (n === 0) notes.push("No fight could be compared: a fight needs [COMBAT]…[/COMBAT], [F:…] foe tags and pcs.");
  else if (n < FIGHTS_TO_TUNE)
    notes.push(
      `${n} fight${n === 1 ? "" : "s"}: too few to tune the outcome profiles (they want ${FIGHTS_TO_TUNE} or more); read each one as a check, not a trend.`
    );
  if (n > 0) {
    if (meanPercentile < 0.3)
      notes.push(
        "The real fights cost less than most simulated ones: the simulator reads these fights as harder than play found them."
      );
    else if (meanPercentile > 0.7)
      notes.push(
        "The real fights cost more than most simulated ones: the simulator reads these fights as easier than play found them."
      );
    else notes.push("The real fights sit within the simulated spread.");
  }
  return {
    doc: {
      difficulty,
      profile: { ...OUTCOME_PROFILES[difficulty], tolerance: FIT_TOLERANCE },
      seed: options.seed,
      trials: options.trials,
      fights,
      summary: {
        fights: n,
        meanHpLost: {
          actual: mean(fights.map((f) => f.actual.hpLost)),
          predicted: mean(fights.map((f) => f.predicted.avgHpLost)),
        },
        meanPercentile,
        meanZ: mean(fights.map((f) => f.z)),
        fitAgrees: fights.filter((f) => f.fit.predicted === f.fit.actual).length,
      },
      ...(skipped.length ? { skipped } : {}),
      notes,
    },
  };
};
