import { describe, it, expect } from "vitest";
import {
  endSession,
  groupCheck,
  longRest,
  loot,
  lootPaths,
  luck,
  shop,
  shortRest,
  travel,
  weather,
  type PartyMember,
} from "./party-cards";

const kowyn: PartyMember = {
  name: "Kowyn",
  hp: { current: 1, max: 10 },
  con: 2,
  hitDice: [{ die: "d8", left: 1, max: 1 }],
  uses: [
    { name: "Nature's Gift", spent: 1, max: 2, recovery: "on long rest" },
    { name: "Wild Shape", spent: 1, max: 2, recovery: "on short rest" },
  ],
  slots: [{ circle: 1, spent: 2 }],
  exhaustion: 1,
};
const talon: PartyMember = {
  name: "Talon",
  hp: { current: 5, max: 10 },
  con: 0,
  hitDice: [{ die: "d10", left: 0, max: 1 }],
  uses: [],
  slots: [],
};

describe("shortRest", () => {
  it("rolls each hit die spent + CON, spends them, and brings back what recharges on a short rest", () => {
    expect(shortRest([{ member: kowyn, dice: { d8: 1 } }]).split("\n")).toEqual([
      "@(Party) Short rest",
      "@(Kowyn) Spends a hit die",
      "d: Healing | 1d8+2=",
      "=> {{outcome?}} [Kowyn/Hit Dice-1] [Kowyn/Wild Shape+1] [Time: +1h]",
    ]);
  });
});

describe("longRest", () => {
  it("gives each back their HP, half their hit dice, long-rest uses and slots — and a level of exhaustion", () => {
    const { text, skipped } = longRest([kowyn, talon]);
    expect(text.split("\n")).toEqual([
      "@(Party) Long rest",
      "=> {{outcome?}} [PC:Kowyn|HP 10] [Kowyn/Nature's Gift+1] [Kowyn/Wild Shape+1] [Kowyn/1st-Circle Slot+2] [Kowyn/Exhaustion-1] [PC:Talon|HP 10] [Talon/Hit Dice+1] [Time: +8h]",
    ]);
    expect(skipped).toEqual([]);
  });

  it("gives nothing to whoever's at 0 HP, nor to anyone when it's interrupted", () => {
    expect(longRest([{ ...talon, hp: { current: 0, max: 10 } }]).skipped).toEqual([
      { name: "Talon", why: "at 0 HP — a long rest needs at least 1" },
    ]);
    expect(longRest([kowyn], { interrupted: true }).text).toContain("Interrupted — no benefit");
  });
});

describe("loot", () => {
  it("puts each thing in its own place — a found Pouch filled, then carried on — and splits the coins", () => {
    const rows = [
      { name: "Arrows", link: true, qty: 1 },
      { name: "Pouch", link: true, qty: 1 },
      { name: "Sling bullets", link: true, qty: 15 },
      { name: "Dagger", link: true, qty: 1 },
    ];
    const paths = lootPaths(rows, [
      { to: "dest", path: ["Talon"] },
      { to: "dest", path: ["Kowyn's Bag"] },
      { to: "found", row: 1 },
      undefined,
    ]);
    expect(paths).toEqual([["Talon"], ["Kowyn's Bag"], ["Kowyn's Bag", "[[Pouch]]"], undefined]);
    expect(
      loot({
        items: rows.map((r, i) => ({ ...r, ...(paths[i] ? { path: paths[i] } : {}) })),
        coins: { gp: 20 },
        split: ["Talon", "Kowyn"],
      }).split("\n")
    ).toEqual([
      "@(Party) Loots the fallen",
      "=> {{outcome?}} [Inv:Talon/[[Arrows]]+1] [Inv:Kowyn's Bag/[[Pouch]]+1] [Inv:Kowyn's Bag/[[Pouch]]/[[Sling bullets]]+15] [Talon/GP+10] [Kowyn/GP+10]",
    ]);
  });

  it("goes nowhere into a container left behind, or into itself", () => {
    const rows = [
      { name: "Pouch", qty: 1 },
      { name: "Gem", qty: 1 },
    ];
    expect(lootPaths(rows, [undefined, { to: "found", row: 0 }])).toEqual([undefined, undefined]);
    expect(
      lootPaths(rows, [
        { to: "found", row: 1 },
        { to: "found", row: 0 },
      ])
    ).toEqual([undefined, undefined]);
  });
});

describe("travel", () => {
  it("writes a stage: where, how far, its time — and each role's check", () => {
    expect(
      travel({
        destination: "Wisdom's Path",
        miles: 12,
        terrain: "forest",
        pace: "normal",
        dc: 14,
        roles: [
          { role: "Outrider", who: "Talon", skill: "Survival" },
          { role: "Sentry", who: "Kowyn", skill: "Perception" },
        ],
        encounterUnder: 25,
      }).split("\n")
    ).toEqual([
      "@(Party) Travels to Wisdom's Path — 12 miles, forest, normal pace",
      "d(Talon): Outrider | d20+[[Survival]]= vs DC 14 ->",
      "d(Kowyn): Sentry | d20+[[Perception]]= vs DC 14 ->",
      "d: Encounter (under 25) | d100=",
      "=> {{outcome?}} [Time: +4h]",
    ]);
  });
});

describe("the small party cards", () => {
  it("sets the weather, rolls a group check, hands out Luck", () => {
    expect(weather({ season: "Autumn", temperature: "warm", wind: "calm", sky: "clear" })).toBe(
      "=> {{outcome?}} [Weather: Autumn · warm · calm · clear]"
    );
    expect(
      groupCheck({ what: "Sneak past the camp", skill: "Stealth", dc: 12, members: ["Talon", "Lilith"] }).split("\n")[2]
    ).toBe("d(Lilith): Stealth | d20+[[Stealth]]= vs DC 12 ->");
    expect(luck({ members: ["Talon", "Kowyn"], why: "Survived the ambush" })).toBe(
      "@(Party) Earns Luck\n=> Survived the ambush [Talon/Luck+1] [Kowyn/Luck+1]"
    );
  });

  it("trades — items in and out, coins the other way", () => {
    expect(
      shop({
        who: "Talon",
        at: "the market",
        rows: [
          { item: "Rope", link: true, qty: 1, price: 1 },
          { item: "Dagger", link: true, qty: 1, price: 1, sell: true },
          { item: "Torch", qty: 2, price: 0.01 },
        ],
      }).split("\n")[1]
    ).toBe("=> {{outcome?}} [Inv:Talon/[[Rope]]+1] [Inv:Talon/[[Dagger]]-1] [Inv:Talon/Torch+2] [Talon/CP-2]");
  });

  it("buys ammunition by the bundle, writing its pieces", () => {
    expect(
      shop({ who: "Talon", rows: [{ item: "Arrows", link: true, qty: 2, price: 1, bundle: 20 }] }).split("\n")[1]
    ).toBe("=> {{outcome?}} [Inv:Talon/[[Arrows]]+40] [Talon/GP-2]");
  });

  it("adds up mixed coins", () => {
    expect(shop({ who: "Talon", rows: [{ item: "Lantern", qty: 1, price: 5.25 }] }).split("\n")[1]).toBe(
      "=> {{outcome?}} [Inv:Talon/Lantern+1] [Talon/GP-5] [Talon/SP-2] [Talon/CP-5]"
    );
  });

  it("ends the session with its XP for each", () => {
    expect(endSession({ members: ["Talon", "Kowyn"], xp: 50, why: "Reached the hut" })).toBe(
      "@(Party) Ends the session\n=> Reached the hut [Talon/XP+50] [Kowyn/XP+50]"
    );
  });
});
