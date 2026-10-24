import { describe, it, expect } from "vitest";
import { splitResultChoice, buildResultChoice, applyChoicePick, NESTED_SEP } from "./choice";

describe("splitResultChoice", () => {
  it("splits a result with a trailing choice token", () => {
    const { before, choice } = splitResultChoice("Altered Scene [The Next Expectation/A Tweak/Fate Question - ]");
    expect(before).toBe("Altered Scene");
    expect(choice).toEqual({
      options: ["The Next Expectation", "A Tweak", "Fate Question"],
      selected: "",
      raw: "[The Next Expectation/A Tweak/Fate Question - ]",
    });
  });

  it("captures the current selection", () => {
    const { choice } = splitResultChoice("Altered Scene [A/B/C - B]");
    expect(choice?.selected).toBe("B");
  });

  it("returns no choice for plain results", () => {
    expect(splitResultChoice("Expected Scene").choice).toBeNull();
  });

  it("does not treat lonelog tags or wikilinks as choices", () => {
    expect(splitResultChoice("Yes [CF:5]").choice).toBeNull();
    expect(splitResultChoice("See [[Some Note]]").choice).toBeNull();
    expect(splitResultChoice("HP-5 damage").choice).toBeNull();
  });

  it("round-trips through buildResultChoice", () => {
    const { before, choice } = splitResultChoice("Altered Scene [A/B/C - ]");
    const rebuilt = buildResultChoice(before, choice!.options, "B");
    expect(rebuilt).toBe("Altered Scene [A/B/C - B]");
    expect(splitResultChoice(rebuilt).choice?.selected).toBe("B");
  });
});

describe("applyChoicePick", () => {
  const log = [
    "gen: Testing the Expected Scene",
    "  Alterations: d10=3 vs CF 5 -> Altered Scene [A Tweak/Fate Question - ]",
    "=> S02 X",
  ].join("\n");

  it("sets the selection and inserts the generated line as a `+ ` child", () => {
    const out = applyChoicePick(log, "Fate Question", { "Fate Question": "? [CF:5] Does it change? -> (d100=)" });
    expect(out).toBe(
      [
        "gen: Testing the Expected Scene",
        "  Alterations: d10=3 vs CF 5 -> Altered Scene [A Tweak/Fate Question - Fate Question]",
        "  + ? [CF:5] Does it change? -> (d100=)",
        "=> S02 X",
      ].join("\n")
    );
  });

  it("records the pick with no inserted line when the option generates none", () => {
    const out = applyChoicePick(log, "A Tweak", { "A Tweak": "" });
    expect(out).toContain("[A Tweak/Fate Question - A Tweak]");
    expect(out.split("\n")).toHaveLength(3); // no line added
  });

  it("clears back to no selection / no line on the empty option", () => {
    expect(applyChoicePick(log, "", {})).toBe(log);
  });
});

describe("applyChoicePick — re-pick swaps the inserted line", () => {
  const log = "  Alterations: d10=3 vs CF 5 -> Altered Scene [A Tweak/Fate Question - ]";
  const fl = { "A Tweak": "(note: tweak)", "Fate Question": "? q -> (d100=)" };

  it("replaces a prior follow line when re-picking, not stacks it", () => {
    const first = applyChoicePick(log, "A Tweak", fl);
    expect(first.split("\n")).toHaveLength(2);
    const second = applyChoicePick(first, "Fate Question", fl);
    const lines = second.split("\n");
    expect(lines).toHaveLength(2); // still 2 — swapped, not stacked
    expect(lines[0]).toContain("- Fate Question]");
    expect(lines[1]).toBe("  + ? q -> (d100=)");
  });

  it("clears a ROLLED child on re-pick (structural `+ ` teardown, not text match)", () => {
    const first = applyChoicePick(log, "Fate Question", fl);
    // The reader rolls a value into the child — an exact-text teardown would
    // no longer recognize it and would leave it behind, clogging the block.
    const rolled = first.replace("(d100=)", "(d100=42) -> Yes");
    const second = applyChoicePick(rolled, "A Tweak", fl);
    expect(second).not.toContain("d100=42");
    expect(second.split("\n")).toHaveLength(2);
    expect(second.split("\n")[1]).toBe("  + (note: tweak)");
  });

  it("drops all children of a multi-line pick, and clears them on the empty option", () => {
    const pair = { Actions: "Actions 1: d100= ->\nActions 2: d100= ->" };
    const picked = applyChoicePick("  Meaning: [Actions - ]", "Actions", pair);
    expect(picked.split("\n")).toHaveLength(3);
    expect(picked.split("\n").slice(1)).toEqual(["  + Actions 1: d100= ->", "  + Actions 2: d100= ->"]);
    const cleared = applyChoicePick(picked, "", pair);
    expect(cleared).toBe("  Meaning: [Actions - ]"); // both children gone
  });
});

describe("splitResultChoice — the render-branch predicate", () => {
  // `RowContent` picks its renderer from `parseFormula` + this predicate:
  // formula → FormulaView, else choice-only → dropdown, else plain markdown.
  // A row that is NEITHER must fall through to markdown — a regression once
  // blanked every plain `+ ` child by using a (always-truthy) JSX element as a
  // `??` fallback, so these cases pin the three-way split.
  it("detects a dieless choice-only line (the GM-picks step)", () => {
    expect(splitResultChoice("[Actions/Descriptions/Elements - ]").choice?.options).toEqual([
      "Actions",
      "Descriptions",
      "Elements",
    ]);
  });

  it("reports NO choice for plain child content, so it renders as text", () => {
    expect(splitResultChoice("Characters: Any Character").choice).toBeNull();
    expect(splitResultChoice("Elements: roll a themed table twice").choice).toBeNull();
    expect(splitResultChoice("Any Character").choice).toBeNull();
  });
});

describe("applyChoicePick — a log with several generators", () => {
  const entry = (pick: string) =>
    ["? Who?", "gen: Name Generator", `  Naming Style: [Anglish/Arabish - ${pick}]`].join("\n");
  const follow = { Anglish: "Anglish 1: @[[a]]#a d100= ->", Arabish: "Arabish 1: @[[b]]#b d100= ->" };
  const body = `${entry("Anglish")}\n  + Anglish 1: @[[a]]#a d100= ->\n${entry("Anglish")}\n  + Anglish 1: @[[a]]#a d100= ->`;

  it("rewrites the entry the dropdown sits in, not the first one in the log", () => {
    const source = "  Naming Style: [Anglish/Arabish - Anglish]";
    const out = applyChoicePick(body, "Arabish", follow, { source, nth: 1 }).split("\n");
    expect(out.filter((l) => l.includes("- Anglish]"))).toHaveLength(1);
    expect(out.filter((l) => l.includes("- Arabish]"))).toHaveLength(1);
    // The second entry now holds the Arabish row once; the first entry is untouched.
    expect(out.slice(0, 4)).toEqual(body.split("\n").slice(0, 4));
    expect(out.filter((l) => l.includes("Arabish 1:"))).toHaveLength(1);
    expect(out.filter((l) => l.includes("Anglish 1:"))).toHaveLength(1);
  });

  it("still takes the first choice line when no line is given", () => {
    const out = applyChoicePick(body, "Arabish", follow);
    expect(out.split("\n")[2]).toContain("- Arabish]");
  });
});

describe("applyChoicePick — a dropdown nested under another pick", () => {
  const kind = (pick: string) => `  + Kind: [Masculine name/Feminine name - ${pick}]`;
  const follow = {
    Anglish: "Kind: [Masculine name/Feminine name - ]",
    [`Anglish${NESTED_SEP}Masculine name`]: "Name: @[[a]]#a d100= ->",
    [`Arabish${NESTED_SEP}Masculine name`]: "Name: @[[b]]#b d100= ->",
    "Masculine name": "Wrong: looked up without its parent",
  };

  it("spawns the style's kind dropdown when the style is picked", () => {
    const body = "gen: Name Generator\n  Naming Style: [Anglish/Arabish - ]";
    const out = applyChoicePick(body, "Anglish", follow).split("\n");
    expect(out).toEqual([
      "gen: Name Generator",
      "  Naming Style: [Anglish/Arabish - Anglish]",
      "  + Kind: [Masculine name/Feminine name - ]",
    ]);
  });

  it("looks the kind up under its style, so two styles' `Masculine name` differ", () => {
    for (const [style, ref] of [
      ["Anglish", "#a"],
      ["Arabish", "#b"],
    ]) {
      const body = ["gen: Name Generator", `  Naming Style: [Anglish/Arabish - ${style}]`, kind("")].join("\n");
      const out = applyChoicePick(body, "Masculine name", follow, { source: kind("").trim(), nth: 0 }).split("\n");
      expect(out[2]).toContain("- Masculine name]");
      expect(out[3]).toContain(ref);
    }
  });

  it("re-picking the style drops the kind line and its rows together", () => {
    const body = [
      "gen: Name Generator",
      "  Naming Style: [Anglish/Arabish - Anglish]",
      kind("Masculine name"),
      "  + Name: @[[a]]#a d100=4 -> Hod",
    ].join("\n");
    const out = applyChoicePick(body, "Arabish", { ...follow, Arabish: "Kind: [Masculine name - ]" }).split("\n");
    expect(out).toEqual([
      "gen: Name Generator",
      "  Naming Style: [Anglish/Arabish - Arabish]",
      "  + Kind: [Masculine name - ]",
    ]);
  });
});
