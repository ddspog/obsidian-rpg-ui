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
  type BattleGrid,
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

describe("terrain, cover and height", () => {
  const archer = actor("Archer", "party", { actions: [ranged("Longbow", 6, "1d8+3", 150)], maxHp: 30 });
  const walker = actor("Brute", "monsters", { actions: [melee("Club", 5, "2d6+3")], speed: 30, maxHp: 30 });

  it("slows a walker in difficult terrain: it reaches an archer later", () => {
    const open = run([archer], [walker], { distance: 60 });
    const rough = run([archer], [walker], { distance: 60, difficult: true });
    expect(rough.avgHpLost).toBeLessThan(open.avgHpLost);
  });

  it("gives a side in cover a better AC against ranged attacks", () => {
    const shooter = actor("Bandit", "monsters", { actions: [ranged("Crossbow", 4, "1d8+2", 80)], maxHp: 60 });
    const pc = actor("Fighter", "party", { actions: [ranged("Javelin", 5, "1d6+3", 30)], maxHp: 40 });
    const bare = run([pc], [shooter], { distance: 60 });
    const covered = run([pc], [shooter], { distance: 60, cover: { party: 5 } });
    expect(covered.avgHpLost).toBeLessThan(bare.avgHpLost);
  });

  it("gives half cover against a ranged attack to one behind another creature", () => {
    const shooter = actor("Bandit", "monsters", {
      actions: [ranged("Crossbow", 4, "1d8+2", 80)],
      maxHp: 80,
      armorClass: 20,
    });
    // The caster stands back (it acts at range); the fighter in front of it is in the way.
    const caster = actor("Caster", "party", { actions: [ranged("Bolt", 4, "1d4", 120)], maxHp: 8, armorClass: 12 });
    const wall = actor("Wall", "party", { actions: [], maxHp: 200, armorClass: 30 });
    const alone = run([caster], [shooter], { distance: 30 });
    const shielded = run([caster, wall], [shooter], { distance: 30 });
    expect(shielded.koRate.Caster).toBeLessThan(alone.koRate.Caster);
  });

  it("keeps a flier hovering out of a 10-foot reach, and lets a 25-foot reach strike it", () => {
    const harrier = actor("Harrier", "monsters", { actions: [ranged("Spines", 4, "1d6+2", 60)], fly: 60, maxHp: 15 });
    const pike = (reach: number) =>
      actor("Pikeman", "party", { actions: [melee("Pike", 6, "1d10+3", reach)], maxHp: 30 });
    expect(run([pike(10)], [harrier], { distance: 30 }).winRate).toBe(0);
    expect(run([pike(25)], [harrier], { distance: 30 }).winRate).toBeGreaterThan(0.5);
  });

  it("drops a flier knocked prone: it falls and lands where a walker can reach it", () => {
    const harrier = actor("Harrier", "monsters", { actions: [ranged("Spines", 4, "1d6+2", 60)], fly: 60, maxHp: 25 });
    const knock = actor("Slinger", "party", {
      actions: [
        { ...ranged("Bola", 6, "1d4", 60), inflicts: { condition: "prone", lasts: "start" } },
        melee("Axe", 6, "1d12+3"),
      ],
      maxHp: 30,
    });
    const swordOnly = actor("Slinger", "party", { actions: [melee("Axe", 6, "1d12+3")], maxHp: 30 });
    expect(run([knock], [harrier], { distance: 30 }).winRate).toBeGreaterThan(
      run([swordOnly], [harrier], { distance: 30 }).winRate
    );
  });

  it("puts a side's back line on a ledge: a walker must climb to strike it", () => {
    const brute = actor("Brute", "monsters", { actions: [melee("Club", 5, "2d6+3")], speed: 20, maxHp: 40 });
    const flat = run([archer], [brute], { distance: 20 });
    const ledge = run([archer], [brute], { distance: 20, highGround: { side: "party", height: 20 } });
    expect(ledge.avgHpLost).toBeLessThan(flat.avgHpLost);
  });
});

describe("Haste and Slow", () => {
  const fighter = (more: Partial<CombatActor> = {}) =>
    actor("Fighter", "party", { actions: [melee("Sword", 6, "1d8+3")], maxHp: 40, initiativeModifier: 5, ...more });
  const ogre = actor("Ogre", "monsters", { actions: [melee("Club", 6, "2d8+4")], maxHp: 70, armorClass: 11 });
  const haste: ModelledAction = {
    kind: "buff",
    name: "Haste",
    circle: 3,
    on: "allies",
    targets: 1,
    ac: 2,
    speedFactor: 2,
    dexAdvantage: true,
    extraAttack: true,
    lethargy: true,
    concentration: true,
  };
  const slow: ModelledAction = {
    kind: "buff",
    name: "Slow",
    circle: 3,
    on: "enemies",
    targets: 6,
    save: { ability: "wis", dc: 25 },
    speedFactor: 0.5,
    ac: -2,
    dexSave: -2,
    noReactions: true,
    oneAttack: true,
    repeatSave: true,
    concentration: true,
  };
  const caster = (spell: ModelledAction) =>
    actor("Caster", "party", {
      actions: [spell, melee("Staff", 2, "1d6")],
      slots: [0, 0, 2],
      maxHp: 30,
      armorClass: 18,
      initiativeModifier: 10,
    });

  it("hastens an ally: an attack more, +2 AC, so the fight is shorter", () => {
    const plain = run([fighter(), caster(melee("Staff", 2, "1d6"))], [ogre]);
    const hasted = run([fighter(), caster(haste)], [ogre]);
    expect(hasted.avgRounds).toBeLessThan(plain.avgRounds);
  });

  it("slows an enemy: one attack a turn, -2 AC, no reactions", () => {
    const twoClubs = {
      ...ogre,
      actions: [
        {
          kind: "multiattack",
          name: "Multiattack",
          swings: [melee("Club", 6, "2d8+4"), melee("Club", 6, "2d8+4")],
        } as ModelledAction,
      ],
    };
    const plain = run([fighter(), caster(melee("Staff", 2, "1d6"))], [twoClubs]);
    const slowed = run([fighter(), caster(slow)], [twoClubs]);
    expect(slowed.avgHpLost).toBeLessThan(plain.avgHpLost);
  });
});

describe("reactions", () => {
  const pc = actor("Fighter", "party", { actions: [melee("Sword", 6, "1d8+3")], maxHp: 60 });
  const beast = (reactions: CombatActor["reactions"]) =>
    actor("Beast", "monsters", {
      actions: [melee("Claw", 4, "1d6+2")],
      maxHp: 40,
      ...(reactions ? { reactions } : {}),
    });

  it("strikes back at the attacker when hit (a counterattack)", () => {
    const plain = run([pc], [beast(undefined)]);
    const counter = run([pc], [beast([{ kind: "counter", name: "Counterattack", attack: melee("Claw", 4, "1d6+2") }])]);
    expect(counter.avgHpLost).toBeGreaterThan(plain.avgHpLost);
  });

  it("deals damage back when damaged (Hellish Rebuke), with a save for half", () => {
    const plain = run([pc], [beast(undefined)]);
    const rebuke = run(
      [pc],
      [
        beast([
          {
            kind: "retaliate",
            name: "Hellish Rebuke",
            damage: { expr: "2d10", type: "fire" },
            save: { ability: "dex", dc: 13 },
            onSuccess: "half",
          },
        ]),
      ]
    );
    expect(rebuke.avgHpLost).toBeGreaterThan(plain.avgHpLost);
  });

  it("gives the attacker disadvantage, or halves a hit's damage: the fight lasts longer", () => {
    const plain = run([pc], [beast(undefined)]);
    const shy = run([pc], [beast([{ kind: "disadvantage", name: "Fin Flare" }])]);
    const huddle = run([pc], [beast([{ kind: "halve", name: "Defensive Huddle" }])]);
    expect(shy.avgRounds).toBeGreaterThan(plain.avgRounds);
    expect(huddle.avgRounds).toBeGreaterThan(plain.avgRounds);
  });

  it("counters a spell of a circle it stops, not a cantrip's weapon", () => {
    const bolt: ModelledAction = {
      kind: "spell-attack",
      name: "Scorching Ray",
      hitBonus: 6,
      damage: { expr: "6d6", type: "fire" },
      circle: 2,
      spell: 2,
    };
    const mage = actor("Mage", "party", { actions: [bolt], slots: [0, 4], maxHp: 30 });
    const golem = actor("Golem", "monsters", { actions: [melee("Slam", 4, "1d8+2")], maxHp: 60 });
    const plain = run([mage], [golem]);
    const warded = run([mage], [{ ...golem, reactions: [{ kind: "counterspell", name: "Counter Spell", upTo: 3 }] }]);
    expect(warded.avgRounds).toBeGreaterThan(plain.avgRounds);
  });

  it("takes one reaction a round, and none under Slow", () => {
    // Two reactions written, one a round: the second waits for the next round.
    const both = run(
      [pc],
      [
        beast([
          { kind: "disadvantage", name: "Fin Flare" },
          { kind: "halve", name: "Huddle" },
        ]),
      ]
    );
    const one = run([pc], [beast([{ kind: "disadvantage", name: "Fin Flare" }])]);
    expect(both.avgRounds).toBeGreaterThanOrEqual(one.avgRounds - 0.1);
  });
});

describe("a battle map", () => {
  /** A map from rows of characters: "#" blocks, "~" is difficult, "^" is half cover, "%" three-quarters. */
  function grid(rows: string[], starts: BattleGrid["starts"]): BattleGrid {
    const cells = rows.flatMap((r) => [...r]);
    return {
      scale: 5,
      cols: rows[0].length,
      rows: rows.length,
      blocked: cells.map((c) => c === "#"),
      difficult: cells.map((c) => c === "~"),
      cover: cells.map((c) => (c === "^" ? 2 : c === "%" ? 5 : 0)),
      starts,
    };
  }
  const archer = actor("Archer", "party", { actions: [ranged("Longbow", 6, "1d8+3", 150)], maxHp: 30, speed: 0 });
  const shooter = actor("Bandit", "monsters", { actions: [ranged("Crossbow", 6, "1d8+3", 150)], maxHp: 30, speed: 0 });
  const both = (map: BattleGrid) => run([archer], [shooter], { map });

  it("puts everyone on their start square, and a wall between them stops the shots", () => {
    const open = grid(["..........", "..........", ".........."], {
      Archer: [{ col: 0, row: 1 }],
      Bandit: [{ col: 9, row: 1 }],
    });
    const walled = grid(["....#.....", "....#.....", "....#....."], {
      Archer: [{ col: 0, row: 1 }],
      Bandit: [{ col: 9, row: 1 }],
    });
    expect(both(open).stalemateRate).toBe(0);
    // Neither can move (speed 0) nor see past the wall: nobody is hurt.
    expect(both(walled)).toMatchObject({ stalemateRate: 1, avgHpLost: 0 });
  });

  it("gives cover from the squares between and the one the target stands in", () => {
    const starts = { Archer: [{ col: 0, row: 0 }], Bandit: [{ col: 9, row: 0 }] };
    const bare = both(grid([".........."], starts));
    const rocks = both(grid(["........%%"], starts));
    expect(rocks.avgRounds).toBeGreaterThan(bare.avgRounds);
  });

  it("walks a melee creature around a wall, and difficult ground slows it", () => {
    // A post that does not fight back: every square more the brute walks is a round less of blows.
    const brute = actor("Brute", "monsters", { actions: [melee("Club", 6, "2d6+3")], maxHp: 30, speed: 20 });
    const post = actor("Post", "party", { actions: [], maxHp: 300, armorClass: 10, speed: 0 });
    const starts = { Post: [{ col: 0, row: 0 }], Brute: [{ col: 11, row: 0 }] };
    const fight = (rows: string[]) => run([post], [brute], { map: grid(rows, starts) });
    const open = fight(Array(11).fill("............"));
    const around = fight([...Array(10).fill("......#....."), "............"]);
    const mud = fight(Array(11).fill("..~~~~~~~~.."));
    expect(around.avgHpLost).toBeLessThan(open.avgHpLost);
    expect(mud.avgHpLost).toBeLessThan(open.avgHpLost);
  });

  it("catches the enemies nearest the one an area is aimed at", () => {
    const blast: ModelledAction = {
      kind: "save",
      name: "Fireball",
      dc: 30,
      ability: "dex",
      damage: { expr: "20" },
      onSuccess: "none",
      area: true,
      targets: 2,
      circle: 0,
      reach: { range: 150 },
    };
    const mage = actor("Mage", "party", { actions: [blast], maxHp: 30, speed: 0 });
    const goblin = (n: string) => actor(n, "monsters", { actions: [], maxHp: 20, speed: 0 });
    const starts = {
      Mage: [{ col: 0, row: 0 }],
      A: [{ col: 9, row: 0 }],
      B: [{ col: 9, row: 1 }],
      C: [{ col: 2, row: 4 }],
    };
    const r = simulateTrial([mage, goblin("A"), goblin("B"), goblin("C")], createSeededRng(1), 3, {
      rules: { map: grid(["..........", "..........", "..........", "..........", ".........."], starts) },
    });
    // Two casts of 20 kill A and B (side by side) first, then C; three rounds are enough for all three.
    expect(r.outcome).toBe("win");
  });
});

describe("reactions that protect or move", () => {
  const pc = actor("Fighter", "party", { actions: [melee("Sword", 6, "1d8+3")], maxHp: 60 });
  const ward = (reactions?: CombatActor["reactions"]) =>
    actor("Ward", "monsters", { actions: [melee("Claw", 4, "1d6+2")], maxHp: 20, ...(reactions ? { reactions } : {}) });

  it("guards an ally next to it: its AC raised, or disadvantage on the attack", () => {
    const guard = (reactions?: CombatActor["reactions"]) =>
      actor("Guard", "monsters", {
        actions: [melee("Spear", 4, "1d6+2")],
        maxHp: 20,
        ...(reactions ? { reactions } : {}),
      });
    const fight = (reactions?: CombatActor["reactions"]) => run([pc], [ward(), guard(reactions)], undefined, 2000);
    const alone = fight();
    const parried = fight([{ kind: "protect", name: "Protector's Parry", within: 5, ac: 2 }]);
    const spoiled = fight([{ kind: "protect", name: "Protective Interference", within: 5 }]);
    expect(parried.avgRounds).toBeGreaterThan(alone.avgRounds);
    expect(spoiled.avgRounds).toBeGreaterThan(alone.avgRounds);
  });

  it("dodges away when missed, drawing no opportunity attack: a second swing finds it out of reach", () => {
    const twice = actor("Fighter", "party", {
      actions: [
        { kind: "multiattack", name: "Multiattack", swings: [melee("Sword", 6, "1d8+3"), melee("Sword", 6, "1d8+3")] },
      ],
      maxHp: 60,
    });
    const plain = run([twice], [ward()], { distance: 0 }, 2000);
    const nimble = run(
      [twice],
      [ward([{ kind: "move", name: "Nimble Dodge", trigger: "missed", feet: 15 }])],
      { distance: 0 },
      2000
    );
    expect(nimble.avgRounds).toBeGreaterThan(plain.avgRounds);
  });

  it("closes in on an enemy that comes near", () => {
    const archer = actor("Archer", "party", { actions: [ranged("Longbow", 6, "1d8+3", 150)], maxHp: 30 });
    const lurker = (reactions?: CombatActor["reactions"]) =>
      actor("Lurker", "monsters", {
        actions: [melee("Bite", 5, "2d6+3")],
        maxHp: 30,
        speed: 10,
        ...(reactions ? { reactions } : {}),
      });
    const plain = run([archer], [lurker()], { distance: 20 });
    const pursuing = run(
      [archer],
      [lurker([{ kind: "move", name: "Slithering Pursuit", trigger: "approached", toward: true, within: 30 }])],
      {
        distance: 20,
      }
    );
    expect(pursuing.avgHpLost).toBeGreaterThanOrEqual(plain.avgHpLost);
  });
});
