import { describe, expect, it } from "vitest";

import { buildBoard } from "./board";
import type { Catalog, CatalogEntry } from "./catalog";

const STAMP = "aaaaaaaaaaaaaaaa";
const fit = (state: "fit" | "too-easy" | "too-hard", avgHpLost: number, over: Record<string, unknown> = {}) => ({
  state,
  stamp: STAMP,
  difficulty: "challenging" as const,
  winRate: 0.9,
  tpkRate: 0.05,
  avgHpLost,
  checkedOn: "2026-11-21",
  checkedAtSession: 2,
  ...over,
});
const entry = (id: string, over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id,
  name: id,
  monsters: [{ note: "bestiary/Wolf.md", count: 2 }],
  tags: ["forest", "tier-1"],
  review: "confirmed",
  ...over,
});
const catalog = (entries: CatalogEntry[], over: Partial<Catalog> = {}): Catalog => ({
  party: { name: "Ashen Four", pcs: ["chars/Kowyn.md", "chars/Lilith.md"] },
  profile: { size: 2, averageLevel: 1, tier: 1, benchmark: "0", singleCr: "1/8-1/2", stamp: STAMP },
  difficulty: "challenging",
  session: 3,
  recheckEverySessions: 5,
  reuseAfterSessions: 3,
  entries,
  ...over,
});

describe("buildBoard", () => {
  it("counts and orders the party tier's entries: fit (closest to the aim first), then easy, hard, out of date", () => {
    const board = buildBoard(
      catalog([
        entry("hard", { fit: fit("too-hard", 0.9) }),
        entry("fit-far", { fit: fit("fit", 0.3) }),
        entry("never"),
        entry("fit-near", { fit: fit("fit", 0.5) }),
        entry("easy", { fit: fit("too-easy", 0.05) }),
        entry("old-party", { fit: fit("fit", 0.5, { stamp: "bbbbbbbbbbbbbbbb" }) }),
        entry("tier-3", { tags: ["tier-3"], fit: fit("fit", 0.5) }),
      ])
    );
    expect(board.cards.map((c) => c.id)).toEqual(["fit-near", "fit-far", "easy", "hard", "old-party", "never"]);
    expect(board.counts).toEqual({
      fit: 2,
      tooEasy: 1,
      tooHard: 1,
      needsCheck: 2,
      drafts: 0,
      recentlyUsed: 0,
      otherTier: 1,
    });
    expect(board.cards.find((c) => c.id === "old-party")).toMatchObject({ status: "stale", stale: "party-changed" });
    expect(board.aim).toEqual({ toll: 0.5, tpk: 0.05, tolerance: 0.3 });
    expect(board.party).toEqual({ name: "Ashen Four", pcs: ["Kowyn", "Lilith"] });
  });

  it("puts recently run and draft entries after the others of their state, and marks them", () => {
    const board = buildBoard(
      catalog([
        entry("ran", { fit: fit("fit", 0.5), lastUsedSession: 2, uses: 1 }),
        entry("draft", { fit: fit("fit", 0.5), review: "draft" }),
        entry("plain", { fit: fit("fit", 0.5) }),
      ])
    );
    expect(board.cards.map((c) => c.id)).toEqual(["plain", "draft", "ran"]);
    expect(board.cards[2]).toMatchObject({ usedRecently: true, uses: 1, lastUsedSession: 2 });
    expect(board.counts).toMatchObject({ drafts: 1, recentlyUsed: 1 });
  });

  it("shows lower tiers on request, and every entry when the party was never profiled", () => {
    const entries = [entry("t1", { fit: fit("fit", 0.5) }), entry("t2", { tags: ["tier-2"], fit: fit("fit", 0.5) })];
    const tier2 = { size: 4, averageLevel: 6, tier: 2, benchmark: "12", singleCr: "1-9", stamp: STAMP };
    expect(buildBoard(catalog(entries, { profile: tier2 })).cards.map((c) => c.id)).toEqual(["t2"]);
    const lower = buildBoard(catalog(entries, { profile: tier2 }), { tiers: "lower" });
    expect(lower.cards.map((c) => [c.id, c.tier])).toEqual([
      ["t2", "same"],
      ["t1", "lower"],
    ]);
    const unprofiled = buildBoard(catalog(entries, { profile: undefined }));
    expect(unprofiled.cards).toHaveLength(2);
    expect(unprofiled.counts.fit).toBe(2);
  });

  it("carries the scene, the source row and a rolled count's other states", () => {
    const [card] = buildBoard(
      catalog([
        entry("rolled", {
          monsters: [{ note: "bestiary/Wolf.md", count: 4, dice: "1d4 + 1" }],
          source: { note: "tables/Forests Encounters.md", row: "1", text: "Wolves leap out." },
          fit: fit("fit", 0.5, { atMin: "fit", atMax: "too-hard" }),
        }),
      ])
    ).cards;
    expect(card).toMatchObject({
      monsters: [{ name: "Wolf", note: "bestiary/Wolf.md", count: 4, dice: "1d4 + 1" }],
      scene: "Wolves leap out.",
      source: "Forests Encounters, row 1",
      atMax: "too-hard",
    });
    expect(card.atMin).toBeUndefined();
  });
});

describe("buildBoard: titles, bylines and resting", () => {
  it("splits a drafted name into title and byline, and rests a recent run until its session comes", () => {
    const board = buildBoard(
      catalog([
        entry("t3-4", { name: "Arctic T3-4 #7: Remorhaz", fit: fit("too-hard", 0.9), tags: ["tier-1"] }),
        entry("ran", {
          name: "Forests T1 #9: 8 Baboon",
          fit: fit("fit", 0.5),
          lastUsedSession: 2,
          source: { note: "tables/Forests Encounters.md", row: "9", book: "game-masters-guide" },
        }),
        entry("hand", { name: "Goblin ambush", fit: fit("fit", 0.5) }),
      ])
    );
    expect(board.cards.map((c) => c.id)).toEqual(["hand", "t3-4", "ran"]);
    expect(board.cards[1]).toMatchObject({ title: "Remorhaz", byline: "Arctic · tier 3–4 · row 7" });
    expect(board.cards[2]).toMatchObject({ title: "8 Baboon", restingUntil: 5, book: "game-masters-guide" });
    expect(board.cards[0]).toMatchObject({ title: "Goblin ambush" });
    expect(board.cards[0].byline).toBeUndefined();
  });
});
