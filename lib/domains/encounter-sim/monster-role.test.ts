import { describe, expect, it } from "vitest";

import {
  crBenchmark,
  crStep,
  damagePerRound,
  equivalentsOf,
  guessRole,
  parseRole,
  parseSubrole,
  roleOfSubrole,
  type RoleInput,
  type RoleProfile,
} from "./monster-role";

const bite = { kind: "weapon" as const, name: "Bite", hitBonus: 4, damage: { expr: "2d4+2" } };

function monster(over: Partial<RoleInput>): RoleInput {
  return { name: "Thing", cr: 1, ac: 14, hp: 40, speed: "30 ft.", features: [], actions: [bite], ...over };
}

describe("the CR table", () => {
  it("gives a CR's row and its step on the ladder", () => {
    expect(crBenchmark(0.5)).toEqual({ ac: 12, hp: 25, dpr: 9 });
    expect(crBenchmark(3)).toEqual({ ac: 14, hp: 80, dpr: 28.5 });
    expect(crStep(0.25) + 1).toBe(crStep(0.5));
    expect(crStep(2) - crStep(1)).toBe(1);
  });

  it("counts a Multiattack's swings and an area for one and a half targets", () => {
    expect(damagePerRound([bite, { kind: "multiattack", name: "M", swings: [bite, bite] }])).toBe(14);
    expect(
      damagePerRound([
        {
          kind: "save",
          name: "Breath",
          dc: 13,
          ability: "dex",
          damage: { expr: "4d6" },
          onSuccess: "half",
          area: true,
          circle: 0,
        },
      ])
    ).toBe(21);
  });
});

describe("guessRole", () => {
  it("puts a striker that is legendary in solo, and a summoner under leader", () => {
    const dragon = guessRole(
      monster({
        cr: 10,
        hp: 200,
        ac: 18,
        actions: [{ kind: "weapon", name: "Bite", hitBonus: 10, damage: { expr: "16d10+6" } }],
        features: [
          { name: "Legendary Resistance (3/Day)", type: "trait", text: "If it fails a saving throw, it can succeed." },
        ],
      })
    );
    expect(dragon).toMatchObject({ role: "striker", subrole: "solo" });
    expect(dragon.tags).toContain("legendary");
    // Summoning picks the subrole; it is the "Shaman" in the name that makes it a leader.
    const caller = guessRole(
      monster({
        name: "Bone Shaman",
        features: [
          {
            name: "Call the Dead",
            type: "action",
            text: "The necromancer summons 1d4 zombies, which act as its allies.",
          },
        ],
      })
    );
    expect(caller).toMatchObject({ role: "leader", subrole: "summoner" });
  });

  it("takes a role its name says outright, surely", () => {
    const g = guessRole(monster({ name: "Worg Soldier" }));
    expect(g).toMatchObject({ role: "soldier", confidence: "high" });
  });

  it("reads a leader from helping allies, not from Pack Tactics", () => {
    const commander = guessRole(
      monster({
        features: [
          {
            name: "Tactical Commands",
            type: "bonus",
            text: "The leader shouts at up to two friendly creatures it can see. Each target gains 1d4 temporary HP.",
          },
          {
            name: "Rally",
            type: "action",
            text: "Each friendly creature within 30 feet has advantage on its next attack roll.",
          },
        ],
      })
    );
    expect(commander).toMatchObject({ role: "leader", subrole: "commander" });
    const wolf = guessRole(
      monster({
        cr: 0.25,
        hp: 11,
        ac: 13,
        features: [
          {
            name: "Pack Tactics",
            type: "trait",
            text: "The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally isn't incapacitated.",
          },
        ],
      })
    );
    expect(wolf.role).not.toBe("leader");
    expect(wolf.reasons.join(" ")).not.toMatch(/incapacitated/);
  });

  it("reads a controller from the conditions it deals, not those it is spared", () => {
    const gaze = guessRole(
      monster({
        features: [
          {
            name: "Petrifying Gaze",
            type: "action",
            text: "Each creature in a 30-foot cone must succeed on a DC 12 CON saving throw or be restrained, then petrified.",
          },
        ],
      })
    );
    expect(gaze).toMatchObject({ role: "controller", subrole: "disabler" });
    const brave = guessRole(
      monster({
        features: [
          { name: "Brave", type: "trait", text: "The creature is immune to the charmed and frightened conditions." },
        ],
      })
    );
    expect(brave.role).not.toBe("controller");
  });

  it("reads a striker from damage well above its CR and from hiding", () => {
    const g = guessRole(
      monster({
        hp: 28,
        ac: 12,
        speed: "40 ft.",
        actions: [{ kind: "weapon", name: "Rend", hitBonus: 5, damage: { expr: "4d8+4" } }],
        features: [
          {
            name: "Shadow Step",
            type: "bonus",
            text: "The creature teleports up to 30 feet to a space in dim light and takes the Hide action.",
          },
        ],
      })
    );
    expect(g).toMatchObject({ role: "striker", subrole: "ambusher" });
    expect(g.ratios.dpr).toBeGreaterThan(1.5);
  });

  it("reads a soldier from hit points and armour above its CR", () => {
    expect(guessRole(monster({ hp: 70, ac: 17 }))).toMatchObject({ role: "soldier", subrole: "brute" });
    expect(guessRole(monster({ cr: 0.25, hp: 11, ac: 12 }))).toMatchObject({
      role: "soldier",
      subrole: "rank-and-file",
    });
  });

  it("reads roles written loosely", () => {
    expect(parseRole("Strikers")).toBe("striker");
    expect(parseRole("brute")).toBeUndefined();
    expect(parseSubrole("Rank and file")).toBe("rank-and-file");
    expect(parseSubrole("ambushers")).toBe("ambusher");
    expect(roleOfSubrole("summoner")).toBe("leader");
  });
});

describe("equivalentsOf", () => {
  const base = (over: Partial<RoleProfile>): RoleProfile => ({
    note: "x",
    name: "X",
    cr: 1,
    role: "soldier",
    subrole: "guardian",
    tags: [],
    ratios: { hp: 1, dpr: 1 },
    ...over,
  });

  it("keeps the same role within the CR steps, the same subrole first, another family before the same one", () => {
    const target = base({ note: "wolf", name: "Wolf", family: "beasts" });
    const pool = [
      target,
      base({ note: "kin", name: "Jackal", family: "beasts" }),
      base({ note: "orc", name: "Orc", family: "humanoids" }),
      base({ note: "far", name: "Ogre", cr: 2, family: "giants" }),
      base({ note: "huge", name: "Giant", cr: 5 }),
      base({ note: "mage", name: "Mage", role: "controller", subrole: "hexer" }),
      base({ note: "brute", name: "Bruiser", subrole: "brute" }),
    ];
    const found = equivalentsOf(target, pool);
    expect(found.map((e) => e.name)).toEqual(["Orc", "Jackal", "Ogre", "Bruiser"]);
    expect(found.find((e) => e.name === "Ogre")?.crSteps).toBe(1);
    expect(equivalentsOf(target, pool, { maxSteps: 0 }).map((e) => e.name)).toEqual(["Orc", "Jackal", "Bruiser"]);
  });
});
