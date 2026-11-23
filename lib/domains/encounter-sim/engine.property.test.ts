/**
 * Properties of the engine over many random fights: whatever the creatures, a
 * trial ends by the round cap, its outcome agrees with the HP it reports, HP
 * stays between 0 and the party's maximum, the actors given are never changed
 * (slots, uses and HP live in the trial's own state), and one seed gives one
 * result. The fights are drawn from the engine's own seeded rng, so a failure
 * names the case that broke and repeats.
 */
import { describe, expect, it } from "vitest";
import { simulateTrial } from "./engine";
import { runMonteCarlo } from "./montecarlo";
import { createSeededRng, type Rng } from "./rng";
import {
  ABILITY_KEYS,
  MODELLED_CONDITIONS,
  type AbilityKey,
  type AbilityStat,
  type CombatActor,
  type CombatSide,
  type Inflict,
  type ModelledAction,
  type WeaponAttackAction,
} from "./types";

const CASES = 300;
const ROUND_CAP = 12;

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const chance = (rng: Rng, p: number) => rng() < p;

const DAMAGE_TYPES = ["slashing", "piercing", "fire", "cold", "poison", "radiant"];

function dice(rng: Rng): string {
  const flat = int(rng, -1, 5);
  return `${int(rng, 1, 3)}d${pick(rng, [4, 6, 8, 10, 12])}${flat > 0 ? `+${flat}` : flat < 0 ? `${flat}` : ""}`;
}

function inflict(rng: Rng): Inflict | undefined {
  if (!chance(rng, 0.25)) return undefined;
  return {
    condition: pick(rng, MODELLED_CONDITIONS),
    ...(chance(rng, 0.7) ? { save: { ability: pick(rng, ABILITY_KEYS), dc: int(rng, 10, 16) } } : {}),
    lasts: pick(rng, ["start", "end", "fight"] as const),
  };
}

function weapon(rng: Rng, i: number): WeaponAttackAction {
  const limit = chance(rng, 0.2) ? (chance(rng, 0.5) ? { recharge: int(rng, 4, 6) } : { perDay: int(rng, 1, 3) }) : {};
  const condition = inflict(rng);
  return {
    kind: "weapon",
    name: `Strike ${i}`,
    hitBonus: int(rng, 0, 9),
    damage: { expr: dice(rng), type: pick(rng, DAMAGE_TYPES) },
    ...(Object.keys(limit).length ? { limit } : {}),
    ...(condition ? { inflicts: condition } : {}),
  };
}

function action(rng: Rng, i: number, caster: boolean): ModelledAction {
  const roll = rng();
  const circle = caster ? int(rng, 0, 3) : 0;
  if (roll < 0.35) return weapon(rng, i);
  if (roll < 0.5)
    return { kind: "multiattack", name: `Multiattack ${i}`, swings: [weapon(rng, i), weapon(rng, i + 1)] };
  if (roll < 0.65)
    return { kind: "spell-attack", name: `Bolt ${i}`, hitBonus: int(rng, 2, 9), damage: { expr: dice(rng) }, circle };
  if (roll < 0.8)
    return {
      kind: "save",
      name: `Blast ${i}`,
      dc: int(rng, 10, 17),
      ability: pick(rng, ABILITY_KEYS),
      damage: { expr: dice(rng), type: pick(rng, DAMAGE_TYPES) },
      onSuccess: pick(rng, ["half", "none"] as const),
      area: chance(rng, 0.5),
      ...(chance(rng, 0.5) ? { targets: int(rng, 1, 4) } : {}),
      circle,
    };
  if (roll < 0.9)
    return { kind: "heal", name: `Mend ${i}`, expr: dice(rng), circle, ...(chance(rng, 0.5) ? { bonus: true } : {}) };
  return {
    kind: "buff",
    name: `Ward ${i}`,
    circle,
    on: pick(rng, ["allies", "enemies"] as const),
    targets: int(rng, 1, 3),
    ...(chance(rng, 0.5) ? { attackDie: "1d4" } : { ac: 2 }),
  };
}

function creature(rng: Rng, name: string, side: CombatSide): CombatActor {
  const abilities = Object.fromEntries(
    ABILITY_KEYS.map((k): [AbilityKey, AbilityStat] => {
      const modifier = int(rng, -1, 4);
      return [k, { modifier, saveModifier: modifier + (chance(rng, 0.3) ? 2 : 0) }];
    })
  ) as Record<AbilityKey, AbilityStat>;
  const caster = chance(rng, 0.4);
  const actions = Array.from({ length: int(rng, 1, 3) }, (_, i) => action(rng, i * 2, caster));
  const legendary = side === "monsters" && chance(rng, 0.1);
  return {
    key: name,
    name,
    side,
    level: int(rng, 1, 10),
    proficiencyBonus: int(rng, 2, 4),
    armorClass: int(rng, 10, 19),
    maxHp: int(rng, 1, 80),
    initiativeModifier: int(rng, -1, 4),
    abilities,
    slots: caster ? [int(rng, 0, 4), int(rng, 0, 3), int(rng, 0, 2)] : [],
    actions,
    ...(chance(rng, 0.2)
      ? {
          defences: {
            resistant: [pick(rng, DAMAGE_TYPES)],
            immune: [],
            vulnerable: [],
            conditionImmune: [],
            conditionResistant: [],
          },
        }
      : {}),
    ...(chance(rng, 0.15)
      ? { riders: [{ name: "Mark", damage: "1d6", kind: pick(rng, ["mark", "once-a-turn"] as const) }] }
      : {}),
    ...(chance(rng, 0.1) ? { reaction: { name: "Parry", ac: 2, untilTurn: false, circle: 0 } } : {}),
    ...(legendary
      ? {
          legendaryResistance: int(rng, 1, 3),
          legendary: { points: 3, actions: [{ action: weapon(rng, 9), cost: 1 }] },
        }
      : {}),
  };
}

/** One random fight: 1–4 PCs against 1–5 monsters. */
function fight(caseSeed: number): CombatActor[] {
  const rng = createSeededRng(caseSeed);
  const party = Array.from({ length: int(rng, 1, 4) }, (_, i) => creature(rng, `PC ${i}`, "party"));
  const monsters = Array.from({ length: int(rng, 1, 5) }, (_, i) => creature(rng, `Monster ${i}`, "monsters"));
  return [...party, ...monsters];
}

const snapshot = (actors: CombatActor[]) => JSON.stringify(actors);

describe("engine properties over random fights", () => {
  it(`ends every trial by the round cap, with an outcome its HP agrees with (${CASES} fights)`, () => {
    for (let c = 1; c <= CASES; c++) {
      const actors = fight(c);
      const before = snapshot(actors);
      const party = actors.filter((a) => a.side === "party");
      const maxHp = party.reduce((sum, a) => sum + a.maxHp, 0);
      const result = simulateTrial(actors, createSeededRng(c * 7919), ROUND_CAP, { monsterFocus: 0.5 });
      const where = `fight ${c}`;
      expect(result.rounds, where).toBeGreaterThanOrEqual(1);
      expect(result.rounds, where).toBeLessThanOrEqual(ROUND_CAP);
      expect(result.partyHpRemaining, where).toBeGreaterThanOrEqual(0);
      expect(result.partyHpRemaining, where).toBeLessThanOrEqual(maxHp);
      expect(new Set(result.knockedOut).size, where).toBe(result.knockedOut.length);
      for (const name of result.knockedOut)
        expect(
          party.map((p) => p.name),
          where
        ).toContain(name);
      if (result.outcome === "tpk") {
        expect(result.partyHpRemaining, where).toBe(0);
        expect(result.knockedOut.length, where).toBe(party.length);
      } else {
        expect(result.knockedOut.length, where).toBeLessThan(party.length);
        expect(result.partyHpRemaining, where).toBeGreaterThan(0);
      }
      if (result.outcome === "stalemate") expect(result.rounds, where).toBe(ROUND_CAP);
      // The actors are the fight's description, not its state: slots, uses and HP are the trial's own.
      expect(snapshot(actors), where).toBe(before);
    }
  });

  it("gives one result for one seed, and the rates of a run sum to one", () => {
    for (let c = 1; c <= 40; c++) {
      const actors = fight(c);
      const input = {
        party: actors.filter((a) => a.side === "party"),
        monsters: actors.filter((a) => a.side === "monsters").map((actor) => ({ actor, count: 1 })),
        seed: c,
        trials: 20,
        roundCap: ROUND_CAP,
      };
      const a = runMonteCarlo(input);
      const b = runMonteCarlo(input);
      expect(b, `fight ${c}`).toEqual(a);
      expect(a.winRate + a.tpkRate + a.stalemateRate, `fight ${c}`).toBeCloseTo(1, 10);
      expect(a.avgHpLost, `fight ${c}`).toBeGreaterThanOrEqual(0);
      expect(a.avgHpLost, `fight ${c}`).toBeLessThanOrEqual(1);
      for (const rate of Object.values(a.koRate)) {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    }
  });

  it("draws the same numbers from a seed on every Node version (the rng is pure arithmetic)", () => {
    const rng = createSeededRng(42);
    const draws = Array.from({ length: 5 }, () => Math.round(rng() * 1e9));
    expect(draws).toEqual(PINNED_DRAWS);
  });
});

/** The first five draws of seed 42, times 1e9 and rounded: a change here changes every pinned result. */
const PINNED_DRAWS = [601103752, 448290559, 852465793, 669734041, 174813899];
