import { describe, expect, it } from "vitest";

import type { Catalog, CatalogEntry } from "./catalog";
import {
  type FitContext,
  fitStateFrom,
  isEligible,
  partitionByFit,
  recentlyUsed,
  recheckReason,
  type FitState,
} from "./fit-state";

const STAMP = "aaaaaaaaaaaaaaaa";

const fit = (over: Partial<FitState> = {}): FitState => ({
  state: "fit",
  stamp: STAMP,
  difficulty: "challenging",
  winRate: 0.9,
  tpkRate: 0.05,
  avgHpLost: 0.5,
  checkedOn: "2026-11-01",
  checkedAtSession: 10,
  ...over,
});

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: "e",
  name: "E",
  monsters: [{ note: "Goblin", count: 2 }],
  tags: ["Forest", "Undead"],
  review: "confirmed",
  fit: fit(),
  ...over,
});

const ctx = (over: Partial<FitContext> = {}): FitContext => ({
  stamp: STAMP,
  session: 11,
  recheckEverySessions: 5,
  difficulty: "challenging",
  ...over,
});

const reason = (e: CatalogEntry, c: FitContext) =>
  recheckReason(e, c.stamp, c.session, c.recheckEverySessions, c.difficulty);

describe("fitStateFrom", () => {
  it("classifies the summary and records the check", () => {
    const state = fitStateFrom(
      { winRate: 0.93, tpkRate: 0.05, avgHpLost: 0.52 },
      "challenging",
      STAMP,
      4,
      "2026-11-21"
    );
    expect(state).toEqual({
      state: "fit",
      stamp: STAMP,
      difficulty: "challenging",
      winRate: 0.93,
      tpkRate: 0.05,
      avgHpLost: 0.52,
      checkedOn: "2026-11-21",
      checkedAtSession: 4,
    });
  });

  it("marks too-easy and too-hard, and rounds to four places", () => {
    expect(fitStateFrom({ winRate: 1, tpkRate: 0, avgHpLost: 0.05 }, "challenging", STAMP, 1, "d").state).toBe(
      "too-easy"
    );
    expect(fitStateFrom({ winRate: 0.1, tpkRate: 0.6, avgHpLost: 0.95 }, "challenging", STAMP, 1, "d").state).toBe(
      "too-hard"
    );
    const rounded = fitStateFrom(
      { winRate: 0.123456, tpkRate: 0.05, avgHpLost: 0.500049 },
      "challenging",
      STAMP,
      1,
      "d"
    );
    expect(rounded.winRate).toBe(0.1235);
    expect(rounded.avgHpLost).toBe(0.5);
  });
});

describe("recheckReason", () => {
  it("is null when current", () => {
    expect(reason(entry(), ctx())).toBeNull();
  });

  it("asks for a check when there is no fit", () => {
    expect(reason(entry({ fit: undefined }), ctx())).toBe("no-fit");
  });

  it("notices a changed party and a changed difficulty", () => {
    expect(reason(entry(), ctx({ stamp: "bbbbbbbbbbbbbbbb" }))).toBe("party-changed");
    expect(reason(entry(), ctx({ difficulty: "deadly" }))).toBe("difficulty-changed");
  });

  it("has a precedence: no-fit, party, difficulty, sessions", () => {
    const old = ctx({ stamp: "bbbbbbbbbbbbbbbb", difficulty: "deadly", session: 99 });
    expect(reason(entry({ fit: undefined }), old)).toBe("no-fit");
    expect(reason(entry(), old)).toBe("party-changed");
    expect(reason(entry(), ctx({ difficulty: "deadly", session: 99 }))).toBe("difficulty-changed");
    expect(reason(entry(), ctx({ session: 99 }))).toBe("sessions-elapsed");
  });

  it("flags exactly N sessions elapsed, not N-1", () => {
    // checked at session 10, every 5
    expect(reason(entry(), ctx({ session: 14 }))).toBeNull();
    expect(reason(entry(), ctx({ session: 15 }))).toBe("sessions-elapsed");
    expect(reason(entry(), ctx({ session: 16 }))).toBe("sessions-elapsed");
    expect(reason(entry(), ctx({ session: 10 }))).toBeNull();
  });

  it("never refreshes by sessions when recheckEverySessions is 0", () => {
    expect(reason(entry(), ctx({ session: 500, recheckEverySessions: 0 }))).toBeNull();
  });
});

describe("isEligible", () => {
  it("admits a current fit by default, and nothing else", () => {
    expect(isEligible(entry(), ctx())).toBe(true);
    expect(isEligible(entry({ fit: fit({ state: "too-easy" }) }), ctx())).toBe(false);
    expect(isEligible(entry({ fit: fit({ state: "too-hard" }) }), ctx())).toBe(false);
  });

  it("keeps too-easy ineligible for the same party, even before N sessions pass", () => {
    const easy = entry({ fit: fit({ state: "too-easy" }) });
    for (const session of [10, 11, 14]) expect(isEligible(easy, ctx({ session }))).toBe(false);
    expect(isEligible(easy, ctx({ session: 11 }), { states: ["too-easy"] })).toBe(true);
    // a changed party makes the verdict unknown, not eligible
    expect(isEligible(easy, ctx({ stamp: "bbbbbbbbbbbbbbbb" }))).toBe(false);
  });

  it("leaves stale and unchecked entries out unless includeStale", () => {
    expect(isEligible(entry(), ctx({ session: 15 }))).toBe(false);
    expect(isEligible(entry(), ctx({ stamp: "bbbbbbbbbbbbbbbb" }))).toBe(false);
    expect(isEligible(entry({ fit: undefined }), ctx())).toBe(false);
    expect(isEligible(entry(), ctx({ session: 15 }), { includeStale: true })).toBe(true);
    expect(isEligible(entry({ fit: undefined }), ctx(), { includeStale: true })).toBe(true);
  });

  it("filters by tags (all, case-insensitive) and anyTags", () => {
    expect(isEligible(entry(), ctx(), { tags: ["forest"] })).toBe(true);
    expect(isEligible(entry(), ctx(), { tags: ["FOREST", "undead"] })).toBe(true);
    expect(isEligible(entry(), ctx(), { tags: ["forest", "swamp"] })).toBe(false);
    expect(isEligible(entry(), ctx(), { anyTags: ["swamp", "UNDEAD"] })).toBe(true);
    expect(isEligible(entry(), ctx(), { anyTags: ["swamp", "city"] })).toBe(false);
    expect(isEligible(entry(), ctx(), { tags: ["forest"], anyTags: ["city"] })).toBe(false);
    expect(isEligible(entry(), ctx(), { tags: [], anyTags: [] })).toBe(true);
  });

  it("filters by the review flag", () => {
    const draft = entry({ review: "draft" });
    expect(isEligible(draft, ctx())).toBe(true);
    expect(isEligible(draft, ctx(), { reviewed: true })).toBe(false);
    expect(isEligible(draft, ctx(), { reviewed: false })).toBe(true);
    expect(isEligible(entry(), ctx(), { reviewed: false })).toBe(false);
    expect(isEligible(entry(), ctx(), { reviewed: true })).toBe(true);
  });

  it("takes several states", () => {
    const hard = entry({ fit: fit({ state: "too-hard" }) });
    expect(isEligible(hard, ctx(), { states: ["fit", "too-hard"] })).toBe(true);
  });
});

describe("partitionByFit", () => {
  it("counts the entries by the state of their fit", () => {
    const entries: CatalogEntry[] = [
      entry({ id: "1" }),
      entry({ id: "2", review: "draft" }),
      entry({ id: "3", fit: fit({ state: "too-easy" }) }),
      entry({ id: "4", fit: fit({ state: "too-hard" }), review: "draft" }),
      entry({ id: "5", fit: fit({ stamp: "bbbbbbbbbbbbbbbb" }) }),
      entry({ id: "6", fit: fit({ checkedAtSession: 1 }) }),
      entry({ id: "7", fit: undefined, review: "draft" }),
    ];
    const catalog: Pick<Catalog, "entries"> = { entries };
    const counts = partitionByFit(catalog, ctx());
    expect(counts).toEqual({ fit: 2, tooEasy: 1, tooHard: 1, stale: 2, unchecked: 1, draft: 3 });
    expect(counts.fit + counts.tooEasy + counts.tooHard + counts.stale + counts.unchecked).toBe(entries.length);
  });

  it("is all zero for an empty catalog", () => {
    expect(partitionByFit({ entries: [] }, ctx())).toEqual({
      fit: 0,
      tooEasy: 0,
      tooHard: 0,
      stale: 0,
      unchecked: 0,
      draft: 0,
    });
  });
});

describe("isEligible: plural tags", () => {
  it("matches a tag whether it is written plural or not", () => {
    expect(isEligible(entry({ tags: ["forests"] }), ctx(), { tags: ["forest"] })).toBe(true);
    expect(isEligible(entry({ tags: ["forest"] }), ctx(), { anyTags: ["Forests"] })).toBe(true);
  });
});

describe("recentlyUsed", () => {
  it("holds an entry back until reuseAfterSessions sessions have passed since its run", () => {
    expect(recentlyUsed({}, 5, 3)).toBe(false);
    expect(recentlyUsed({ lastUsedSession: 5 }, 5, 3)).toBe(true);
    expect(recentlyUsed({ lastUsedSession: 5 }, 7, 3)).toBe(true);
    expect(recentlyUsed({ lastUsedSession: 5 }, 8, 3)).toBe(false);
    expect(recentlyUsed({ lastUsedSession: 5 }, 5, 0)).toBe(false);
  });
});
