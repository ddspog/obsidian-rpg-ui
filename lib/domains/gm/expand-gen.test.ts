import { describe, it, expect } from "vitest";
import { expandCalledGenerator } from "./expand-gen";
import type { GMFeature, GMGeneratorAspect } from "../features/types";

// A tiny two-file vault: Random Event emits Event Focus + Event Meaning.
const EVENT_FOCUS: GMFeature[] = [
  {
    name: "Event Focus",
    reads: ["@[[Characters]]", "@[[Threads]]"],
    generators: [
      {
        id: "event-focus",
        name: "Event Focus",
        steps: [{ work: "Event Focus", roll: "d100", table: "@[[Event Focus]]#focus", interpret: { NPC: "[Characters?]" } }],
      },
    ],
  },
];
const EVENT_MEANING: GMFeature[] = [
  { name: "Event Meaning", generators: [{ id: "event-meaning", name: "Event Meaning", steps: [{ work: "Event Meaning", choices: ["Actions", "Descriptions"] }] }] },
  { name: "Meaning Tables", steps: [{ choice: "Actions", tables: ["@[[Actions Meaning]]#action-01", "@[[Actions Meaning]]#action-02"] }] },
];

const read = async (target: string): Promise<GMFeature[] | null> =>
  target === "Event Focus" ? EVENT_FOCUS : target === "Event Meaning" ? EVENT_MEANING : null;

describe("expandCalledGenerator", () => {
  const randomEvent: GMGeneratorAspect = {
    name: "Random Event",
    emits: ["@[[Event Focus]]#event-focus", "@[[Event Meaning]]#event-meaning"],
  };

  it("flattens a generator's cross-file `emits:` sub-generators into one step list", async () => {
    const out = await expandCalledGenerator(randomEvent, read);
    expect(out.steps.map((s) => s.work)).toEqual(["Event Focus", "Event Meaning"]);
  });

  it("collects the touched files' step blocks (for a `choices` pick map)", async () => {
    const out = await expandCalledGenerator(randomEvent, read);
    expect(out.stepBlocks.map((f) => f.name)).toContain("Meaning Tables");
  });

  it("collects `reads:`-bearing features (for list imports)", async () => {
    const out = await expandCalledGenerator(randomEvent, read);
    expect(out.readsFeatures.some((f) => f.reads?.includes("@[[Characters]]"))).toBe(true);
  });

  it("returns a plain `steps:` generator unchanged (no emits)", async () => {
    const gen: GMGeneratorAspect = { name: "Solo", steps: [{ work: "Roll", roll: "d6" }] };
    const out = await expandCalledGenerator(gen, read);
    expect(out.steps).toEqual([{ work: "Roll", roll: "d6" }]);
    expect(out.stepBlocks).toEqual([]);
  });

  it("expands a plain `steps:` generator so IT can derive a `gen:` body too", async () => {
    // Event Focus has no `emits:` — its own steps are the working lines, so a
    // `gen: Event Focus` block on its page populates from them (the loaders used
    // to skip any generator without `emits:`, leaving such a block empty).
    const focusGen = EVENT_FOCUS[0].generators![0];
    const out = await expandCalledGenerator(focusGen, read);
    expect(out.steps).toHaveLength(1);
    expect(out.steps[0].work).toBe("Event Focus");
    expect(out.steps[0].table).toBe("@[[Event Focus]]#focus");
  });

  it("breaks an emit cycle instead of looping forever", async () => {
    const A: GMFeature[] = [{ name: "A", generators: [{ id: "a", name: "A", emits: ["@[[B]]#b"] }] }];
    const B: GMFeature[] = [{ name: "B", generators: [{ id: "b", name: "B", emits: ["@[[A]]#a"] }] }];
    const readAB = async (t: string) => (t === "A" ? A : t === "B" ? B : null);
    const out = await expandCalledGenerator(A[0].generators![0], readAB);
    expect(out.steps).toEqual([]); // neither has working steps; recursion terminates
  });
});
