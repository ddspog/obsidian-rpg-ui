/**
 * The rules beyond the dice (types.ts `TrialRules` and the actor data that turns them on): positions and
 * movement, flight, opportunity attacks, bonus moves and bonus actions, a lair, ammunition, concentration and
 * death saves. Each is shown by many seeded fights with the rule and without it, so a test says what the rule
 * changes rather than pinning a draw order.
 */
import { describe, expect, it } from "vitest";
import { simulateTrial } from "./engine";
import { runMonteCarlo } from "./montecarlo";
import { createSeededRng } from "./rng";
import {
  ABILITY_KEYS,
  type AbilityKey,
  type AbilityStat,
  type CombatActor,
  type CombatSide,
  type ModelledAction,
  type TrialRules,
  type WeaponAttackAction,
} from "./types";

const abilities = (saves: Partial<Record<AbilityKey, number>> = {}) =>
  Object.fromEntries(
    ABILITY_KEYS.map((k): [AbilityKey, AbilityStat] => [k, { modifier: 0, saveModifier: saves[k] ?? 0 }])
  ) as Record<AbilityKey, AbilityStat>;

function actor(name: string, side: CombatSide, more: Partial<CombatActor> = {}): CombatActor {
  return {
    key: name,
    name,
    side,
    level: 1,
    proficiencyBonus: 2,
    armorClass: 12,
    maxHp: 20,
    initiativeModifier: 0,
    abilities: abilities(),
    slots: [],
    actions: [],
    ...more,
  };
}

const melee = (name: string, hit: number, expr: string, reach = 5): WeaponAttackAction => ({
  kind: "weapon",
  name,
  hitBonus: hit,
  damage: { expr, type: "slashing" },
  reach: { melee: reach },
});
const ranged = (name: string, hit: number, expr: string, range = 80): WeaponAttackAction => ({
  kind: "weapon",
  name,
  hitBonus: hit,
  damage: { expr, type: "piercing" },
  reach: { range },
});

function run(party: CombatActor[], monsters: CombatActor[], rules?: TrialRules, trials = 400) {
  return runMonteCarlo({
    party,
    monsters: monsters.map((m) => ({ actor: m, count: 1 })),
    seed: 7,
    trials,
    roundCap: 12,
    monsterFocus: 1,
    ...(rules ? { rules } : {}),
  });
}

describe("positions", () => {
  const archer = actor("Archer", "party", { actions: [ranged("Longbow", 6, "1d8+3", 150)], maxHp: 30 });
  const slow = actor("Ooze", "monsters", { actions: [melee("Pseudopod", 5, "2d6+3")], speed: 10, maxHp: 25 });

  it("keeps a slow melee creature from striking until it has crossed the gap", () => {
    const abstract = run([archer], [slow]);
    const spaced = run([archer], [slow], { distance: 60 });
    expect(abstract.avgHpLost).toBeGreaterThan(0.1);
    expect(spaced.avgHpLost).toBeLessThan(abstract.avgHpLost / 3);
  });

  it("starts everyone in reach at distance 0", () => {
    const close = run([archer], [slow], { distance: 0 });
    expect(close.avgHpLost).toBeGreaterThan(0.05);
  });

  it("lets a melee creature reach and strike in one turn when the gap is its speed or less", () => {
    const fast = { ...slow, speed: 30 };
    expect(run([archer], [fast], { distance: 30 }).avgHpLost).toBeGreaterThan(0.05);
  });
});

describe("flight", () => {
  const fighter = actor("Fighter", "party", { actions: [melee("Longsword", 6, "1d8+3")], maxHp: 30 });
  const harrier = actor("Harrier", "monsters", {
    actions: [ranged("Spines", 4, "1d6+2", 60)],
    fly: 60,
    speed: 10,
    maxHp: 15,
  });

  it("keeps a flier acting at range out of reach of a creature that cannot fly", () => {
    const abstract = run([fighter], [harrier]);
    const spaced = run([fighter], [harrier], { distance: 30 });
    expect(abstract.winRate).toBeGreaterThan(0.8);
    expect(spaced.winRate).toBe(0);
  });

  it("is reached by a fighter with a ranged weapon", () => {
    const archer = { ...fighter, actions: [ranged("Longbow", 6, "1d8+3", 150)] };
    expect(run([archer], [harrier], { distance: 30 }).winRate).toBeGreaterThan(0.5);
  });
});

describe("opportunity attacks and bonus moves", () => {
  const brute = actor("Brute", "monsters", { actions: [melee("Club", 5, "1d6+2")], maxHp: 60, armorClass: 10 });
  const archer = (more: Partial<CombatActor> = {}) =>
    actor("Archer", "party", { actions: [ranged("Longbow", 6, "2d8+3", 150)], maxHp: 40, ...more });

  it("makes an archer next to an enemy pay: a slip away with Disengage costs less than stepping back or shooting with disadvantage", () => {
    const plain = run([archer()], [brute], { distance: 0 });
    const nimble = run([archer({ bonusMoves: ["disengage"] })], [brute], { distance: 0 });
    expect(nimble.avgHpLost).toBeLessThan(plain.avgHpLost);
  });

  it("hides at range with a bonus action for advantage, and wins faster for it", () => {
    const far = { ...brute, speed: 5 };
    const seen = run([archer({ stealth: 0 })], [far], { distance: 60 });
    const hidden = run([archer({ bonusMoves: ["hide"], stealth: 8 })], [far], { distance: 60 });
    expect(hidden.avgRounds).toBeLessThan(seen.avgRounds);
  });

  it("dashes with a bonus action to close a gap and strike in the same turn", () => {
    const pc = actor("Rogue", "party", { actions: [melee("Rapier", 6, "1d8+3")], maxHp: 30 });
    const target = actor("Bandit", "monsters", { actions: [ranged("Crossbow", 3, "1d8+1", 80)], maxHp: 30 });
    const walk = run([pc], [target], { distance: 50 });
    const dash = run([{ ...pc, bonusMoves: ["dash"] }], [target], { distance: 50 });
    expect(dash.avgHpLost).toBeLessThanOrEqual(walk.avgHpLost);
    expect(dash.avgRounds).toBeLessThan(walk.avgRounds);
  });
});

describe("bonus actions and lair actions", () => {
  const pc = actor("Fighter", "party", { actions: [melee("Longsword", 5, "1d8+3")], maxHp: 40, armorClass: 14 });
  const beast = actor("Beast", "monsters", { actions: [melee("Claw", 4, "1d6+2")], maxHp: 30 });

  it("adds a bonus-action attack to the turn", () => {
    const plain = run([pc], [beast]);
    const biting = run([pc], [{ ...beast, bonusActions: [melee("Bite", 4, "1d6+2")] }]);
    expect(biting.avgHpLost).toBeGreaterThan(plain.avgHpLost);
  });

  it("uses lair actions on initiative 20 only in a lair", () => {
    const lair: ModelledAction[] = [
      {
        kind: "save",
        name: "Collapse",
        dc: 13,
        ability: "dex",
        damage: { expr: "2d6" },
        onSuccess: "none",
        area: true,
        circle: 0,
      },
    ];
    const owner = { ...beast, lair };
    const away = run([pc], [owner]);
    const home = run([pc], [owner], { lair: true });
    expect(away).toEqual(run([pc], [beast]));
    expect(home.avgHpLost).toBeGreaterThan(away.avgHpLost);
  });
});

describe("ammunition", () => {
  it("stops shooting when the arrows run out", () => {
    // A target that does not fight back: the quiver alone decides the fight.
    const target = actor("Golem", "monsters", { maxHp: 60, armorClass: 5, speed: 0 });
    const quiver = (ammo?: number) =>
      actor("Archer", "party", {
        actions: [{ ...ranged("Longbow", 6, "1d8+3", 150), ...(ammo !== undefined ? { ammo } : {}) }],
      });
    const fight = (ammo?: number) =>
      simulateTrial([quiver(ammo), target], createSeededRng(3), 30, { rules: { distance: 30 } });
    expect(fight().outcome).toBe("win");
    expect(fight(2).outcome).toBe("stalemate");
  });
});

describe("concentration", () => {
  const hold = (concentration: boolean): ModelledAction => ({
    kind: "save",
    name: "Hold Monster",
    dc: 30,
    ability: "wis",
    damage: { expr: "0" },
    onSuccess: "none",
    area: false,
    circle: 0,
    inflicts: { condition: "paralyzed", lasts: "fight", save: { ability: "wis", dc: 30 } },
    ...(concentration ? { concentration: true } : {}),
  });
  const caster = (concentration: boolean) =>
    actor("Caster", "party", { actions: [hold(concentration)], maxHp: 30, initiativeModifier: 10 });
  // The caster has the fewer HP, so the monsters go for it.
  const fighter = actor("Fighter", "party", { actions: [melee("Axe", 6, "1d12+3")], maxHp: 60 });
  const ogre = actor("Ogre", "monsters", { actions: [melee("Club", 6, "2d8+4")], maxHp: 90, armorClass: 11 });
  // A pest that only throws pebbles at the caster: it barely hurts, but it can break concentration.
  const pest = actor("Pest", "monsters", { actions: [ranged("Pebble", 8, "1d4", 60)], maxHp: 200, armorClass: 25 });

  it("holds a paralysis while the caster is untouched", () => {
    expect(run([caster(true), fighter], [ogre], undefined, 200).avgHpLost).toBeLessThan(0.15);
  });

  it("loses it when the caster is hit and fails the save", () => {
    // A second ogre throws rocks at the caster: its concentration breaks and the held one acts again.
    const kept = run([caster(false), fighter], [ogre, pest], undefined, 300);
    const broken = run([caster(true), fighter], [ogre, pest], undefined, 300);
    expect(broken.avgHpLost).toBeGreaterThan(kept.avgHpLost + 0.05);
  });
});

describe("death saves", () => {
  const frail = actor("Frail", "party", { actions: [melee("Dagger", 3, "1d4")], maxHp: 4, armorClass: 8 });
  const tough = actor("Tough", "party", { actions: [melee("Maul", 6, "2d6+3")], maxHp: 60, armorClass: 16 });
  const goblin = actor("Goblin", "monsters", { actions: [melee("Scimitar", 4, "1d6+2")], maxHp: 30 });

  it("reports who died, and a natural 20 brings a fallen PC back", () => {
    const summary = run([frail, tough], [goblin], { deathSaves: true });
    expect(summary.deathRate?.Frail).toBeGreaterThan(0);
    expect(summary.deathRate?.Tough).toBe(0);
    expect(summary.anyDeathRate).toBeGreaterThan(0);
    // Without the rule nothing says who died.
    expect(run([frail, tough], [goblin]).deathRate).toBeUndefined();
  });

  it("lets a healer bring a fallen ally back first", () => {
    const healer = actor("Healer", "party", {
      actions: [{ kind: "heal", name: "Healing Word", expr: "1d4+3", circle: 1, bonus: true }, melee("Mace", 3, "1d6")],
      slots: [3],
      maxHp: 30,
      armorClass: 16,
    });
    const without = run([frail, tough], [goblin], { deathSaves: true });
    const withHealer = run([frail, tough, healer], [goblin], { deathSaves: true });
    expect(withHealer.deathRate?.Frail).toBeLessThan(without.deathRate!.Frail);
  });

  it("keeps the dice of a trial when the rules are off", () => {
    const actors = [frail, tough, goblin];
    expect(simulateTrial(actors, createSeededRng(11), 12, { rules: {} })).toEqual(
      simulateTrial(actors, createSeededRng(11), 12)
    );
  });
});
