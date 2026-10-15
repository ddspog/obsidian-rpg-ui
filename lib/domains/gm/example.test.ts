import { describe, it, expect } from "vitest";
import type { GMFeature, GMStep } from "../features/types";
import type { TableDef } from "../tables/types";
import {
  buildGMExampleLog,
  gmFollowLines,
  gmStepLines,
  resolveContest,
  applyDieEdit,
  resolveGmBody,
  stepGeneratedLine,
  expandStepBlockGens,
} from "./example";
import { applyChoicePick } from "../session-log/choice";

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

describe("stepGeneratedLine", () => {
  it("returns the flat labeled calc for a single-roll step", () => {
    expect(stepGeneratedLine({ choice: "Fate Question", calc: "d100= ->" })).toBe("Fate Question: d100= ->");
  });

  it("returns empty (record-only) for an empty calc", () => {
    expect(stepGeneratedLine({ choice: "The Next Expectation", calc: "" })).toBe("");
  });

  it("emits one self-describing roll line per table for a word pair", () => {
    const s: GMStep = {
      choice: "Meaning Actions",
      calc: "",
      tables: ["@[[Actions Meaning]]#action-01", "@[[Actions Meaning]]#action-02"],
    };
    expect(stepGeneratedLine(s)).toBe(
      [
        "Meaning Actions 1: @[[Actions Meaning]]#action-01 d100= ->",
        "Meaning Actions 2: @[[Actions Meaning]]#action-02 d100= ->",
      ].join("\n")
    );
  });

  it("randomly picks a subset of tables (deterministic via injected rng)", () => {
    const s: GMStep = {
      choice: "Meaning Elements",
      calc: "",
      pick: 2,
      tables: [
        "@[[Location Descriptors]]#locations",
        "@[[Character Descriptors]]#characters",
        "@[[Objects Descriptors]]#objects",
      ],
    };
    expect(stepGeneratedLine(s, () => 0)).toBe(
      [
        "Meaning Elements 1: @[[Location Descriptors]]#locations d100= ->",
        "Meaning Elements 2: @[[Character Descriptors]]#characters d100= ->",
      ].join("\n")
    );
  });
});

describe("resolveGmBody — word-pair steps", () => {
  const wordTable = (pairs: Array<[string, string]>): TableDef => ({
    name: "meaning",
    columns: ["d100", "Meaning"],
    columnLabels: ["d100", "Meaning"],
    headerRows: [],
    rows: pairs.map(([k, v]) => ({ cells: [{ value: k }, { value: v }] })),
    classes: [],
    footer: [],
  });
  const feature: GMFeature = {
    name: "Scene Check",
    generator: {
      name: "Test Gen",
      roll: "d10",
      vs: "CF",
      work: "Alterations",
      interpret: { "<=CF, odd": "@[[Altered Scene]]" },
    },
  };
  const pairStep: GMStep = {
    choice: "Meaning Actions",
    calc: "",
    tables: ["@[[Actions Meaning]]#action-01", "@[[Actions Meaning]]#action-02"],
  };
  const stepCtx = {
    steps: { "Altered Scene": { name: "Altered Scene", steps: [pairStep] } as GMFeature },
    tables: {
      "@[[Actions Meaning]]#action-01": wordTable([["13", "Betray"]]),
      "@[[Actions Meaning]]#action-02": wordTable([["8", "Weapon"]]),
    },
  };

  it("fills both words of a pair, each from its own table (label-suffix lookup)", () => {
    const body = [
      "gen: Test Gen",
      "  Meaning Actions 1: @[[Actions Meaning]]#action-01 d100=13 ->",
      "  Meaning Actions 2: @[[Actions Meaning]]#action-02 d100=8 ->",
    ].join("\n");
    const out = resolveGmBody(body, [feature], stepCtx);
    expect(out).toContain("Meaning Actions 1: @[[Actions Meaning]]#action-01 d100=13 -> Betray");
    expect(out).toContain("Meaning Actions 2: @[[Actions Meaning]]#action-02 d100=8 -> Weapon");
  });

  it("fills only the rolled word of a partially-rolled pair", () => {
    const body = [
      "gen: Test Gen",
      "  Meaning Actions 1: @[[Actions Meaning]]#action-01 d100=13 ->",
      "  Meaning Actions 2: @[[Actions Meaning]]#action-02 d100= ->",
    ].join("\n");
    const out = resolveGmBody(body, [feature], stepCtx);
    expect(out).toContain("d100=13 -> Betray");
    expect(out).not.toContain("Weapon");
  });

  it("is idempotent — re-resolving a filled pair changes nothing", () => {
    const body = [
      "gen: Test Gen",
      "  Meaning Actions 1: @[[Actions Meaning]]#action-01 d100=13 -> Betray",
      "  Meaning Actions 2: @[[Actions Meaning]]#action-02 d100=8 -> Weapon",
    ].join("\n");
    expect(resolveGmBody(body, [feature], stepCtx)).toBe(body);
  });
});

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
    expect(out).toContain("  Scene: d10=3 vs CF 5 -> Altered Scene [The Next Expectation/A Tweak/Fate Question - ]");
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
    const body = [
      '? [CF:5] Does the "x" scene happen?',
      "gen: Testing the Expected Scene",
      "  Scene: d10=3 vs CF 5 ->",
      '=> Start Scene(): "y"',
    ].join("\n");
    const out = resolveGmBody(body, [entry], stepCtx);
    expect(out).toContain("  Scene: d10=3 vs CF 5 -> Altered Scene [A Tweak/Fate Question - ]");
  });

  it("resolves an appended fate-question step line via the Fate Chart (CF from the body)", () => {
    const body = [
      "? [CF:5] q",
      "gen: Testing the Expected Scene",
      "  Scene: d10=3 vs CF 5 -> Altered Scene [A Tweak/Fate Question - Fate Question]",
      "  Fate Question: d100=20 ->",
    ].join("\n");
    const out = resolveGmBody(body, [entry], stepCtx);
    expect(out).toMatch(/ {2}Fate Question: d100=20 -> \S/);
  });

  it("leaves non-GM blocks and unrolled lines untouched", () => {
    const body = [
      "? [CF:5] q",
      "d(PC): d20=15 vs DC 12 -> Success",
      "gen: Testing the Expected Scene",
      "  Scene: d10= vs CF 5 ->",
    ].join("\n");
    const out = resolveGmBody(body, [entry], stepCtx);
    expect(out).toContain("d(PC): d20=15 vs DC 12 -> Success");
    expect(out).toContain("  Scene: d10= vs CF 5 -> ");
  });

  it("re-resolves a generator declared in `generators:` (card-composed), not just a top-level aspect", () => {
    // Same generator, but declared as a `generators:` entry (as a `cards:` feature does).
    const carded: GMFeature = {
      name: "Scene Check",
      generators: [{ id: "scene-check", ...entry.generator! }],
    };
    const body = [
      '? [CF:5] Does the "x" scene happen?',
      "gen: Testing the Expected Scene",
      "  Scene: d10=3 vs CF 5 ->",
    ].join("\n");
    const out = resolveGmBody(body, [carded], stepCtx);
    expect(out).toContain("  Scene: d10=3 vs CF 5 -> Altered Scene [A Tweak/Fate Question - ]");
  });

  it("overwrites a stale hand-authored result — a low roll no longer reads Expected Scene", () => {
    const feature: GMFeature = {
      name: "Testing the Expected Scene",
      generators: [
        {
          id: "scene-check",
          name: "Testing the Expected Scene",
          steps: [
            {
              work: "Alterations",
              roll: "d10",
              vs: "CF",
              interpret: {
                ">CF": "@[[Scene Check|Expected Scene]]",
                "<=CF, odd": "@[[Altered Scene]]",
                "<=CF, even": "@[[Interrupt Scene]]",
              },
            },
          ],
        },
      ],
    };
    // Each body carries a STALE "-> Expected Scene"; resolveGmBody re-derives from the roll.
    const mk = (n: number) =>
      ["? [CF:5] q", "gen: Testing the Expected Scene", `  Alterations: d10=${n} vs CF 5 -> Expected Scene`].join("\n");
    expect(resolveGmBody(mk(8), [feature])).toContain("Alterations: d10=8 vs CF 5 -> Expected Scene"); // 8 > 5
    expect(resolveGmBody(mk(2), [feature])).toContain("Alterations: d10=2 vs CF 5 -> Interrupt Scene"); // 2 even ≤ 5
    expect(resolveGmBody(mk(3), [feature])).toContain("Alterations: d10=3 vs CF 5 -> Altered Scene"); // 3 odd ≤ 5
  });

  it("matches each `steps:` working line to its OWN interpret by work-label", () => {
    const feature: GMFeature = {
      name: "Twin",
      generators: [
        {
          id: "twin",
          name: "Twin",
          steps: [
            { work: "First", roll: "d6", interpret: { ">3": "High", "<=3": "Low" } },
            { work: "Second", roll: "d6", interpret: { ">3": "Big", "<=3": "Small" } },
          ],
        },
      ],
    };
    const body = ["gen: Twin", "  First: d6=5 ->", "  Second: d6=2 ->"].join("\n");
    const out = resolveGmBody(body, [feature]);
    expect(out).toContain("  First: d6=5 -> High");
    expect(out).toContain("  Second: d6=2 -> Small");
  });
});

describe("resolveGmBody — single-choice branch auto-pick", () => {
  const feature: GMFeature = {
    name: "Testing the Expected Scene",
    generators: [
      {
        id: "scene-check",
        name: "Testing the Expected Scene",
        steps: [
          {
            work: "Alterations",
            roll: "d10",
            vs: "CF",
            interpret: {
              ">CF": "@[[Scene Check|Expected Scene]]",
              "<=CF, odd": "@[[Altered Scene]]",
              "<=CF, even": "@[[Interrupt Scene]]",
            },
          },
        ],
      },
    ],
  };
  const stepCtx = {
    steps: {
      // one NORMAL step → always fires (deterministic), no dropdown
      "Interrupt Scene": {
        name: "Interrupt Scene",
        steps: [{ step: "Generate a Random Event", calc: "@[[Random Event]]#random-event (roll it)" }],
      },
      // several choices → keeps the dropdown
      "Altered Scene": {
        name: "Altered Scene",
        steps: [
          { choice: "A Tweak", calc: "(note)" },
          { choice: "Fate Question", calc: "d100= ->" },
        ],
      },
    },
  };
  const mk = (n: number) =>
    ["? [CF:5] q", "gen: Testing the Expected Scene", `  Alterations: d10=${n} vs CF 5 ->`].join("\n");

  it("auto-fires a normal `step:` — bare label, no dropdown, follow-up line inserted", () => {
    const out = resolveGmBody(mk(2), [feature], stepCtx); // 2 even ≤ 5 → Interrupt Scene
    expect(out).toContain("  Alterations: d10=2 vs CF 5 -> Interrupt Scene ..."); // spawns → trailing ...
    expect(out).not.toContain("Interrupt Scene ["); // no dropdown for a deterministic step
    expect(out).toContain("  Generate a Random Event: @[[Random Event]]#random-event (roll it)");
  });

  it("also auto-picks a lone `choice:` (a one-item dropdown is pointless)", () => {
    const loneChoice = {
      steps: {
        "Interrupt Scene": {
          name: "Interrupt Scene",
          steps: [{ choice: "Generate a Random Event", calc: "@[[Random Event]]#random-event (roll it)" }],
        },
      },
    };
    const out = resolveGmBody(mk(2), [feature], loneChoice);
    expect(out).toContain("  Alterations: d10=2 vs CF 5 -> Interrupt Scene ...");
    expect(out).not.toContain("Interrupt Scene [");
    expect(out).toContain("  Generate a Random Event: @[[Random Event]]#random-event (roll it)");
  });

  it("still shows a dropdown when the branch offers several choices", () => {
    const out = resolveGmBody(mk(3), [feature], stepCtx); // 3 odd ≤ 5 → Altered Scene
    expect(out).toContain("Altered Scene [A Tweak/Fate Question - ]");
    expect(out).not.toContain("Generate a Random Event");
  });

  it("is idempotent — re-resolving keeps a single follow-up line", () => {
    const once = resolveGmBody(mk(2), [feature], stepCtx);
    const twice = resolveGmBody(once, [feature], stepCtx);
    expect(twice).toBe(once);
  });

  it("clears the stale follow-up when a re-roll leaves the single-choice branch", () => {
    const stale = [
      "? [CF:5] q",
      "gen: Testing the Expected Scene",
      "  Alterations: d10=8 vs CF 5 -> Interrupt Scene", // now 8 → Expected, old follow-up lingers
      "  Generate a Random Event: @[[Random Event]]#random-event (roll it)",
      '=> Start Scene(): "x"',
    ].join("\n");
    const out = resolveGmBody(stale, [feature], stepCtx);
    expect(out).toContain("  Alterations: d10=8 vs CF 5 -> Expected Scene");
    expect(out).not.toContain("Generate a Random Event"); // stale line removed
    expect(out).toContain('=> Start Scene(): "x"');
  });
});

describe("resolveGmBody — named step composition (`...` spawn + `+` children)", () => {
  const feature: GMFeature = {
    name: "Testing the Expected Scene",
    generators: [
      {
        id: "scene-check",
        name: "Testing the Expected Scene",
        steps: [
          {
            work: "Alterations",
            roll: "d10",
            vs: "CF",
            interpret: {
              ">CF": "@[[Scene Check|Expected Scene]]",
              "<=CF, even": "@[[Interrupt Scene]]",
            },
          },
        ],
      },
    ],
  };
  const stepCtx = {
    steps: {
      "Interrupt Scene": {
        name: "Interrupt Scene",
        steps: [{ step: "Random Event", calc: "Event and Meaning tables", calls: "@[[Random Event]]#random-event" }],
      },
    },
    calls: {
      "@[[Random Event]]#random-event": ["Event Focus: d100= ->", "Event Meaning: d100= ->"],
    },
  };
  const mk = (n: number) =>
    ["? [CF:5] q", "gen: Testing the Expected Scene", `  Alterations: d10=${n} vs CF 5 ->`].join("\n");

  it("marks the spawning line with `...` and lays the called sub-steps as `+ ` children", () => {
    const out = resolveGmBody(mk(4), [feature], stepCtx); // 4 even ≤ 5 → Interrupt Scene
    expect(out).toBe(
      [
        "? [CF:5] q",
        "gen: Testing the Expected Scene",
        "  Alterations: d10=4 vs CF 5 -> Interrupt Scene ...",
        "  Random Event: Event and Meaning tables",
        "  + Event Focus: d100= ->",
        "  + Event Meaning: d100= ->",
      ].join("\n")
    );
  });

  it("is idempotent — re-resolving keeps a single subtree", () => {
    const once = resolveGmBody(mk(4), [feature], stepCtx);
    expect(resolveGmBody(once, [feature], stepCtx)).toBe(once);
  });

  it("preserves a reader's rolled-in child value when re-resolving the same branch", () => {
    const spawned = resolveGmBody(mk(4), [feature], stepCtx);
    // the reader rolls the Event Focus child die
    const rolled = spawned.replace("+ Event Focus: d100= ->", "+ Event Focus: d100=42 -> NPC Action");
    const out = resolveGmBody(rolled, [feature], stepCtx);
    expect(out).toContain("+ Event Focus: d100=42 -> NPC Action"); // NOT wiped back to the unrolled template
    expect(out).toContain("Interrupt Scene ..."); // subtree still there
  });

  it("tears down the whole subtree (parent + `+ ` children + `...`) when a re-roll leaves the branch", () => {
    const spawned = resolveGmBody(mk(4), [feature], stepCtx); // Interrupt Scene subtree present
    const rerolled = spawned.replace("d10=4", "d10=8"); // 8 > CF → Expected Scene, no spawn
    const out = resolveGmBody(rerolled, [feature], stepCtx);
    expect(out).toBe(
      ["? [CF:5] q", "gen: Testing the Expected Scene", "  Alterations: d10=8 vs CF 5 -> Expected Scene"].join("\n")
    );
    expect(out).not.toContain("...");
    expect(out).not.toContain("Random Event");
    expect(out).not.toContain("+ Event");
  });
});

describe("expandStepBlockGens", () => {
  const feature: GMFeature = {
    name: "Interrupt Scene",
    steps: [{ step: "Random Event", calc: "Event and Meaning tables", calls: "@[[Random Event]]#random-event" }],
  };
  const stepCtx = { calls: { "@[[Random Event]]#random-event": ["Event Focus: d100= ->", "Action: d100= ->"] } };

  it("fills a bare `gen: <step-block>` with the feature's steps + `calls:` children", () => {
    const body = ["? q", "gen: Interrupt Scene", "=> S1"].join("\n");
    expect(expandStepBlockGens(body, [feature], stepCtx)).toBe(
      [
        "? q",
        "gen: Interrupt Scene",
        "  Random Event: Event and Meaning tables",
        "  + Event Focus: d100= ->",
        "  + Action: d100= ->",
        "=> S1",
      ].join("\n")
    );
  });

  it("leaves an already-populated gen block alone (idempotent)", () => {
    const once = expandStepBlockGens(["gen: Interrupt Scene", "=> S1"].join("\n"), [feature], stepCtx);
    expect(expandStepBlockGens(once, [feature], stepCtx)).toBe(once);
  });

  it("ignores a `gen:` that names something other than a loaded step block", () => {
    const body = ["gen: Random Event", "  Event Focus: d100= ->"].join("\n");
    expect(expandStepBlockGens(body, [feature], stepCtx)).toBe(body);
  });
});

describe("resolveGmBody — table-backed generator steps (a gen step rolls a table inline)", () => {
  const focusTable = {
    name: "random-event-focus-table",
    rows: [
      { cells: [{ value: "1-20" }, { value: "Remote Event" }] },
      { cells: [{ value: "21-40" }, { value: "NPC Action" }] },
    ],
  } as unknown as TableDef;
  const stepCtx = {
    stepTables: { "Event Focus": "@[[Event Focus]]#random-event-focus-table" },
    stepFollows: { "Event Focus": { NPC: "@[[Characters]]", Thread: "@[[Threads]]" } },
    tables: { "@[[Event Focus]]#random-event-focus-table": focusTable },
  };
  const feature: GMFeature = {
    name: "Random Event",
    generators: [
      {
        id: "re",
        name: "Random Event",
        steps: [{ work: "Event Focus", roll: "d100", table: "@[[Event Focus]]#random-event-focus-table" }],
      },
    ],
  };

  it("auto-fills a generator working line from its table on roll", () => {
    const body = ["gen: Random Event", "  Event Focus: d100=34 ->"].join("\n");
    expect(resolveGmBody(body, [feature], stepCtx)).toContain("  Event Focus: d100=34 -> NPC Action");
  });

  it("auto-fills a composed `+ ` child from its step's table too", () => {
    const body = ["gen: Random Event", "  Random Event: Event and Meaning tables", "  + Event Focus: d100=34 ->"].join(
      "\n"
    );
    expect(resolveGmBody(body, [feature], stepCtx)).toContain("  + Event Focus: d100=34 -> NPC Action");
  });

  it("leaves the result blank until the die is rolled", () => {
    const body = ["gen: Random Event", "  Event Focus: d100= ->"].join("\n");
    expect(resolveGmBody(body, [feature], stepCtx)).toContain("  Event Focus: d100= -> ");
  });

  it("resolves table-backed children under a `gen: <step-block>` invocation", () => {
    // A step block invoked via `gen: <self>` (Interrupt Scene) — its block must
    // be entered even though it has no generator aspect, so the child resolves.
    const interrupt: GMFeature = {
      name: "Interrupt Scene",
      steps: [{ step: "Random Event", calc: "Event and Meaning tables", calls: "@[[Random Event]]#random-event" }],
    };
    const body = [
      "gen: Interrupt Scene",
      "  Random Event: Event and Meaning tables",
      "  + Event Focus: d100=34 ->",
    ].join("\n");
    expect(resolveGmBody(body, [interrupt], stepCtx)).toContain("  + Event Focus: d100=34 -> NPC Action");
  });

  it("chains the interpreted follow-up (regex match on the result) as a nested step", () => {
    const body = ["gen: Random Event", "  Event Focus: d100=34 ->"].join("\n"); // 34 → NPC Action
    const out = resolveGmBody(body, [feature], stepCtx);
    expect(out).toContain("  Event Focus: d100=34 -> NPC Action");
    expect(out).toContain("    + @[[Characters]]"); // NPC → Characters, nested one deeper
  });

  it("clears the follow-up when a re-roll lands on a non-matching focus", () => {
    const spawned = resolveGmBody(["gen: Random Event", "  Event Focus: d100=34 ->"].join("\n"), [feature], stepCtx);
    const rerolled = spawned.replace("d100=34", "d100=3"); // 3 → Remote Event (no NPC/Thread)
    const out = resolveGmBody(rerolled, [feature], stepCtx);
    expect(out).toContain("  Event Focus: d100=3 -> Remote Event");
    expect(out).not.toContain("@[[Characters]]");
  });
});

describe("resolveGmBody — consult-list ramification (`[Characters?]` → default)", () => {
  const focusTable = {
    name: "random-event-focus-table",
    rows: [
      { cells: [{ value: "1-20" }, { value: "Remote Event" }] },
      { cells: [{ value: "21-40" }, { value: "NPC Action" }] },
    ],
  } as unknown as TableDef;
  const feature: GMFeature = {
    name: "Random Event",
    generators: [
      {
        id: "re",
        name: "Random Event",
        steps: [{ work: "Event Focus", roll: "d100", table: "@[[Event Focus]]#random-event-focus-table" }],
      },
    ],
  };
  const stepCtx = {
    stepTables: { "Event Focus": "@[[Event Focus]]#random-event-focus-table" },
    stepFollows: { "Event Focus": { NPC: "[Characters?]", Thread: "[Threads?]" } },
    tables: { "@[[Event Focus]]#random-event-focus-table": focusTable },
    lists: {
      Characters: { name: "Characters", default: "Any Character", entries: [] },
      Threads: { name: "Threads", default: "Any Thread", entries: [] },
    },
  };

  it("resolves a consult follow-up to the list's default", () => {
    const body = ["gen: Random Event", "  Event Focus: d100=34 ->"].join("\n"); // 34 → NPC → [Characters?]
    const out = resolveGmBody(body, [feature], stepCtx);
    expect(out).toContain("  Event Focus: d100=34 -> NPC Action");
    expect(out).toContain("    + Characters: Any Character");
  });

  it("falls back to the raw consult ref when the list is unknown", () => {
    const noLists = { ...stepCtx, lists: {} };
    const body = ["gen: Random Event", "  Event Focus: d100=34 ->"].join("\n");
    expect(resolveGmBody(body, [feature], noLists)).toContain("    + [Characters?]");
  });

  it("clears the consult on a re-roll to a non-matching focus", () => {
    const spawned = resolveGmBody(["gen: Random Event", "  Event Focus: d100=34 ->"].join("\n"), [feature], stepCtx);
    const out = resolveGmBody(spawned.replace("d100=34", "d100=3"), [feature], stepCtx); // 3 → Remote Event
    expect(out).toContain("  Event Focus: d100=3 -> Remote Event");
    expect(out).not.toContain("Characters:");
  });
});

describe("resolveGmBody — Random Event demo body (a `gen:` composing emits)", () => {
  const focusTable = {
    name: "random-event-focus-table",
    rows: [
      { cells: [{ value: "1-20" }, { value: "Remote Event" }] },
      { cells: [{ value: "21-40" }, { value: "NPC Action" }] },
    ],
  } as unknown as TableDef;
  // The generator only `emits:` sub-gens (no own steps) — the loader supplies the
  // expanded steps' context (stepTables / stepFollows / lists), so a hand-authored
  // `gen: Random Event` body still re-resolves the Event Focus working line.
  const feature: GMFeature = {
    name: "Random Event",
    generators: [
      {
        id: "random-event",
        name: "Random Event",
        emits: ["@[[Event Focus]]#event-focus", "@[[Event Meaning]]#event-meaning"],
      },
    ],
  };
  const stepCtx = {
    stepTables: { "Event Focus": "@[[Event Focus]]#random-event-focus-table" },
    stepFollows: { "Event Focus": { NPC: "[Characters?]", Thread: "[Threads?]" } },
    tables: { "@[[Event Focus]]#random-event-focus-table": focusTable },
    lists: { Characters: { name: "Characters", default: "Any Character", entries: [] } },
    genLines: { "Random Event": ["Event Focus: d100= ->", "Event Meaning: [Actions/Descriptions/Elements - ]"] },
  };

  it("derives the composed lines from a bare `gen: Random Event` (like a step block)", () => {
    const body = ["? A Random Event fires — what is it?", "gen: Random Event", "! Interpret it in Context."].join("\n");
    expect(expandStepBlockGens(body, [feature], stepCtx)).toBe(
      [
        "? A Random Event fires — what is it?",
        "gen: Random Event",
        "  Event Focus: d100= ->",
        "  Event Meaning: [Actions/Descriptions/Elements - ]",
        "! Interpret it in Context.",
      ].join("\n")
    );
  });

  it("does not re-populate an already-filled gen block (reader rolls survive)", () => {
    const once = expandStepBlockGens(["gen: Random Event", "! x"].join("\n"), [feature], stepCtx);
    const rolled = once.replace("Event Focus: d100= ->", "Event Focus: d100=34 ->");
    expect(expandStepBlockGens(rolled, [feature], stepCtx)).toBe(rolled);
  });

  it("auto-fills the Focus, ramifies to the list, and leaves the Meaning pick alone", () => {
    const body = [
      "? A Random Event fires — what is it?",
      "gen: Random Event",
      "  Event Focus: d100=34 ->",
      "  Event Meaning: [Actions/Descriptions/Elements - ]",
      "! An existing NPC acts.",
    ].join("\n");
    const out = resolveGmBody(body, [feature], stepCtx);
    expect(out).toContain("  Event Focus: d100=34 -> NPC Action");
    expect(out).toContain("    + Characters: Any Character");
    expect(out).toContain("  Event Meaning: [Actions/Descriptions/Elements - ]"); // untouched
    expect(out).toContain("! An existing NPC acts.");
  });

  it("picking a Meaning table inserts that table's word pair as `+ ` children", () => {
    const meaningBlock: GMFeature = {
      name: "Meaning Tables",
      steps: [
        { choice: "Actions", tables: ["@[[Actions Meaning]]#action-01", "@[[Actions Meaning]]#action-02"] },
        { choice: "Elements", calc: "(choose a specialized Element Meaning table)" },
      ],
    };
    const withBlock = { ...stepCtx, steps: { "Meaning Tables": meaningBlock } };
    const body = ["gen: Random Event", "  Event Meaning: [Actions/Descriptions/Elements - ]"].join("\n");
    const out = applyChoicePick(body, "Actions", gmStepLines(feature, withBlock));
    expect(out).toContain("  Event Meaning: [Actions/Descriptions/Elements - Actions]");
    expect(out).toContain("  + Actions 1: @[[Actions Meaning]]#action-01 d100= ->");
    expect(out).toContain("  + Actions 2: @[[Actions Meaning]]#action-02 d100= ->");
  });

  it("a picked `+ ` child still auto-fills from its own table when rolled", () => {
    const wordTable = (pairs: Array<[string, string]>) =>
      ({ name: "w", rows: pairs.map(([k, v]) => ({ cells: [{ value: k }, { value: v }] })) }) as unknown as TableDef;
    const meaningBlock: GMFeature = {
      name: "Meaning Tables",
      steps: [{ choice: "Actions", tables: ["@[[Actions Meaning]]#action-01", "@[[Actions Meaning]]#action-02"] }],
    };
    const withBlock = {
      ...stepCtx,
      steps: { "Meaning Tables": meaningBlock },
      tables: {
        ...stepCtx.tables,
        "@[[Actions Meaning]]#action-01": wordTable([["13", "Betray"]]),
        "@[[Actions Meaning]]#action-02": wordTable([["8", "Weapon"]]),
      },
    };
    const picked = applyChoicePick(
      ["gen: Random Event", "  Event Meaning: [Actions/Descriptions/Elements - ]"].join("\n"),
      "Actions",
      gmStepLines(feature, withBlock)
    );
    const rolled = picked
      .replace("action-01 d100=", "action-01 d100=13")
      .replace("action-02 d100=", "action-02 d100=8");
    const out = resolveGmBody(rolled, [feature], withBlock);
    expect(out).toContain("+ Actions 1: @[[Actions Meaning]]#action-01 d100=13 -> Betray");
    expect(out).toContain("+ Actions 2: @[[Actions Meaning]]#action-02 d100=8 -> Weapon");
  });
});

describe("resolveGmBody — CF dial default fallback", () => {
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
  // A loaded CF dial (via the feature's `reads:` link), default 5.
  const dialCtx = { dials: { CF: { abbr: "CF", min: 1, max: 9, default: 5 } } };

  it("falls back to the dial default when a line has no inline CF and no [CF:n] token", () => {
    // roll 7 vs default 5 → 7 > 5 → Expected Scene.
    const body = ["gen: Testing the Expected Scene", "  Scene: d10=7 ->"].join("\n");
    const out = resolveGmBody(body, [entry], dialCtx);
    expect(out).toContain("  Scene: d10=7 -> Expected Scene");
  });

  it("a [CF:n] token wins over the dial default", () => {
    // [CF:7]: roll 7 vs 7 → 7 <= 7, odd → Altered Scene (≠ Expected from default 5).
    const body = ["? [CF:7] q", "gen: Testing the Expected Scene", "  Scene: d10=7 ->"].join("\n");
    const out = resolveGmBody(body, [entry], dialCtx);
    expect(out).toContain("  Scene: d10=7 -> Altered Scene");
  });

  it("an inline `vs CF n` on the line wins over the dial default", () => {
    // inline vs CF 9: roll 7 vs 9 → 7 <= 9, odd → Altered Scene (≠ Expected from default 5).
    const body = ["gen: Testing the Expected Scene", "  Scene: d10=7 vs CF 9 ->"].join("\n");
    const out = resolveGmBody(body, [entry], dialCtx);
    expect(out).toContain("  Scene: d10=7 vs CF 9 -> Altered Scene");
  });

  it("without a loaded dial, output is unchanged (no CF available → blank)", () => {
    const body = ["gen: Testing the Expected Scene", "  Scene: d10=7 ->"].join("\n");
    const out = resolveGmBody(body, [entry]);
    expect(out).toContain("  Scene: d10=7 -> ");
    // the contest line stays blank — no result text after the arrow
    expect(out).not.toMatch(/Scene: d10=7 -> \S/);
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
    rows: [
      { cells: [{ value: "1" }, { value: "Remove a Character" }] },
      { cells: [{ value: "2" }, { value: "Add a Character" }] },
    ],
    classes: [],
    footer: [],
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

describe("resolveGmBody — Event Focus page body (a plain `steps:` generator)", () => {
  const focusTable = {
    name: "random-event-focus-table",
    rows: [
      { cells: [{ value: "1-5" }, { value: "Remote Event" }] },
      { cells: [{ value: "21-40" }, { value: "NPC Action" }] },
    ],
  } as unknown as TableDef;
  const feature: GMFeature = {
    name: "Event Focus",
    generators: [
      {
        id: "event-focus",
        name: "Event Focus",
        steps: [
          {
            work: "Event Focus",
            roll: "d100",
            table: "@[[Event Focus]]#random-event-focus-table",
            interpret: { NPC: "[Characters?]", Thread: "[Threads?]" },
          },
        ],
      },
    ],
  };
  const stepCtx = {
    stepTables: { "Event Focus": "@[[Event Focus]]#random-event-focus-table" },
    stepFollows: { "Event Focus": { NPC: "[Characters?]", Thread: "[Threads?]" } },
    tables: { "@[[Event Focus]]#random-event-focus-table": focusTable },
    lists: { Characters: { name: "Characters", default: "Any Character", entries: [] } },
    // A generator with plain `steps:` (no `emits:`) still derives its lines.
    genLines: { "Event Focus": ["Event Focus: d100= ->"] },
  };

  it("derives the working line from a bare `gen: Event Focus`", () => {
    const body = ["? Where is this Random Event centered?", "gen: Event Focus", "! Interpret it."].join("\n");
    expect(expandStepBlockGens(body, [feature], stepCtx)).toBe(
      ["? Where is this Random Event centered?", "gen: Event Focus", "  Event Focus: d100= ->", "! Interpret it."].join(
        "\n"
      )
    );
  });

  it("auto-fills and ramifies once the die is rolled", () => {
    const derived = expandStepBlockGens(["gen: Event Focus"].join("\n"), [feature], stepCtx);
    const out = resolveGmBody(derived.replace("d100=", "d100=34"), [feature], stepCtx);
    expect(out).toContain("  Event Focus: d100=34 -> NPC Action");
    expect(out).toContain("    + Characters: Any Character");
  });
});

describe("a feature declaring BOTH a `choices` generator and its pick-map steps", () => {
  // Event Meaning: one fence holds the picker generator AND the step block
  // naming what each pick spawns. `gen:` must invoke the GENERATOR, while the
  // feature's own steps feed the dropdown's pick map.
  const merged: GMFeature = {
    id: "event-meaning",
    name: "Event Meaning",
    generators: [
      {
        id: "event-meaning",
        name: "Event Meaning",
        steps: [{ work: "Event Meaning", choices: ["Actions", "Elements"] }],
      },
    ],
    steps: [
      { choice: "Actions", tables: ["@[[Actions Meaning]]#action-01", "@[[Actions Meaning]]#action-02"] },
      { choice: "Elements", calc: "(pick a themed table)" },
    ],
  };

  it("`gen: <name>` derives the GENERATOR's line, not the step block's steps", () => {
    const stepCtx = { genLines: { "Event Meaning": ["Event Meaning: [Actions/Elements - ]"] } };
    expect(expandStepBlockGens("gen: Event Meaning", [merged], stepCtx)).toBe(
      ["gen: Event Meaning", "  Event Meaning: [Actions/Elements - ]"].join("\n")
    );
  });

  it("the feature's OWN steps feed the pick map (no cross-file step block needed)", () => {
    const lines = gmStepLines(merged, {});
    expect(Object.keys(lines)).toEqual(["Actions", "Elements"]);
    expect(lines.Actions).toContain("Actions 1: @[[Actions Meaning]]#action-01 d100= ->");
  });

  it("picking spawns the word pair as `+ ` children of the picker line", () => {
    const body = ["gen: Event Meaning", "  Event Meaning: [Actions/Elements - ]"].join("\n");
    const out = applyChoicePick(body, "Actions", gmStepLines(merged, {}));
    expect(out).toContain("  Event Meaning: [Actions/Elements - Actions]");
    expect(out).toContain("  + Actions 1: @[[Actions Meaning]]#action-01 d100= ->");
    expect(out).toContain("  + Actions 2: @[[Actions Meaning]]#action-02 d100= ->");
  });

  it("ROLLING a picked child resolves against the feature's OWN step", () => {
    // The page has no cross-file step block — the pick map is the feature's own
    // `steps:`. `stepByLabel` used to read only `stepCtx.steps`, so these lines
    // rolled but never filled.
    const wordTable = (pairs: Array<[string, string]>) =>
      ({ name: "w", rows: pairs.map(([k, v]) => ({ cells: [{ value: k }, { value: v }] })) }) as unknown as TableDef;
    const ctx = {
      tables: {
        "@[[Actions Meaning]]#action-01": wordTable([["13", "Betray"]]),
        "@[[Actions Meaning]]#action-02": wordTable([["8", "Weapon"]]),
      },
      steps: {} as Record<string, GMFeature>,
    };
    const picked = applyChoicePick(
      ["gen: Event Meaning", "  Event Meaning: [Actions/Elements - ]"].join("\n"),
      "Actions",
      gmStepLines(merged, ctx)
    );
    const rolled = picked
      .replace("action-01 d100=", "action-01 d100=13")
      .replace("action-02 d100=", "action-02 d100=8");
    const out = resolveGmBody(rolled, [merged], ctx);
    expect(out).toContain("+ Actions 1: @[[Actions Meaning]]#action-01 d100=13 -> Betray");
    expect(out).toContain("+ Actions 2: @[[Actions Meaning]]#action-02 d100=8 -> Weapon");
  });
});
