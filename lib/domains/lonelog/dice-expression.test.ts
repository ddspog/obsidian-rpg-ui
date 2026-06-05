import { describe, it, expect } from "vitest";
import { parseRollField, isDiceExpression, highlightDiceNotation } from "./dice-expression";

describe("parseRollField", () => {
  it("parses a simple roll with total and outcome", () => {
    const result = parseRollField("2d6+2=9 -> Hit");
    expect(result.outcome).toBe("Hit");
    expect(result.expressions).toHaveLength(1);
    expect(result.expressions[0].expression).toBe("2d6+2");
    expect(result.expressions[0].total).toBe(9);
  });

  it("parses a roll with vs target", () => {
    const result = parseRollField("d20+5=17 vs DC 15 -> Success");
    expect(result.vsTarget).toBe("DC 15");
    expect(result.outcome).toBe("Success");
    expect(result.expressions[0].total).toBe(17);
  });

  it("parses a roll with label", () => {
    const result = parseRollField("Strike 2d6+2=9 -> Hit");
    expect(result.expressions[0].label).toBe("Strike");
    expect(result.expressions[0].expression).toBe("2d6+2");
    expect(result.expressions[0].total).toBe(9);
  });

  it("parses a roll with inline description", () => {
    const result = parseRollField("4d6dl1 // Strength=15");
    expect(result.expressions[0].description).toBe("Strength");
    expect(result.expressions[0].total).toBe(15);
  });

  it("parses comma-separated expressions", () => {
    const result = parseRollField("4d6dl1 // STR=15, 4d6dl1 // DEX=12");
    expect(result.expressions).toHaveLength(2);
    expect(result.expressions[0].description).toBe("STR");
    expect(result.expressions[0].total).toBe(15);
    expect(result.expressions[1].description).toBe("DEX");
    expect(result.expressions[1].total).toBe(12);
  });

  it("parses a roll with breakdown", () => {
    const result = parseRollField("4d6dl1 [6, 4d, 5, 3]=14");
    expect(result.expressions[0].breakdown).toBe("6, 4d, 5, 3");
    expect(result.expressions[0].total).toBe(14);
  });

  it("handles PbtA roll", () => {
    const result = parseRollField("2d6+2=9 -> Weak Hit");
    expect(result.expressions[0].expression).toBe("2d6+2");
    expect(result.expressions[0].total).toBe(9);
    expect(result.outcome).toBe("Weak Hit");
  });

  it("handles Fate/Fudge roll", () => {
    const result = parseRollField("Overcome 4dF+2=3 -> Success with Style");
    expect(result.expressions[0].label).toBe("Overcome");
    expect(result.expressions[0].expression).toBe("4dF+2");
    expect(result.expressions[0].total).toBe(3);
    expect(result.outcome).toBe("Success with Style");
  });

  it("handles advantage roll", () => {
    const result = parseRollField("Persuade 2d20kh1+4=16");
    expect(result.expressions[0].label).toBe("Persuade");
    expect(result.expressions[0].expression).toBe("2d20kh1+4");
    expect(result.expressions[0].total).toBe(16);
  });

  it("handles dice pool successes", () => {
    const result = parseRollField("5d10>=7=3 -> Hit");
    expect(result.expressions[0].total).toBe(3);
    expect(result.outcome).toBe("Hit");
  });

  it("handles roll with no total or outcome", () => {
    const result = parseRollField("d20+5");
    expect(result.expressions[0].expression).toBe("d20+5");
    expect(result.expressions[0].total).toBeUndefined();
    expect(result.outcome).toBeUndefined();
  });

  it("handles percentile roll", () => {
    const result = parseRollField("d%=42 -> Yes, but...");
    expect(result.expressions[0].expression).toBe("d%");
    expect(result.expressions[0].total).toBe(42);
    expect(result.outcome).toBe("Yes, but...");
  });

  it("handles exploding dice with space before =", () => {
    const result = parseRollField("2d6! =13");
    expect(result.expressions[0].total).toBe(13);
    expect(result.expressions[0].expression).toBe("2d6!");
  });
});

describe("isDiceExpression", () => {
  it("recognizes standard dice notation", () => {
    expect(isDiceExpression("2d6+3")).toBe(true);
    expect(isDiceExpression("d20")).toBe(true);
    expect(isDiceExpression("4d6dl1")).toBe(true);
    expect(isDiceExpression("d%")).toBe(true);
    expect(isDiceExpression("4dF")).toBe(true);
  });

  it("rejects non-dice text", () => {
    expect(isDiceExpression("hello")).toBe(false);
    expect(isDiceExpression("42")).toBe(false);
    expect(isDiceExpression("DC 15")).toBe(false);
  });
});

describe("highlightDiceNotation", () => {
  it("tokenizes a simple expression", () => {
    const tokens = highlightDiceNotation("2d6+3");
    expect(tokens).toEqual([
      { text: "2d6", type: "dice" },
      { text: "+", type: "operator" },
      { text: "3", type: "number" },
    ]);
  });

  it("tokenizes with modifiers", () => {
    const tokens = highlightDiceNotation("4d6dl1");
    expect(tokens[0]).toEqual({ text: "4d6", type: "dice" });
    expect(tokens[1]).toEqual({ text: "dl1", type: "modifier" });
  });

  it("tokenizes exploding dice", () => {
    const tokens = highlightDiceNotation("2d6!");
    expect(tokens[0]).toEqual({ text: "2d6", type: "dice" });
    expect(tokens[1]).toEqual({ text: "!", type: "modifier" });
  });

  it("tokenizes keep highest", () => {
    const tokens = highlightDiceNotation("2d20kh1");
    expect(tokens[0]).toEqual({ text: "2d20", type: "dice" });
    expect(tokens[1]).toEqual({ text: "kh1", type: "modifier" });
  });
});
