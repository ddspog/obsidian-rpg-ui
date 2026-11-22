import { describe, expect, it } from "vitest";

import { proposeAdjustments, rankAdjustments, tacticsFor, type AdjustCandidate } from "./adjust";

const options = {
  nameOf: (note: string) => note,
  equivalents: (note: string) => (note === "Wolf" ? [{ note: "Jackal", name: "Jackal" }] : []),
  minions: [{ note: "Kobold", name: "Kobold" }],
  leaders: [{ note: "Acolyte", name: "Acolyte" }],
  maxCount: 30,
};

describe("proposeAdjustments", () => {
  it("makes a fight easier with fewer of a group, a swap and a group less", () => {
    const found = proposeAdjustments(
      [
        { note: "Wolf", count: 4 },
        { note: "Ogre", count: 1 },
      ],
      "easier",
      options
    );
    const labels = found.map((c) => c.label);
    expect(labels).toContain("3 Wolf instead of 4");
    expect(labels).toContain("4 Jackal instead of 4 Wolf");
    expect(labels).toContain("without the Ogre");
    expect(found.every((c) => c.monsters.every((m) => m.count >= 1))).toBe(true);
    expect(found.some((c) => c.kind === "add")).toBe(false);
  });

  it("makes a fight harder with more of a group, minions or a leader", () => {
    const found = proposeAdjustments([{ note: "Wolf", count: 2 }], "harder", options);
    const labels = found.map((c) => c.label);
    expect(labels).toContain("3 Wolf instead of 2");
    expect(labels).toContain("with 2 Kobold (rank and file)");
    expect(labels).toContain("led by an Acolyte");
    expect(found.some((c) => c.kind === "remove")).toBe(false);
  });
});

describe("rankAdjustments", () => {
  it("keeps the fitting ones, the closest first, a count change before a swap on a near tie", () => {
    const c = (kind: AdjustCandidate["kind"], label: string): AdjustCandidate => ({ kind, label, monsters: [] });
    const ranked = rankAdjustments([
      { candidate: c("swap", "swap"), distance: 0.1, fits: true },
      { candidate: c("count", "count"), distance: 0.12, fits: true },
      { candidate: c("count", "miss"), distance: 0.01, fits: false },
    ]);
    expect(ranked.map((r) => r.candidate.label)).toEqual(["count", "swap"]);
  });

  it("suggests tactics the way the fight should go", () => {
    expect(tacticsFor("easier").join(" ")).toMatch(/choke point/);
    expect(tacticsFor("harder").join(" ")).toMatch(/ambush/);
  });
});
