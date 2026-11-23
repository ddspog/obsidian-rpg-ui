import { describe, expect, it } from "vitest";

import { parseCr } from "../encounter-sim/difficulty";
import { entryTiers, tierMatch } from "./tier";

const tier2 = { tier: 2 as const, maxSingleCr: parseCr("7") };
const crs: Record<string, string> = { Wolf: "1/4", Ogre: "2", Dragon: "10" };
const crOf = (note: string) => crs[note];
const entry = (tags: string[], ...notes: string[]) => ({ tags, monsters: notes.map((note) => ({ note, count: 1 })) });

describe("entryTiers", () => {
  it("reads tier-N tags, sorted and once each", () => {
    expect(entryTiers({ tags: ["forest", "tier-4", "Tier-3", "tier-4"] })).toEqual([3, 4]);
    expect(entryTiers({ tags: ["tier-9", "forest"] })).toEqual([]);
  });
});

describe("tierMatch", () => {
  it("matches tagged entries by their tiers", () => {
    expect(tierMatch(entry(["tier-2"], "Dragon"), tier2, crOf)).toBe("same");
    expect(tierMatch(entry(["tier-1"], "Wolf"), tier2, crOf)).toBe("lower");
    expect(tierMatch(entry(["tier-3", "tier-4"], "Wolf"), tier2, crOf)).toBe("higher");
    expect(tierMatch(entry(["tier-1", "tier-2"], "Wolf"), tier2, crOf)).toBe("same");
  });

  it("judges untagged entries by the single-monster CR, ignoring CRs it cannot read", () => {
    expect(tierMatch(entry([], "Wolf", "Ogre"), tier2, crOf)).toBe("same");
    expect(tierMatch(entry([], "Wolf", "Dragon"), tier2, crOf)).toBe("higher");
    expect(tierMatch(entry([], "Unknown"), tier2, crOf)).toBe("same");
  });
});
