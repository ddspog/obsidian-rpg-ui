import { describe, expect, it } from "vitest";

import { ABILITY_KEYS, type AbilityKey, type AbilityStat, type CombatActor } from "../encounter-sim/types";

import { partyStamp } from "./party-stamp";

const abilities = (): Record<AbilityKey, AbilityStat> =>
  Object.fromEntries(ABILITY_KEYS.map((k, i) => [k, { score: 10 + i, modifier: i - 1, saveModifier: i }])) as Record<
    AbilityKey,
    AbilityStat
  >;

const pc = (over: Partial<CombatActor> = {}): CombatActor => ({
  key: "kowyn",
  name: "Kowyn",
  side: "party",
  level: 3,
  proficiencyBonus: 2,
  armorClass: 16,
  maxHp: 27,
  initiativeModifier: 2,
  abilities: abilities(),
  slots: [4, 2],
  actions: [
    { kind: "weapon", name: "Sword", hitBonus: 5, damage: { expr: "1d8+3", type: "slashing" } },
    {
      kind: "save",
      name: "Burst",
      dc: 13,
      ability: "dex",
      damage: { expr: "3d6" },
      onSuccess: "half",
      area: true,
      circle: 2,
    },
  ],
  ...over,
});

describe("partyStamp", () => {
  it("is a short hex digest, deterministic", () => {
    const stamp = partyStamp([pc()]);
    expect(stamp).toMatch(/^[0-9a-f]{16}$/);
    expect(partyStamp([pc()])).toBe(stamp);
    expect(partyStamp([])).toMatch(/^[0-9a-f]{16}$/);
  });

  it("does not depend on key or insertion order", () => {
    const a = pc();
    const reorderedAbilities = Object.fromEntries(
      [...ABILITY_KEYS]
        .reverse()
        .map((k) => [k, { saveModifier: a.abilities[k].saveModifier, modifier: a.abilities[k].modifier }])
    ) as Record<AbilityKey, AbilityStat>;
    const b: CombatActor = {
      actions: [
        { damage: { type: "slashing", expr: "1d8+3" }, hitBonus: 5, name: "Sword", kind: "weapon" },
        {
          circle: 2,
          area: true,
          onSuccess: "half",
          damage: { expr: "3d6" },
          ability: "dex",
          dc: 13,
          name: "Burst",
          kind: "save",
        },
      ],
      slots: [4, 2],
      abilities: reorderedAbilities,
      initiativeModifier: 2,
      maxHp: 27,
      armorClass: 16,
      proficiencyBonus: 2,
      level: 3,
      side: "party",
      name: "Kowyn",
      key: "kowyn",
    };
    expect(partyStamp([b])).toBe(partyStamp([a]));
  });

  it("ignores the score, the key and the side", () => {
    const a = pc();
    const b = pc({
      key: "other",
      side: "monsters",
      abilities: { ...a.abilities, str: { modifier: -1, saveModifier: 0, score: 3 } },
    });
    expect(partyStamp([b])).toBe(partyStamp([a]));
  });

  it("reads a field left out and a field undefined the same", () => {
    expect(partyStamp([pc({ riders: undefined, reactions: undefined })])).toBe(partyStamp([pc()]));
  });

  it("changes with each field class", () => {
    const base = partyStamp([pc()]);
    const variants: Record<string, CombatActor> = {
      name: pc({ name: "Kowyn II" }),
      level: pc({ level: 4 }),
      proficiencyBonus: pc({ proficiencyBonus: 3 }),
      armorClass: pc({ armorClass: 17 }),
      maxHp: pc({ maxHp: 28 }),
      initiative: pc({ initiativeModifier: 3 }),
      slotCount: pc({ slots: [4, 1] }),
      slotCircles: pc({ slots: [4, 2, 0] }),
      abilityModifier: pc({ abilities: { ...abilities(), wis: { modifier: 9, saveModifier: 3 } } }),
      abilitySave: pc({ abilities: { ...abilities(), cha: { modifier: 4, saveModifier: 9 } } }),
      actionDamage: pc({
        actions: [
          { kind: "weapon", name: "Sword", hitBonus: 5, damage: { expr: "1d8+4", type: "slashing" } },
          ...pc().actions.slice(1),
        ],
      }),
      actionType: pc({
        actions: [
          { kind: "weapon", name: "Sword", hitBonus: 5, damage: { expr: "1d8+3", type: "piercing" } },
          ...pc().actions.slice(1),
        ],
      }),
      actionDc: pc({
        actions: [pc().actions[0], { ...(pc().actions[1] as object), dc: 14 } as CombatActor["actions"][number]],
      }),
      actionRemoved: pc({ actions: pc().actions.slice(0, 1) }),
      rider: pc({ riders: [{ name: "Mystic Mark", damage: "1d4", kind: "mark", uses: 2 }] }),
      defences: pc({
        defences: { resistant: ["fire"], immune: [], vulnerable: [], conditionImmune: [], conditionResistant: [] },
      }),
      acReaction: pc({ reaction: { name: "Shield", ac: 5, untilTurn: true, circle: 1 } }),
      reactions: pc({ reactions: [{ kind: "halve", name: "Uncanny Dodge" }] }),
      legendaryResistance: pc({ legendaryResistance: 3 }),
      legendary: pc({
        legendary: {
          points: 3,
          actions: [{ action: { kind: "weapon", name: "Tail", hitBonus: 8, damage: { expr: "2d8+5" } }, cost: 2 }],
        },
      }),
      speed: pc({ speed: 40 }),
      flySpeed: pc({ fly: 60 }),
      flyby: pc({ flyby: true }),
      bonusMoves: pc({ bonusMoves: ["dash"] }),
      bonusActions: pc({
        bonusActions: [{ kind: "weapon", name: "Off-hand", hitBonus: 5, damage: { expr: "1d6" } }],
      }),
      stealth: pc({ stealth: 4 }),
      passivePerception: pc({ passivePerception: 12 }),
      lair: pc({
        lair: [
          {
            kind: "save",
            name: "Tremor",
            dc: 15,
            ability: "dex",
            damage: { expr: "0" },
            onSuccess: "none",
            area: true,
            circle: 0,
          },
        ],
      }),
    };
    const seen = new Set([base]);
    for (const [label, actor] of Object.entries(variants)) {
      const stamp = partyStamp([actor]);
      expect(stamp, label).not.toBe(base);
      seen.add(stamp);
    }
    expect(seen.size).toBe(Object.keys(variants).length + 1);
  });

  it("depends on the order of the actors and on who is in the party", () => {
    const a = pc();
    const b = pc({ name: "Talon", level: 5 });
    expect(partyStamp([a, b])).not.toBe(partyStamp([b, a]));
    expect(partyStamp([a, b])).not.toBe(partyStamp([a]));
  });
});

describe("partyStamp: the rules", () => {
  it("changes with the rules a fit was simulated by, and is the party's alone without them", () => {
    const party = [pc()];
    const plain = partyStamp(party);
    expect(partyStamp(party, {})).toBe(plain);
    const spaced = partyStamp(party, { distance: 30, deathSaves: true });
    expect(spaced).not.toBe(plain);
    expect(partyStamp(party, { distance: 60, deathSaves: true })).not.toBe(spaced);
    expect(partyStamp(party, { distance: 30, deathSaves: true, lair: true })).not.toBe(spaced);
  });
});
