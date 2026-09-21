import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { buildSidebarItems } from "./prose-model";

/** The rows a log produces, as the sidebar would show them. */
function rowsOf(log: string) {
  const items = buildSidebarItems(groupIntoProse(parseLonelog(log)));
  return items.flatMap((i) => i.rows);
}

const shown = (r: { pills: Array<{ name: string; value?: string }>; content: string }) =>
  `${r.pills.map((p) => `[${p.name}${p.value ? " " + p.value : ""}]`).join(" ")} ${r.content}`.trim();

describe("an `o:` line answering the question above it", () => {
  it("keeps the question as prose and puts the machinery on its own row", () => {
    const rows = rowsOf("? [CF:5] Is the gate still guarded?\no: Fate Chart (likely) d100=22 ->\n");
    // The question names nothing: it is the question, and nothing else.
    expect(shown(rows[0])).toBe("[CF 5] Is the gate still guarded?");
    // Likely at CF 5 is the chart's 65 cell, and 22 beats it.
    expect(shown(rows[1])).toBe("[Fate Chart likely] [yes on ≤65] d100=22 → Yes");
  });

  it("reads the answer off the roll, not off what was typed", () => {
    // The written result is wrong on purpose.
    const rows = rowsOf("? [CF:5] Is it guarded?\no: Fate Chart (likely) d100=22 -> No\n");
    expect(rows[1].content).toBe("d100=22 → Yes");
  });

  it("finds the exceptional edges of the same cell", () => {
    const yes = rowsOf("? [CF:5] Is it?\no: Fate Chart (likely) d100=13 ->\n");
    expect(yes[1].content).toBe("d100=13 → Yes, and...");
    const no = rowsOf("? [CF:5] Is it?\no: Fate Chart (likely) d100=94 ->\n");
    expect(no[1].content).toBe("d100=94 → No, and...");
  });

  it("moves with the chaos factor above it", () => {
    const low = rowsOf("? [CF:1] Is it?\no: Fate Chart (50/50) d100=22 ->\n");
    expect(low[1].content).toBe("d100=22 → No"); // a 10 cell
    const high = rowsOf("? [CF:9] Is it?\no: Fate Chart (50/50) d100=22 ->\n");
    expect(high[1].content).toBe("d100=22 → Yes"); // a 90 cell
  });

  it("keeps a written result where the roll cannot decide one", () => {
    // No odds: nothing picks a cell of the chart.
    const noOdds = rowsOf("? [CF:5] Is it?\no: Fate Chart d100=22 -> Maybe\n");
    expect(shown(noOdds[1])).toBe("[Fate Chart] d100=22 → Maybe");
    // Unrolled: nothing to resolve.
    const unrolled = rowsOf("? [CF:5] Is it?\no: Fate Chart (likely) d100 ->\n");
    expect(unrolled[1].content).toBe("d100");
  });

  it("leaves a question answered by hand alone", () => {
    const rows = rowsOf("? [CF:5] Is anyone else awake?\n-> Yes, and… (d100=22)\n");
    expect(rows[1].content).toBe("Yes, and… (d100=22)");
    expect(rows).toHaveLength(2);
  });

  it("takes more than one oracle for a single question", () => {
    const rows = rowsOf(
      "? [CF:5] Does the storm break?\no: Fate Chart (likely) d100=22 ->\no: Fate Chart (unlikely) d100=80 ->\n"
    );
    expect(rows.slice(1).map((r) => r.content)).toEqual(["d100=22 → Yes", "d100=80 → No"]);
  });
});
