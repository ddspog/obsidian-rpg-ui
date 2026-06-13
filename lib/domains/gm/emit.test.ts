import { describe, it, expect } from "vitest";
import type { GMFeature } from "../features/types";
import { emitGMFeature, gmPrimaryStack, gmStacks, refLabel } from "./emit";

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
