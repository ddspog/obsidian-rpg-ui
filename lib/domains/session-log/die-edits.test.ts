import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { buildSidebarItems, checkResult, dieEditKey, withActorRefs, withCheckResults } from "./prose-model";
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
