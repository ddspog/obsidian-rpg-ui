import { simulateTrial } from "./engine";
import { createSeededRng } from "./rng";
import type { CombatActor, TrialResult } from "./types";

export interface ActorGroup {
  actor: CombatActor;
  count: number;
}

export interface MonteCarloInput {
  party: CombatActor[];
  monsters: ActorGroup[];
  seed: number;
  trials: number;
  roundCap: number;
}

export interface MonteCarloSummary {
  winRate: number;
  tpkRate: number;
  stalemateRate: number;
  avgRounds: number;
  /** The share of the party's total max HP lost at a fight's end, averaged over the trials (0..1). */
  avgHpLost: number;
  /** The standard deviation, over the trials, of the share of the party's HP lost: how far one fight strays from the average. */
  hpLostStdDev: number;
  roundsPerTrial: number[];
  hpRemainingPerTrial: number[];
  koRate: Record<string, number>;
}

export type CompactSummary = Omit<MonteCarloSummary, "roundsPerTrial" | "hpRemainingPerTrial" | "hpLostStdDev">;

/** Four decimal places, as the JSON contract states. */
export const round4 = (x: number): number => Math.round(x * 10000) / 10000;

/**
 * Expand each monster group into distinct combatants. A group of one keeps its
 * name; a larger group gets " 1", " 2", ... so combatants stay distinguishable.
 */
export function expandMonsters(groups: ActorGroup[]): CombatActor[] {
  const out: CombatActor[] = [];
  groups.forEach((group, g) => {
    for (let i = 1; i <= group.count; i++) {
      const name = group.count > 1 ? `${group.actor.name} ${i}` : group.actor.name;
      out.push({ ...group.actor, key: `${group.actor.key}#${g}.${i}`, name, side: "monsters" });
    }
  });
  return out;
}

/** Run N seeded trials of the party against the monster groups and summarise. */
export function runMonteCarlo(input: MonteCarloInput): MonteCarloSummary {
  const { party, monsters, seed, trials, roundCap } = input;
  const rng = createSeededRng(seed);
  const combatants: CombatActor[] = [
    ...party.map((p) => ({ ...p, side: "party" as const })),
    ...expandMonsters(monsters),
  ];

  const results: TrialResult[] = [];
  for (let t = 0; t < trials; t++) results.push(simulateTrial(combatants, rng, roundCap));

  const share = (outcome: TrialResult["outcome"]) =>
    round4(results.filter((r) => r.outcome === outcome).length / trials);
  const roundsPerTrial = results.map((r) => (r.outcome === "stalemate" ? roundCap : r.rounds));
  const koRate: Record<string, number> = {};
  for (const p of party) {
    koRate[p.name] = round4(results.filter((r) => r.knockedOut.includes(p.name)).length / trials);
  }

  const partyMaxHp = party.reduce((sum, p) => sum + p.maxHp, 0);
  const hpRemaining = results.map((r) => r.partyHpRemaining);
  const meanRemaining = hpRemaining.reduce((a, b) => a + b, 0) / trials;
  const avgHpLost = partyMaxHp > 0 ? round4(Math.min(1, Math.max(0, 1 - meanRemaining / partyMaxHp))) : 0;
  const lost = hpRemaining.map((h) => (partyMaxHp > 0 ? 1 - h / partyMaxHp : 0));
  const meanLost = lost.reduce((a, b) => a + b, 0) / trials;
  const hpLostStdDev = round4(Math.sqrt(lost.reduce((a, b) => a + (b - meanLost) ** 2, 0) / Math.max(1, trials - 1)));

  return {
    winRate: share("win"),
    tpkRate: share("tpk"),
    stalemateRate: share("stalemate"),
    avgRounds: round4(roundsPerTrial.reduce((a, b) => a + b, 0) / trials),
    avgHpLost,
    hpLostStdDev,
    roundsPerTrial,
    hpRemainingPerTrial: hpRemaining,
    koRate,
  };
}

/** The summary without its per-trial arrays, for suggest. */
export function compactSummary(summary: MonteCarloSummary): CompactSummary {
  const { roundsPerTrial: _r, hpRemainingPerTrial: _h, hpLostStdDev: _s, ...rest } = summary;
  void _r;
  void _h;
  void _s;
  return rest;
}
