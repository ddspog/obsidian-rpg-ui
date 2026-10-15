import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { partyGroups } from "./party-groups";

const segments = (lines: string[]) => groupIntoProse(parseLonelog(lines.join("\n")));
const party = (a: string) => ["Kowyn", "Talon"].includes(a);

describe("partyGroups", () => {
  it("gathers a party card's members' entries after it, until anything else", () => {
    const segs = segments([
      "@(Party) Short rest",
      "@(Kowyn) Spends a hit die",
      "d: Healing | 1d8+2=9",
      "@(Talon) Spends a hit die",
      "d: Healing | 1d10=5",
      "=> They patched up. [Kowyn/Hit Dice-1] [Talon/Hit Dice-1]",
      "@(Kobold) Wakes up",
    ]);
    const groups = partyGroups(segs, party);
    expect([...groups.values()].map((m) => m.length)).toEqual([2]);
  });

  it("leaves a party card with no member entries alone", () => {
    expect(
      partyGroups(segments(["@(Party) Long rest", "=> Rested. [Time: +8h]", "@(Talon) Stretches"]), party).size
    ).toBe(0);
  });
});
