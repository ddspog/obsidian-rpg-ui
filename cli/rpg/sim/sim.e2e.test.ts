import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseDamage } from "lib/domains/session-log/session-actions";
import type { Ctx } from "../app";
import { characterSheet } from "../commands/character";
import { simMain } from "./dispatch";
import { DEFAULT_PARTY } from "./party";
import { simRun } from "./run";
import { simSuggest } from "./suggest";
import { copyVaultWithClassStems, initSystemLoader, makeCtx } from "./test-support";

// The whole simulator over the real PCs and bestiary, when the testing vault is beside the plugin (as in CI).
const VAULT = process.env.RPG_VAULT_ROOT ?? resolve(__dirname, "../../../../testing-vault");
const SYSTEM_DIR = "tales-of-the-valiant";
const HOBGOBLIN = "Hobgoblin";
const SMALL_FRY = "Mastiff"; // CR 1/8

const R5_KEYS = [
  "party",
  "monsters",
  "seed",
  "trials",
  "roundCap",
  "winRate",
  "tpkRate",
  "stalemateRate",
  "avgRounds",
  "roundsPerTrial",
  "hpRemainingPerTrial",
  "koRate",
  "difficulty",
  "fidelity",
];

describe.skipIf(!existsSync(join(VAULT, SYSTEM_DIR, "config", "index.ts")))("rpg sim over the vault", () => {
  let ctx: Ctx;

  beforeAll(async () => {
    await initSystemLoader();
    ctx = makeCtx(copyVaultWithClassStems(VAULT, SYSTEM_DIR, DEFAULT_PARTY));
  }, 240_000);

  async function sim(...tokens: string[]) {
    let out = "";
    let err = "";
    const code = await simMain(
      tokens,
      { out: (s) => (out += s), err: (s) => (err += s) },
      { context: () => ctx, run: simRun, suggest: simSuggest }
    );
    return { code, out, err };
  }

  const run = async (...tokens: string[]) => {
    const result = await sim("run", ...tokens);
    expect(result.code, result.err).toBe(0);
    return { text: result.out, doc: JSON.parse(result.out) as Record<string, any> };
  };

  it("is byte-identical for one seed, differs for another, and finishes 200 trials inside 30 seconds", async () => {
    const started = Date.now();
    const a = await run("--monster", `${HOBGOBLIN}:2`, "--seed", "7", "--trials", "200");
    const elapsed = Date.now() - started;
    const b = await run("--monster", `${HOBGOBLIN}:2`, "--seed", "7", "--trials", "200", "--json");
    const c = await run("--monster", `${HOBGOBLIN}:2`, "--seed", "8", "--trials", "200");
    expect(elapsed).toBeLessThan(30_000);
    expect(b.text).toBe(a.text);
    expect(c.doc.roundsPerTrial.join() + c.doc.hpRemainingPerTrial.join()).not.toBe(
      a.doc.roundsPerTrial.join() + a.doc.hpRemainingPerTrial.join()
    );
  }, 120_000);

  it("writes the R5 keys, rates that sum to one, and per-trial arrays as long as trials", async () => {
    const { doc } = await run("--monster", `${HOBGOBLIN}:2`, "--seed", "7", "--trials", "200");
    expect(Object.keys(doc)).toEqual(R5_KEYS);
    expect(doc.seed).toBe(7);
    expect(doc.trials).toBe(200);
    expect(doc.roundCap).toBe(20);
    for (const rate of [doc.winRate, doc.tpkRate, doc.stalemateRate]) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
    expect(doc.winRate + doc.tpkRate + doc.stalemateRate).toBeCloseTo(1, 3);
    expect(doc.roundsPerTrial).toHaveLength(200);
    expect(doc.hpRemainingPerTrial).toHaveLength(200);
    expect(Object.keys(doc.koRate)).toEqual(["Jacqui Ilitul", "Kowyn", "Lilith", "Talon Pallton"]);
    expect(doc.difficulty).toEqual({ totalCr: "1", benchmark: "1/2", label: "above" });
  }, 120_000);

  it("carries each default PC's stats and weapon attacks exactly as the character sheet has them", async () => {
    const { doc } = await run("--monster", HOBGOBLIN, "--trials", "5");
    expect(doc.party).toHaveLength(DEFAULT_PARTY.length);
    for (const [i, ref] of DEFAULT_PARTY.entries()) {
      const sheet = await characterSheet(ctx, ref);
      const pc = doc.party[i];
      expect(pc).toMatchObject({
        note: ref,
        name: sheet.name,
        level: sheet.level,
        proficiencyBonus: sheet.proficiencyBonus,
        armorClass: sheet.armorClass,
        maxHp: sheet.hitPoints?.max,
        initiative: sheet.initiative,
      });
      sheet.abilities.forEach((a, index) => {
        const key = ["str", "dex", "con", "int", "wis", "cha"][index];
        expect(pc.abilities[key]).toMatchObject({ modifier: a.modifier, save: a.save });
      });
      const sheetWeapons = (sheet.actions as Array<{ name: string; origin: string; hit?: string; damage?: string }>)
        .filter((a) => a.origin === "weapon" && a.hit && parseDamage(a.damage))
        .map((w) => ({ name: w.name, hitBonus: parseInt(w.hit!, 10), damage: parseDamage(w.damage)!.dice }));
      const weapons = pc.actions
        .filter((a: { kind: string }) => a.kind === "weapon")
        .map((w: { name: string; hitBonus: number; damage: string }) => ({
          name: w.name,
          hitBonus: w.hitBonus,
          damage: w.damage,
        }));
      expect(weapons).toEqual(sheetWeapons);
    }
  }, 120_000);

  it("labels a Hobgoblin with a CR-1/8 monster above the benchmark, a lone Hobgoblin at it, a lone mastiff below", async () => {
    const both = await run("--monster", HOBGOBLIN, "--monster", SMALL_FRY, "--trials", "5");
    expect(both.doc.difficulty).toEqual({ totalCr: "5/8", benchmark: "1/2", label: "above" });
    const lone = await run("--monster", HOBGOBLIN, "--trials", "5");
    expect(lone.doc.difficulty).toEqual({ totalCr: "1/2", benchmark: "1/2", label: "at" });
    const small = await run("--monster", SMALL_FRY, "--trials", "5");
    expect(small.doc.difficulty).toEqual({ totalCr: "1/8", benchmark: "1/2", label: "below" });
  }, 120_000);

  it("reports Entangle and Sanctuary as control spells and Tactical Analysis as unsupported", async () => {
    const { doc } = await run("--monster", HOBGOBLIN, "--trials", "5");
    expect(doc.fidelity.Kowyn).toContainEqual({
      name: "Entangle",
      owner: "Kowyn",
      status: "skipped",
      reason: "control-spell",
    });
    expect(doc.fidelity["Jacqui Ilitul"]).toContainEqual({
      name: "Sanctuary",
      owner: "Jacqui Ilitul",
      status: "skipped",
      reason: "control-spell",
    });
    const monsterRef = doc.monsters[0].note as string;
    expect(doc.fidelity[monsterRef]).toContainEqual({
      name: "Tactical Analysis",
      owner: monsterRef,
      status: "skipped",
      reason: "unsupported-feature",
    });
  }, 120_000);

  it("reports a spellcasting monster's Spellcasting feature as skipped", async () => {
    const { doc } = await run("--monster", "Hobgoblin Conjurer", "--trials", "5");
    const ref = doc.monsters[0].note as string;
    expect(doc.fidelity[ref]).toContainEqual(
      expect.objectContaining({ name: "Spellcasting", status: "skipped", reason: "monster-spellcasting" })
    );
  }, 120_000);

  it("suggests encounters across the bestiary, narrowed by --habitat and --cr, within the time budget", async () => {
    const started = Date.now();
    const all = await sim("suggest", "--trials", "20", "--limit", "5");
    expect(all.code, all.err).toBe(0);
    expect(Date.now() - started).toBeLessThan(5 * 60_000);
    const doc = JSON.parse(all.out);
    expect(doc.target).toEqual({ difficulty: "challenging", targetTotal: "1/2", benchmark: "1/2" });
    expect(doc.candidates.length).toBeGreaterThan(0);
    expect(doc.candidates.length).toBeLessThanOrEqual(5);
    expect(doc.excluded["cr-0"]).toBeGreaterThan(0);
    expect(doc.excluded["non-monster"]).toBeGreaterThan(0);

    const half = JSON.parse((await sim("suggest", "--trials", "20", "--cr", "1/2", "--limit", "500")).out);
    expect(half.candidates.length).toBeGreaterThan(0);
    for (const c of half.candidates) expect(c.composition.cr).toBe("1/2");

    const forest = JSON.parse((await sim("suggest", "--trials", "20", "--habitat", "Forest", "--limit", "500")).out);
    expect(forest.candidates.length).toBeGreaterThan(0);
    expect(forest.candidates.length).toBeLessThan(
      JSON.parse((await sim("suggest", "--trials", "20", "--limit", "500")).out).candidates.length + 1
    );
    expect(forest.excluded.filtered).toBeGreaterThan(0);
  }, 400_000);
});
