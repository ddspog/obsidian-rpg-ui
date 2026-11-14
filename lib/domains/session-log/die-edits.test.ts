import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import {
  applyTokenEdits,
  buildSidebarItems,
  checkResult,
  dieEditKey,
  withActorRefs,
  withCheckResults,
} from "./prose-model";
import { applySwapsToBody, fillDerivedResults, pendingTermSwaps } from "./die-edits";

const read = (text: string, refs: Record<string, number> = {}) =>
  withCheckResults(withActorRefs(buildSidebarItems(groupIntoProse(parseLonelog(text))), (_a, n) => refs[n]));

describe("checkResult — a DC check judged from its roll", () => {
  it("compares the result — the die and its modifiers — with the DC", () => {
    expect(checkResult("d20+5=11 vs DC 11", {})).toBe("Success");
    expect(checkResult("d20+5=10 vs DC 11", {})).toBe("Failure");
    // An older line that wrote only the die (less than the modifier allows) still reads.
    expect(checkResult("d20+5=5 vs DC 11", {})).toBe("Failure");
    expect(checkResult("d20+[[Insight]]=11 vs DC 10", { refs: { Insight: 4 } })).toBe("Success");
  });

  it("waits for the die, every modifier, and a blank result", () => {
    expect(checkResult("d20+5= vs DC 11", {})).toBeNull();
    expect(checkResult("d20+[[Insight]]=11 vs DC 10", {})).toBeNull();
    expect(checkResult("d20+5=18 vs DC 11 -> Barely", {})).toBeNull();
    expect(checkResult("d20+5=18", {})).toBeNull();
  });
});

describe("rolling a card in its preview", () => {
  const card = "@(Talon) Checking if the Kobold is lying\nd: d20+[[Insight]]= vs DC 10 ->\n=> I watched him.";

  it("writes the rolled die into its line, and the result after it", () => {
    const base = read(card, { Insight: 4 });
    const source = "d: d20+[[Insight]]= vs DC 10 ->";
    const rolled = applySwapsToBody(
      card,
      pendingTermSwaps(base, { [dieEditKey(source, "d20+[[Insight]]=", 0)]: "11" })
    );
    expect(rolled.split("\n")[1]).toBe("d: d20+[[Insight]]=11 vs DC 10 ->");
    expect(fillDerivedResults(rolled, read(rolled, { Insight: 4 }))).toBe(
      "@(Talon) Checking if the Kobold is lying\nd: d20+[[Insight]]=11 vs DC 10 -> Success\n=> I watched him."
    );
  });

  it("leaves an unrolled die unrolled", () => {
    const base = read(card, { Insight: 4 });
    expect(applySwapsToBody(card, pendingTermSwaps(base, {}))).toBe(card);
  });

  it("shows the judged result in the Log too, for a hand-written check left blank", () => {
    const [item] = read("@(Talon) Look\nd: d20+[[Perception]]=4 vs DC 12 ->", { Perception: 3 });
    expect(item.rows.find((r) => r.derivedResult)?.content).toBe("d20+[[Perception]]=4 vs DC 12 → Failure");
  });
});

describe("identical lines — each copy keeps its own roll", () => {
  // Two Random Events whose Event Meaning picks the same table: the log holds
  // the same unrolled line twice, character for character.
  const twin = "  + Actions 1: @[[Actions Meaning]]#action-01 d100= -> ";
  const log = ["? Random Event", "  gen: Event Meaning", twin, "? Random Event", "  gen: Event Meaning", twin].join(
    "\n"
  );
  const source = twin.trim();
  const raw = "d100=";

  it("numbers each copy, so its edits have a key of their own", () => {
    const rows = read(log).flatMap((i) => i.rows.filter((r) => r.source === source));
    expect(rows.map((r) => r.sourceNth)).toEqual([0, 1]);
    expect(dieEditKey(source, raw, 0, 0)).not.toBe(dieEditKey(source, raw, 0, 1));
  });

  it("writes a roll of the SECOND copy into the second line only", () => {
    const rolled = applySwapsToBody(log, pendingTermSwaps(read(log), { [dieEditKey(source, raw, 0, 1)]: "42" }));
    const lines = rolled.split("\n");
    expect(lines[2]).toBe(twin);
    expect(lines[5]).toBe("  + Actions 1: @[[Actions Meaning]]#action-01 d100=42 -> ");
  });

  it("writes two copies rolled separately each into its own line", () => {
    const edits = { [dieEditKey(source, raw, 0, 0)]: "7", [dieEditKey(source, raw, 0, 1)]: "93" };
    const swaps = pendingTermSwaps(read(log), edits);
    expect(swaps.map((s) => s.nth)).toEqual([0, 1]);
    const lines = applySwapsToBody(log, swaps).split("\n");
    expect(lines[2]).toContain("d100=7 ->");
    expect(lines[5]).toContain("d100=93 ->");
    // The Log's own write-back (into the note's code block) addresses each copy the same way.
    const note = applyTokenEdits("```rpg log\n" + log + "\n```", swaps).split("\n");
    expect(note[3]).toContain("d100=7 ->");
    expect(note[6]).toContain("d100=93 ->");
  });
});
