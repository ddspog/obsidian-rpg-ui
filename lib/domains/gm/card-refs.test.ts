import { describe, it, expect } from "vitest";
import type { GMFeature } from "../features/types";
import { selectGenerator, cardXFileRefs, inlineCardXFileRefs } from "./card-refs";
import { emitCard } from "./emit";

describe("selectGenerator", () => {
  const sceneCheck: GMFeature = {
    name: "Testing the Expected Scene",
    id: "scene-check",
    generator: { name: "Testing the Expected Scene", roll: "d10", vs: "CF", work: "Scene" },
  };
  const withList: GMFeature = {
    name: "Tools",
    generators: [{ id: "meaning", name: "Meaning", roll: "d100" }],
  };

  it("matches a feature by its `id:`, returning its generator aspect", () => {
    expect(selectGenerator([sceneCheck], "scene-check")?.name).toBe("Testing the Expected Scene");
  });

  it("matches a `generators:` entry by id", () => {
    expect(selectGenerator([withList], "meaning")?.roll).toBe("d100");
  });

  it("returns null when the id matches nothing", () => {
    expect(selectGenerator([sceneCheck], "nope")).toBeNull();
  });

  it("with no id, returns the single generator-bearing feature (else null)", () => {
    expect(selectGenerator([sceneCheck])?.name).toBe("Testing the Expected Scene");
    expect(selectGenerator([sceneCheck, { ...sceneCheck, id: "other" }])).toBeNull();
  });
});

describe("cardXFileRefs", () => {
  it("collects distinct `@[[File]]#id` refs, ignoring local `@id` and inline pieces", () => {
    const feature: GMFeature = {
      name: "Scene Tools",
      cards: [
        { name: "A", emits: [{ oracle: { question: "?" } }, "@local", "@[[Scene Check]]#scene-check"] },
        { name: "B", emits: ["@[[Scene Check]]#scene-check", "@[[Other]]#gen"] },
      ],
    };
    expect(cardXFileRefs(feature)).toEqual(["@[[Scene Check]]#scene-check", "@[[Other]]#gen"]);
  });

  it("returns [] for a feature with no cards", () => {
    expect(cardXFileRefs({ name: "X" })).toEqual([]);
  });
});

describe("inlineCardXFileRefs", () => {
  it("inlines a resolved x-file ref into generators and rewrites the emit to a local @id", () => {
    const feature: GMFeature = {
      name: "Scene Tools",
      cards: [
        {
          name: "Reuse",
          stack: "generator",
          emits: [{ oracle: { question: "Happens?", chaos: true } }, "@[[Scene Check]]#scene-check"],
        },
      ],
    };
    const resolved = {
      "@[[Scene Check]]#scene-check": { name: "Testing the Expected Scene", roll: "d10", vs: "CF", work: "Scene" },
    };
    const out = inlineCardXFileRefs(feature, resolved);
    expect(out.generators).toEqual([{ name: "Testing the Expected Scene", roll: "d10", vs: "CF", work: "Scene", id: "xref-0" }]);
    expect(out.cards![0].emits[1]).toBe("@xref-0");
    // and it now emits as a full generator through emitCard
    expect(emitCard(out.cards![0], out.generators)).toBe(
      ["? [CF:{{cf}}] Happens?", "gen: Testing the Expected Scene", "  Scene: d10= vs CF {{cf}} ->"].join("\n")
    );
  });

  it("leaves an unresolved ref untouched (emitCard drops it)", () => {
    const feature: GMFeature = { name: "X", cards: [{ name: "A", emits: [{ oracle: { question: "Q?" } }, "@[[Gone]]#x"] }] };
    const out = inlineCardXFileRefs(feature, {});
    expect(out).toBe(feature); // no resolved refs → same reference, no rewrite
    expect(emitCard(out.cards![0])).toBe("? Q?");
  });

  it("also resolves cross-file refs inside a generator's own `emits:`", () => {
    const feature: GMFeature = {
      name: "Random Event",
      generators: [{ id: "random-event", name: "Random Event", emits: ["@[[Event Focus]]#focus"] }],
    };
    const resolved = { "@[[Event Focus]]#focus": { name: "Event Focus", roll: "d100" } };
    const out = inlineCardXFileRefs(feature, resolved);
    // the original generator's emit is rewritten to the synthesized local id…
    const orig = out.generators!.find((g) => g.id === "random-event")!;
    expect(orig.emits).toEqual(["@xref-0"]);
    // …and the resolved generator is appended under that id
    expect(out.generators!.find((g) => g.id === "xref-0")).toEqual({ name: "Event Focus", roll: "d100", id: "xref-0" });
  });
});
