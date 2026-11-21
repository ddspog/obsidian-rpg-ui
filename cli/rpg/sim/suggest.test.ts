import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { classifyFit, outcomeDistance } from "lib/domains/encounter-sim/fit";
import type { Ctx } from "../app";
import { simMain } from "./dispatch";
import { simSuggest } from "./suggest";
import { FIXTURE_SYSTEM, initSystemLoader, makeCtx, pcNote, put, weapon } from "./test-support";

const BESTIARY = "tales-of-the-valiant/worldbuilding/bestiary";
const note = (name: string) => `${BESTIARY}/${name}.md`;

const TRAITS = [
  "# Traits",
  "```rpg feature.details",
  'name: "Bite"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 5 (1d6 + 2) piercing damage.",
  "```",
  "```rpg feature.details",
  'name: "Keen Smell"',
  "type: trait",
  "---",
  "The creature has advantage on Perception checks that rely on smell.",
  "```",
  "",
].join("\n");

interface FixtureMonster {
  type: string;
  cr: string | number;
  habitat?: string;
  refs: string[];
  hp?: number;
  ac?: number;
}

function monsterNote(name: string, m: FixtureMonster): string {
  return [
    `# ${name}`,
    "```rpg stat.monster",
    `name: "${name}"`,
    `type: "${m.type}"`,
    `cr: "${m.cr}"`,
    ...(m.habitat ? [`habitat: "${m.habitat}"`] : []),
    "stats:",
    `  ac: "${m.ac ?? 12}"`,
    `  hp: "${m.hp ?? 9} (2d8)"`,
    '  speed: "30 ft."',
    "abilities:",
    "  str: 1",
    "  dex: 1",
    "  con: 1",
    "  int: 0",
    "  wis: 0",
    "  cha: 0",
    "features:",
    ...m.refs.map((r) => `  - ref: "${r}"`),
    "```",
    "",
  ].join("\n");
}

const BITE = "@[[Traits]]#Bite";
const SMELL = "@[[Traits]]#Keen Smell";

const MONSTERS: Record<string, FixtureMonster> = {
  Wolf: { type: "Medium [[Beast]]", cr: "1/2", habitat: "[[Hills]], [[Forest]]", refs: [BITE] },
  Bear: { type: "Large [[Beast]]", cr: 1, habitat: "[[Swamp]]", refs: [BITE] },
  Imp: { type: "Small [[Fiend]]", cr: "1/4", habitat: "[[Forest]]", refs: [BITE] },
  Pup: { type: "Tiny [[Beast]]", cr: 0, refs: [BITE] },
  // Over twice the challenging target; its feature ref is broken, so loading it would count it unresolvable.
  Giant: { type: "Huge [[Giant]]", cr: 5, refs: ["@[[Nowhere]]#Stomp"] },
  Mute: { type: "Medium [[Beast]]", cr: "1/2", habitat: "[[Forest]]", refs: [SMELL] },
  // Passes the cheap checks, fails to load: its feature ref points at a missing note.
  Lost: { type: "[[Beast]]", cr: 1, habitat: "[[Forest]]", refs: ["@[[Nowhere]]#Claw"] },
};

const PCS = ["Aria", "Bram", "Cora", "Dax"];
const pcPath = (name: string) => `fixture/pcs/${name}.md`;

/** Monsters whose strength has nothing to do with their CR: a harmless CR 1/2, a brute of CR 1/4, ... */
const OUTCOME_TRAITS = [
  "```rpg feature.details",
  'name: "Nibble"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +0 to hit, reach 5 ft., one target. *Hit:* 1 (1d2) piercing damage.",
  "```",
  "```rpg feature.details",
  'name: "Flail"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* -5 to hit, reach 5 ft., one target. *Hit:* 1 (1d2) piercing damage.",
  "```",
  "```rpg feature.details",
  'name: "Maul"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +6 to hit, reach 5 ft., one target. *Hit:* 7 (2d6) bludgeoning damage.",
  "```",
  "```rpg feature.details",
  'name: "Annihilate"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +20 to hit, reach 5 ft., one target. *Hit:* 60 (10d10 + 5) force damage.",
  "```",
  "",
].join("\n");

const OUTCOME_MONSTERS: Record<string, FixtureMonster> = {
  // On the CR target (1/2) but harmless: costs the party next to nothing.
  Weakling: { type: "Small [[Beast]]", cr: "1/2", hp: 1, ac: 5, refs: ["@[[Traits]]#Nibble"] },
  // Far below the CR target (1/4) but a real fight.
  Brute: { type: "Large [[Beast]]", cr: "1/4", hp: 40, ac: 15, refs: ["@[[Traits]]#Maul"] },
  // A tiny CR whose first copy already wipes the party.
  Doom: { type: "Huge [[Fiend]]", cr: "1/8", hp: 500, ac: 12, refs: ["@[[Traits]]#Annihilate"] },
  // A tiny CR that never hurts anyone: counts run to the hard cap.
  Mote: { type: "Tiny [[Beast]]", cr: "1/32", hp: 1, ac: 5, refs: ["@[[Traits]]#Flail"] },
};

let ctx: Ctx;
let outcomeCtx: Ctx;

beforeAll(async () => {
  await initSystemLoader();
  const root = mkdtempSync(join(tmpdir(), "rpg-suggest-"));
  put(root, "fixture/config/index.ts", FIXTURE_SYSTEM);
  for (const name of PCS) {
    put(
      root,
      pcPath(name),
      pcNote({ name, ac: 14, hp: 11, actions: [weapon("Staff", "+3 (STR)", "1d6+1 bludgeoning")] })
    );
  }
  put(root, "Traits.md", TRAITS);
  for (const [name, m] of Object.entries(MONSTERS)) put(root, note(name), monsterNote(name, m));
  put(root, note("Lore"), "# Lore\nJust prose, no statblock.\n");
  put(root, note("NoCr"), "# NoCr\n```rpg stat.monster\nname: NoCr\nstats:\n  ac: 12\n  hp: 5\n```\n");
  put(root, "elsewhere/Outsider.md", monsterNote("Outsider", { type: "Beast", cr: 1, refs: [BITE] }));
  ctx = makeCtx(root);

  // A second vault whose monsters differ in strength, not only in CR, for the outcome ranking.
  const outcomeRoot = mkdtempSync(join(tmpdir(), "rpg-suggest-outcome-"));
  put(outcomeRoot, "fixture/config/index.ts", FIXTURE_SYSTEM);
  for (const name of PCS) {
    put(
      outcomeRoot,
      pcPath(name),
      pcNote({ name, ac: 14, hp: 11, actions: [weapon("Staff", "+3 (STR)", "1d6+1 bludgeoning")] })
    );
  }
  put(outcomeRoot, "Traits.md", TRAITS + OUTCOME_TRAITS);
  for (const [name, m] of Object.entries(OUTCOME_MONSTERS)) put(outcomeRoot, note(name), monsterNote(name, m));
  outcomeCtx = makeCtx(outcomeRoot);
}, 120_000);

interface Suggest {
  target: { difficulty: string; targetTotal: string; benchmark: string; rank: string };
  candidates: Array<{
    composition: { note: string; count: number; cr: string };
    base?: Array<{ note: string; count: number; cr: string }>;
    totalCr: string;
    label: string;
    winRate: number;
    tpkRate: number;
    stalemateRate: number;
    avgRounds: number;
    avgHpLost: number;
    koRate: Record<string, number>;
    fit: string;
  }>;
  excluded: Record<string, number>;
}

async function suggest(...flags: string[]) {
  return suggestIn(ctx, ...flags);
}

async function suggestIn(
  where: Ctx,
  ...flags: string[]
): Promise<{ code: number; doc: Suggest; text: string; err: string }> {
  let text = "";
  let err = "";
  const tokens = ["suggest", ...PCS.flatMap((n) => ["--pc", pcPath(n)]), "--trials", "6", ...flags];
  const code = await simMain(
    tokens,
    { out: (s) => (text += s), err: (s) => (err += s) },
    {
      context: () => where,
      run: async () => {
        throw new Error("run is not under test");
      },
      suggest: simSuggest,
    }
  );
  return { code, doc: text ? (JSON.parse(text) as Suggest) : ({} as Suggest), text, err };
}

/** A rational "p/q" or "n" as a number. */
function num(cr: string): number {
  const [a, b] = cr.split("/").map(Number);
  return b ? a / b : a;
}

/** The counts swept for each note, in the order they appear. */
function countsByNote(doc: Suggest): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const c of doc.candidates) {
    (out[c.composition.note.split("/").pop()!.replace(/\.md$/, "")] ??= []).push(c.composition.count);
  }
  for (const counts of Object.values(out)) counts.sort((a, b) => a - b);
  return out;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("rpg sim suggest", () => {
  it("classifies every bestiary note in order and counts what it leaves out", async () => {
    const { code, doc } = await suggest();
    expect(code).toBe(0);
    expect(doc.excluded).toEqual({
      "cr-0": 1, // Pup
      "no-damaging-action": 1, // Mute
      "non-monster": 1, // Lore
      "out-of-range": 1, // Giant: never loaded (a load would have counted it unresolvable)
      unresolvable: 2, // NoCr (no fence data), Lost (feature ref does not resolve)
    });
    // Keys are sorted, for a stable document.
    expect(Object.keys(doc.excluded)).toEqual(Object.keys(doc.excluded).sort());
    // Notes outside the bestiary are not looked at.
    expect(doc.candidates.every((c) => c.composition.note.startsWith(BESTIARY))).toBe(true);
    // Only the three good monsters make candidates.
    expect(Object.keys(countsByNote(doc)).sort()).toEqual(["Bear", "Imp", "Wolf"]);
  });

  it("omits an empty reason and the sweep carries on past a note that fails to load", async () => {
    const { doc } = await suggest("--habitat", "forest");
    // Lost and Mute are in the Forest and reach the load step; the sweep still finds Wolf and Imp.
    expect(Object.keys(countsByNote(doc)).sort()).toEqual(["Imp", "Wolf"]);
    expect(doc.excluded.unresolvable).toBe(2);
    expect(doc.excluded["cr-0"]).toBeUndefined();
    expect(doc.excluded["out-of-range"]).toBeUndefined();
  });

  it("maps easy, challenging and deadly to the benchmark times 1/2, 1 and 2", async () => {
    for (const [difficulty, targetTotal] of [
      ["easy", "1/4"],
      ["challenging", "1/2"],
      ["deadly", "1"],
    ] as const) {
      const { doc } = await suggest("--difficulty", difficulty, "--limit", "100");
      // Four level-1 PCs: a benchmark of 1/2.
      expect(doc.target).toEqual({ difficulty, targetTotal, benchmark: "1/2", rank: "cr" });
    }
    // The default difficulty is challenging.
    expect((await suggest()).doc.target.difficulty).toBe("challenging");
  });

  it("sweeps counts while n x CR stays within twice the target, and skips a CR above it", async () => {
    // Challenging: target 1/2, so up to a total of 1.
    const challenging = await suggest("--limit", "100");
    expect(countsByNote(challenging.doc)).toEqual({ Wolf: range(2), Bear: [1], Imp: range(4) });
    expect(challenging.doc.excluded["out-of-range"]).toBe(1);
    for (const c of challenging.doc.candidates) {
      expect(num(c.totalCr)).toBeCloseTo(c.composition.count * num(c.composition.cr), 10);
      expect(num(c.totalCr)).toBeLessThanOrEqual(1);
    }

    // Easy: target 1/4, so up to a total of 1/2. Bear and Lost (CR 1) now top that on their own.
    const easy = await suggest("--difficulty", "easy", "--limit", "100");
    expect(countsByNote(easy.doc)).toEqual({ Wolf: [1], Imp: range(2) });
    expect(easy.doc.excluded["out-of-range"]).toBe(3);
    expect(easy.doc.excluded.unresolvable).toBe(1);

    // Deadly: target 1, so up to a total of 2; the Giant (CR 5) is still out of range.
    const deadly = await suggest("--difficulty", "deadly", "--limit", "100");
    expect(countsByNote(deadly.doc)).toEqual({ Wolf: range(4), Bear: range(2), Imp: range(8) });
    expect(deadly.doc.excluded["out-of-range"]).toBe(1);
  });

  it("labels each candidate against the party benchmark", async () => {
    const { doc } = await suggest("--limit", "100");
    for (const c of doc.candidates) {
      const total = num(c.totalCr);
      expect(c.label).toBe(total < 0.5 ? "below" : total === 0.5 ? "at" : "above");
    }
    expect(new Set(doc.candidates.map((c) => c.label))).toEqual(new Set(["below", "at", "above"]));
  });

  it("sorts by distance to the target, then tpkRate, then note ref, then count", async () => {
    const { doc } = await suggest("--limit", "100");
    const rows = doc.candidates.map((c) => ({
      distance: Math.abs(num(c.totalCr) - 0.5),
      tpk: c.tpkRate,
      note: c.composition.note,
      count: c.composition.count,
    }));
    expect(rows.length).toBe(7);
    const sorted = [...rows].sort(
      (a, b) =>
        a.distance - b.distance ||
        a.tpk - b.tpk ||
        (a.note < b.note ? -1 : a.note > b.note ? 1 : 0) ||
        a.count - b.count
    );
    expect(rows).toEqual(sorted);
    // Total CR 1/2 (Wolf x1, Imp x2) is on the target and so leads.
    expect(rows.slice(0, 2).every((r) => r.distance === 0)).toBe(true);
    expect(rows[2].distance).toBeGreaterThan(0);
  });

  it("caps the candidates at --limit and keeps the best ones", async () => {
    const all = (await suggest("--limit", "100")).doc.candidates;
    const capped = (await suggest("--limit", "3")).doc.candidates;
    expect(capped).toHaveLength(3);
    expect(capped).toEqual(all.slice(0, 3));
    expect((await suggest("--limit", "0")).doc.candidates).toEqual([]);
    // The default cap is 20, which the fixture's 7 (challenging) and 14 (deadly) candidates stay under.
    expect((await suggest()).doc.candidates).toHaveLength(7);
    expect((await suggest("--difficulty", "deadly")).doc.candidates).toHaveLength(14);
  });

  it("gives each candidate its composition, total CR, label and compact summary, with no per-trial arrays", async () => {
    const { doc, text } = await suggest("--limit", "100");
    for (const c of doc.candidates) {
      expect(Object.keys(c).sort()).toEqual(
        [
          "avgHpLost",
          "avgRounds",
          "composition",
          "fit",
          "koRate",
          "label",
          "stalemateRate",
          "tpkRate",
          "totalCr",
          "winRate",
        ].sort()
      );
      expect(Object.keys(c.composition).sort()).toEqual(["count", "cr", "note"]);
      expect(Object.keys(c.koRate).sort()).toEqual([...PCS].sort());
      expect(c.winRate + c.tpkRate + c.stalemateRate).toBeCloseTo(1, 3);
      for (const rate of [c.winRate, c.tpkRate, c.stalemateRate, ...Object.values(c.koRate)]) {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    }
    expect(text).not.toContain("roundsPerTrial");
    expect(text).not.toContain("hpRemainingPerTrial");
  });

  it("reads --habitat case-insensitively, exact on link names", async () => {
    const forest = await suggest("--habitat", "FOREST", "--limit", "100");
    expect(Object.keys(countsByNote(forest.doc)).sort()).toEqual(["Imp", "Wolf"]);
    // Bear (Swamp), Pup and Giant (no habitat) are filtered; they never reach cr-0 or out-of-range.
    expect(forest.doc.excluded).toEqual({
      "no-damaging-action": 1,
      "non-monster": 1,
      filtered: 3,
      unresolvable: 2,
    });
    // A link name is matched whole, not as a substring.
    const part = await suggest("--habitat", "For");
    expect(part.doc.candidates).toEqual([]);
  });

  it("reads --type as a case-insensitive substring of the type line", async () => {
    const { doc } = await suggest("--type", "BEA", "--limit", "100");
    expect(Object.keys(countsByNote(doc)).sort()).toEqual(["Bear", "Wolf"]);
    // Imp (Fiend) and Giant are filtered before the range check.
    expect(doc.excluded).toEqual({
      "cr-0": 1,
      "no-damaging-action": 1,
      "non-monster": 1,
      filtered: 2,
      unresolvable: 2,
    });
  });

  it("reads --cr as an exact rational", async () => {
    const half = await suggest("--cr", "1/2", "--limit", "100");
    expect(Object.keys(countsByNote(half.doc))).toEqual(["Wolf"]);
    expect(half.doc.excluded).toEqual({
      "no-damaging-action": 1,
      "non-monster": 1,
      filtered: 5,
      unresolvable: 1,
    });
    // 2/4 is the same rational as 1/2.
    expect((await suggest("--cr", "2/4", "--limit", "100")).doc.candidates).toEqual(half.doc.candidates);
    // 1/4 is Imp's CR, not 1/2's.
    expect(Object.keys(countsByNote((await suggest("--cr", "1/4", "--limit", "100")).doc))).toEqual(["Imp"]);
  });

  it("rejects a --cr that is not a rational with a usage error naming it", async () => {
    const { code, err } = await suggest("--cr", "0.5");
    expect(code).toBe(1);
    expect(err).toContain("--cr");
    expect(err).toContain("0.5");
  });

  it("returns exit 0 with an empty candidate list when nothing survives", async () => {
    const none = await suggest("--habitat", "Nowhere");
    expect(none.code).toBe(0);
    expect(none.doc.candidates).toEqual([]);
    expect(none.doc.target.targetTotal).toBe("1/2");
    expect(none.doc.excluded.filtered).toBeGreaterThan(0);

    // CR 0 passes the filters and is then excluded as cr-0.
    const zero = await suggest("--cr", "0");
    expect(zero.code).toBe(0);
    expect(zero.doc.candidates).toEqual([]);
    expect(zero.doc.excluded["cr-0"]).toBe(1);
  });

  it("is deterministic for a seed", async () => {
    const a = await suggest("--seed", "7", "--limit", "100");
    const b = await suggest("--seed", "7", "--limit", "100");
    expect(a.code).toBe(0);
    expect(a.text).toBe(b.text);
  });
});

const stem = (note: string) => note.split("/").pop()!.replace(/\.md$/, "");
type Candidate = Suggest["candidates"][number];
const find = (doc: Suggest, name: string, count: number): number =>
  doc.candidates.findIndex((c) => stem(c.composition.note) === name && c.composition.count === count);

describe("rpg sim suggest --rank outcome", () => {
  it("adds avgHpLost and fit to every candidate, in both rank modes, and the rank to the target", async () => {
    for (const rank of ["cr", "outcome"]) {
      const { doc } = await suggest("--rank", rank, "--limit", "100");
      expect(doc.target.rank).toBe(rank);
      expect(doc.candidates.length).toBeGreaterThan(0);
      for (const c of doc.candidates) {
        expect(c.avgHpLost).toBeGreaterThanOrEqual(0);
        expect(c.avgHpLost).toBeLessThanOrEqual(1);
        expect(c.fit).toBe(classifyFit(c, "challenging"));
        expect(c.base).toBeUndefined();
      }
    }
  });

  it("labels fit against the difficulty asked for", async () => {
    const challenging = (await suggest("--rank", "outcome", "--limit", "100")).doc;
    const deadly = (await suggest("--rank", "outcome", "--difficulty", "deadly", "--limit", "100")).doc;
    expect(new Set(challenging.candidates.map((c) => c.fit))).toEqual(new Set(["too-easy", "too-hard"]));
    for (const c of deadly.candidates) expect(c.fit).toBe(classifyFit(c, "deadly"));
    // The same fight is judged by the difficulty asked for: Imp x3 costs about 40% of the HP and wipes
    // the party now and then, which is too hard for an easy encounter.
    const easy = (await suggest("--rank", "outcome", "--difficulty", "easy", "--limit", "100")).doc;
    const fitOf = (doc: Suggest) => doc.candidates[find(doc, "Imp", 3)].fit;
    expect(fitOf(easy)).toBe("too-hard");
    expect(fitOf(deadly)).toBe(classifyFit(deadly.candidates[find(deadly, "Imp", 3)], "deadly"));
  });

  it("sorts by distance to the outcome profile, then tpkRate, then note ref, then count", async () => {
    const { doc } = await suggest("--rank", "outcome", "--limit", "100");
    const distance = (c: Candidate) => Math.round(outcomeDistance(c, "challenging") * 1e9) / 1e9;
    const expected = [...doc.candidates].sort(
      (a, b) =>
        distance(a) - distance(b) ||
        a.tpkRate - b.tpkRate ||
        (a.composition.note < b.composition.note ? -1 : a.composition.note > b.composition.note ? 1 : 0) ||
        a.composition.count - b.composition.count
    );
    expect(doc.candidates).toEqual(expected);
    expect(doc.candidates.length).toBeGreaterThan(7);
  });

  it("ranks by outcome where CR order and outcome order differ", async () => {
    // Weakling (CR 1/2, harmless) sits on the CR target; Brute (CR 1/4) is a real fight.
    const cr = (await suggestIn(outcomeCtx, "--limit", "200")).doc;
    const outcome = (await suggestIn(outcomeCtx, "--rank", "outcome", "--limit", "200")).doc;
    expect(find(cr, "Weakling", 1)).toBeLessThan(find(cr, "Brute", 1));
    expect(find(outcome, "Brute", 1)).toBeLessThan(find(outcome, "Weakling", 1));
    // The default ranking keeps its CR order: the leading candidates all sit on the target total.
    expect(cr.candidates.slice(0, 2).every((c) => c.totalCr === "1/2")).toBe(true);
    expect(outcome.candidates[0].fit).toBe("fit");
  });

  it("widens the sweep to 4 x the benchmark, past the default's twice the target", async () => {
    const wide = (await suggest("--rank", "outcome", "--limit", "100")).doc;
    const narrow = (await suggest("--limit", "100")).doc;
    // Default: totals stop at 1 (twice the 1/2 target); outcome: up to 2 (4 x the benchmark of 1/2).
    expect(Math.max(...narrow.candidates.map((c) => num(c.totalCr)))).toBe(1);
    expect(Math.max(...wide.candidates.map((c) => num(c.totalCr)))).toBe(2);
    expect(find(narrow, "Bear", 2)).toBe(-1);
    expect(find(wide, "Bear", 2)).toBeGreaterThanOrEqual(0);
    expect(find(wide, "Wolf", 4)).toBeGreaterThanOrEqual(0);
    for (const c of wide.candidates) expect(num(c.totalCr)).toBeLessThanOrEqual(2);
    // A note whose single CR is above the wider cap is still out of range (the Giant, CR 5).
    expect(wide.excluded["out-of-range"]).toBe(1);
  });

  it("stops a kind's counts once a probe's tpkRate reaches 0.9", async () => {
    const wide = (await suggest("--rank", "outcome", "--limit", "100")).doc;
    // Imp would sweep to 8 (total 2); it stops at the first count that wipes the party 9 times in 10.
    const imps = wide.candidates.filter((c) => stem(c.composition.note) === "Imp");
    const counts = imps.map((c) => c.composition.count).sort((a, b) => a - b);
    expect(counts).toEqual(range(counts.length));
    expect(counts.length).toBeLessThan(8);
    expect(imps.filter((c) => c.tpkRate >= 0.9)).toHaveLength(1);
    expect(Math.max(...counts)).toBe(counts.length);
    expect(imps.find((c) => c.composition.count === counts.length)!.tpkRate).toBeGreaterThanOrEqual(0.9);

    // Doom (CR 1/8) wipes the party alone: one candidate in outcome mode, the full sweep in the default.
    const doom = (await suggestIn(outcomeCtx, "--rank", "outcome", "--limit", "200")).doc;
    expect(doom.candidates.filter((c) => stem(c.composition.note) === "Doom").map((c) => c.composition.count)).toEqual([
      1,
    ]);
    const plain = (await suggestIn(outcomeCtx, "--limit", "200")).doc;
    expect(countsByNote(plain).Doom).toEqual(range(8));
  });

  it("holds a kind to 30 monsters", async () => {
    // Mote (CR 1/32) would fit 64 under the cap of 2; the default sweeps to its own cap of 1 (32).
    const doc = (await suggestIn(outcomeCtx, "--rank", "outcome", "--limit", "500")).doc;
    expect(countsByNote(doc).Mote).toEqual(range(30));
    const plain = (await suggestIn(outcomeCtx, "--limit", "500")).doc;
    expect(countsByNote(plain).Mote).toEqual(range(32));
  });

  it("keeps the excluded reasons as the default has them", async () => {
    const { doc } = await suggest("--rank", "outcome", "--limit", "100");
    expect(doc.excluded).toEqual({
      "cr-0": 1,
      "no-damaging-action": 1,
      "non-monster": 1,
      "out-of-range": 1,
      unresolvable: 2,
    });
  });

  it("is deterministic for a seed", async () => {
    const a = await suggest("--rank", "outcome", "--seed", "7", "--limit", "100");
    const b = await suggest("--rank", "outcome", "--seed", "7", "--limit", "100");
    expect(a.code).toBe(0);
    expect(a.text).toBe(b.text);
    const c = await suggest("--rank", "outcome", "--seed", "8", "--limit", "100");
    expect(c.text).not.toBe(a.text);
  });
});

describe("rpg sim suggest --base", () => {
  const wolf = note("Wolf");

  it("keeps the base in every fight and adds one swept kind, totalling the base and n x CR", async () => {
    const { code, doc } = await suggest("--base", "Wolf", "--limit", "100");
    expect(code).toBe(0);
    // Base 1/2; cap 1 (twice the target): Wolf x1 and Imp x1, x2 fit; Bear (1/2 + 1) and Giant do not.
    expect(
      doc.candidates.map((c) => `${stem(c.composition.note)} x${c.composition.count} ${c.totalCr}`).sort()
    ).toEqual(["Imp x1 3/4", "Imp x2 1", "Wolf x1 1"]);
    for (const c of doc.candidates) {
      expect(c.base).toEqual([{ note: wolf, count: 1, cr: "1/2" }]);
      expect(Object.keys(c.composition).sort()).toEqual(["count", "cr", "note"]);
      expect(num(c.totalCr)).toBeCloseTo(0.5 + c.composition.count * num(c.composition.cr), 10);
      expect(c.label).toBe(num(c.totalCr) < 0.5 ? "below" : num(c.totalCr) === 0.5 ? "at" : "above");
    }
    // A note that cannot be added to the base within the cap is out of range, before it is loaded.
    expect(doc.excluded["out-of-range"]).toBe(3);
  });

  it("fights the base too: more base means a harder fight", async () => {
    const plain = (await suggest("--limit", "100")).doc;
    const based = (await suggest("--base", "Wolf", "--limit", "100")).doc;
    const imp1 = (doc: Suggest) => doc.candidates[find(doc, "Imp", 1)];
    expect(imp1(based).avgHpLost).toBeGreaterThan(imp1(plain).avgHpLost);
  });

  it("orders by CR distance of the total, then tpkRate, note and count", async () => {
    const { doc } = await suggest("--base", "Wolf", "--limit", "100");
    const rows = doc.candidates.map((c) => ({
      distance: Math.abs(num(c.totalCr) - 0.5),
      tpk: c.tpkRate,
      note: c.composition.note,
      count: c.composition.count,
    }));
    const sorted = [...rows].sort(
      (a, b) =>
        a.distance - b.distance ||
        a.tpk - b.tpk ||
        (a.note < b.note ? -1 : a.note > b.note ? 1 : 0) ||
        a.count - b.count
    );
    expect(rows).toEqual(sorted);
    expect(rows[0].distance).toBe(0.25);
  });

  it("takes a count, sums several groups, and lets the swept kind be the base's own note", async () => {
    const counted = (await suggest("--base", "Imp:2", "--limit", "100")).doc;
    expect(counted.candidates.every((c) => c.base?.[0].count === 2 && c.base[0].cr === "1/4")).toBe(true);
    // Base 1/2 again; Wolf (same note as nothing here) and Imp, whose own group stays apart from the base's.
    expect(find(counted, "Imp", 2)).toBeGreaterThanOrEqual(0);
    expect(counted.candidates[find(counted, "Imp", 2)].totalCr).toBe("1");

    const two = (await suggest("--base", "Imp:2", "--base", "Imp", "--limit", "100")).doc;
    expect(two.candidates.every((c) => c.base?.length === 2)).toBe(true);
    // Base total 3/4: Imp x1 (1) is the only one left under the cap of 1.
    expect(two.candidates.map((c) => `${stem(c.composition.note)} x${c.composition.count} ${c.totalCr}`)).toEqual([
      "Imp x1 1",
    ]);
  });

  it("works with --rank outcome, whose cap counts the base", async () => {
    const { doc } = await suggest("--base", "Imp:2", "--rank", "outcome", "--limit", "100");
    expect(doc.candidates.length).toBeGreaterThan(0);
    // Base 1/2, cap 2: Bear x1 (3/2) fits, Bear x2 (5/2) does not; Wolf goes to x3 (2).
    expect(find(doc, "Bear", 1)).toBeGreaterThanOrEqual(0);
    expect(find(doc, "Bear", 2)).toBe(-1);
    expect(Math.max(...doc.candidates.map((c) => num(c.totalCr)))).toBeLessThanOrEqual(2);
    for (const c of doc.candidates) expect(c.fit).toBe(classifyFit(c, "challenging"));
  });

  it("throws a runtime error naming an unresolvable base note", async () => {
    await expect(suggest("--base", "Nowhere At All")).rejects.toThrow(/Nowhere At All/);
    await expect(suggest("--base", "Lost")).rejects.toThrow();
  });

  it("is refused by `run` with a usage error that points to --monster", async () => {
    let err = "";
    const code = await simMain(
      ["run", "--monster", "Wolf", "--base", "Wolf"],
      { out: () => undefined, err: (s) => (err += s) },
      {
        context: () => {
          throw new Error("the vault must not boot");
        },
        run: async () => {
          throw new Error("run must not start");
        },
        suggest: simSuggest,
      }
    );
    expect(code).toBe(1);
    expect(err).toContain("--base");
    expect(err).toContain("--monster");
  });

  it("is deterministic for a seed", async () => {
    const a = await suggest("--base", "Wolf", "--seed", "3", "--limit", "100");
    const b = await suggest("--base", "Wolf", "--seed", "3", "--limit", "100");
    expect(a.text).toBe(b.text);
  });
});
