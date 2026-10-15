import { describe, it, expect } from "vitest";
import { appliedValue, bookkeeping, rowId, slotCircle, usesSpent, type PartySheet } from "./bookkeeping";

const talon: PartySheet = {
  name: "Talon",
  page: "Talon Pallton",
  sheet: { hp: { current: 10, max: 10 }, uses: {}, slots: {} },
  baseline: { hp: { current: 10, max: 10 }, uses: {}, slots: {} },
  uses: [{ key: "Ranger:Mystic Mark:bonus", name: "Mystic Mark", max: 2 }],
  casters: [],
};
const kowyn: PartySheet = {
  name: "Kowyn",
  page: "Kowyn",
  sheet: { hp: { current: 10, max: 10 }, uses: {}, slots: { Druid: { "1": 1 } } },
  baseline: { hp: { current: 10, max: 10 }, uses: {}, slots: { Druid: { "1": 1 } } },
  uses: [{ key: "Druid:Nature's Gift:bonus", name: "Nature's Gift", max: 2 }],
  casters: ["Druid"],
};
const end = (hp: Record<string, number>) => (name: string) =>
  hp[name] != null ? { current: hp[name], max: 10 } : undefined;

describe("bookkeeping", () => {
  it("lists what the log changed on each sheet, counted from where it began", () => {
    const rows = bookkeeping(
      [talon, kowyn],
      [
        { who: "Talon", resource: "Mystic Mark", change: -1 },
        { who: "Kowyn", resource: "1st-Circle Slot", change: -1 },
        { who: "Kowyn", resource: "Nature's Gift", change: -1 },
      ],
      end({ Talon: 6, Kowyn: 10 })
    );
    expect(rows.map((r) => [r.who, r.kind, r.label, r.sheet, r.target, r.ok])).toEqual([
      ["Talon", "hp", "HP", 10, 6, false],
      ["Talon", "uses", "Mystic Mark", 0, 1, false],
      ["Kowyn", "slot", "1st-Circle Slots", 1, 2, false],
      ["Kowyn", "uses", "Nature's Gift", 0, 1, false],
    ]);
  });

  it("is done once the sheet shows it — and doesn't count the log twice", () => {
    const applied = {
      ...talon,
      sheet: { hp: { current: 6, max: 10 }, uses: { "Ranger:Mystic Mark:bonus": 1 }, slots: {} },
    };
    const rows = bookkeeping([applied], [{ who: "Talon", resource: "Mystic Mark", change: -1 }], end({ Talon: 6 }));
    expect(rows.map((r) => [r.label, r.sheet, r.target, r.ok])).toEqual([
      ["HP", 6, 6, true],
      ["Mystic Mark", 1, 1, true],
    ]);
  });

  it("never spends past a feature's uses, and keeps what has no place on the sheet", () => {
    const rows = bookkeeping(
      [talon],
      [
        { who: "Talon", resource: "Mystic Mark", change: -5 },
        { who: "Talon", resource: "Torch", change: -1 },
      ],
      end({})
    );
    expect(rows.map((r) => [r.kind, r.label, r.target])).toEqual([
      ["uses", "Mystic Mark", 2],
      ["note", "Torch", 1],
    ]);
  });

  it("gives the cards their uses spent, as the log leaves them", () => {
    const rows = bookkeeping([talon], [{ who: "Talon", resource: "Mystic Mark", change: -1 }], end({}));
    expect(usesSpent(rows, [talon])).toEqual({ "Ranger:Mystic Mark:bonus": 1 });
  });

  it("writes its progress onto the sheet as it is now", () => {
    const [hp] = bookkeeping([talon], [], end({ Talon: 6 }));
    expect(appliedValue(hp)).toBe(6);
    // A later log healed Talon to 9 already: this one's −4 lands on that.
    expect(appliedValue({ ...hp, sheet: 9 })).toBe(5);
    expect(appliedValue({ ...hp, sheet: 2 })).toBe(0);
  });

  it("knows a change by who, what, and where the log leaves it", () => {
    const [hp] = bookkeeping([talon], [], end({ Talon: 6 }));
    expect(rowId(hp)).toBe(rowId({ ...hp, sheet: 9 }));
    expect(rowId(hp)).not.toBe(rowId({ ...hp, target: 5 }));
  });

  it("marks a dying PC's death saves for its sheet — and wipes them once it's back up", () => {
    const dying = () => ({ current: 0, max: 10, life: { state: "dying" as const, successes: 1, failures: 2 } });
    const rows = bookkeeping([talon], [], dying);
    expect(rows.filter((r) => r.kind === "saves").map((r) => [r.label, r.from, r.target, r.max])).toEqual([
      ["Death saves ✓", 0, 1, 3],
      ["Death saves ✗", 0, 2, 3],
    ]);
    const marked = { ...talon, baseline: { ...talon.baseline, deathSaves: { successes: 1, failures: 2 } } };
    const healed = bookkeeping([marked], [], () => ({ current: 4, max: 10 }));
    expect(healed.filter((r) => r.kind === "saves").map((r) => [r.key, r.target])).toEqual([
      ["successes", 0],
      ["failures", 0],
    ]);
  });

  it("adds a fight's XP share to the sheet's XP", () => {
    const withXp = { ...talon, sheet: { ...talon.sheet, xp: 88 }, baseline: { ...talon.baseline, xp: 88 } };
    const [xp] = bookkeeping([withXp], [{ who: "Talon", resource: "XP", change: 87 }], end({}));
    expect([xp.kind, xp.label, xp.from, xp.target, xp.ok]).toEqual(["xp", "XP", 88, 175, false]);
  });

  it("moves the sheet's counts — hit dice, Luck, coins — by the log's ±n", () => {
    const counted = {
      ...talon,
      sheet: { ...talon.sheet, counters: { "Hit Dice": 1, Luck: 0, GP: 10 } },
      baseline: { ...talon.baseline, counters: { "Hit Dice": 1, Luck: 0, GP: 10 } },
    };
    const rows = bookkeeping(
      [counted],
      [
        { who: "Talon", resource: "Hit Dice", change: -1 },
        { who: "Talon", resource: "Luck", change: 1 },
        { who: "Talon", resource: "GP", change: 15 },
      ],
      end({})
    );
    expect(rows.map((r) => [r.kind, r.label, r.from, r.target])).toEqual([
      ["counter", "Hit Dice", 1, 0],
      ["counter", "Luck", 0, 1],
      ["counter", "GP", 10, 25],
    ]);
  });

  it("reads a slot's circle", () => {
    expect([slotCircle("1st-Circle Slot"), slotCircle("3rd-circle slots"), slotCircle("Mystic Mark")]).toEqual([
      1,
      3,
      undefined,
    ]);
  });
});

describe("bookkeeping's spends, counted against their most", () => {
  it("knows each slot's most, and flags spending past what the sheet had", () => {
    const withMax = { ...kowyn, slotMax: { Druid: [2, 0] }, counterMax: { "Hit Dice": 1 } };
    withMax.baseline = { ...withMax.baseline, counters: { "Hit Dice": 0 } };
    const rows = bookkeeping(
      [withMax],
      [
        { who: "Kowyn", resource: "1st-Circle Slot", change: -1 },
        { who: "Kowyn", resource: "Hit Dice", change: -1 },
      ],
      () => undefined
    );
    expect(rows.find((r) => r.kind === "slot")).toMatchObject({ from: 1, target: 2, max: 2, spends: true });
    expect(rows.find((r) => r.kind === "counter")).toMatchObject({ from: 0, target: 0, max: 1, short: 1 });
  });
});
