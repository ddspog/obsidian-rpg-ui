import { describe, it, expect } from "vitest";
import type { GMFeature, GMStep } from "../features/types";
import type { TableDef } from "../tables/types";
import {
  parseBranchRef,
  stepLabels,
  stepCalc,
  selectStepBlock,
  appendStepLine,
  resolveTableRoll,
  chooseTables,
  stepUseLinks,
  spliceStepUses,
  flattenSteps,
  parsePickSpec,
  partText,
  pickNames,
  pickResult,
  pickSides,
} from "./steps";

describe("step composition — use:", () => {
  const meaning: GMStep[] = [
    { choice: "Meaning Actions", tables: ["@[[Actions Meaning]]#action-01", "@[[Actions Meaning]]#action-02"] },
    { choice: "Meaning Elements", pick: 2, tables: ["@[[Location Descriptors]]#locations"] },
  ];

  it("stepUseLinks collects the `use:` links (skipping normal steps)", () => {
    const steps: GMStep[] = [{ choice: "A", calc: "" }, { use: "@[[Meaning]]" }, { use: "@[[Extras]]" }];
    expect(stepUseLinks(steps)).toEqual(["@[[Meaning]]", "@[[Extras]]"]);
  });

  it("spliceStepUses replaces a `use:` step with the imported block's steps, in order", () => {
    const steps: GMStep[] = [
      { choice: "A Tweak", calc: "(note: …)" },
      { use: "@[[Meaning]]" },
      { choice: "Scene Adjustment", calc: "d10= ->" },
    ];
    expect(spliceStepUses(steps, { "@[[Meaning]]": meaning }).map((s) => s.choice)).toEqual([
      "A Tweak",
      "Meaning Actions",
      "Meaning Elements",
      "Scene Adjustment",
    ]);
  });

  it("drops an unresolved `use:` step", () => {
    const steps: GMStep[] = [{ choice: "A", calc: "" }, { use: "@[[Missing]]" }];
    expect(spliceStepUses(steps, {}).map((s) => s.choice)).toEqual(["A"]);
  });

  it("stepLabels skips `use:` splices (no choice)", () => {
    const block: GMFeature = { name: "Altered", steps: [{ choice: "A Tweak", calc: "" }, { use: "@[[Meaning]]" }] };
    expect(stepLabels(block)).toEqual(["A Tweak"]);
  });
});

describe("parseBranchRef", () => {
  it("parses a bare @[[file]] call", () => {
    expect(parseBranchRef("@[[Altered Scene]]")).toEqual({
      label: "Altered Scene",
      target: "Altered Scene",
      block: undefined,
    });
  });

  it("parses a plain [[file]] wikilink", () => {
    expect(parseBranchRef("[[Altered Scene]]")?.target).toBe("Altered Scene");
  });

  it("honors a |label alias", () => {
    expect(parseBranchRef("[[Scene Check|Expected Scene]]")).toEqual({
      label: "Expected Scene",
      target: "Scene Check",
      block: undefined,
    });
  });

  it("extracts a #blockid (inside or trailing the brackets)", () => {
    expect(parseBranchRef("@[[Altered Scene]]#tweaks")).toEqual({
      label: "Altered Scene",
      target: "Altered Scene",
      block: "tweaks",
    });
    expect(parseBranchRef("@[[Altered Scene#tweaks]]")).toEqual({
      label: "Altered Scene",
      target: "Altered Scene",
      block: "tweaks",
    });
    expect(parseBranchRef("@[[Altered Scene]]#scene-adjustment-table")?.block).toBe("scene-adjustment-table");
  });

  it("handles target#block|label together", () => {
    expect(parseBranchRef("[[Altered Scene#tweaks|Tweaks]]")).toEqual({
      label: "Tweaks",
      target: "Altered Scene",
      block: "tweaks",
    });
  });

  it("uses the last path segment as the default label", () => {
    expect(parseBranchRef("[[scenes/Altered Scene]]")?.label).toBe("Altered Scene");
  });

  it("returns null for plain text", () => {
    expect(parseBranchRef("Expected Scene")).toBeNull();
    expect(parseBranchRef("")).toBeNull();
  });
});

const altered: GMFeature = {
  name: "Altered Scene",
  steps: [
    { choice: "The Next Expectation", calc: "" },
    { choice: "A Tweak", calc: "(note: tweak the activity, an NPC, an object, or the location)" },
    { choice: "Fate Question", calc: "d100= ->" },
    { choice: "Scene Adjustment", calc: "@[[Scene Adjustment]] d10= ->" },
  ],
};

describe("stepLabels / stepCalc", () => {
  it("lists the choice labels in order", () => {
    expect(stepLabels(altered)).toEqual(["The Next Expectation", "A Tweak", "Fate Question", "Scene Adjustment"]);
  });

  it("returns the calc for a choice", () => {
    expect(stepCalc(altered, "Fate Question")).toBe("d100= ->");
    expect(stepCalc(altered, "The Next Expectation")).toBe("");
    expect(stepCalc(altered, "Nope")).toBeUndefined();
  });

  it("tolerates a feature with no steps", () => {
    expect(stepLabels({ name: "x" })).toEqual([]);
  });
});

describe("selectStepBlock", () => {
  const a: GMFeature = { name: "Altered Scene", steps: [{ choice: "A", calc: "" }] };
  const b: GMFeature = { name: "Other", steps: [{ choice: "B", calc: "" }] };
  const plain: GMFeature = { name: "Prose", text: "no steps" };

  it("returns the single step block when there is exactly one", () => {
    expect(selectStepBlock([a, plain])).toBe(a);
  });

  it("returns null when ambiguous and no block id given", () => {
    expect(selectStepBlock([a, b])).toBeNull();
  });

  it("disambiguates by block id (feature name)", () => {
    expect(selectStepBlock([a, b], "Other")).toBe(b);
    expect(selectStepBlock([a, b], "Missing")).toBeNull();
  });

  it("returns null when no step blocks exist", () => {
    expect(selectStepBlock([plain])).toBeNull();
  });
});

describe("appendStepLine", () => {
  const log = [
    '? Does the "raid" scene happen as expected?  [CF:5]',
    "gen: Testing the Expected Scene",
    "  Scene: d10=3 vs CF 5 -> Altered Scene",
    '=> Start Scene(): ""',
  ].join("\n");

  it("appends a flat labeled line after the gen's indented block", () => {
    const out = appendStepLine(log, "Testing the Expected Scene", "Fate Question", "d100= ->");
    expect(out.split("\n")).toEqual([
      '? Does the "raid" scene happen as expected?  [CF:5]',
      "gen: Testing the Expected Scene",
      "  Scene: d10=3 vs CF 5 -> Altered Scene",
      "  Fate Question: d100= ->",
      '=> Start Scene(): ""',
    ]);
  });

  it("accumulates multiple picks in order, never nesting", () => {
    let out = appendStepLine(log, "Testing the Expected Scene", "A Tweak", "(note: tweak)");
    out = appendStepLine(out, "Testing the Expected Scene", "Fate Question", "d100= ->");
    const indents = out.split("\n").filter((l) => /^\s+\S/.test(l));
    expect(indents).toEqual([
      "  Scene: d10=3 vs CF 5 -> Altered Scene",
      "  A Tweak: (note: tweak)",
      "  Fate Question: d100= ->",
    ]);
    // every appended line is exactly one indent level (two spaces)
    expect(indents.every((l) => l.startsWith("  ") && !l.startsWith("    "))).toBe(true);
  });

  it("records nothing for an empty calc", () => {
    expect(appendStepLine(log, "Testing the Expected Scene", "The Next Expectation", "")).toBe(log);
  });

  it("leaves the log unchanged when the gen line is absent", () => {
    expect(appendStepLine(log, "Nonexistent", "X", "d6= ->")).toBe(log);
  });
});

const sceneAdjustment: TableDef = {
  name: "scene-adjustment",
  columns: ["1d10", "result"],
  columnLabels: ["1D10", "RESULT"],
  headerRows: [],
  rows: [
    { cells: [{ value: "1" }, { value: "Remove a Character" }] },
    { cells: [{ value: "2" }, { value: "Add a Character" }] },
    { cells: [{ value: "7-10" }, { value: "Make 2 Adjustments" }] },
  ],
  classes: [],
  footer: [],
};

describe("resolveTableRoll", () => {
  it("fills the result from the matched single-value row", () => {
    expect(resolveTableRoll("@[[Scene Adjustment]] d10=2 ->", sceneAdjustment)).toBe(
      "@[[Scene Adjustment]] d10=2 -> Add a Character"
    );
  });

  it("matches a range row (7-10)", () => {
    expect(resolveTableRoll("d10=9 ->", sceneAdjustment)).toBe("d10=9 -> Make 2 Adjustments");
  });

  it("leaves the calc unchanged when the die isn't rolled", () => {
    expect(resolveTableRoll("@[[Scene Adjustment]] d10= ->", sceneAdjustment)).toBe("@[[Scene Adjustment]] d10= ->");
  });

  it("leaves the calc unchanged when no row matches", () => {
    expect(resolveTableRoll("d10=5 ->", sceneAdjustment)).toBe("d10=5 ->");
  });

  it("resolves a pool recorded die-by-die on the sum of its dice", () => {
    // `[1,1]` sums to 2, so it must land where a bare `=2` lands.
    expect(resolveTableRoll("2d10=[1,1] ->", sceneAdjustment)).toBe("2d10=[1,1] -> Add a Character");
    expect(resolveTableRoll("2d10=[7,2] ->", sceneAdjustment)).toBe("2d10=[7,2] -> Make 2 Adjustments");
  });

  it("does not overwrite an already-filled result", () => {
    expect(resolveTableRoll("d10=2 -> Already Set", sceneAdjustment)).toBe("d10=2 -> Already Set");
  });
});

describe("resolveTableRoll — rows with several value columns", () => {
  const cols = (labels: string[], rows: string[][]): TableDef => ({
    name: "names",
    columns: labels.map((l) => l.toLowerCase()),
    columnLabels: labels,
    headerRows: [],
    rows: rows.map((r) => ({ cells: r.map((value) => ({ value })) })),
    classes: [],
    footer: [],
  });

  it("names each filled column, joined", () => {
    const t = cols(["d20", "Start", "Ending"], [["4", "Hod", "dare"]]);
    expect(resolveTableRoll("d20=4 ->", t)).toBe("d20=4 -> Start: Hod · Ending: dare");
  });

  it("gives just the values when the columns are numbered alternatives", () => {
    const t = cols(["d20", "1", "2", "3"], [["4", "Aafas", "Halad", "Okhtar"]]);
    expect(resolveTableRoll("d20=4 ->", t)).toBe("d20=4 -> Aafas / Halad / Okhtar");
  });

  it("skips an empty column", () => {
    const t = cols(["d20", "Start", "Middle", "Ending"], [["4", "Ka", "", "dun"]]);
    expect(resolveTableRoll("d20=4 ->", t)).toBe("d20=4 -> Start: Ka · Ending: dun");
  });
});

describe("chooseTables", () => {
  const els = [
    "@[[Location Descriptors]]#locations",
    "@[[Character Descriptors]]#characters",
    "@[[Objects Descriptors]]#objects",
  ];

  it("returns the full list when pick is omitted", () => {
    expect(chooseTables(els)).toEqual(els);
  });

  it("returns the full list when pick >= length", () => {
    expect(chooseTables(els, 5)).toEqual(els);
  });

  it("returns exactly `pick` entries, all from the input, with no duplicates", () => {
    const out = chooseTables(els, 2, () => 0.5);
    expect(out).toHaveLength(2);
    expect(new Set(out).size).toBe(2);
    out.forEach((t) => expect(els).toContain(t));
  });

  it("is deterministic given an injected rng", () => {
    expect(chooseTables(els, 2, () => 0)).toEqual([els[0], els[1]]);
    expect(chooseTables(els, 2, () => 0.99)).toEqual([els[2], els[0]]);
  });

  it("does not mutate the input array", () => {
    const copy = [...els];
    chooseTables(els, 2, () => 0.99);
    expect(els).toEqual(copy);
  });
});

describe("flattenSteps", () => {
  it("lists a step's nested options after it, at any depth", () => {
    const steps: GMStep[] = [
      { choice: "A", then: [{ choice: "A1" }, { choice: "A2", then: [{ choice: "A2a" }] }] },
      { choice: "B" },
    ];
    expect(flattenSteps(steps).map((s) => s.choice)).toEqual(["A", "A1", "A2", "A2a", "B"]);
  });
});

describe("a name made of independently rolled parts — @pick", () => {
  const row = (...v: string[]) => ({ cells: v.map((value) => ({ value })) }) as TableDef["rows"][number];
  const table = {
    columnLabels: ["d100*", "Start 1", "Start 2", "Start 3", "End 1", "End 2"],
    rows: [row("1-50", "Briga", "Ma", "Lew", "ven", "werp"), row("51-100", "Ae", "", "", "bant", "")],
  } as unknown as TableDef;
  const spec = "Start=1,2,3+End=4,5";

  it("reads the parts and their names out of the spec", () => {
    expect(parsePickSpec(spec)).toEqual([
      { name: "Start", cols: [1, 2, 3] },
      { name: "End", cols: [4, 5] },
    ]);
    expect(parsePickSpec("1,2")).toEqual([{ cols: [1, 2] }]);
  });

  it("puts a space before a part joined by &, for words rather than syllables", () => {
    expect(parsePickSpec("Part 1=1,2& Part 2=3")).toEqual([
      { name: "Part 1", cols: [1, 2] },
      { name: "Part 2", cols: [3], spaced: true },
    ]);
    const words = {
      columnLabels: ["d20*", "A", "B"],
      rows: [row("1-20", "Constrictor", "of Moons")],
    } as unknown as TableDef;
    expect(pickNames(words, [5, 5], "A=1&B=2")).toEqual(["Constrictor of Moons"]);
  });

  it("counts the names a spec can make", () => {
    expect(pickSides("1,2")).toBe(2);
    expect(pickSides(spec)).toBe(6);
  });

  it("reads what one part's row offers", () => {
    expect(partText(table, 10, spec, 0)).toBe("Briga / Ma / Lew");
    expect(partText(table, 10, spec, 1)).toBe("ven / werp");
    expect(partText(table, 80, spec, 0)).toBe("Ae");
  });

  it("joins every value of the first part to every value of the next, from rows rolled apart", () => {
    expect(pickNames(table, [10, 80], spec)).toEqual(["Briga" + "bant", "Mabant", "Lewbant"]);
    expect(pickNames(table, [80, 10], spec)).toEqual(["Aeven", "Aewerp"]);
    expect(pickNames(table, [10], spec)).toBeUndefined();
  });

  it("takes the name the second roll lands on, wrapping when the rows offer fewer", () => {
    expect(pickResult(table, [10, 10], spec, 3)).toBe("Maven");
    expect(pickResult(table, [80, 80], spec, 5)).toBe("Aebant");
  });

  it("shows every name when there is no die", () => {
    expect(pickResult(table, [80, 80], spec)).toBe("Aebant");
    expect(pickResult(table, [10], "1,2")).toBe("Briga / Ma");
  });

  it("reads columns of one kind (Start 1, Start 2) as alternatives, but different kinds with their names", () => {
    const starts = {
      columnLabels: ["d100*", "Start 1", "Start 2"],
      rows: [row("1-100", "Cai", "Ma")],
    } as unknown as TableDef;
    expect(resolveTableRoll("d100=5 ->", starts)).toBe("d100=5 -> Cai / Ma");
    expect(resolveTableRoll("d100=5 ->", table)).toBe(
      "d100=5 -> Start 1: Briga · Start 2: Ma · Start 3: Lew · End 1: ven · End 2: werp"
    );
  });

  it("reads numbered alternative columns as alternatives", () => {
    const numbers = {
      columnLabels: ["d100*", "1", "2"],
      rows: [row("1-100", "Norel", "Nudwin")],
    } as unknown as TableDef;
    expect(resolveTableRoll("d100=5 ->", numbers)).toBe("d100=5 -> Norel / Nudwin");
  });
});
