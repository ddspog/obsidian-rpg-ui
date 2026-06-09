import { describe, it, expect } from "vitest";
import {
  parseFormula,
  editableDice,
  editableTerms,
  setDiceValue,
  setTermRaw,
  diceSlots,
  diceSlotInitial,
  combineDiceSlots,
  termSlots,
  termSlotInitial,
  combineTermValue,
  resultReplacement,
} from "./formula";

describe("parseFormula", () => {
  it("parses a contest with check -> result and picks the higher winner", () => {
    const f = parseFormula("d10=8 vs CF 5 -> Expected Scene");
    expect(f).not.toBeNull();
    expect(f!.result).toBe("Expected Scene");
    expect(f!.check.kind).toBe("contest");
    if (f!.check.kind === "contest") {
      expect(f!.check.left).toMatchObject({ kind: "dice", sides: 10, value: 8 });
      expect(f!.check.right).toMatchObject({ kind: "threshold", label: "CF", value: 5 });
      expect(f!.check.winner).toBe("left"); // 8 > 5
    }
  });

  it("makes the threshold the winner when it is higher", () => {
    const f = parseFormula("d20+2=8 vs DC 15 -> Fail");
    if (f!.check.kind === "contest") {
      expect(f!.check.left).toMatchObject({ kind: "dice", sides: 20, modifier: "+2", value: 8 });
      expect(f!.check.winner).toBe("right"); // DC 15 > 8
    }
  });

  it("leaves winner null when a side is unrolled", () => {
    const f = parseFormula("d10= vs CF 5");
    if (f!.check.kind === "contest") {
      expect(f!.check.left).toMatchObject({ kind: "dice", sides: 10, value: null });
      expect(f!.check.winner).toBeNull();
    }
  });

  it("parses a single dice term with a result", () => {
    const f = parseFormula("d6=4 -> Heavy Rain");
    expect(f!.result).toBe("Heavy Rain");
    expect(f!.check.kind).toBe("single");
    if (f!.check.kind === "single") {
      expect(f!.check.term).toMatchObject({ kind: "dice", sides: 6, value: 4 });
    }
  });

  it("parses multi-dice with count and modifier", () => {
    const f = parseFormula("2d6+3=11");
    if (f!.check.kind === "single" && f!.check.term.kind === "dice") {
      expect(f!.check.term.count).toBe(2);
      expect(f!.check.term.sides).toBe(6);
      expect(f!.check.term.modifier).toBe("+3");
      expect(f!.check.term.value).toBe(11);
    }
    expect(f!.result).toBeNull();
  });

  it("returns null for plain prose without a dice/threshold token", () => {
    expect(parseFormula("Just a working note")).toBeNull();
    expect(parseFormula("the door opens -> they enter")).toBeNull();
    expect(parseFormula("")).toBeNull();
  });
});

describe("editableDice", () => {
  it("returns the single die of a contest", () => {
    const dice = editableDice(parseFormula("d10=8 vs CF 5 -> Expected Scene")!);
    expect(dice).toHaveLength(1);
    expect(dice[0]).toMatchObject({ sides: 10, raw: "d10=8" });
  });

  it("includes pools and percentile (every die is editable now)", () => {
    expect(editableDice(parseFormula("2d6+3=11")!)).toHaveLength(1);
    expect(editableDice(parseFormula("d100=42")!)).toHaveLength(1);
  });
});

describe("editableTerms (dice + thresholds)", () => {
  it("returns both the die and the CF/DC threshold of a contest", () => {
    const terms = editableTerms(parseFormula("d10=8 vs CF 5 -> Expected Scene")!);
    expect(terms.map((t) => t.kind)).toEqual(["dice", "threshold"]);
  });

  it("treats a threshold as one slot whose value passes through, swapping its raw", () => {
    const threshold = editableTerms(parseFormula("d20+2=8 vs DC 15 -> Fail")!).find((t) => t.kind === "threshold")!;
    expect(termSlots(threshold)).toBe(1);
    expect(termSlotInitial(threshold, 0)).toBe("15");
    expect(combineTermValue(threshold, ["10"])).toBe("10");
    expect(setTermRaw(threshold, "10")).toBe("DC 10");
  });
});

describe("diceSlots / diceSlotInitial", () => {
  it("exposes 1 slot for a single die, 2 for d100, N for a pool", () => {
    const single = editableDice(parseFormula("d10=8")!)[0];
    const d100 = editableDice(parseFormula("d100=42")!)[0];
    const pool = editableDice(parseFormula("3d6=11")!)[0];
    expect(diceSlots(single)).toBe(1);
    expect(diceSlots(d100)).toBe(2);
    expect(diceSlots(pool)).toBe(3);
  });

  it("decomposes a d100 total into tens/units and leaves pool slots blank", () => {
    const d100 = editableDice(parseFormula("d100=42")!)[0];
    expect(diceSlotInitial(d100, 0)).toBe("4");
    expect(diceSlotInitial(d100, 1)).toBe("2");
    const d100hundred = editableDice(parseFormula("d100=100")!)[0];
    expect([diceSlotInitial(d100hundred, 0), diceSlotInitial(d100hundred, 1)]).toEqual(["0", "0"]);
    const pool = editableDice(parseFormula("2d6+3=11")!)[0];
    expect(diceSlotInitial(pool, 0)).toBe("");
  });
});

describe("combineDiceSlots", () => {
  it("passes a single die value through", () => {
    const die = editableDice(parseFormula("d10=8")!)[0];
    expect(combineDiceSlots(die, ["9"])).toBe("9");
    expect(combineDiceSlots(die, [""])).toBe(""); // cleared → unrolled
  });

  it("joins d100 tens/units, treating 00 as 100", () => {
    const d100 = editableDice(parseFormula("d100=42")!)[0];
    expect(combineDiceSlots(d100, ["4", "2"])).toBe("42");
    expect(combineDiceSlots(d100, ["0", "7"])).toBe("7");
    expect(combineDiceSlots(d100, ["0", "0"])).toBe("100");
    expect(combineDiceSlots(d100, ["", ""])).toBe("");
  });

  it("sums a pool's dice plus its modifier, blank while untouched", () => {
    const pool = editableDice(parseFormula("2d6+3=11")!)[0];
    expect(combineDiceSlots(pool, ["4", "5"])).toBe("12");
    expect(combineDiceSlots(pool, ["", ""])).toBe("");
  });
});

describe("resultReplacement", () => {
  it("swaps the text after the arrow, anchored on the arrow", () => {
    expect(resultReplacement("d6=4 -> Heavy Rain", "Clear Skies")).toEqual({
      from: "-> Heavy Rain",
      to: "-> Clear Skies",
    });
  });

  it("handles the unicode arrow and a cleared result (bare arrow)", () => {
    expect(resultReplacement("d10=8 vs CF 5 → Expected Scene", "Twist")).toEqual({
      from: "→ Expected Scene",
      to: "→ Twist",
    });
    expect(resultReplacement("d6=4 -> Heavy Rain", "")).toEqual({ from: "-> Heavy Rain", to: "->" });
  });

  it("returns null when the line has no arrow", () => {
    expect(resultReplacement("d10= vs CF 5", "X")).toBeNull();
  });
});

describe("setDiceValue", () => {
  it("rewrites the value after `=`", () => {
    expect(setDiceValue("d10=8", "9")).toBe("d10=9");
    expect(setDiceValue("2d6+3=11", "12")).toBe("2d6+3=12");
  });

  it("fills an unrolled die and clears back to unrolled", () => {
    expect(setDiceValue("d10=", "7")).toBe("d10=7");
    expect(setDiceValue("d10=8", "")).toBe("d10=");
  });
});
