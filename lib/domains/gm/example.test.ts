import { describe, it, expect } from "vitest";
import type { GMFeature } from "../features/types";
import { buildGMExampleLog, gmFollowLines, resolveContest, applyDieEdit } from "./example";

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
