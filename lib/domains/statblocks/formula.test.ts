import { describe, expect, it } from "vitest";
import { evaluate, fillFormulas, fillFormulasMarkdown, namesIn } from "./formula";

describe("evaluate", () => {
  it("works out arithmetic with precedence, parentheses and functions", () => {
    const v = { circle: 8, pb: 3, level_ranger: 5, mod_wis: 2 };
    expect(evaluate("13 + circle", v)).toBe(21);
    expect(evaluate("70 + 10 * (circle - 7)", v)).toBe(80);
    expect(evaluate("floor(circle / 2)", v)).toBe(4);
    expect(evaluate("5 + 5 × level_ranger", v)).toBe(30);
    expect(evaluate("8 + pb + max(mod_wis, 1)", v)).toBe(13);
    expect(evaluate("−pb", v)).toBe(-3);
    expect(evaluate("ceil(7 / 2)", v)).toBe(4);
  });

  it("gives undefined for an unknown name or a bad formula", () => {
    expect(evaluate("13 + circle", {})).toBeUndefined();
    expect(evaluate("13 +", {})).toBeUndefined();
    expect(evaluate("self.name()", {})).toBeUndefined();
    expect(evaluate("nope(2)", {})).toBeUndefined();
  });

  it("names what a formula reads", () => {
    expect(namesIn("floor(circle / 2) + pb")).toEqual(["circle", "pb"]);
  });
});

describe("fillFormulas", () => {
  it("fills the formulas it can and leaves the others", () => {
    expect(fillFormulas("AC {{ 13 + circle }}, the {{ self.name() }}", { circle: 7 })).toEqual([
      { text: "AC " },
      { value: "20", formula: "13 + circle" },
      { text: ", the {{ self.name() }}" },
    ]);
  });

  it("writes Markdown spans that carry the formula", () => {
    expect(fillFormulasMarkdown("+{{ 4 + pb }} to hit", { pb: 2 })).toBe(
      '+<span class="rpg-formula" tabindex="0" role="button" data-formula="4 + pb" title="4 + pb">6</span> to hit'
    );
  });
});
