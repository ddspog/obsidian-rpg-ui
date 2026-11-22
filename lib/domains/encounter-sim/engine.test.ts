import { describe, expect, it } from "vitest";

import { simulateTrial } from "./engine";
import { createSeededRng } from "./rng";
import {
  ABILITY_KEYS,
  type AbilityKey,
  type AbilityStat,
  type CombatActor,
  type CombatSide,
  type HealAction,
  type ModelledAction,
  type MultiattackAction,
  type SaveAction,
  type SpellAttackAction,
  type WeaponAttackAction,
} from "./types";

// ---------------------------------------------------------------------------
// Scripted RNG: a queue of values, then `after` forever (or a throw when none,
// so a test can pin the exact number of draws and check `left()` is 0).
// ---------------------------------------------------------------------------

/** The rng share that yields `face` on a die of `sides` faces. */
const face = (value: number, sides = 20) => (value - 0.5) / sides;

function script(values: number[], after?: number) {
  const queue = [...values];
  const rng = () => {
    if (queue.length > 0) return queue.shift() as number;
    if (after !== undefined) return after;
    throw new Error("scripted rng exhausted");
  };
  return Object.assign(rng, { left: () => queue.length });
}

/** Initiative draws: per actor one d20 (the roll) then one tiebreak share, in actor order. */
const initDraws = (...pairs: Array<[roll: number, tiebreak: number]>) =>
  pairs.flatMap(([roll, tb]) => [face(roll), tb]);

/** `n` actors that all roll 10 and share a tiebreak: order is decided by modifiers alone. */
const neutral = (n: number) => initDraws(...Array.from({ length: n }, (): [number, number] => [10, 0.5]));

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

interface ActorSpec {
  name: string;
  side: CombatSide;
  ac?: number;
  hp?: number;
  init?: number;
  slots?: number[];
  actions?: ModelledAction[];
  saves?: Partial<Record<AbilityKey, number>>;
}

function actor(spec: ActorSpec): CombatActor {
  const abilities = Object.fromEntries(
    ABILITY_KEYS.map((k): [AbilityKey, AbilityStat] => [k, { modifier: 0, saveModifier: spec.saves?.[k] ?? 0 }])
  ) as Record<AbilityKey, AbilityStat>;
  return {
    key: spec.name.toLowerCase(),
    name: spec.name,
    side: spec.side,
    level: 1,
    proficiencyBonus: 2,
    armorClass: spec.ac ?? 10,
    maxHp: spec.hp ?? 10,
    initiativeModifier: spec.init ?? 0,
    abilities,
    slots: spec.slots ?? [],
    actions: spec.actions ?? [],
  };
}

const pc = (name: string, spec: Omit<ActorSpec, "name" | "side"> = {}) => actor({ name, side: "party", ...spec });
const mon = (name: string, spec: Omit<ActorSpec, "name" | "side"> = {}) => actor({ name, side: "monsters", ...spec });

const weapon = (expr: string, hitBonus = 0, name = "Weapon"): WeaponAttackAction => ({
  kind: "weapon",
  name,
  hitBonus,
  damage: { expr },
});

const multiattack = (...swings: WeaponAttackAction[]): MultiattackAction => ({
  kind: "multiattack",
  name: "Multiattack",
  swings,
});

const spellAttack = (expr: string, circle = 0, hitBonus = 0, name = "Spell"): SpellAttackAction => ({
  kind: "spell-attack",
  name,
  hitBonus,
  damage: { expr },
  circle,
});

const saveAction = (spec: Partial<SaveAction> & Pick<SaveAction, "damage">): SaveAction => ({
  kind: "save",
  name: "Save effect",
  dc: 12,
  ability: "dex",
  onSuccess: "half",
  area: false,
  circle: 0,
  ...spec,
});

const heal = (expr: string, circle = 0): HealAction => ({ kind: "heal", name: "Heal", expr, circle });

// d20 face 11 (an unscripted draw of 0.5) beats AC 10 and a DC 12 save with +1 only.

describe("simulateTrial: fresh state", () => {
  it("starts every trial at full HP and full slots without touching the actors", () => {
    const caster = pc("Caster", {
      slots: [1],
      actions: [spellAttack("20", 1, 0, "Big spell"), spellAttack("1", 0, 0, "Cantrip")],
    });
    const dummy = mon("Dummy", { hp: 21, ac: 1 });
    const actors = [caster, dummy];
    const before = structuredClone(actors);

    // Round 1 spends the slot (20), round 2 is the cantrip (1): 21 damage, dead in round 2.
    const first = simulateTrial(actors, script(neutral(2), 0.5), 2);
    expect(actors).toEqual(before);
    expect(caster.slots).toEqual([1]);
    const second = simulateTrial(actors, script(neutral(2), 0.5), 2);

    expect(first).toEqual({ outcome: "win", rounds: 2, partyHpRemaining: 10, knockedOut: [] });
    expect(second).toEqual(first);
    expect(actors).toEqual(before);
  });

  it("resets HP between trials", () => {
    const hero = pc("Hero", { hp: 10 });
    const brute = mon("Brute", { hp: 100, actions: [weapon("4")] });
    const actors = [hero, brute];

    const run = () => simulateTrial(actors, script(neutral(2), 0.5), 2);
    expect(run()).toEqual({ outcome: "stalemate", rounds: 2, partyHpRemaining: 2, knockedOut: [] });
    expect(run()).toEqual({ outcome: "stalemate", rounds: 2, partyHpRemaining: 2, knockedOut: [] });
    expect(hero.maxHp).toBe(10);
  });

  it("gives the same result for the same seed", () => {
    const actors = [
      pc("Hero", { hp: 20, actions: [weapon("1d8+2", 4)] }),
      mon("Goblin", { hp: 12, ac: 13, actions: [weapon("1d6", 3)] }),
    ];
    expect(simulateTrial(actors, createSeededRng(5), 20)).toEqual(simulateTrial(actors, createSeededRng(5), 20));
  });
});

describe("simulateTrial: initiative", () => {
  // Both sides one-shot each other with a flat 5, so whoever acts first decides the outcome.
  const duel = () => [pc("Hero", { hp: 5, actions: [weapon("5")] }), mon("Foe", { hp: 5, actions: [weapon("5")] })];
  const attackRoll = [face(11)];

  it("orders by d20 plus modifier, highest first", () => {
    expect(simulateTrial(duel(), script([...initDraws([15, 0.5], [5, 0.5]), ...attackRoll]), 5).outcome).toBe("win");
    expect(simulateTrial(duel(), script([...initDraws([5, 0.5], [15, 0.5]), ...attackRoll]), 5).outcome).toBe("tpk");
  });

  it("adds the initiative modifier to the roll", () => {
    const actors = [pc("Hero", { hp: 5, init: 5, actions: [weapon("5")] }), duel()[1]];
    // 10 + 5 = 15 beats 12.
    const result = simulateTrial(actors, script([...initDraws([10, 0.5], [12, 0.5]), ...attackRoll]), 5);
    expect(result.outcome).toBe("win");
  });

  it("breaks a tied total by the higher modifier, whatever the tiebreak draws", () => {
    const heroFirst = [pc("Hero", { hp: 5, init: 2, actions: [weapon("5")] }), duel()[1]];
    // Both total 12; Hero's modifier is higher although its tiebreak draw is worse.
    expect(simulateTrial(heroFirst, script([...initDraws([10, 0.9], [12, 0.1]), ...attackRoll]), 5).outcome).toBe(
      "win"
    );

    const foeFirst = [duel()[0], mon("Foe", { hp: 5, init: 2, actions: [weapon("5")] })];
    expect(simulateTrial(foeFirst, script([...initDraws([12, 0.1], [10, 0.9]), ...attackRoll]), 5).outcome).toBe("tpk");
  });

  it("breaks a tie in total and modifier by the lower tiebreak draw", () => {
    expect(simulateTrial(duel(), script([...initDraws([10, 0.2], [10, 0.7]), ...attackRoll]), 5).outcome).toBe("win");
    expect(simulateTrial(duel(), script([...initDraws([10, 0.8], [10, 0.3]), ...attackRoll]), 5).outcome).toBe("tpk");
  });

  it("rolls once per combatant, d20 then tiebreak, in actor order, and again each trial", () => {
    const actors = duel();
    const rng = script([
      ...initDraws([15, 0.5], [5, 0.5]), // trial 1: Hero first
      face(11),
      ...initDraws([5, 0.5], [15, 0.5]), // trial 2: Foe first
      face(11),
    ]);
    expect(simulateTrial(actors, rng, 5).outcome).toBe("win");
    expect(simulateTrial(actors, rng, 5).outcome).toBe("tpk");
    expect(rng.left()).toBe(0);
  });
});

describe("simulateTrial: targeting", () => {
  // Hero acts first and deals 3; A and B each have 3 or more HP and hit back for 7 and 1.
  const actors = (a: { hp: number; init: number }, b: { hp: number; init: number }) => [
    pc("Hero", { hp: 20, ac: 5, init: 20, actions: [weapon("3")] }),
    mon("A", { hp: a.hp, ac: 5, init: a.init, actions: [weapon("7")] }),
    mon("B", { hp: b.hp, ac: 5, init: b.init, actions: [weapon("1")] }),
  ];

  it("attacks the living enemy with the lowest current HP", () => {
    // B (3 HP) dies although A comes first in initiative; only A's 7 lands.
    const result = simulateTrial(actors({ hp: 9, init: 10 }, { hp: 3, init: 5 }), script(neutral(3), 0.5), 1);
    expect(result.partyHpRemaining).toBe(13);
  });

  it("breaks ties in current HP by initiative order", () => {
    const aFirst = simulateTrial(actors({ hp: 3, init: 10 }, { hp: 3, init: 5 }), script(neutral(3), 0.5), 1);
    expect(aFirst.partyHpRemaining).toBe(19); // A died, only B's 1 lands
    const bFirst = simulateTrial(actors({ hp: 3, init: 5 }, { hp: 3, init: 10 }), script(neutral(3), 0.5), 1);
    expect(bFirst.partyHpRemaining).toBe(13); // B died, only A's 7 lands
  });

  it("skips the turn of a creature that dropped earlier in the round", () => {
    const only = [
      pc("Hero", { hp: 20, init: 10, actions: [weapon("5")] }),
      mon("Foe", { hp: 5, actions: [weapon("5")] }),
    ];
    const rng = script([...neutral(2), face(11)]);
    expect(simulateTrial(only, rng, 5)).toEqual({ outcome: "win", rounds: 1, partyHpRemaining: 20, knockedOut: [] });
    expect(rng.left()).toBe(0);
  });
});

describe("simulateTrial: attack resolution", () => {
  const hero = (action: WeaponAttackAction, spec: Omit<ActorSpec, "name" | "side"> = {}) =>
    pc("Hero", { init: 5, actions: [action], ...spec });

  it("a natural 20 always hits and doubles the damage dice, not the bonus", () => {
    // 2 dice (6, 6) + 2 = 14 against AC 30 and 14 HP.
    const rng = script([...neutral(2), face(20), face(6, 6), face(6, 6)]);
    const result = simulateTrial([hero(weapon("1d6+2")), mon("Foe", { hp: 14, ac: 30 })], rng, 1);
    expect(result.outcome).toBe("win");
    expect(rng.left()).toBe(0);
  });

  it("rolls a single die on a normal hit", () => {
    const rng = script([...neutral(2), face(11), face(6, 6)]);
    const result = simulateTrial([hero(weapon("1d6+2")), mon("Foe", { hp: 9, ac: 10 })], rng, 1);
    expect(result.outcome).toBe("stalemate"); // 6 + 2 = 8 < 9
    expect(rng.left()).toBe(0);
    const killed = simulateTrial(
      [hero(weapon("1d6+2")), mon("Foe", { hp: 8, ac: 10 })],
      script([...neutral(2), face(11), face(6, 6)]),
      1
    );
    expect(killed.outcome).toBe("win");
  });

  it("a natural 1 always misses, with no damage drawn", () => {
    const rng = script([...neutral(2), face(1)]);
    const result = simulateTrial([hero(weapon("1d6", 30)), mon("Foe", { hp: 1, ac: 5 })], rng, 1);
    expect(result.outcome).toBe("stalemate");
    expect(rng.left()).toBe(0);
  });

  it("hits when d20 plus the bonus equals AC and misses one below", () => {
    const hit = simulateTrial(
      [hero(weapon("5", 2)), mon("Foe", { hp: 5, ac: 12 })],
      script([...neutral(2), face(10)]),
      1
    );
    expect(hit.outcome).toBe("win");
    const miss = simulateTrial(
      [hero(weapon("5", 2)), mon("Foe", { hp: 5, ac: 13 })],
      script([...neutral(2), face(10)]),
      1
    );
    expect(miss.outcome).toBe("stalemate");
  });

  it("deals flat damage as written, a natural 20 leaves it unchanged", () => {
    const rng = script([...neutral(2), face(20)]);
    const result = simulateTrial([hero(weapon("5")), mon("Foe", { hp: 6, ac: 30 })], rng, 1);
    expect(result.outcome).toBe("stalemate"); // 5, not 10
    expect(rng.left()).toBe(0);
  });
});

describe("simulateTrial: choosing an action", () => {
  it("uses a multiattack's swings summed, re-picking the target per swing", () => {
    const actors = [
      pc("Hero", { init: 5, actions: [weapon("5"), multiattack(weapon("3"), weapon("3"))] }),
      mon("E1", { hp: 3, ac: 1 }),
      mon("E2", { hp: 3, ac: 1 }),
    ];
    // 3 + 3 beats a single 5, and each swing kills one enemy.
    const rng = script([...neutral(3), face(11), face(11)]);
    expect(simulateTrial(actors, rng, 3)).toMatchObject({ outcome: "win", rounds: 1 });
    expect(rng.left()).toBe(0);
  });

  it("prefers a multiattack over a weaker single attack against one enemy", () => {
    const actors = [
      pc("Hero", { init: 5, actions: [weapon("5"), multiattack(weapon("3"), weapon("3"))] }),
      mon("Foe", { hp: 6, ac: 1 }),
    ];
    expect(simulateTrial(actors, script(neutral(2), 0.5), 3)).toMatchObject({ outcome: "win", rounds: 1 });
  });

  it("values an area save at its average times the living enemies", () => {
    const blast = saveAction({ damage: { expr: "5" }, area: true });
    const caster = pc("Caster", { init: 5, actions: [weapon("8", 0), blast] });
    // Two enemies: 5 x 2 = 10 beats 8. The weapon (AC 30) would miss, the blast kills both.
    const two = simulateTrial(
      [caster, mon("E1", { hp: 5, ac: 30 }), mon("E2", { hp: 5, ac: 30 })],
      script(neutral(3), 0.5),
      3
    );
    expect(two).toMatchObject({ outcome: "win", rounds: 1 });
    // One enemy: 5 x 1 = 5 loses to 8, so the (always missing) weapon is swung.
    const one = simulateTrial([caster, mon("E1", { hp: 5, ac: 30 })], script(neutral(2), 0.5), 3);
    expect(one).toMatchObject({ outcome: "stalemate", rounds: 3 });
  });

  it("breaks equal averages by the first-listed action", () => {
    const weaponFirst = pc("Hero", { init: 5, actions: [weapon("4", 0), spellAttack("4", 0, 30)] });
    const cantripFirst = pc("Hero", { init: 5, actions: [spellAttack("4", 0, 30), weapon("4", 0)] });
    const foe = () => mon("Foe", { hp: 4, ac: 15 });
    // Face 11: the weapon (+0) misses AC 15, the cantrip (+30) hits.
    expect(simulateTrial([weaponFirst, foe()], script(neutral(2), 0.5), 1).outcome).toBe("stalemate");
    expect(simulateTrial([cantripFirst, foe()], script(neutral(2), 0.5), 1).outcome).toBe("win");
  });

  it("casts a slotted spell while a slot of its circle remains, then falls back to the cantrip", () => {
    const caster = pc("Caster", {
      init: 5,
      slots: [1],
      actions: [spellAttack("20", 1, 0, "Big"), spellAttack("3", 0, 0, "Cantrip")],
    });
    // 20 + 3 + 3 = 26: the slot is spent once, the cantrip finishes in round 3.
    const result = simulateTrial([caster, mon("Foe", { hp: 26, ac: 1 })], script(neutral(2), 0.5), 10);
    expect(result).toMatchObject({ outcome: "win", rounds: 3 });
  });

  it("indexes slots by circle minus one", () => {
    const caster = pc("Caster", {
      init: 5,
      slots: [0, 1],
      actions: [spellAttack("20", 1, 0, "First"), spellAttack("10", 2, 0, "Second"), spellAttack("1", 0, 0, "Cantrip")],
    });
    // The 1st-circle spell is out of slots; the 2nd-circle spell (10) is cast once, then 1 + 1.
    const result = simulateTrial([caster, mon("Foe", { hp: 12, ac: 1 })], script(neutral(2), 0.5), 10);
    expect(result).toMatchObject({ outcome: "win", rounds: 3 });
  });
});

describe("simulateTrial: saving throws", () => {
  const caster = (action: SaveAction) => mon("Caster", { init: 20, actions: [action] });

  it("halves damage (floored) on a successful save and deals it all on a failure", () => {
    const action = saveAction({ damage: { expr: "9" }, onSuccess: "half" });
    // DC 12: face 11 + 1 = 12 succeeds, + 0 = 11 fails.
    const saved = simulateTrial(
      [pc("Hero", { hp: 20, saves: { dex: 1 } }), caster(action)],
      script(neutral(2), 0.5),
      1
    );
    expect(saved.partyHpRemaining).toBe(16);
    const failed = simulateTrial([pc("Hero", { hp: 20 }), caster(action)], script(neutral(2), 0.5), 1);
    expect(failed.partyHpRemaining).toBe(11);
  });

  it("deals nothing on a successful save when onSuccess is none", () => {
    const action = saveAction({ damage: { expr: "9" }, onSuccess: "none" });
    const result = simulateTrial(
      [pc("Hero", { hp: 20, saves: { dex: 1 } }), caster(action)],
      script(neutral(2), 0.5),
      1
    );
    expect(result.partyHpRemaining).toBe(20);
  });

  it("uses the target's save modifier for the action's ability", () => {
    const action = saveAction({ damage: { expr: "10" }, ability: "wis", onSuccess: "none" });
    // Only a Wisdom bonus helps: Dex +9 does not.
    const wrong = simulateTrial(
      [pc("Hero", { hp: 20, saves: { dex: 9 } }), caster(action)],
      script(neutral(2), 0.5),
      1
    );
    expect(wrong.partyHpRemaining).toBe(10);
    const right = simulateTrial(
      [pc("Hero", { hp: 20, saves: { wis: 9 } }), caster(action)],
      script(neutral(2), 0.5),
      1
    );
    expect(right.partyHpRemaining).toBe(20);
  });

  it("rolls the damage once per cast, then one save per target in initiative order", () => {
    const action = saveAction({ damage: { expr: "2d6" }, area: true });
    const actors = [pc("First", { hp: 30, init: 5 }), pc("Second", { hp: 30, init: 0 }), caster(action)];
    // 2d6 = 6 + 6 = 12, rolled once. First saves (15 vs DC 12) and takes 6; Second fails and takes 12.
    const rng = script([...neutral(3), face(6, 6), face(6, 6), face(15), face(5)]);
    const result = simulateTrial(actors, rng, 1);
    expect(result.partyHpRemaining).toBe(42);
    expect(rng.left()).toBe(0);
  });

  it("hits one target only when the effect is not an area", () => {
    const action = saveAction({ damage: { expr: "10" }, onSuccess: "none", area: false });
    const actors = [pc("Weak", { hp: 5 }), pc("Strong", { hp: 30 }), caster(action)];
    const result = simulateTrial(actors, script(neutral(3), 0.5), 1);
    expect(result).toMatchObject({ partyHpRemaining: 30, knockedOut: ["Weak"] });
  });
});

describe("simulateTrial: healing", () => {
  // Foe acts first and hits the lowest-HP party member (the 12-max PC); the healer acts last.
  const party = (damage: string, healer: Partial<ActorSpec> = {}) => [
    pc("Patient", { hp: 12, ac: 5 }),
    pc("Healer", {
      hp: 30,
      slots: [1],
      actions: [heal("5", 1), spellAttack("5", 0, 0, "Cantrip")],
      ...healer,
    }),
    mon("Foe", { hp: 3, ac: 1, init: 10, actions: [weapon(damage)] }),
  ];

  it("does not heal an ally at exactly half HP, and attacks instead", () => {
    // 12 - 6 = 6: 2 x 6 < 12 is false, so the cantrip kills the foe.
    const result = simulateTrial(party("6"), script(neutral(3), 0.5), 1);
    expect(result).toEqual({ outcome: "win", rounds: 1, partyHpRemaining: 36, knockedOut: [] });
  });

  it("heals an ally below half HP and ends the turn", () => {
    // 12 - 7 = 5: healed to 10; the cantrip is not cast, so the foe survives.
    const result = simulateTrial(party("7"), script(neutral(3), 0.5), 1);
    expect(result).toEqual({ outcome: "stalemate", rounds: 1, partyHpRemaining: 40, knockedOut: [] });
  });

  it("spends the slot of a slotted heal", () => {
    // Round 1 heals (5 -> 10); round 2 the foe hits again (10 -> 3), no slot is left, so the cantrip kills it.
    const result = simulateTrial(party("7"), script(neutral(3), 0.5), 2);
    expect(result).toEqual({ outcome: "win", rounds: 2, partyHpRemaining: 33, knockedOut: [] });
  });

  it("does not heal with a slotted heal when the slot is gone from the start", () => {
    const result = simulateTrial(party("7", { slots: [0] }), script(neutral(3), 0.5), 1);
    expect(result).toMatchObject({ outcome: "win", partyHpRemaining: 35 });
  });

  describe("after an area effect that wounds several allies", () => {
    // M1 (acts first) blasts the whole party; the Healer then heals fully (flat 100, capped at max).
    const blast = (amount: string, onSuccess: "half" | "none" = "half") =>
      mon("Blast", { hp: 50, init: 20, actions: [saveAction({ damage: { expr: amount }, area: true, onSuccess })] });
    const healer = (spec: Partial<ActorSpec> = {}) =>
      pc("Healer", { hp: 100, init: 10, slots: [1], actions: [heal("100", 1)], ...spec });

    it("heals the ally with the most missing HP, not the lowest current HP", () => {
      // A (max 16, saves) takes 9 -> 7, missing 9. B (max 30) takes 18 -> 12, missing 18. Healer 100 -> 82.
      const actors = [pc("A", { hp: 16, saves: { dex: 5 } }), pc("B", { hp: 30 }), healer(), blast("18")];
      const result = simulateTrial(actors, script(neutral(4), 0.5), 1);
      expect(result.partyHpRemaining).toBe(7 + 30 + 82);
    });

    it("never heals a creature at 0 HP", () => {
      // A (max 30) fails the save and drops (40); B (max 38) saves: 20 -> 18. Healer 100 -> 60.
      const actors = [pc("A", { hp: 30 }), pc("B", { hp: 38, saves: { dex: 5 } }), healer(), blast("40")];
      const result = simulateTrial(actors, script(neutral(4), 0.5), 1);
      expect(result.partyHpRemaining).toBe(0 + 38 + 60);
      expect(result.knockedOut).toEqual(["A"]);
    });

    // After the heal a second foe kills whoever has the lowest HP, which reveals who was healed.
    const finisher = () => mon("Finisher", { hp: 50, init: 0, actions: [weapon("20")] });

    it("breaks ties in missing HP by lowest current HP", () => {
      // A (max 14) -> 4, B (max 18) -> 8; both miss 10. A is healed, so B is the weakest left.
      const actors = [pc("A", { hp: 14, ac: 5 }), pc("B", { hp: 18, ac: 5 }), healer(), blast("10"), finisher()];
      const result = simulateTrial(actors, script(neutral(5), 0.5), 1);
      expect(result.knockedOut).toEqual(["B"]);
    });

    it("breaks remaining ties by initiative order", () => {
      // Both end at 4 of 14. The first in initiative is healed, the other is killed.
      const aFirst = [
        pc("A", { hp: 14, ac: 5, init: 5 }),
        pc("B", { hp: 14, ac: 5 }),
        healer(),
        blast("10"),
        finisher(),
      ];
      expect(simulateTrial(aFirst, script(neutral(5), 0.5), 1).knockedOut).toEqual(["B"]);
      const bFirst = [
        pc("A", { hp: 14, ac: 5 }),
        pc("B", { hp: 14, ac: 5, init: 5 }),
        healer(),
        blast("10"),
        finisher(),
      ];
      expect(simulateTrial(bFirst, script(neutral(5), 0.5), 1).knockedOut).toEqual(["A"]);
    });
  });
});

describe("simulateTrial: termination", () => {
  it("ends as a win the moment the last monster drops, without further turns", () => {
    const actors = [
      pc("First", { hp: 10, init: 10, actions: [weapon("5")] }),
      pc("Second", { hp: 10, actions: [weapon("5")] }),
      mon("Foe", { hp: 5 }),
    ];
    const rng = script([...neutral(3), face(11)]);
    expect(simulateTrial(actors, rng, 20)).toEqual({ outcome: "win", rounds: 1, partyHpRemaining: 20, knockedOut: [] });
    expect(rng.left()).toBe(0);
  });

  it("ends as a TPK in the round the last PC drops and names those at 0 HP", () => {
    const actors = [
      pc("One", { hp: 10, ac: 5 }),
      pc("Two", { hp: 10, ac: 5 }),
      mon("Brute", { hp: 50, init: 10, actions: [weapon("10")] }),
    ];
    const rng = script([...neutral(3), face(11), face(11)]);
    expect(simulateTrial(actors, rng, 20)).toEqual({
      outcome: "tpk",
      rounds: 2,
      partyHpRemaining: 0,
      knockedOut: ["One", "Two"],
    });
    expect(rng.left()).toBe(0);
  });

  it("reports the survivors' HP and the fallen when the party wins with losses", () => {
    const actors = [
      pc("Tank", { hp: 30, ac: 5, init: 5, actions: [weapon("10")] }),
      pc("Squishy", { hp: 4, ac: 5 }),
      mon("Foe", { hp: 10, ac: 5, init: 10, actions: [weapon("4")] }),
    ];
    // Foe hits the lowest-HP PC (Squishy), who drops; Tank then kills the Foe.
    const result = simulateTrial(actors, script(neutral(3), 0.5), 5);
    expect(result).toEqual({ outcome: "win", rounds: 1, partyHpRemaining: 30, knockedOut: ["Squishy"] });
  });

  it("ends as a stalemate at the round cap with both sides standing", () => {
    const actors = [pc("Hero", { hp: 10, actions: [weapon("1")] }), mon("Wall", { hp: 100, ac: 1 })];
    const rng = script([...neutral(2), face(11), face(11), face(11)]);
    expect(simulateTrial(actors, rng, 3)).toEqual({
      outcome: "stalemate",
      rounds: 3,
      partyHpRemaining: 10,
      knockedOut: [],
    });
    expect(rng.left()).toBe(0);
  });

  it("ends as a stalemate at the cap when neither side can damage the other", () => {
    const actors = [pc("Hero", { hp: 10 }), pc("Mage", { hp: 8, slots: [2] }), mon("Dummy", { hp: 20 })];
    // Only the initiative draws are consumed: every turn is a pass.
    const rng = script(neutral(3));
    expect(simulateTrial(actors, rng, 7)).toEqual({
      outcome: "stalemate",
      rounds: 7,
      partyHpRemaining: 18,
      knockedOut: [],
    });
    expect(rng.left()).toBe(0);
  });

  it("passes when a combatant has only a heal and nobody needs it", () => {
    const actors = [pc("Healer", { actions: [heal("5")] }), mon("Dummy")];
    expect(simulateTrial(actors, script(neutral(2)), 4)).toMatchObject({ outcome: "stalemate", rounds: 4 });
  });
});

describe("use limits and the size of an area", () => {
  const breath = (extra: Partial<SaveAction>): SaveAction => ({
    kind: "save",
    name: "Breath (Recharge 6)",
    dc: 30,
    ability: "dex",
    damage: { expr: "10" },
    onSuccess: "none",
    area: true,
    circle: 0,
    ...extra,
  });

  it("does not breathe again until the recharge comes up", () => {
    const pc = actor({ name: "Tank", side: "party", hp: 1000 });
    const dragon = actor({
      name: "Dragon",
      side: "monsters",
      hp: 1000,
      init: 5,
      actions: [breath({ limit: { recharge: 6 } })],
    });
    // The dragon acts first; its recharge d6 always shows 1, so it breathes once in five rounds.
    const r = simulateTrial([pc, dragon], () => face(1, 6) / 1, 5);
    expect(r.outcome).toBe("stalemate");
    expect(r.partyHpRemaining).toBe(990);
  });

  it("uses a once-a-day action once", () => {
    const pc = actor({ name: "Tank", side: "party", hp: 1000 });
    const dragon = actor({
      name: "Dragon",
      side: "monsters",
      hp: 1000,
      init: 5,
      actions: [breath({ limit: { perDay: 1 } })],
    });
    expect(simulateTrial([pc, dragon], createSeededRng(3), 5).partyHpRemaining).toBe(990);
  });

  it("catches as many as its size says", () => {
    const party = ["A", "B", "C", "D"].map((name) => actor({ name, side: "party", hp: 100 }));
    const dragon = actor({ name: "Dragon", side: "monsters", hp: 1000, init: 5, actions: [breath({ targets: 2 })] });
    const r = simulateTrial([...party, dragon], createSeededRng(1), 1);
    expect(r.partyHpRemaining).toBe(400 - 20);
  });
});

describe("conditions and riders", () => {
  const hitAll = (name: string, extra: Partial<WeaponAttackAction> = {}): WeaponAttackAction => ({
    kind: "weapon",
    name,
    hitBonus: 100,
    damage: { expr: "1" },
    ...extra,
  });

  it("a stunned creature loses its turn until its next turn ends", () => {
    const stunner = actor({
      name: "Stunner",
      side: "party",
      hp: 100,
      init: 10,
      actions: [hitAll("Stun", { inflicts: { condition: "stunned", lasts: "end" } })],
    });
    const brute = actor({
      name: "Brute",
      side: "monsters",
      hp: 100,
      actions: [hitAll("Club", { damage: { expr: "10" } })],
    });
    // The stunner acts first each round and stuns the brute again: the brute never acts.
    const r = simulateTrial([stunner, brute], createSeededRng(5), 3);
    expect(r.partyHpRemaining).toBe(100);
  });

  it("a mark rider adds its damage to every hit on the marked target, and a use marks it", () => {
    const ranger = actor({ name: "Ranger", side: "party", hp: 100, init: 10, actions: [hitAll("Bow")] });
    ranger.riders = [{ name: "Mark", damage: "2", kind: "mark", uses: 1 }];
    const dummy = actor({ name: "Dummy", side: "monsters", hp: 9 });
    // 1 + 2 a hit: 9 HP falls in three rounds with the mark, nine without.
    expect(simulateTrial([ranger, dummy], createSeededRng(2), 10).rounds).toBe(3);
  });

  it("spreads a monster's picks when its focus is below 1", () => {
    const weak = { ...actor({ name: "Weak", side: "party", hp: 10 }) };
    const strong = actor({ name: "Strong", side: "party", hp: 1000 });
    const brute = actor({
      name: "Brute",
      side: "monsters",
      hp: 10000,
      init: 10,
      actions: [hitAll("Club", { damage: { expr: "5" } })],
    });
    const koRate = (focus: number) => {
      const rng = createSeededRng(9);
      let kos = 0;
      for (let t = 0; t < 200; t++)
        if (simulateTrial([weak, strong, brute], rng, 2, { monsterFocus: focus }).knockedOut.includes("Weak")) kos++;
      return kos / 200;
    };
    // Focus fire drops the weak PC in two rounds whenever both blows land (a natural 1 misses); at random, only when both find it.
    expect(koRate(1)).toBeGreaterThan(0.85);
    expect(koRate(0)).toBeGreaterThan(0.1);
    expect(koRate(0)).toBeLessThan(0.45);
  });
});
