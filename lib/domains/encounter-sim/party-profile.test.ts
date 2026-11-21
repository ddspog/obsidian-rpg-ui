import { describe, expect, it } from "vitest";

import { partyProfile, profileView, tierOf } from "./party-profile";

describe("tierOf", () => {
  it("follows the tiers of play: 1–4, 5–10, 11–16, 17–20", () => {
    expect([1, 4, 5, 10, 11, 16, 17, 20].map(tierOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("partyProfile", () => {
  it("reads size, average level, tier, benchmark and single-monster CR from the benchmark table", () => {
    expect(profileView(partyProfile([1, 1, 1, 1]))).toEqual({
      size: 4,
      averageLevel: 1,
      tier: 1,
      benchmark: "1/2",
      singleCr: "1/8-1/2",
    });
    // Five 7th-level PCs: the Monster Vault's own example (benchmark 17, a single monster up to CR 10).
    expect(profileView(partyProfile([7, 7, 7, 7, 7]))).toEqual({
      size: 5,
      averageLevel: 7,
      tier: 2,
      benchmark: "17",
      singleCr: "1-10",
    });
    expect(profileView(partyProfile([13, 13, 14]))).toMatchObject({
      size: 3,
      averageLevel: 13,
      tier: 3,
      singleCr: "3-19",
    });
  });

  it("rounds the average down and clamps it to 1–20", () => {
    expect(partyProfile([4, 5]).averageLevel).toBe(4);
    expect(partyProfile([4, 5]).tier).toBe(1);
    expect(() => partyProfile([])).toThrow(/at least one PC/);
  });
});
