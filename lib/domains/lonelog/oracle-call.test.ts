import { describe, it, expect } from "vitest";
import { parseOracleCallLine, parseLikelihood } from "./oracle-call";
import { answerFateQuestion } from "lib/domains/gm/fate-chart";

describe("the `o:` line", () => {
  it("reads the source, the odds, the roll and the result", () => {
    expect(parseOracleCallLine("Fate Chart (likely) d100=22 -> Yes")).toEqual({
      source: "Fate Chart",
      oddsText: "likely",
      likelihood: "likely",
      roll: "d100=22",
      result: "Yes",
    });
  });

  it("keeps a multi-word source whole", () => {
    // Splitting on whitespace is what leaves `tbl: Wilderness Encounters d100=63`
    // with a source of "Wilderness".
    expect(parseOracleCallLine("Fate Chart (50/50) d100=22").source).toBe("Fate Chart");
    expect(parseOracleCallLine("Fate Chart d100=22").source).toBe("Fate Chart");
    expect(parseOracleCallLine("Fate Chart").source).toBe("Fate Chart");
  });

  it("reads an unrolled line, as a feature emits it", () => {
    expect(parseOracleCallLine("Fate Chart (likely) d100 ->")).toEqual({
      source: "Fate Chart",
      oddsText: "likely",
      likelihood: "likely",
      roll: "d100",
    });
  });

  it("keeps odds it cannot name, rather than dropping them", () => {
    const line = parseOracleCallLine("Fate Chart (whatever) d100=22");
    expect(line.oddsText).toBe("whatever");
    expect(line.likelihood).toBeUndefined();
  });

  it("accepts the odds as the chart prints them", () => {
    expect(parseOracleCallLine("Fate Chart (Nearly Certain) d100=5").likelihood).toBe("near-certain");
    expect(parseLikelihood("Very Unlikely")).toBe("very-unlikely");
    expect(parseLikelihood("50/50")).toBe("50/50");
    expect(parseLikelihood("even")).toBe("50/50");
    expect(parseLikelihood("gibberish")).toBeNull();
  });
});

describe("answering through the chart", () => {
  it("resolves the roll the way the printed chart does", () => {
    // Likely at CF 5 is the chart's 13 · 65 · 94 cell.
    const a = answerFateQuestion(22, 5, "likely");
    expect(a).toMatchObject({ result: "Yes", wording: "Yes", threshold: 65, exceptionalYes: 13, exceptionalNo: 94 });
    expect(answerFateQuestion(13, 5, "likely").result).toBe("Exceptional Yes");
    expect(answerFateQuestion(66, 5, "likely").result).toBe("No");
    expect(answerFateQuestion(94, 5, "likely").result).toBe("Exceptional No");
  });

  it("moves with the chaos factor", () => {
    // The same odds slide along the ladder: 50/50 is a 90 cell at CF 9, a 10 at CF 1.
    expect(answerFateQuestion(60, 9, "50/50").result).toBe("Yes");
    expect(answerFateQuestion(60, 1, "50/50").result).toBe("No");
    expect(answerFateQuestion(60, 5, "50/50").result).toBe("No"); // 50 cell
  });

  it("words an exceptional answer the way the log reads it", () => {
    expect(answerFateQuestion(1, 5, "50/50").wording).toBe("Yes, and...");
    expect(answerFateQuestion(100, 5, "50/50").wording).toBe("No, and...");
  });
});
