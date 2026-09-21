import { describe, it, expect } from "vitest";
import type { GMFeature, GMCardDef, NamedGenerator } from "../features/types";
import { emitGMFeature, emitCard, cardPrimaryStack, gmPrimaryStack, gmStacks, refLabel } from "./emit";

describe("emitCard", () => {
  it("emits a card's pieces in the declared order, sharing the oracle's cf", () => {
    const card: GMCardDef = {
      name: "Scene Check",
      emits: [
        { oracle: { question: 'Does the "{{scene}}" scene happen?', chaos: true } },
        { generator: { name: "Testing the Expected Scene", roll: "d10", vs: "CF", work: "Scene" } },
        { scene: { opens: 'Start Scene(): "{{next}}"' } },
      ],
    };
    expect(emitCard(card)).toBe(
      [
        '? [CF:{{cf}}] Does the "{{scene}}" scene happen?',
        "gen: Testing the Expected Scene",
        "  Scene: d10= vs CF {{cf}} ->",
        '=> Start Scene(): "{{next}}"',
      ].join("\n")
    );
  });

  it("respects the written order even when it differs from the aspect order", () => {
    const card: GMCardDef = { name: "X", emits: [{ scene: { opens: "S{{n}}" } }, { roll: { die: "d6" } }] };
    expect(emitCard(card)).toBe(["=> S{{n}}", "d: d6= ->"].join("\n"));
  });

  it("cardPrimaryStack uses `stack:` else the first emit piece's aspect", () => {
    expect(cardPrimaryStack({ name: "A", emits: [{ table: { source: "@[[T]]" } }] })).toBe("table");
    expect(cardPrimaryStack({ name: "B", stack: "scene", emits: [{ oracle: { question: "?" } }] })).toBe("scene");
    expect(cardPrimaryStack({ name: "C", emits: [] })).toBeNull();
  });

  it("resolves a local `@ref` in emits against the feature's generators", () => {
    const generators: NamedGenerator[] = [
      { id: "scene-check", name: "Testing the Expected Scene", roll: "d10", vs: "CF", work: "Scene" },
    ];
    const card: GMCardDef = {
      name: "Test a Scene",
      emits: [
        { oracle: { question: 'Does the "{{scene}}" scene happen?', chaos: true } },
        "@scene-check",
        { scene: { opens: 'Start Scene(): "{{next}}"' } },
      ],
    };
    expect(emitCard(card, generators)).toBe(
      [
        '? [CF:{{cf}}] Does the "{{scene}}" scene happen?',
        "gen: Testing the Expected Scene",
        "  Scene: d10= vs CF {{cf}} ->",
        '=> Start Scene(): "{{next}}"',
      ].join("\n")
    );
    // a local @ref as the lead piece → generator stack
    expect(cardPrimaryStack({ name: "G", emits: ["@scene-check"] }, generators)).toBe("generator");
  });

  it("drops an unresolved (cross-file / unknown) `@ref`, emitting the rest", () => {
    const card: GMCardDef = { name: "X", emits: [{ oracle: { question: "Locked?" } }, "@[[Other]]#gen"] };
    expect(emitCard(card)).toBe("? Locked?");
  });
});

describe("generator composition (emits)", () => {
  it("expands a feature generator's `emits:` sub-generators inline, in order", () => {
    const feature: GMFeature = {
      name: "Random Event",
      generators: [
        { id: "focus", name: "Event Focus", roll: "d100" },
        { id: "action", name: "Event Meaning: Action", roll: "d100" },
        { id: "subject", name: "Event Meaning: Subject", roll: "d100" },
      ],
      generator: { name: "Random Event", emits: ["@focus", "@action", "@subject"] },
    };
    expect(emitGMFeature(feature)).toBe(
      [
        "gen: Random Event",
        "gen: Event Focus",
        "  d100= ->",
        "gen: Event Meaning: Action",
        "  d100= ->",
        "gen: Event Meaning: Subject",
        "  d100= ->",
      ].join("\n")
    );
  });

  it("recurses through a nested generator `emits:` chain", () => {
    const generators: NamedGenerator[] = [
      { id: "outer", name: "Outer", emits: ["@inner"] },
      { id: "inner", name: "Inner", roll: "d6" },
    ];
    const card: GMCardDef = { name: "C", emits: ["@outer"] };
    expect(emitCard(card, generators)).toBe(["gen: Outer", "gen: Inner", "  d6= ->"].join("\n"));
  });

  it("breaks a generator cycle instead of looping forever", () => {
    const generators: NamedGenerator[] = [
      { id: "a", name: "A", emits: ["@b"] },
      { id: "b", name: "B", emits: ["@a"] },
    ];
    // A -> B -> (A already seen, stop)
    expect(emitCard({ name: "C", emits: ["@a"] }, generators)).toBe(["gen: A", "gen: B", "gen: A"].join("\n"));
  });
});

describe("generator steps", () => {
  it("emits one working line per `steps:` entry under a single gen header", () => {
    const feature: GMFeature = {
      name: "Random Event",
      generator: {
        name: "Random Event",
        steps: [
          { work: "Event Focus", roll: "d100" },
          { work: "Action", roll: "d100" },
          { work: "Subject", roll: "d100" },
        ],
      },
    };
    expect(emitGMFeature(feature)).toBe(
      ["gen: Random Event", "  Event Focus: d100= ->", "  Action: d100= ->", "  Subject: d100= ->"].join("\n")
    );
  });

  it("still supports the flat work/roll/vs sugar as a single step", () => {
    expect(emitGMFeature({ name: "G", generator: { name: "Test", work: "Alterations", roll: "d10", vs: "CF" } })).toBe(
      ["gen: Test", "  Alterations: d10= vs CF ->"].join("\n")
    );
  });

  it("emits a `choices:` step as a pick dropdown (no die)", () => {
    const feature: GMFeature = {
      name: "Event Meaning",
      generator: { name: "Event Meaning", steps: [{ work: "Event Meaning", choices: ["Actions", "Descriptions", "Elements"] }] },
    };
    expect(emitGMFeature(feature)).toBe(
      ["gen: Event Meaning", "  Event Meaning: [Actions/Descriptions/Elements - ]"].join("\n")
    );
  });
});

describe("emitGMFeature", () => {
  it("emits a Mythic scene check (oracle + generator + scene) as the canonical block", () => {
    const feature: GMFeature = {
      name: "Scene Check",
      oracle: { question: "Does {{scene}} occur?", chaos: true },
      generator: {
        name: "Testing the Expected Scene",
        roll: "d10",
        vs: "CF",
        work: "Alterations",
        interpret: { ">CF": "Expected Scene", "<=CF, even": "Altered Scene", "<=CF, odd": "Interrupt Scene" },
      },
      scene: { opens: "S{{n}} {{title}}" },
    };
    expect(emitGMFeature(feature)).toBe(
      [
        "? [CF:{{cf}}] Does {{scene}} occur?",
        "gen: Testing the Expected Scene",
        "  Alterations: d10= vs CF {{cf}} ->",
        "=> S{{n}} {{title}}",
      ].join("\n")
    );
  });

  it("bakes a constant cf and leaves a {{cf}} slot when chaos is true", () => {
    expect(emitGMFeature({ name: "Q", oracle: { question: "Locked?", cf: 5 } })).toBe("? [CF:5] Locked?");
    expect(emitGMFeature({ name: "Q", oracle: { question: "Locked?", chaos: true } })).toBe("? [CF:{{cf}}] Locked?");
    expect(emitGMFeature({ name: "Q", oracle: { question: "Locked?" } })).toBe("? Locked?");
  });

  it("references an imported resource by `tag:` — emits `[<tag>:{{<tag>}}]`", () => {
    // `chaos: true` is now sugar for `tag: CF`
    expect(emitGMFeature({ name: "Q", oracle: { question: "Locked?", tag: "CF" } })).toBe("? [CF:{{cf}}] Locked?");
    // any other imported dial works the same, keyed by its declared abbr
    expect(emitGMFeature({ name: "Q", oracle: { question: "Reinforcements arrive?", tag: "RF" } })).toBe(
      "? [RF:{{rf}}] Reinforcements arrive?"
    );
    // a constant `cf:` still bakes a literal under the tag
    expect(emitGMFeature({ name: "Q", oracle: { question: "Q?", tag: "RF", cf: 3 } })).toBe("? [RF:3] Q?");
  });

  it("shares the oracle's `tag` value with the generator's `vs: CF`", () => {
    const feature: GMFeature = {
      name: "Scene Check",
      oracle: { question: "Happens?", tag: "CF" },
      generator: { name: "Test", work: "Alterations", roll: "d10", vs: "CF" },
    };
    expect(emitGMFeature(feature)).toBe(
      ["? [CF:{{cf}}] Happens?", "gen: Test", "  Alterations: d10= vs CF {{cf}} ->"].join("\n")
    );
  });

  it("emits an oracle answer line only when the oracle resolves itself", () => {
    expect(
      emitGMFeature({ name: "Fate", oracle: { question: "Locked?", chaos: true, likelihood: "likely", roll: "d100" } })
    ).toBe(["? [CF:{{cf}}] Locked?", "-> (d100=)"].join("\n"));
    expect(emitGMFeature({ name: "Fate", oracle: { question: "Locked?", interpret: { ">10": "Yes" } } })).toBe(
      ["? Locked?", "->"].join("\n")
    );
  });

  it("attributes a question with ?(Name)", () => {
    expect(emitGMFeature({ name: "Q", oracle: { question: "Inhabited?", attribution: "Sable", cf: 3 } })).toBe(
      "?(Sable) [CF:3] Inhabited?"
    );
  });

  it("emits a named roll as a d(Name): contest, unrolled", () => {
    expect(emitGMFeature({ name: "Stealth", roll: { name: "Stealth", die: "d20+5", vs: "DC 15" } })).toBe(
      "d(Stealth): d20+5= vs DC 15 ->"
    );
    expect(emitGMFeature({ name: "Flat", roll: { die: "d20" } })).toBe("d: d20= ->");
  });

  it("emits a table roll from an @[[…]] reference, unrolled", () => {
    expect(emitGMFeature({ name: "Weather", table: { source: "@[[Tables/Weather]]", die: "d6" } })).toBe(
      "tbl: Weather d6= ->"
    );
    expect(emitGMFeature({ name: "Weather", table: { source: "Weather" } })).toBe("tbl: Weather ->");
  });

  it("emits one tbl line per source when the table aspect lists several (same or other files)", () => {
    expect(
      emitGMFeature({
        name: "Actions Meaning",
        table: { source: ["@[[Actions Meaning]].table(action-01)", "@[[Actions Meaning]].table(action-02)"] },
      })
    ).toBe(["tbl: action-01 ->", "tbl: action-02 ->"].join("\n"));
    // cross-file + a shared die override
    expect(
      emitGMFeature({
        name: "Elements",
        table: { source: ["@[[Location Descriptors]].table(locations)", "@[[Objects Descriptors]].table(objects)"], die: "d100" },
      })
    ).toBe(["tbl: locations d100= ->", "tbl: objects d100= ->"].join("\n"));
  });

  it("emits an event with leading focus/meaning generators then the ! line", () => {
    expect(
      emitGMFeature({
        name: "Random Event",
        event: {
          focus: "@[[Oracles/Event Focus]]",
          meaning: ["@[[Oracles/Action]]", "@[[Oracles/Subject]]"],
          text: "{{event}}",
        },
      })
    ).toBe(["gen: Event Focus ->", "gen: Action ->", "gen: Subject ->", "! {{event}}"].join("\n"));
    expect(emitGMFeature({ name: "World", event: {} })).toBe("! {{event}}");
  });

  it("emits scene opens and plain consequences", () => {
    expect(emitGMFeature({ name: "S", scene: { opens: "S{{n}} {{title}}" } })).toBe("=> S{{n}} {{title}}");
    expect(emitGMFeature({ name: "C", scene: { consequence: "The door slams shut" } })).toBe("=> The door slams shut");
  });

  it("expands a generator's `vs: CF` against the feature chaos factor", () => {
    expect(
      emitGMFeature({ name: "G", oracle: { question: "?", cf: 7 }, generator: { name: "Roll", roll: "d10", vs: "CF" } })
    ).toBe(["? [CF:7] ?", "gen: Roll", "  d10= vs CF 7 ->"].join("\n"));
  });
});

describe("gmStacks / gmPrimaryStack", () => {
  it("lists declared aspects in canonical order and defaults the stack to the first", () => {
    const f: GMFeature = { name: "X", scene: { opens: "S1" }, oracle: { question: "?" }, roll: { die: "d6" } };
    expect(gmStacks(f)).toEqual(["oracle", "roll", "scene"]);
    expect(gmPrimaryStack(f)).toBe("oracle");
  });

  it("honors an explicit stack override", () => {
    expect(gmPrimaryStack({ name: "X", stack: "scene", oracle: { question: "?" } })).toBe("scene");
  });

  it("returns null when no aspect is declared", () => {
    expect(gmPrimaryStack({ name: "X" })).toBeNull();
  });
});

describe("refLabel", () => {
  it("resolves call/wikilink/path/alias forms to a display label", () => {
    expect(refLabel("@[[Tables/Weather]]")).toBe("Weather");
    expect(refLabel("[[Oracles/Fate Chart|Fate]]")).toBe("Fate");
    expect(refLabel("@[[06. Playing#Downtime]]")).toBe("06. Playing");
    expect(refLabel("Weather")).toBe("Weather");
  });
});
