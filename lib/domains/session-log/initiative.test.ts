import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { applyInitiative, combatantKey, foldInitiative, sortOrder } from "./initiative";

const fold = (lines: string[]) => {
  const segs = groupIntoProse(parseLonelog(lines.join("\n")));
  const at = foldInitiative(segs);
  return segs.map((s) => ({ type: s.type, ...at.get(s.sourceIndex)! }));
};

describe("initiative order", () => {
  it("sorts highest first, keeping written order for ties and unvalued names", () => {
    const order = sortOrder([
      { name: "A", value: 12 },
      { name: "B" },
      { name: "C", value: 17 },
      { name: "D", value: 12 },
    ]);
    expect(order.map((e) => e.name)).toEqual(["C", "A", "D", "B"]);
  });

  it("adds into place and removes by displayed name", () => {
    let order = applyInitiative([], {
      kind: "initiative",
      op: "set",
      entries: [
        { name: "Talon", value: 17 },
        { name: "Lilith", value: 9 },
      ],
    });
    order = applyInitiative(order, { kind: "initiative", op: "add", entries: [{ name: "Archer", value: 14 }] });
    expect(order.map((e) => e.name)).toEqual(["Talon", "Archer", "Lilith"]);
    order = applyInitiative(order, { kind: "initiative", op: "remove", entries: [{ name: "talon" }] });
    expect(order.map((e) => e.name)).toEqual(["Archer", "Lilith"]);
  });

  it("keys combatants by their shown name, so two links to one note stay two", () => {
    expect(combatantKey("Fat [[Kobold, A]]")).not.toBe(combatantKey("Think [[Kobold, A]]"));
    expect(combatantKey("[[Kobold, Elite]]")).toBe("kobold, elite");
  });
});

describe("foldInitiative — turns within a round", () => {
  const combat = [
    "[COMBAT]",
    "[Init: Talon 17; [[Kobold, Elite]] 12; Lilith 9]",
    "R1",
    "@(Talon) Shoot",
    "@(Lilith) Charge",
    "@(Kobold, Elite) Slash",
    "R2",
    "@(Talon) Shoot again",
    "[/COMBAT]",
    "@(Lilith) Rest",
  ];

  it("flags an actor who acts after someone later in the order", () => {
    const actions = fold(combat).filter((s) => s.type === "action-group");
    expect(actions.map((a) => !!a.outOfTurn)).toEqual([false, false, true, false, false]);
  });

  it("starts each round over, and stops tracking after [/COMBAT]", () => {
    const actions = fold(combat).filter((s) => s.type === "action-group");
    expect(actions.map((a) => a.round)).toEqual([1, 1, 1, 2, 0]);
    expect(actions[4].order).toEqual([]);
  });
});

describe("foldInitiative — order registered before the fight", () => {
  const log = [
    "? Combat begins with no one surprised.",
    "[Init: Talon 17; [[Kobold, Elite]] 12; Lilith 9]",
    "@(Lilith) I talk to the kobold first",
    "@(Talon) I nock an arrow",
    "[COMBAT]",
    "R1",
    "@(Talon) Shoot",
    "@(Kobold, Elite) Slash",
    "@(Lilith) Charge",
    "[/COMBAT]",
  ];

  it("carries the order into [COMBAT] without checking turns before it", () => {
    const actions = fold(log).filter((s) => s.type === "action-group");
    expect(actions.map((a) => a.order.length)).toEqual([3, 3, 3, 3, 3]);
    expect(actions.map((a) => !!a.outOfTurn)).toEqual([false, false, false, false, false]);
  });

  it("starts tracking at the first R# when no [COMBAT] is written", () => {
    const actions = fold(["[Init: Talon 17; Lilith 9]", "R1", "@(Lilith) Charge", "@(Talon) Shoot"]).filter(
      (s) => s.type === "action-group"
    );
    expect(actions.map((a) => !!a.outOfTurn)).toEqual([false, true]);
  });
});

describe("turn order, once rounds are marked", () => {
  it("takes no turn for a reaction made in someone else's round", () => {
    const segs = groupIntoProse(
      parseLonelog(
        [
          "[Init: Kobold 20; Talon 14; Lilith 2]",
          "[COMBAT]",
          "T1",
          "R(Kobold)",
          "@(Kobold) Moves",
          "@(Lilith) Opportunity Attack",
          "R(Talon)",
          "@(Talon) Longbow → Kobold",
        ].join("\n")
      )
    );
    const at = foldInitiative(segs);
    expect([...at.values()].some((a) => a.outOfTurn)).toBe(false);
  });
});
