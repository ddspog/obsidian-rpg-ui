import { describe, it, expect } from "vitest";
import type { GMFeature } from "../features/types";
import type { TableDef } from "../tables/types";
import { buildGMExampleLog, gmFollowLines, gmStepLines, resolveContest, applyDieEdit, resolveGmBody } from "./example";

const sceneCheck: GMFeature = {
  name: "Scene Check",
  oracle: { question: "Does {{scene}} occur?", chaos: true },
  generator: {
    name: "Testing the Expected Scene",
    roll: "d10",
    vs: "CF",
    work: "Alterations",
    interpret: { ">CF": "Expected Scene", "<=CF, odd": "Altered Scene", "<=CF, even": "Interrupt Scene" },
  },
  scene: { opens: "S{{n}} {{title}}" },
};

describe("buildGMExampleLog", () => {
  it("returns null when the feature has no example", () => {
    expect(buildGMExampleLog(sceneCheck)).toBeNull();
  });

  it("fills placeholders + dice and COMPUTES the outcome from the feature's interpret", () => {
    const f: GMFeature = {
      ...sceneCheck,
      example: {
        scene: "the ambush at the rockslide",
        cf: 5,
        rolls: { d10: 8 }, // 8 > CF 5 → ">CF" → Expected Scene
        n: "01",
        title: "After the Landslide.",
      },
    };
    expect(buildGMExampleLog(f)).toBe(
      [
        "? [CF:5] Does the ambush at the rockslide occur?",
        "gen: Testing the Expected Scene",
        "  Alterations: d10=8 vs CF 5 -> Expected Scene",
        "=> S01 After the Landslide.",
      ].join("\n")
    );
  });

  it("picks the parity branch when the roll is <= CF and even (Interrupt)", () => {
    const f: GMFeature = {
      ...sceneCheck,
      example: { scene: "x", cf: 5, rolls: { d10: 4 }, n: "02", title: "T" },
    };
    expect(buildGMExampleLog(f)).toContain("d10=4 vs CF 5 -> Interrupt Scene");
  });

  it("honors an explicit result over the computed one", () => {
    const f: GMFeature = {
      ...sceneCheck,
      example: { scene: "x", cf: 5, rolls: { d10: 8 }, result: "Interrupt!", n: "1", title: "T" },
    };
    expect(buildGMExampleLog(f)).toContain("-> Interrupt!");
  });

  it("computes a likelihood oracle's answer via the Fate Chart", () => {
    const fate: GMFeature = {
      name: "Fate Question",
      oracle: { question: "Is the door locked?", chaos: true, likelihood: "likely", roll: "d100" },
      example: { cf: 5, rolls: { d100: 3 } }, // very low roll → exceptional yes
    };
    const out = buildGMExampleLog(fate)!;
    expect(out).toContain("? [CF:5] Is the door locked?");
    expect(out).toContain("-> ");
    // 3 is in the exceptional-yes band for likely@CF5 → "Yes, and..."
    expect(out).toMatch(/-> Yes/);
  });

  it("uses `narration` as the {{title}} alias when no title is given", () => {
    const f: GMFeature = {
      ...sceneCheck,
      example: { scene: "x", cf: 5, rolls: { d10: 8 }, n: "1", narration: "The pass is buried." },
    };
    expect(buildGMExampleLog(f)).toContain("=> S1 The pass is buried.");
  });
});

describe("buildGMExampleLog — follow-strategy choice slot", () => {
  const withFollow: GMFeature = {
    name: "Testing the Expected Scene",
    oracle: { question: "Does {{scene}} occur?", chaos: true },
    generator: {
      name: "Testing the Expected Scene",
      roll: "d10",
      vs: "CF",
      work: "Alterations",
      interpret: { ">CF": "Expected Scene", "<=CF, odd": "Altered Scene", "<=CF, even": "Interrupt Scene" },
      follow: {
        "Altered Scene": {
          "The Next Expectation": "",
          "A Tweak": "(note: Tweak the scene)",
          "Fate Question": "? [CF:5] Does it change? -> (d100=)",
        },
        "Interrupt Scene": { "Generate a Random Event": "gen: Event Focus d100= ->" },
      },
    },
    scene: { opens: "S{{n}} {{title}}" },
  };

  it("appends a [options - ] choice slot when the rolled result offers follow strategies", () => {
    // d10=3 is odd and <= CF 5 → Altered Scene, which has follow strategies.
    const f: GMFeature = { ...withFollow, example: { scene: "x", cf: 5, rolls: { d10: 3 }, n: "02", title: "T" } };
    expect(buildGMExampleLog(f)).toContain("-> Altered Scene [The Next Expectation/A Tweak/Fate Question - ]");
  });

  it("omits the slot for a result with no follow strategies", () => {
    // d10=8 > CF 5 → Expected Scene (no follow).
    const f: GMFeature = { ...withFollow, example: { scene: "x", cf: 5, rolls: { d10: 8 }, n: "1", title: "T" } };
    const out = buildGMExampleLog(f)!;
    expect(out).toContain("-> Expected Scene");
    expect(out).not.toContain(" - ]");
  });
});

describe("buildGMExampleLog — cross-file step branches", () => {
  // Entry feature: interpret results are @[[link]] branch refs (the new model).
  const entry: GMFeature = {
    name: "Testing the Expected Scene",
    oracle: { question: 'Does the "{{scene}}" scene happen as expected?', chaos: true },
    generator: {
      name: "Testing the Expected Scene",
      work: "Scene",
      roll: "d10",
      vs: "CF",
      interpret: {
        ">CF": "@[[Scene Check|Expected Scene]]",
        "<=CF, odd": "@[[Altered Scene]]",
        "<=CF, even": "@[[Interrupt Scene]]",
      },
    },
    scene: { opens: 'Start Scene(): "{{next}}"' },
    example: { scene: "ambush at the rockslide", cf: 5, rolls: { d10: 3 }, next: "the back exit" },
  };
  const alteredStep: GMFeature = {
    name: "Altered Scene",
    steps: [
      { choice: "The Next Expectation", calc: "" },
      { choice: "A Tweak", calc: "(note: tweak the scene)" },
      { choice: "Fate Question", calc: "d100= ->" },
    ],
  };
  const stepCtx = { steps: { "Altered Scene": alteredStep } };

  it("shows the branch label + the linked step block's choices as a dropdown", () => {
    const out = buildGMExampleLog(entry, stepCtx)!;
    expect(out).toContain(
      "  Scene: d10=3 vs CF 5 -> Altered Scene [The Next Expectation/A Tweak/Fate Question - ]"
    );
    expect(out).toContain('=> Start Scene(): "the back exit"');
  });

  it("shows the branch label with no dropdown when the step block isn't loaded", () => {
    const out = buildGMExampleLog(entry)!; // no stepCtx
    expect(out).toContain("-> Altered Scene");
    expect(out).not.toContain(" - ]");
  });

  it("uses just the link label for a branch with no step block (Expected)", () => {
    const f: GMFeature = { ...entry, example: { ...entry.example, rolls: { d10: 8 } } }; // >CF → Expected
    const out = buildGMExampleLog(f, stepCtx)!;
    expect(out).toContain("-> Expected Scene");
    expect(out).not.toContain(" - ]");
  });

  it("gmStepLines flattens loaded step choices to labeled `choice: calc` lines", () => {
    expect(gmStepLines(entry, stepCtx)).toEqual({
      "The Next Expectation": "",
      "A Tweak": "A Tweak: (note: tweak the scene)",
      "Fate Question": "Fate Question: d100= ->",
    });
  });
});

describe("resolveGmBody — re-resolve GM lines in a live body", () => {
  const entry: GMFeature = {
    name: "Testing the Expected Scene",
    generator: {
      name: "Testing the Expected Scene",
      work: "Scene",
      roll: "d10",
      vs: "CF",
      interpret: {
        ">CF": "@[[Scene Check|Expected Scene]]",
        "<=CF, odd": "@[[Altered Scene]]",
        "<=CF, even": "@[[Interrupt Scene]]",
      },
    },
  };
  const stepCtx = {
    steps: {
      "Altered Scene": {
        name: "Altered Scene",
        steps: [
          { choice: "A Tweak", calc: "(note: tweak)" },
          { choice: "Fate Question", calc: "d100= ->", likelihood: "50/50" as const },
        ],
      },
    },
  };

  it("resolves the primary contest to a branch label + step dropdown", () => {
    const body = ['? [CF:5] Does the "x" scene happen?', "gen: Testing the Expected Scene", "  Scene: d10=3 vs CF 5 ->", '=> Start Scene(): "y"'].join("\n");
    const out = resolveGmBody(body, [entry], stepCtx);
    expect(out).toContain("  Scene: d10=3 vs CF 5 -> Altered Scene [A Tweak/Fate Question - ]");
  });

  it("resolves an appended fate-question step line via the Fate Chart (CF from the body)", () => {
    const body = ["? [CF:5] q", "gen: Testing the Expected Scene", "  Scene: d10=3 vs CF 5 -> Altered Scene [A Tweak/Fate Question - Fate Question]", "  Fate Question: d100=20 ->"].join("\n");
    const out = resolveGmBody(body, [entry], stepCtx);
    expect(out).toMatch(/ {2}Fate Question: d100=20 -> \S/);
  });

  it("leaves non-GM blocks and unrolled lines untouched", () => {
    const body = ["? [CF:5] q", "d(PC): d20=15 vs DC 12 -> Success", "gen: Testing the Expected Scene", "  Scene: d10= vs CF 5 ->"].join("\n");
    const out = resolveGmBody(body, [entry], stepCtx);
    expect(out).toContain("d(PC): d20=15 vs DC 12 -> Success");
    expect(out).toContain("  Scene: d10= vs CF 5 -> ");
  });
});

describe("gmFollowLines", () => {
  it("flattens every result's option->line into one lookup", () => {
    const f: GMFeature = {
      name: "x",
      generator: {
        name: "g",
        follow: {
          "Altered Scene": { "A Tweak": "(note: tweak)", "Fate Question": "? q -> (d100=)" },
          "Interrupt Scene": { "Random Event": "gen: Event Focus d100= ->" },
        },
      },
    };
    expect(gmFollowLines(f)).toEqual({
      "A Tweak": "(note: tweak)",
      "Fate Question": "? q -> (d100=)",
      "Random Event": "gen: Event Focus d100= ->",
    });
  });

  it("returns {} when there is no follow", () => {
    expect(gmFollowLines({ name: "x", generator: { name: "g" } })).toEqual({});
  });
});

describe("resolveContest", () => {
  const interpret = { ">CF": "Expected Scene", "<=CF, odd": "Altered Scene", "<=CF, even": "Interrupt Scene" };
  const follow = { "Altered Scene": { "A Tweak": "(note: tweak)", "Fate Question": "? q -> (d100=)" } };

  it("resolves a rolled contest via interpret", () => {
    expect(resolveContest("d10=8 vs CF 5", interpret)).toBe("Expected Scene");
  });

  it("appends the follow choice slot when the result offers strategies", () => {
    expect(resolveContest("d10=3 vs CF 5", interpret, follow)).toBe("Altered Scene [A Tweak/Fate Question - ]");
  });

  it("returns null for an unrolled die or a non-contest", () => {
    expect(resolveContest("d10= vs CF 5", interpret)).toBeNull();
    expect(resolveContest("just text", interpret)).toBeNull();
  });
});

describe("applyDieEdit", () => {
  const feature: GMFeature = {
    name: "Testing the Expected Scene",
    generator: {
      name: "Testing the Expected Scene",
      roll: "d10",
      vs: "CF",
      work: "Alterations",
      interpret: { ">CF": "Expected Scene", "<=CF, odd": "Altered Scene", "<=CF, even": "Interrupt Scene" },
    },
  };
  const log = ["gen: Testing the Expected Scene", "  Alterations: d10=3 vs CF 5 -> Altered Scene", "=> S02 X"].join(
    "\n"
  );

  it("sets the die and re-resolves the result on that line", () => {
    // 3 -> 8 flips Altered (odd<=CF) to Expected (>CF).
    const out = applyDieEdit(log, "Alterations: d10=3 vs CF 5 -> Altered Scene", "d10=3", "8", feature);
    expect(out).toContain("Alterations: d10=8 vs CF 5 -> Expected Scene");
  });

  it("leaves unrelated lines (no contest) untouched", () => {
    const withNote = log + "\n  (note: keep me)";
    const out = applyDieEdit(withNote, "(note: keep me)", "d10=3", "8", feature);
    expect(out).toContain("(note: keep me)");
  });
});

describe("applyDieEdit — appended step lines resolve via the step's metadata", () => {
  const entry: GMFeature = {
    name: "Testing the Expected Scene",
    oracle: { question: "Does {{scene}} occur?", chaos: true },
    generator: { name: "Testing the Expected Scene", work: "Scene", roll: "d10", vs: "CF" },
    example: { scene: "x", cf: 5 },
  };
  const sceneAdjustment: TableDef = {
    name: "scene-adjustment",
    columns: ["1d10", "result"],
    columnLabels: ["1D10", "RESULT"],
    headerRows: [],
    footerCells: [],
    rows: [
      { cells: [{ value: "1" }, { value: "Remove a Character" }] },
      { cells: [{ value: "2" }, { value: "Add a Character" }] },
    ],
    classes: [],
    footerRows: [],
  };
  const stepCtx = {
    steps: {
      "Altered Scene": {
        name: "Altered Scene",
        steps: [
          { choice: "Fate Question", calc: "d100= ->", likelihood: "50/50" as const },
          { choice: "Scene Adjustment", calc: "d10= ->", table: "@[[Altered Scene]]#scene-adjustment" },
        ],
      },
    },
    tables: { "@[[Altered Scene]]#scene-adjustment": sceneAdjustment },
  };

  it("auto-fills a table-backed step from the looked-up row", () => {
    const log = "gen: Testing the Expected Scene\n  Scene: d10=3 vs CF 5 -> Altered Scene\n  Scene Adjustment: d10= ->";
    const out = applyDieEdit(log, "Scene Adjustment: d10= ->", "d10=", "2", entry, stepCtx);
    expect(out).toContain("  Scene Adjustment: d10=2 -> Add a Character");
  });

  it("resolves a likelihood step via the Fate Chart", () => {
    const log = "gen: Testing the Expected Scene\n  Fate Question: d100= ->";
    const out = applyDieEdit(log, "Fate Question: d100= ->", "d100=", "20", entry, stepCtx);
    expect(out).toMatch(/Fate Question: d100=20 -> \S/); // a worded answer was filled
  });

  it("blanks the result when the die is cleared", () => {
    const log = "gen: Testing the Expected Scene\n  Scene Adjustment: d10=2 -> Add a Character";
    const out = applyDieEdit(log, "Scene Adjustment: d10=2 -> Add a Character", "d10=2", "", entry, stepCtx);
    expect(out).toContain("  Scene Adjustment: d10= -> ");
  });
});
