import { describe, expect, it } from "vitest";

import { compactSummary, expandMonsters, round4, runMonteCarlo } from "./montecarlo";
import type { CombatActor } from "./types";

function actor(over: Partial<CombatActor> & Pick<CombatActor, "key" | "name" | "side">): CombatActor {
  const ability = { modifier: 0, saveModifier: 0 };
  return {
    level: 1,
    proficiencyBonus: 2,
    armorClass: 12,
    maxHp: 12,
    initiativeModifier: 0,
    abilities: { str: ability, dex: ability, con: ability, int: ability, wis: ability, cha: ability },
    slots: [],
    actions: [],
    ...over,
  };
}

const sword = (bonus: number, expr: string) => ({
  kind: "weapon" as const,
  name: "Sword",
  hitBonus: bonus,
  damage: { expr, type: "slashing" },
});

const party = [
  actor({ key: "a", name: "Ana", side: "party", maxHp: 14, actions: [sword(4, "1d8+2")] }),
  actor({ key: "b", name: "Bo", side: "party", maxHp: 10, actions: [sword(3, "1d6+1")] }),
];
const goblin = actor({ key: "gob", name: "Goblin", side: "monsters", maxHp: 9, actions: [sword(3, "1d6+1")] });

const input = { party, monsters: [{ actor: goblin, count: 2 }], seed: 5, trials: 100, roundCap: 20 };

describe("runMonteCarlo", () => {
  it("reports 4-decimal rates in [0,1] that sum to one", () => {
    const s = runMonteCarlo(input);
    for (const r of [s.winRate, s.tpkRate, s.stalemateRate]) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(round4(r)).toBe(r);
    }
    expect(s.winRate + s.tpkRate + s.stalemateRate).toBeCloseTo(1, 3);
  });

  it("sizes the per-trial arrays to trials and keys koRate by PC name", () => {
    const s = runMonteCarlo(input);
    expect(s.roundsPerTrial).toHaveLength(100);
    expect(s.hpRemainingPerTrial).toHaveLength(100);
    expect(Object.keys(s.koRate).sort()).toEqual(["Ana", "Bo"]);
  });

  it("counts stalemates at the round cap in avgRounds", () => {
    const mute = (side: "party" | "monsters", key: string) => actor({ key, name: key, side, actions: [] });
    const s = runMonteCarlo({
      party: [mute("party", "p")],
      monsters: [{ actor: mute("monsters", "m"), count: 1 }],
      seed: 1,
      trials: 5,
      roundCap: 7,
    });
    expect(s.stalemateRate).toBe(1);
    expect(s.avgRounds).toBe(7);
    expect(s.roundsPerTrial).toEqual([7, 7, 7, 7, 7]);
  });

  it("reports avgHpLost as the share of the party's max HP lost, in [0,1], from hpRemainingPerTrial", () => {
    const s = runMonteCarlo(input);
    const maxHp = party.reduce((sum, p) => sum + p.maxHp, 0);
    const mean = s.hpRemainingPerTrial.reduce((a, b) => a + b, 0) / s.hpRemainingPerTrial.length;
    expect(s.avgHpLost).toBe(round4(1 - mean / maxHp));
    expect(s.avgHpLost).toBeGreaterThanOrEqual(0);
    expect(s.avgHpLost).toBeLessThanOrEqual(1);
    expect(round4(s.avgHpLost)).toBe(s.avgHpLost);
  });

  it("reports no HP lost when nobody can hurt anybody, and all of it in a sure TPK", () => {
    const mute = (side: "party" | "monsters", key: string) => actor({ key, name: key, side, actions: [] });
    const quiet = runMonteCarlo({
      party: [mute("party", "p")],
      monsters: [{ actor: mute("monsters", "m"), count: 1 }],
      seed: 1,
      trials: 5,
      roundCap: 3,
    });
    expect(quiet.avgHpLost).toBe(0);
    const killer = actor({ key: "k", name: "K", side: "monsters", maxHp: 500, actions: [sword(30, "50")] });
    const wipe = runMonteCarlo({ ...input, monsters: [{ actor: killer, count: 3 }] });
    expect(wipe.tpkRate).toBe(1);
    expect(wipe.avgHpLost).toBe(1);
  });

  it("is deterministic for a seed and changes with another seed", () => {
    const a = runMonteCarlo(input);
    const b = runMonteCarlo({ ...input });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = runMonteCarlo({ ...input, seed: 6 });
    expect(c.roundsPerTrial.join() + c.hpRemainingPerTrial.join()).not.toBe(
      a.roundsPerTrial.join() + a.hpRemainingPerTrial.join()
    );
  });

  it("does not mutate the input actors", () => {
    const before = JSON.stringify(input);
    runMonteCarlo(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("expandMonsters", () => {
  it("suffixes names only when count is above one and keeps separate groups apart", () => {
    const names = expandMonsters([
      { actor: goblin, count: 2 },
      { actor: goblin, count: 1 },
    ]).map((m) => m.name);
    expect(names).toEqual(["Goblin 1", "Goblin 2", "Goblin"]);
    const keys = expandMonsters([
      { actor: goblin, count: 2 },
      { actor: goblin, count: 1 },
    ]).map((m) => m.key);
    expect(new Set(keys).size).toBe(3);
  });
});

describe("compactSummary", () => {
  it("drops the per-trial arrays", () => {
    const c = compactSummary(runMonteCarlo(input));
    expect(Object.keys(c).sort()).toEqual(["avgHpLost", "avgRounds", "koRate", "stalemateRate", "tpkRate", "winRate"]);
  });
});
