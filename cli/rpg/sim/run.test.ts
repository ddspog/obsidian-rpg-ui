import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { SKIP_REASONS, type FidelityRecord } from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";
import { simMain } from "./dispatch";
import { DEFAULT_PARTY } from "./party";
import { simRun } from "./run";
import { basic, FIXTURE_SYSTEM, initSystemLoader, makeCtx, pcNote, put, weapon } from "./test-support";

const BESTIARY = "tales-of-the-valiant/worldbuilding/bestiary";
const WOLF = `${BESTIARY}/Wolf.md`;
const MUTE = `${BESTIARY}/Mute.md`;
const BRUTE = "fixture/pcs/Brute.md";
const PACIFIST = "fixture/pcs/Pacifist.md";

function monsterNote(name: string, cr: string, refs: string[]): string {
  return [
    `# ${name}`,
    "```rpg stat.monster",
    `name: "${name}"`,
    'type: "Large [[Beast]]"',
    `cr: "${cr}"`,
    "stats:",
    '  ac: "13 (natural armor)"',
    '  hp: "27 (5d8 + 5)"',
    '  speed: "40 ft."',
    "abilities:",
    "  str: 2",
    "  dex: 3",
    "  con: 1",
    "  int: -4",
    "  wis: 1",
    "  cha: -3",
    "features:",
    ...refs.map((r) => `  - ref: "${r}"`),
    "```",
    "",
  ].join("\n");
}

const TRAITS = [
  "# Traits",
  "```rpg feature.details",
  'id: "Wolf: Multiattack"',
  'name: "Multiattack"',
  "type: action",
  "---",
  "The wolf makes two Bite attacks.",
  "```",
  "```rpg feature.details",
  'name: "Bite"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 7 (2d4 + 2) piercing damage.",
  "```",
  "```rpg feature.details",
  'name: "Keen Smell"',
  "type: trait",
  "---",
  "The wolf has advantage on Perception checks that rely on smell.",
  "```",
  "",
].join("\n");

const ref = (block: string) => `@[[Traits]]#${block}`;

const R5_KEYS = [
  "party",
  "monsters",
  "seed",
  "trials",
  "roundCap",
  "rules",
  "winRate",
  "tpkRate",
  "stalemateRate",
  "avgRounds",
  "roundsPerTrial",
  "hpRemainingPerTrial",
  "koRate",
  "deathRate",
  "anyDeathRate",
  "difficulty",
  "fidelity",
];

interface Captured {
  code: number;
  out: string;
  err: string;
}

let ctx: Ctx;

beforeAll(async () => {
  await initSystemLoader();
  const root = mkdtempSync(join(tmpdir(), "rpg-sim-run-"));
  put(root, "fixture/config/index.ts", FIXTURE_SYSTEM);
  put(
    root,
    BRUTE,
    pcNote({ name: "Brute", ac: 17, hp: 15, actions: [weapon("Greataxe", "+5 (STR)", "1d12+3 slashing")] })
  );
  put(root, PACIFIST, pcNote({ name: "Pacifist", ac: 10, hp: 6, actions: [basic("Dash")] }));
  put(root, "Traits.md", TRAITS);
  put(root, WOLF, monsterNote("Wolf", "1/2", [ref("Wolf: Multiattack"), ref("Bite"), ref("Keen Smell")]));
  put(root, MUTE, monsterNote("Mute", "1", [ref("Keen Smell")]));
  put(root, `${BESTIARY}/Lore.md`, "# Lore\nJust prose.\n");
  ctx = makeCtx(root);
}, 120_000);

async function sim(...tokens: string[]): Promise<Captured> {
  let out = "";
  let err = "";
  const code = await simMain(
    tokens,
    { out: (s) => (out += s), err: (s) => (err += s) },
    {
      context: () => ctx,
      run: simRun,
      suggest: async () => {
        throw new Error("suggest is not under test");
      },
    }
  );
  return { code, out, err };
}

const runDoc = async (...tokens: string[]) => {
  const result = await sim("run", ...tokens);
  expect(result.code, result.err).toBe(0);
  return JSON.parse(result.out) as Record<string, any>;
};

describe("sim run: usage errors", () => {
  it("returns 1 naming --monster when no monster is given", async () => {
    const result = await sim("run", "--pc", BRUTE);
    expect(result.code).toBe(1);
    expect(result.err).toContain("--monster");
    expect(result.out).toBe("");
  });

  it("returns 1 naming --pc when the party is empty", async () => {
    const saved = DEFAULT_PARTY.splice(0);
    try {
      const result = await sim("run", "--monster", WOLF);
      expect(result.code).toBe(1);
      expect(result.err).toContain("--pc");
    } finally {
      DEFAULT_PARTY.push(...saved);
    }
  });

  it("returns 1 naming the value when a --monster count is below 1", async () => {
    const result = await sim("run", "--pc", BRUTE, "--monster", `${WOLF}:0`);
    expect(result.code).toBe(1);
    expect(result.err).toContain(`${WOLF}:0`);
  });

  it("returns 1 naming --trials 0 and --rounds 0", async () => {
    const trials = await sim("run", "--pc", BRUTE, "--monster", WOLF, "--trials", "0");
    expect(trials.code).toBe(1);
    expect(trials.err).toContain("--trials");
    const rounds = await sim("run", "--pc", BRUTE, "--monster", WOLF, "--rounds", "0");
    expect(rounds.code).toBe(1);
    expect(rounds.err).toContain("--rounds");
  });

  it("accepts the same monster note twice as two separate groups", async () => {
    const doc = await runDoc("--pc", BRUTE, "--monster", `${WOLF}:2`, "--monster", WOLF, "--trials", "10");
    expect(doc.monsters.map((m: { note: string; count: number }) => [m.note, m.count])).toEqual([
      [WOLF, 2],
      [WOLF, 1],
    ]);
    // 2 x 1/2 + 1 x 1/2 = 3/2
    expect(doc.difficulty.totalCr).toBe("3/2");
  });
});

describe("sim run: the document", () => {
  const args = ["--pc", BRUTE, "--pc", PACIFIST, "--monster", `${WOLF}:3`, "--seed", "7", "--trials", "25"];

  it("returns 0 with one document carrying every key, in order", async () => {
    const doc = await runDoc(...args);
    expect(Object.keys(doc)).toEqual(R5_KEYS);
    expect(doc.seed).toBe(7);
    expect(doc.trials).toBe(25);
    expect(doc.roundCap).toBe(20);
    expect(doc.roundsPerTrial).toHaveLength(25);
    expect(doc.hpRemainingPerTrial).toHaveLength(25);
    expect(doc.winRate + doc.tpkRate + doc.stalemateRate).toBeCloseTo(1, 3);
    expect(Object.keys(doc.koRate)).toEqual(["Brute", "Pacifist"]);
    expect(doc.difficulty).toEqual({ totalCr: "3/2", benchmark: "0", label: "above" });
  });

  it("summarises each PC and monster group", async () => {
    const doc = await runDoc(...args);
    expect(doc.party[0]).toEqual({
      note: BRUTE,
      name: "Brute",
      level: 1,
      proficiencyBonus: 2,
      armorClass: 17,
      maxHp: 15,
      initiative: 1,
      abilities: {
        str: { score: 10, modifier: 0, save: 0 },
        dex: { score: 12, modifier: 1, save: 1 },
        con: { score: 14, modifier: 2, save: 2 },
        int: { score: 8, modifier: -1, save: -1 },
        wis: { score: 16, modifier: 3, save: 3 },
        cha: { score: 10, modifier: 0, save: 0 },
      },
      actions: [{ name: "Greataxe", kind: "weapon", hitBonus: 5, damage: "1d12+3", damageType: "slashing" }],
    });
    expect(doc.party[1].actions).toEqual([]);
    expect(Object.keys(doc.monsters[0])).toEqual([
      "note",
      "name",
      "count",
      "cr",
      "ac",
      "hp",
      "speed",
      "initiative",
      "abilities",
      "actions",
    ]);
    expect(doc.monsters[0]).toMatchObject({
      note: WOLF,
      name: "Wolf",
      count: 3,
      cr: "1/2",
      ac: 13,
      hp: 27,
      speed: 40,
      initiative: 3,
    });
    expect(doc.monsters[0].abilities.str).toEqual({ modifier: 2, save: 2 });
    expect(doc.monsters[0].actions.map((a: { kind: string }) => a.kind)).toEqual(["multiattack", "weapon"]);
  });

  it("prints the same bytes with and without --json", async () => {
    const plain = await sim("run", ...args);
    const json = await sim("run", ...args, "--json");
    expect(plain.code).toBe(0);
    expect(json.code).toBe(0);
    expect(json.out).toBe(plain.out);
  });

  it("keys fidelity per actor, once per note whatever the counts", async () => {
    const doc = await runDoc("--pc", BRUTE, "--monster", `${WOLF}:3`, "--monster", WOLF, "--trials", "5");
    expect(Object.keys(doc.fidelity)).toEqual(["Brute", WOLF]);
    const wolf: FidelityRecord[] = doc.fidelity[WOLF];
    expect(wolf.map((r) => r.name)).toEqual(["Multiattack", "Bite", "Keen Smell"]);
    expect(doc.fidelity.Brute).toEqual([{ name: "Greataxe", owner: "Brute", status: "modelled" }]);
    for (const records of Object.values(doc.fidelity) as FidelityRecord[][]) {
      for (const record of records) {
        expect(["modelled", "skipped"]).toContain(record.status);
        if (record.status === "skipped") expect(SKIP_REASONS).toContain(record.reason);
        else expect(record.reason).toBeUndefined();
      }
    }
    expect(wolf.find((r) => r.name === "Keen Smell")).toMatchObject({
      status: "skipped",
      reason: "unsupported-feature",
    });
  });

  it("is deterministic for a seed and changes with another", async () => {
    const a = await sim("run", ...args);
    const b = await sim("run", ...args);
    expect(b.out).toBe(a.out);
    const other = await runDoc(...args.map((t) => (t === "7" ? "8" : t)));
    const first = JSON.parse(a.out);
    expect(other.seed).toBe(8);
    const same = JSON.stringify(other.roundsPerTrial) === JSON.stringify(first.roundsPerTrial);
    const sameHp = JSON.stringify(other.hpRemainingPerTrial) === JSON.stringify(first.hpRemainingPerTrial);
    expect(same && sameHp).toBe(false);
  });
});

describe("sim run: neither side can do damage", () => {
  it("is a stalemate every trial, at the round cap, with no-damaging-action on both sides", async () => {
    const doc = await runDoc("--pc", PACIFIST, "--monster", MUTE, "--trials", "20", "--rounds", "5");
    expect(doc.stalemateRate).toBe(1);
    expect(doc.winRate).toBe(0);
    expect(doc.tpkRate).toBe(0);
    expect(doc.avgRounds).toBe(5);
    expect(doc.roundsPerTrial).toEqual(Array(20).fill(5));
    expect(doc.roundCap).toBe(5);
    expect(doc.fidelity.Pacifist.map((r: FidelityRecord) => r.reason)).toContain("no-damaging-action");
    expect(doc.fidelity[MUTE].map((r: FidelityRecord) => r.reason)).toContain("no-damaging-action");
  });
});

describe("sim run: errors that are not usage", () => {
  it("rejects naming an unresolvable --pc note", async () => {
    await expect(sim("run", "--pc", "fixture/pcs/Nobody.md", "--monster", WOLF)).rejects.toThrow(/Nobody/);
  });

  it("rejects naming an unresolvable --monster note", async () => {
    await expect(sim("run", "--pc", BRUTE, "--monster", `${BESTIARY}/Ghost.md`)).rejects.toThrow(/Ghost/);
  });

  it("rejects naming a note that is not a monster", async () => {
    await expect(sim("run", "--pc", BRUTE, "--monster", `${BESTIARY}/Lore.md`)).rejects.toThrow(/Lore/);
  });
});
