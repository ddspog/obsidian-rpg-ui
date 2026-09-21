import { describe, it, expect } from "vitest";
import { parseExpressionLine, evaluate, outcomeOf, diceOf, hasDice, type VarScope, type ExprNode } from "./expression";

/** The scope a log would supply: declared resources first, then sheet values. */
const scope: VarScope = (name) => ({ PB: 3, STR_MOD: 4, CF: 5 })[name] ?? null;

const parse = (text: string) => {
  const line = parseExpressionLine(text);
  expect(line, `should parse: ${text}`).not.toBeNull();
  return line!;
};

describe("parseExpressionLine — what the grammar accepts", () => {
  it("reads arithmetic over dice, numbers and variables", () => {
    const line = parse("d8=5 + d6=3 + 2 =");
    expect(line.evaluate).toBe(true);
    expect(evaluate(line.left, scope)).toBe(10);
    expect(diceOf(line.left).map((d) => d.spec)).toEqual(["d8", "d6"]);
  });

  it("keeps a die's value bound to the die, and everything else arithmetic", () => {
    // The distinction the whole grammar rests on: `=17` is the die's, `=22` is the
    // expression's, and only the position of the `=` says which.
    const line = parse("d20=17 + 5 = 22");
    const dice = diceOf(line.left);
    expect(dice[0].value).toBe(17);
    expect(line.authored).toBe(22);
    expect(evaluate(line.left, scope)).toBe(22); // derived, and it agrees
  });

  it("reads a hand-written log where no die has a value yet", () => {
    // `d20+5=22` is how the vault's logs are written: the total is authored and the
    // dice are not recorded. It must keep showing 22.
    const line = parse("d20 + 5 = 22");
    expect(evaluate(line.left, scope)).toBeNull(); // nothing to derive from
    const out = outcomeOf(line, scope);
    expect(out.total).toBe(22);
    expect(out.derived).toBe(false);
  });

  it("resolves variables from the scope, and refuses to guess without one", () => {
    const line = parse("d20=14 + {{PB}} =");
    expect(evaluate(line.left, scope)).toBe(17);
    expect(evaluate(line.left, () => null)).toBeNull();
  });

  it("binds * and / tighter than + and -, and honours parentheses", () => {
    expect(evaluate(parse("2 + 3 * 4 =").left)).toBe(14);
    expect(evaluate(parse("(2 + 3) * 4 =").left)).toBe(20);
    expect(evaluate(parse("(d8=5 + 2) * 2 =").left)).toBe(14);
    expect(evaluate(parse("d8=5 - 2 - 1 =").left)).toBe(2); // left to right
  });

  it("floors division, the way halving does at the table", () => {
    expect(evaluate(parse("4d6=[1,2,3,4] / 2 =").left)).toBe(5);
    expect(evaluate(parse("d8=5 / 2 =").left)).toBe(2);
    expect(evaluate(parse("d8=5 / 0 =").left)).toBeNull(); // no answer, not Infinity
  });

  it("reads a negative operand", () => {
    expect(evaluate(parse("d8=5 + -2 =").left)).toBe(3);
  });

  it("returns null for text that is not an expression", () => {
    expect(parseExpressionLine("Two watchmen, and one is alert")).toBeNull();
    expect(parseExpressionLine("")).toBeNull();
    expect(parseExpressionLine("(d8=5 + 2 =")).toBeNull(); // unbalanced
    expect(parseExpressionLine("d8=5 + = 2")).toBeNull(); // `=` mid-expression
    // Arithmetic with no dice and no total asked for is not a roll.
    expect(parseExpressionLine("2 + 3")).toBeNull();
  });

  it("treats a selector'd pool as one operand", () => {
    const line = parse("2d20kh1=[19,4] + {{PB}} =");
    expect(evaluate(line.left, scope)).toBe(22); // advantage takes 19, not 23
  });
});

describe("comparisons", () => {
  it("says which side is higher for `vs`", () => {
    const line = parse("d20=17 + 5 vs 15");
    expect(line.compare?.op).toBe("vs");
    expect(outcomeOf(line, scope)).toMatchObject({ total: 22, against: 15, winner: "left" });
    expect(outcomeOf(parse("d20=2 vs 15"), scope).winner).toBe("right");
    expect(outcomeOf(parse("d20=15 vs 15"), scope).winner).toBe("tie");
  });

  it("compares two rolls, not just a roll against a number", () => {
    const line = parse("2d20kh1=[19,4] vs d20=11 + 2");
    expect(outcomeOf(line, scope)).toMatchObject({ total: 19, against: 13, winner: "left" });
  });

  it("passes or fails a threshold", () => {
    expect(outcomeOf(parse("d20=17 + 5 >= 15"), scope).passed).toBe(true);
    expect(outcomeOf(parse("d20=2 + 5 >= 15"), scope).passed).toBe(false);
    expect(outcomeOf(parse("d20=2 < 15"), scope).passed).toBe(true);
    expect(outcomeOf(parse("d20=17 <= 15"), scope).passed).toBe(false);
    expect(outcomeOf(parse("d20=17 > 15"), scope).passed).toBe(true);
  });

  it("leaves a comparison undecided while a die is unrolled", () => {
    // Undecided is not "false": an unrolled roll has not failed anything.
    const out = outcomeOf(parse("d20 + 5 >= 15"), scope);
    expect(out.passed).toBeNull();
    expect(outcomeOf(parse("d20 vs 15"), scope).winner).toBeNull();
  });

  it("compares against a variable", () => {
    expect(outcomeOf(parse("d10=8 vs {{CF}}"), scope)).toMatchObject({ against: 5, winner: "left" });
    expect(outcomeOf(parse("d10=3 >= {{CF}}"), scope).passed).toBe(false);
  });
});

describe("what an editor may touch", () => {
  it("lists every die, and nothing else", () => {
    const line = parse("(2d20kh1=[19,4] + {{PB}}) * 2 - d4=1 =");
    expect(diceOf(line.left).map((d) => d.raw)).toEqual(["2d20kh1=[19,4]", "d4=1"]);
    expect(hasDice(line.left)).toBe(true);
    expect(hasDice({ kind: "number", value: 2, raw: "2" } as ExprNode)).toBe(false);
  });
});

describe("labels: one mark for the check, another for a die", () => {
  it("names the whole check with a pipe", () => {
    const line = parse("Stealth | d20=17 + 5 =");
    expect(line.label).toBe("Stealth");
    expect(evaluate(line.left, scope)).toBe(22);
    // The label is not part of the formula, so it changes nothing about the maths.
    expect(diceOf(line.left).map((d) => d.spec)).toEqual(["d20"]);
  });

  it("lets a check's name hold what names hold", () => {
    // Everything up to the pipe, so commas and apostrophes need no escaping.
    expect(parse("Loki, the old God | d20=9 + 2 =").label).toBe("Loki, the old God");
    expect(parse("Thieves' Tools | d20=8 =").label).toBe("Thieves' Tools");
    expect(parse("STR | 4d6dl1=[4,3,6,2] =").label).toBe("STR");
  });

  it("names ONE die with a colon, bound to it", () => {
    const line = parse("d8=6 + sneak:2d6=[4,3] + 3 =");
    const dice = line.left;
    // The label rides on the die it precedes, not on the expression.
    expect(line.label).toBeUndefined();
    const labelled = collectDice(dice).find((d) => d.label === "sneak");
    expect(labelled?.term.spec).toBe("2d6");
    expect(evaluate(line.left, scope)).toBe(16); // 6 + 7 + 3
  });

  it("carries both marks at once, each doing its own job", () => {
    const line = parse("Damage | d8=6 + sneak:2d6=[4,3] =");
    expect(line.label).toBe("Damage");
    expect(collectDice(line.left).map((d) => d.label)).toEqual([undefined, "sneak"]);
  });

  it("keeps a die label off anything that is not a die", () => {
    // A colon has no meaning except directly before a die.
    expect(parseExpressionLine("total: 5 + 2 =")).toBeNull();
    expect(parseExpressionLine("Stealth | notadie:5 =")).toBeNull();
  });

  it("refuses a pipe that names nothing", () => {
    expect(parseExpressionLine("| d20=17 =")).toBeNull();
  });

  it("does not read a die's own notation as a label", () => {
    // `d20=17` has no colon, and `drop<3` must not be mistaken for one.
    expect(parse("d20=17 + 5 =").label).toBeUndefined();
    expect(collectDice(parse("4d6drop<3=[1,5,2,6] =").left)[0].label).toBeUndefined();
  });
});

/** Every dice node, so a test can inspect the labels riding on them. */
function collectDice(node: ExprNode): Array<{ term: { spec: string }; label?: string }> {
  switch (node.kind) {
    case "dice":
      return [{ term: node.term, label: node.label }];
    case "number":
    case "var":
      return [];
    case "neg":
    case "group":
      return collectDice(node.inner);
    case "binary":
      return [...collectDice(node.left), ...collectDice(node.right)];
  }
}
