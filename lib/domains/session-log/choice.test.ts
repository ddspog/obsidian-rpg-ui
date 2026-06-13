import { describe, it, expect } from "vitest";
import { splitResultChoice, buildResultChoice, applyChoicePick } from "./choice";

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

  it("sets the selection and inserts the generated line, matching indentation", () => {
    const out = applyChoicePick(log, "Fate Question", { "Fate Question": "? [CF:5] Does it change? -> (d100=)" });
    expect(out).toBe(
      [
        "gen: Testing the Expected Scene",
        "  Alterations: d10=3 vs CF 5 -> Altered Scene [A Tweak/Fate Question - Fate Question]",
        "  ? [CF:5] Does it change? -> (d100=)",
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
    expect(lines[1]).toBe("  ? q -> (d100=)");
  });
});
