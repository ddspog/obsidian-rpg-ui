import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
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
    '  ac: "12"',
    '  hp: "9 (2d8)"',
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

let ctx: Ctx;

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
}, 120_000);

interface Suggest {
  target: { difficulty: string; targetTotal: string; benchmark: string };
  candidates: Array<{
    composition: { note: string; count: number; cr: string };
    totalCr: string;
    label: string;
    winRate: number;
    tpkRate: number;
    stalemateRate: number;
    avgRounds: number;
    koRate: Record<string, number>;
  }>;
  excluded: Record<string, number>;
}

async function suggest(...flags: string[]): Promise<{ code: number; doc: Suggest; text: string; err: string }> {
  let text = "";
  let err = "";
  const tokens = ["suggest", ...PCS.flatMap((n) => ["--pc", pcPath(n)]), "--trials", "6", ...flags];
  const code = await simMain(
    tokens,
    { out: (s) => (text += s), err: (s) => (err += s) },
    {
      context: () => ctx,
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
      expect(doc.target).toEqual({ difficulty, targetTotal, benchmark: "1/2" });
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
        ["avgRounds", "composition", "koRate", "label", "stalemateRate", "tpkRate", "totalCr", "winRate"].sort()
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
