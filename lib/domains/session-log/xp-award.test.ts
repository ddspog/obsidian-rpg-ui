import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { buildSidebarItems } from "./prose-model";
import { resolveLogTemplate } from "./template-resolver";
import { withXpAward, xpShares } from "./xp-award";

const segments = (lines: string[]) => groupIntoProse(parseLonelog(lines.join("\n")));
const fight = [
  "[COMBAT]",
  "T1",
  "R(Talon)",
  "@(Talon) Shoots",
  "[/COMBAT]",
  "=> The leader yielded. [Talon/XP+87] [Kowyn/XP+87]",
];

describe("a fight's XP", () => {
  it("reads each share off the ending line's tags", () => {
    expect(xpShares(segments(fight)[segments(fight).length - 1])).toEqual([
      { who: "Talon", xp: 87 },
      { who: "Kowyn", xp: 87 },
    ]);
  });

  it("draws the shares as one pill — the fight's worth, each one's part, who got it", () => {
    const segs = segments(fight);
    const items = withXpAward(buildSidebarItems(segs), segs, () => 175);
    expect(items[items.length - 1].rows[0].pills).toEqual([
      { name: "XP", value: "175 — 87 each · Talon, Kowyn", kind: "dial" },
    ]);
  });

  it("keeps the tags when how it ended is left blank", () => {
    expect(resolveLogTemplate("[/COMBAT]\n=> {{how_it_ended?}} [Talon/XP+87]", {})).toBe("[/COMBAT]\n=> [Talon/XP+87]");
    expect(resolveLogTemplate("@(Talon) Rests\n=> {{outcome?}}", {})).toBe("@(Talon) Rests");
    expect(resolveLogTemplate("[Threads+ {{thread?}}]", {})).toBe("");
  });
});
