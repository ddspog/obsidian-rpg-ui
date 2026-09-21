import { describe, it, expect } from "vitest";
import {
  parseFormula,
  parseFormulaLine,
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
  clampDieValue,
  clampDiceList,
  contestWinner,
  liveTermValue,
  rollDiceTerm,
  rollDiceFaces,
  rollDie,
  resolvePool,
  recordedGroups,
  recordedText,
  generatesDice,
  formatDiceValue,
  parseDiceValue,
  countedDice,
  describeSelector,
  readDiceValue,
  diceMax,
  rolledValue,
  sumTotal,
  type DiceTerm,
  type EditableTerm,
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
  it("exposes exactly one slot for every die", () => {
    const single = editableDice(parseFormula("d10=8")!)[0];
    const d100 = editableDice(parseFormula("d100=42")!)[0];
    const pool = editableDice(parseFormula("3d6=11")!)[0];
    expect(diceSlots(single)).toBe(1);
    expect(diceSlots(pool)).toBe(1); // one slot holding the whole list
    expect(diceSlots(d100)).toBe(1); // NOT a tens/units pair
  });

  it("gives a d100 its whole number, not a digit of it", () => {
    // Splitting it across two slots showed "4" for a 42, and writing back combined
    // the typed 42 with the stale units digit into 422.
    const d100 = editableDice(parseFormula("d100=42")!)[0];
    expect(diceSlotInitial(d100, 0)).toBe("42");
    expect(combineDiceSlots(d100, ["42"])).toBe("42");
    expect(setTermRaw(d100, combineDiceSlots(d100, ["42"]))).toBe("d100=42");
  });

  it("gives a pool's slot its recorded list, so a roll round-trips", () => {
    const pool = editableDice(parseFormula("2d6=[4,3]")!)[0];
    expect(diceSlotInitial(pool, 0)).toBe("[4,3]");
    // A pool recorded as a bare total (older logs) keeps that total.
    const legacy = editableDice(parseFormula("2d6+3=11")!)[0];
    expect(diceSlotInitial(legacy, 0)).toBe("11");
  });
});

describe("combineDiceSlots", () => {
  it("passes a single die value through", () => {
    const die = editableDice(parseFormula("d10=8")!)[0];
    expect(combineDiceSlots(die, ["9"])).toBe("9");
    expect(combineDiceSlots(die, [""])).toBe(""); // cleared → unrolled
  });

  it("passes a d100 value straight through", () => {
    const d100 = editableDice(parseFormula("d100=42")!)[0];
    expect(combineDiceSlots(d100, ["7"])).toBe("7");
    expect(combineDiceSlots(d100, ["100"])).toBe("100");
    expect(combineDiceSlots(d100, [""])).toBe("");
  });

  it("passes a pool's recorded list through unchanged", () => {
    const pool = editableDice(parseFormula("2d6=[4,3]")!)[0];
    expect(combineDiceSlots(pool, ["[5,2]"])).toBe("[5,2]");
    expect(combineDiceSlots(pool, [""])).toBe("");
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

describe("clampDieValue", () => {
  it("keeps a valid face as-is", () => {
    expect(clampDieValue("3", 4)).toBe("3");
    expect(clampDieValue("10", 10)).toBe("10");
  });

  it("clamps above the die's maximum", () => {
    expect(clampDieValue("7", 4)).toBe("4");
    expect(clampDieValue("99", 10)).toBe("10");
    // Typing "1" then "0" on a d4 lands on 4, not a stuck 1.
    expect(clampDieValue("10", 4)).toBe("4");
  });

  it("clamps below 1 — a die has no zero face", () => {
    expect(clampDieValue("0", 6)).toBe("1");
  });

  it("strips non-digits and leading zeros", () => {
    expect(clampDieValue("4a", 6)).toBe("4");
    expect(clampDieValue("007", 10)).toBe("7");
  });

  it("preserves empty so a die can be cleared back to unrolled", () => {
    expect(clampDieValue("", 10)).toBe("");
    expect(clampDieValue("abc", 10)).toBe("");
  });
});

describe("parseFormula — selectors and special dice", () => {
  const dieOf = (t: string) => {
    const f = parseFormula(t)!;
    return f.check.kind === "single" && f.check.term.kind === "dice" ? f.check.term : null;
  };

  it("keeps exploding and reroll selectors on the die", () => {
    expect(dieOf("3d8!=19")).toMatchObject({ count: 3, sides: 8, selector: "!", value: 19 });
    expect(dieOf("2d6!p=11")).toMatchObject({ selector: "!p" });
    expect(dieOf("4d6ro1=17")).toMatchObject({ selector: "ro1" });
  });

  it("keeps keep/drop selectors", () => {
    expect(dieOf("2d20kh1=19")).toMatchObject({ selector: "kh1", value: 19 });
    expect(dieOf("2d20kl1=6")).toMatchObject({ selector: "kl1" });
    expect(dieOf("4d6dl1=13")).toMatchObject({ selector: "dl1" });
    expect(dieOf("4d6dh1=9")).toMatchObject({ selector: "dh1" });
  });

  it("accepts a selector followed by a numeric modifier", () => {
    expect(dieOf("4d6dl1+2=15")).toMatchObject({ selector: "dl1", modifier: "+2", value: 15 });
  });

  it("maps special dice to a shape while keeping the authored spec", () => {
    // `sides` drives the silhouette; `spec` is what the author wrote.
    expect(dieOf("d%=45")).toMatchObject({ sides: 100, spec: "d%", value: 45 });
    expect(dieOf("dF=1")).toMatchObject({ sides: 6, spec: "dF" });
    expect(dieOf("4dF.2=2")).toMatchObject({ sides: 6, spec: "4dF.2", count: 4 });
  });

  it("leaves a plain die untouched", () => {
    expect(dieOf("d20+5=18")).toMatchObject({ sides: 20, selector: "", modifier: "+5", value: 18 });
  });
});

describe("parseFormula — several dice summed", () => {
  const sumOf = (t: string) => {
    const f = parseFormula(t)!;
    return f.check.kind === "sum" ? f.check : null;
  };

  it("splits mixed dice into addends, with the total on the sum", () => {
    const sum = sumOf("d8+d6+2=13")!;
    expect(sum.total).toBe(13);
    expect(sum.parts.map((p) => p.op)).toEqual([null, "+", "+"]);
    expect(
      sum.parts.map((p) => (p.term.kind === "dice" ? p.term.spec : p.term.kind === "text" ? p.term.text : "?"))
    ).toEqual(["d8", "d6", "2"]);
  });

  it("handles counted dice and repeated dice", () => {
    expect(sumOf("2d6+1d4+3=14")!.parts).toHaveLength(3);
    expect(sumOf("d4+d4=6")!.parts).toHaveLength(2);
  });

  it("exposes every die of a sum as editable", () => {
    expect(editableDice(parseFormula("d8+d6+2=13")!).map((d) => d.spec)).toEqual(["d8", "d6"]);
  });

  it("does NOT treat one die plus a modifier as a sum", () => {
    // `d20+5` is a single die with a modifier; only 2+ dice make a sum.
    expect(parseFormula("d20+5=18")!.check.kind).toBe("single");
    expect(parseFormula("2d6+3=11")!.check.kind).toBe("single");
  });
});

describe("rollDiceTerm", () => {
  const die = (spec: string) => {
    const f = parseFormula(`${spec}=`)!;
    return f.check.kind === "single" && f.check.term.kind === "dice" ? f.check.term : null;
  };

  it("rolls one die within 1..sides", () => {
    const d8 = die("d8")!;
    expect(rollDiceTerm(d8, () => 0)).toBe(1); // lowest face
    expect(rollDiceTerm(d8, () => 0.999)).toBe(8); // highest face
  });

  it("sums a pool — `3d8` rolls three dice", () => {
    const pool = die("3d8")!;
    expect(rollDiceTerm(pool, () => 0)).toBe(3); // 1+1+1
    expect(rollDiceTerm(pool, () => 0.999)).toBe(24); // 8+8+8
  });

  it("rolls percentile across 1..100", () => {
    expect(rollDiceTerm(die("d%")!, () => 0.999)).toBe(100);
  });
});

describe("sumTotal", () => {
  const parts = (t: string) => {
    const f = parseFormula(t)!;
    return f.check.kind === "sum" ? f.check.parts : [];
  };

  it("adds each die's own recorded result plus the constants", () => {
    expect(sumTotal(parts("d8=5 + d6=3 + 2 = 10"))).toBe(10);
  });

  it("subtracts a negated addend", () => {
    expect(sumTotal(parts("d8=5 - d6=2 = 3"))).toBe(3);
  });

  it("treats an unrolled die as zero, so a partial sum still computes", () => {
    expect(sumTotal(parts("d8=5 + d6 + 2 = 7"))).toBe(7);
  });
});

describe("per-die results inside a sum", () => {
  const sum = (t: string) => {
    const f = parseFormula(t)!;
    return f.check.kind === "sum" ? f.check : null;
  };

  it("records a value on each die, and the total after the LAST `=`", () => {
    const s = sum("d8=5 + d6=3 + 2 = 10")!;
    expect(s.parts.map((p) => (p.term.kind === "dice" ? p.term.value : null))).toEqual([5, 3, null]);
    expect(s.total).toBe(10);
  });

  it("keeps `raw` carrying the `=value`, so a write-back can swap it", () => {
    const s = sum("d8=5 + d6=3 = 8")!;
    const first = s.parts[0].term;
    expect(first.kind === "dice" && first.raw).toBe("d8=5");
  });

  it("still parses a sum with no results yet", () => {
    const s = sum("d8+d6+2=")!;
    expect(s.total).toBeNull();
    expect(s.parts.every((p) => p.term.kind !== "dice" || p.term.value == null)).toBe(true);
  });
});

describe("a party roll: several checks on one line", () => {
  const line = (text: string) => parseFormulaLine(text);

  it("splits on `;`, one labelled check per character", () => {
    const fs = line("Talon | d20+5=18; Kowyn | d20+3=12; Lilith | d20+7=21")!;
    expect(fs.map((f) => f.label)).toEqual(["Talon", "Kowyn", "Lilith"]);
    expect(fs.every((f) => f.check.kind === "single")).toBe(true);
  });

  it("keeps a comma'd name whole, which is why `;` separates", () => {
    const fs = line("Loki, the old God | d20+2=15; Brian | d20=9")!;
    expect(fs.map((f) => f.label)).toEqual(["Loki, the old God", "Brian"]);
  });

  it("reads the older trailing-label form, total and all", () => {
    // `4d6dl1 // STR=14` — the name after the dice, the total past the name.
    const fs = line("4d6dl1 // STR=14, 4d6dl1 // DEX=12")!;
    expect(fs.map((f) => f.label)).toEqual(["STR", "DEX"]);
    expect(fs[0].check.kind).toBe("single");
  });

  it("gives one check back as one, unchanged", () => {
    const fs = line("Stealth | d20+5=18 vs DC 14 -> success")!;
    expect(fs).toHaveLength(1);
    expect(fs[0].result).toBe("success");
  });

  it("is prose unless EVERY part is a formula", () => {
    // Half a line of rolls and half prose is prose: rendering the readable half
    // would quietly drop the rest.
    expect(line("Three checks, one entry.")).toBeNull();
    expect(line("Talon | d20+5=18; and then everyone waited")).toBeNull();
    expect(line("")).toBeNull();
  });
});

describe("labels reach the renderer", () => {
  it("takes the check's name from before the pipe", () => {
    const f = parseFormula("Stealth | d20+5=18 vs DC 14 -> success")!;
    expect(f.label).toBe("Stealth");
    expect(f.check.kind).toBe("contest"); // the formula parses as if unlabelled
    expect(f.result).toBe("success");
    // Anything but a pipe belongs in a name.
    expect(parseFormula("Thieves' Tools | d20+0=8 vs DC 15 -> fail")!.label).toBe("Thieves' Tools");
    // Written the way the current grammar takes a modifier; the new form
    // (`d20=9 + 2 =`) is covered in expression.test.ts, which can parse it.
    expect(parseFormula("Loki, the old God | d20+2=15")!.label).toBe("Loki, the old God");
  });

  it("binds a die's name to that die, inside a labelled check", () => {
    const f = parseFormula("Sneak Attack | d8=6 + sneak:2d6=[4,3] + 3 =")!;
    expect(f.label).toBe("Sneak Attack");
    const parts = (f.check as Extract<typeof f.check, { kind: "sum" }>).parts;
    expect(parts.map((p) => p.label)).toEqual([undefined, "sneak", undefined]);
    // The die itself is untouched by its name: the value still reads through it.
    const sneak = parts[1].term as DiceTerm;
    expect(sneak.spec).toBe("2d6");
    expect(sneak.value).toBe(7);
  });

  it("leaves an unlabelled roll unlabelled", () => {
    expect(parseFormula("4d6dl1=[5,2,6,4]")!.label).toBeUndefined();
    expect(parseFormula("d20+5=18")!.label).toBeUndefined();
  });

  it("keeps a pipe inside a result out of the label", () => {
    // Only a pipe before the arrow names the check.
    const f = parseFormula("d20=17 -> a | b")!;
    expect(f.label).toBeUndefined();
    expect(f.result).toBe("a | b");
  });

  it("names a lone die from its own colon", () => {
    // With nothing else on the line the two labels land in the same place.
    expect(parseFormula("sneak:2d6=[4,3]")!.label).toBe("sneak");
  });
});

describe("a total follows the dice the interface has, not the file", () => {
  const die = (text: string) => editableDice(parseFormula(text)!)[0];

  it("sums the pending rolls, not the values on disk", () => {
    // The bug: chips showed the roll just made while the total still showed the
    // one before it, because the parts were summed as parsed.
    const f = parseFormula("d8+d6+2=13")!;
    const parts = (f.check as Extract<typeof f.check, { kind: "sum" }>).parts;
    expect(sumTotal(parts)).toBe(2); // nothing rolled: only the constant
    // Now the reader rolls a 2 and a 1, which live as pending edits.
    const pending: Record<string, string> = { d8: "2", d6: "1" };
    const valueOf = (t: DiceTerm) => liveTermValue(t, () => pending[t.spec]);
    expect(sumTotal(parts, valueOf)).toBe(5);
  });

  it("moves a contest's emphasis to whichever side now leads", () => {
    const f = parseFormula("d20=8 vs CF 5 -> Expected Scene")!;
    const check = f.check as Extract<typeof f.check, { kind: "contest" }>;
    expect(check.winner).toBe("left");
    // Rerolled to a 3: the threshold now leads.
    const valueFor = (t: EditableTerm) => (t.kind === "dice" ? "3" : String(t.value));
    expect(contestWinner(check.left, check.right, valueFor)).toBe("right");
    // A tie has no winner, so neither side is emphasised.
    const tie = (t: EditableTerm) => (t.kind === "dice" ? "5" : String(t.value));
    expect(contestWinner(check.left, check.right, tie)).toBeNull();
  });

  it("reads a pending value through the die's selector", () => {
    // A pending `[19,4]` on an advantage die is 19, not 23.
    const adv = die("2d20kh1=[3,2]");
    expect(liveTermValue(adv, () => "[19,4]")).toBe(19);
  });
});

describe("<special>: which dice count, and how they read", () => {
  const die = (text: string) => editableDice(parseFormula(text)!)[0];

  it("takes advantage rather than adding the dice", () => {
    // The bug this covers: the recorded text was summed with no regard for the
    // selector, so advantage on [19,4] read 23 — a number no d20 pair can produce.
    const adv = die("2d20kh1=[19,4]");
    expect(adv.value).toBe(19);
    expect(readDiceValue(adv, "[19,4]").value).toBe(19);
    expect(die("2d20kl1=[7,20]").value).toBe(7); // disadvantage
  });

  it("removes the dice that miss a threshold", () => {
    // `drop<3` throws the failing dice away — it does not count them as 3s.
    expect(countedDice([1, 5, 2, 6], "drop<3")).toEqual([5, 6]);
    expect(countedDice([1, 5, 2, 6], "drop>4")).toEqual([1, 2]);
    // The non-strict forms include the bar in what goes.
    expect(countedDice([1, 5, 2, 6], "drop<=2")).toEqual([5, 6]);
    expect(countedDice([1, 5, 2, 6], "drop>=5")).toEqual([1, 2]);
    // Nothing meeting the bar is a legitimate zero, not a missing value.
    expect(countedDice([1, 2], "drop<3")).toEqual([]);
    expect(editableDice(parseFormula("2d6drop<3=[1,2]")!)[0].value).toBe(0);
  });

  it("clamps with floor / cap, removing nothing", () => {
    // The other half of the pair: the die still counts, at the bar.
    expect(countedDice([1, 5, 2], "floor3")).toEqual([3, 5, 3]);
    expect(countedDice([1, 5, 6], "cap4")).toEqual([1, 4, 4]);
    expect(countedDice([1, 5, 2, 6], "floor3").length).toBe(4);
  });

  it("applies a combined selector in order", () => {
    // Drop the lowest of four by position, then floor what is left by value.
    expect(countedDice([1, 2, 5, 6], "dl1floor3")).toEqual([3, 5, 6]);
    // Filter first, then clamp what survived.
    expect(countedDice([1, 2, 5, 6], "drop<2cap5")).toEqual([2, 5, 5]);
  });

  it("leaves dice alone for selectors that describe how they were obtained", () => {
    // The list already holds whatever exploding or rerolling produced.
    expect(countedDice([8, 5, 6], "!")).toEqual([8, 5, 6]);
    expect(countedDice([4, 3], "ro1")).toEqual([4, 3]);
    expect(countedDice([4, 3], "sa")).toEqual([4, 3]);
  });

  it("puts the threshold in the collapsed mark, where the rule turns on it", () => {
    const notes = (text: string) => describeSelector(editableDice(parseFormula(text)!)[0]);
    // A bare `≥` cannot be checked against the dice: 17 from a list summing to 14
    // only makes sense once the floor of 3 is visible.
    expect(notes("4d6drop<3=[1,5,2,6]")[0].mark).toBe("▽<3");
    expect(notes("4d6drop>4=[1,5,2,6]")[0].mark).toBe("▽>4");
    expect(notes("4d6drop<=2=[1,5,2,6]")[0].mark).toBe("▽≤2");
    expect(notes("4d6floor3=[1,5,2,6]")[0].mark).toBe("⌊3");
    expect(notes("4d6cap4=[1,5,2,6]")[0].mark).toBe("⌈4");
    expect(notes("4d6ro2=[1,5,2,6]")[0].mark).toBe("↻2");
    // Keeping or dropping ONE is the usual case, so the count is left off there…
    expect(notes("4d6dl1=[4,3,6,2]")[0].mark).toBe("▽");
    expect(notes("2d20kh1=[19,4]")[0].mark).toBe("▲");
    // …and shown when it is not.
    expect(notes("4d6dl2=[4,3,6,2]")[0].mark).toBe("▽2");
    expect(notes("4d6kh2=[4,3,6,2]")[0].mark).toBe("▲2");
    // The expanded pill pairs the bare glyph with the words, so it never doubles up.
    expect(notes("4d6floor3=[1,5,2,6]").map((s) => [s.symbol, s.label])).toEqual([["⌊", "floor 3"]]);
  });

  it("tells a threshold FILTER apart from a clamp, on the same dice", () => {
    // Same dice, same number: one removes, the other counts at the bar.
    const filtered = editableDice(parseFormula("4d6drop<3=[1,5,2,6]")!)[0];
    const clamped = editableDice(parseFormula("4d6floor3=[1,5,2,6]")!)[0];
    expect(filtered.value).toBe(11); // 5 + 6, the 1 and 2 thrown away
    expect(clamped.value).toBe(17); // 3 + 5 + 3 + 6, nothing thrown away
    expect(describeSelector(filtered)[0].mark).toBe("▽<3");
    expect(describeSelector(clamped)[0].mark).toBe("⌊3");
  });

  it("names each special for the reader, in the order written", () => {
    const notes = (text: string) => describeSelector(editableDice(parseFormula(text)!)[0]);
    expect(notes("2d20kh1=[19,4]").map((s) => [s.symbol, s.label])).toEqual([["▲", "adv"]]);
    expect(notes("2d20kl1=[19,4]")[0].label).toBe("dis");
    expect(notes("4d6dl1=[4,3,6,2]").map((s) => [s.symbol, s.label])).toEqual([["▽", "drop 1 lo"]]);
    expect(notes("3d8!=[8,5,6]")[0].label).toBe("explodes");
    expect(notes("2d6!p=[6,5]")[0].label).toBe("explodes once");
    expect(notes("4d6ro1=[4,3,6,2]")[0].label).toBe("reroll ≤1");
    expect(notes("4d6dl1floor3=[4,3,6,2]").map((s) => s.label)).toEqual(["drop 1 lo", "floor 3"]);
    expect(notes("d20=8")).toEqual([]);
  });

  it("calls it advantage for any number of d20s, not just two", () => {
    const notes = (text: string) => describeSelector(editableDice(parseFormula(text)!)[0]);
    // A feature that grants a third die is still advantage.
    expect(notes("3d20kh1=[19,4,11]")[0].label).toBe("adv");
    expect(notes("3d20kh1=[19,4,11]")[0].description).toBe("advantage — the highest of 3 dice");
    expect(notes("2d20kh1=[19,4]")[0].description).toBe("advantage — the higher of two dice");
    expect(notes("4d20kl1=[19,4,11,2]")[0].label).toBe("dis");
    // Off the d20 it is keep-highest, and keeping one of ONE is not advantage.
    expect(notes("4d6kh1=[4,3,6,2]")[0].label).toBe("keep 1 hi");
    expect(notes("d20kh1=19")[0].label).toBe("keep 1 hi");
    // Keeping two of three has no common name, on any die.
    expect(notes("3d20kh2=[19,4,11]")[0].label).toBe("keep 2 hi");
  });

  it("reads a bare `kh` as `kh1`, since keeping one die is the common case", () => {
    const notes = (text: string) => describeSelector(editableDice(parseFormula(text)!)[0]);
    expect(notes("2d20kh=[19,4]")[0].label).toBe("adv");
    expect(notes("2d20kl=[19,4]")[0].label).toBe("dis");
    // …and it computes as one, too.
    expect(editableDice(parseFormula("2d20kh=[19,4]")!)[0].value).toBe(19);
    expect(editableDice(parseFormula("2d20kl=[19,4]")!)[0].value).toBe(4);
    expect(countedDice([4, 3, 6, 2], "dl")).toEqual([3, 4, 6]);
    expect(countedDice([1, 4], "ro")).toEqual([1, 4]);
  });

  it("rolls the dice a special adds, and records them in their own list", () => {
    const explode = die("d6!=6");
    // An rng that always showed the max would never stop, so: max once.
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0.999 : 0);
    const roll = rollDiceFaces(explode, rng);
    expect(roll).toEqual({ first: [6], extra: [1] }); // the 6 exploded into one more
    // The two lists say WHERE the extra die came from, which one flat list cannot.
    expect(formatDiceValue(explode, roll)).toBe("[6][1]");
    expect(diceMax(explode)).toBe(Number.POSITIVE_INFINITY); // no ceiling to clamp to
  });

  it("rolls one die within its faces, from the shared helper", () => {
    // The list draw and a formula's dice both roll through this, so a section die
    // and a d20 cannot drift apart in how they are thrown.
    expect(rollDie(4, () => 0)).toBe(1);
    expect(rollDie(4, () => 0.999)).toBe(4);
    expect(rollDie(10, () => 0.5)).toBe(6);
  });

  it("keeps a rerolled die in the log, with its replacement generated", () => {
    const pool = die("2d6ro1=[4,3]");
    // Two dice first (1 and 4), then the 1's replacement (6).
    const seq = [0, 0.5, 0.999];
    let i = 0;
    const roll = rollDiceFaces(pool, () => seq[i++]);
    expect(roll).toEqual({ first: [1, 4], extra: [6] });
    // The 1 is recorded but does not count — the 6 took its place.
    expect(resolvePool(roll.first, roll.extra, pool.selector)).toEqual([6, 4]);
    expect(formatDiceValue(pool, roll)).toBe("[1,4][6]");
  });
});

describe("a pool records every die and shows their sum", () => {
  const die = (text: string) => editableDice(parseFormula(text)!)[0];

  it("parses `=[4,3]` into per-die results plus their sum", () => {
    const pool = die("2d6=[4,3]");
    expect(pool.values).toEqual([4, 3]);
    expect(pool.value).toBe(7); // what the reader sees
  });

  it("keeps a plain total as-is, with no per-die list", () => {
    const pool = die("2d6=11");
    expect(pool.values).toEqual([]);
    expect(pool.value).toBe(11);
  });

  it("sums only the dice a keep/drop selector counts", () => {
    expect(die("4d6dl1=[4,3,6,2]").value).toBe(13); // drops the 2
    expect(die("2d20kh1=[19,4]").value).toBe(19);
    expect(die("2d20kl1=[19,4]").value).toBe(4);
    expect(die("4d6dh1=[4,3,6,2]").value).toBe(9); // drops the 6
  });

  it("leaves an unrolled pool with no value", () => {
    expect(parseDiceValue(undefined)).toEqual({ value: null, values: [], extra: [] });
    expect(parseDiceValue("")).toEqual({ value: null, values: [], extra: [] });
  });

  it("reads the older breakdown form, trusting the total the author wrote", () => {
    // `!` explodes, so the recorded dice cannot be re-derived — the total rules.
    const exploded = die("3d8! [8!, 5, 6]=19");
    expect(exploded.values).toEqual([8, 5, 6]);
    expect(exploded.value).toBe(19);
    const dropped = die("4d6dl1 [4, 3, 6, 2]=13");
    expect(dropped.value).toBe(13);
  });

  it("records a rolled pool as a list and a single die as a value", () => {
    const pool = die("2d6=[4,3]");
    expect(formatDiceValue(pool, { first: [5, 2], extra: [] })).toBe("[5,2]");
    expect(rollDiceFaces(pool, () => 0.999)).toEqual({ first: [6, 6], extra: [] });
    expect(formatDiceValue(die("d20=8"), { first: [11], extra: [] })).toBe("11");
    // A plain roll gets no second list at all — there is nothing to separate.
    expect(recordedGroups("[5,2]")).toEqual(["5,2"]);
  });

  it("keeps the generated dice in a second list, through parse and write-back", () => {
    const explode = die("3d8!=[8,5,6][3]");
    expect(explode.values).toEqual([8, 5, 6]);
    expect(explode.extra).toEqual([3]);
    expect(explode.value).toBe(22); // every recorded die counts for an explosion
    // A reroll's original is recorded but replaced, so it does NOT count.
    const reroll = die("4d6ro1=[1,5,2,6][4]");
    expect(reroll.values).toEqual([1, 5, 2, 6]);
    expect(reroll.extra).toEqual([4]);
    expect(reroll.value).toBe(17); // 4 + 5 + 2 + 6, the 1 set aside
    // The slot round-trips both lists rather than flattening them.
    expect(termSlotInitial(explode, 0)).toBe("[8,5,6][3]");
    expect(termSlotInitial(reroll, 0)).toBe("[1,5,2,6][4]");
    expect(setTermRaw(explode, combineDiceSlots(explode, ["[8,5,6][3]"]))).toBe("3d8!=[8,5,6][3]");
    expect(recordedText({ first: [8, 5, 6], extra: [3] })).toBe("[8,5,6][3]");
    expect(generatesDice("!")).toBe(true);
    expect(generatesDice("ro1")).toBe(true);
    expect(generatesDice("kh1")).toBe(false);
  });

  it("normalises a half-typed second list without losing the first", () => {
    const explode = die("3d8!=[8,5,6][3]");
    expect(combineDiceSlots(explode, ["[8,5,6][3,"])).toBe("[8,5,6][3]");
    expect(combineDiceSlots(explode, ["[8,5,"])).toBe("[8,5]");
    // Clearing the generated list leaves the dice that were thrown.
    expect(combineDiceSlots(explode, ["[8,5,6][]"])).toBe("[8,5,6]");
  });

  it("replaces an authored breakdown when a new roll is recorded", () => {
    // Keeping both would list one set of dice and total another.
    expect(setDiceValue("4d6dl1 [4, 3, 6, 2]=13", "[1,2,3,4]")).toBe("4d6dl1=[1,2,3,4]");
    // A plain total edit leaves the breakdown alone.
    expect(setDiceValue("4d6dl1 [4, 3, 6, 2]=13", "9")).toBe("4d6dl1 [4, 3, 6, 2]=9");
  });

  it("reads a line's roll the same whether it kept a total or a list", () => {
    expect(rolledValue("Event Focus: d100=34 -> NPC Action")).toBe(34);
    expect(rolledValue("d(Talon): 2d6+3=[4,3]")).toBe(7);
    expect(rolledValue("drop lowest: 4d6dl1=[4,3,6,2]")).toBe(13);
    expect(rolledValue("breakdown: 4d6dl1 [4, 3, 6, 2]=13")).toBe(13);
    expect(rolledValue("no dice here")).toBeNull();
    expect(rolledValue("d10= ->")).toBeNull(); // not yet rolled
  });

  it("records a hand-typed total as a total, replacing the list", () => {
    // A sum somebody typed is not a set of dice, so the list gives way to it.
    const pool = editableDice(parseFormula("2d6=[4,3]")!)[0];
    expect(setTermRaw(pool, combineDiceSlots(pool, ["11"]))).toBe("2d6=11");
    expect(diceMax(pool)).toBe(12); // a 2d6 total reaches 12, not 6
    expect(diceMax(editableDice(parseFormula("d20=8")!)[0])).toBe(20);
    expect(clampDieValue("14", diceMax(pool))).toBe("12");
  });

  it("lets each die of a pool be typed, clamped to a real face", () => {
    const pool = editableDice(parseFormula("3d8=[6,2,2]")!)[0];
    const type = (text: string) => clampDiceList(text, pool.sides);
    // Commas survive keystroke by keystroke — rebuilding the list every time would
    // swallow the one just typed.
    expect(type("6,")).toBe("6,");
    expect(type("6,2,7")).toBe("6,2,7");
    // Each number is ONE die, so a 9 is not a d8 face.
    expect(type("9,2")).toBe("8,2");
    // Brackets are drawn by the chip, so they never enter the field.
    expect(type("[6,2]")).toBe("6,2");
    expect(type("6,2x")).toBe("6,2");
    // A LONE value is the whole roll, and clamps to the pool's ceiling instead.
    expect(clampDieValue("30", diceMax(pool))).toBe("24");
  });

  it("writes valid list syntax even from a half-typed field", () => {
    const pool = editableDice(parseFormula("3d8=[6,2,2]")!)[0];
    expect(setTermRaw(pool, combineDiceSlots(pool, ["[6,2,"]))).toBe("3d8=[6,2]");
    expect(setTermRaw(pool, combineDiceSlots(pool, ["[6,2,7]"]))).toBe("3d8=[6,2,7]");
    expect(combineDiceSlots(pool, ["["])).toBe(""); // nothing entered yet
  });

  it("selects nothing to drop from a single recorded die", () => {
    expect(countedDice([7], "dl1")).toEqual([7]);
    expect(countedDice([4, 3], "")).toEqual([4, 3]);
  });
});
