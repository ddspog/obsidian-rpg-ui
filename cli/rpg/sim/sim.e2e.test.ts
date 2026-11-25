import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseCatalog } from "lib/domains/encounter-catalog/catalog";
import { parseDamage } from "lib/domains/session-log/session-actions";
import type { Ctx } from "../app";
import { characterSheet } from "../commands/character";
import { simCalibrate } from "./calibrate";
import { createSimCatalog } from "./catalog";
import { simMain } from "./dispatch";
import { parseSimArgv } from "./flags";
import { DEFAULT_PARTY } from "./party";
import { simRun } from "./run";
import { simSuggest } from "./suggest";
import { copyVault, initSystemLoader, makeCtx } from "./test-support";

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

describe.skipIf(!existsSync(join(VAULT, SYSTEM_DIR, "config", "index.ts")))("rpg sim over the vault", () => {
  let ctx: Ctx;

  beforeAll(async () => {
    await initSystemLoader();
    ctx = makeCtx(copyVault(VAULT, SYSTEM_DIR));
  }, 240_000);

  async function sim(...tokens: string[]) {
    let out = "";
    let err = "";
    const code = await simMain(
      tokens,
      { out: (s) => (out += s), err: (s) => (err += s) },
      {
        context: () => ctx,
        run: simRun,
        suggest: simSuggest,
        catalog: createSimCatalog({ now: () => "2026-11-21" }),
      }
    );
    return { code, out, err };
  }

  const run = async (...tokens: string[]) => {
    const result = await sim("run", ...tokens);
    expect(result.code, result.err).toBe(0);
    return { text: result.out, doc: JSON.parse(result.out) as Record<string, any> };
  };

  it("calibrate sets the logged kobold fight against the simulator's run of it", async () => {
    const { doc } = await simCalibrate(ctx, parseSimArgv(["calibrate", "tales-of-the-valiant/binder"]).options);
    const d = doc as Record<string, any>;
    const fight = d.fights.find((f: any) => f.map === "Clearing");
    expect(fight.foes).toHaveLength(4);
    expect(fight.pcs).toHaveLength(4);
    expect(fight.actual.rounds).toBe(2);
    expect(fight.actual.knockedOut).toEqual([]);
    expect(fight.actual.hpLost).toBeGreaterThan(0.1);
    expect(fight.actual.hpLost).toBeLessThan(0.4);
    expect(fight.percentile).toBeGreaterThanOrEqual(0);
    expect(fight.percentile).toBeLessThanOrEqual(1);
    expect(d.notes.join(" ")).toMatch(/too few to tune/);
  }, 120_000);

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

  it("models Entangle, wards with Sanctuary and reports Tactical Analysis as unsupported", async () => {
    const { doc } = await run("--monster", HOBGOBLIN, "--trials", "5");
    expect(doc.fidelity.Kowyn).toContainEqual({ name: "Entangle", owner: "Kowyn", status: "modelled" });
    expect(doc.fidelity["Jacqui Ilitul"]).toContainEqual({
      name: "Sanctuary",
      owner: "Jacqui Ilitul",
      status: "modelled",
    });
    const monsterRef = doc.monsters[0].note as string;
    expect(doc.fidelity[monsterRef]).toContainEqual({
      name: "Tactical Analysis",
      owner: monsterRef,
      status: "skipped",
      reason: "unsupported-feature",
    });
  }, 120_000);

  it("casts a spellcasting monster's spells from the vault's spell notes", async () => {
    const { doc } = await run("--monster", "Hobgoblin Conjurer", "--trials", "5");
    const ref = doc.monsters[0].note as string;
    // Web: a DEX save or restrained, once a day.
    expect(doc.monsters[0].actions).toContainEqual(expect.objectContaining({ name: "Web", kind: "save", perDay: 1 }));
    expect(doc.fidelity[ref]).toContainEqual({ name: "Web", owner: ref, status: "modelled" });
    expect(doc.fidelity[ref]).toContainEqual(expect.objectContaining({ name: "Light", reason: "utility-spell" }));
  }, 120_000);

  // Void is a template note the vault's main branch has (CI checks the vault out at main).
  it("applies a template named after the creature: Void on a Mule", async () => {
    const plain = (await run("--monster", "Mule", "--trials", "5")).doc.monsters[0];
    const { doc } = await run("--monster", "Mule with Void", "--trials", "5");
    const voided = doc.monsters[0];
    expect(voided.note).toMatch(/Mule\.md with Void$/);
    expect(voided.name).toBe(`${plain.name} (Void)`);
    expect(voided.hp).not.toBe(plain.hp);
    await expect(sim("run", "--monster", "Mule with Nothing Such", "--trials", "5")).rejects.toThrow(
      /No template "Nothing Such"/
    );
  }, 120_000);

  it("fights on a battle map: the monsters its tokens link, everyone on their token", async () => {
    const { doc } = await run("--map", "Kobold Ambush", "--trials", "20");
    expect(doc.rules.map).toBe("Kobold Ambush");
    expect(doc.monsters.length).toBeGreaterThan(0);
    expect(doc.winRate + doc.tpkRate + doc.stalemateRate).toBeCloseTo(1, 5);
    const plain = await run(
      ...doc.monsters.flatMap((m: { note: string; count: number }) => ["--monster", `${m.note}:${m.count}`]),
      "--trials",
      "20"
    );
    expect(plain.doc.rules.map).toBeUndefined();
  }, 120_000);

  it("suggests encounters across the bestiary, narrowed by --habitat and --cr, within the time budget", async () => {
    const started = Date.now();
    // This spec is about ranking by CR (no longer the default) over the whole bestiary.
    const all = await sim("suggest", "--rank", "cr", "--tiers", "all", "--trials", "20", "--limit", "5");
    expect(all.code, all.err).toBe(0);
    expect(Date.now() - started).toBeLessThan(5 * 60_000);
    const doc = JSON.parse(all.out);
    expect(doc.target).toEqual({ difficulty: "challenging", targetTotal: "1/2", benchmark: "1/2", rank: "cr" });
    expect(doc.candidates.length).toBeGreaterThan(0);
    expect(doc.candidates.length).toBeLessThanOrEqual(5);
    expect(doc.excluded["cr-0"]).toBeGreaterThan(0);
    expect(doc.excluded["non-monster"]).toBeGreaterThan(0);

    const half = JSON.parse(
      (await sim("suggest", "--rank", "cr", "--trials", "20", "--cr", "1/2", "--limit", "500")).out
    );
    expect(half.candidates.length).toBeGreaterThan(0);
    for (const c of half.candidates) expect(c.composition.cr).toBe("1/2");

    const forest = JSON.parse(
      (await sim("suggest", "--rank", "cr", "--trials", "20", "--habitat", "Forest", "--limit", "500")).out
    );
    expect(forest.candidates.length).toBeGreaterThan(0);
    expect(forest.candidates.length).toBeLessThan(
      JSON.parse((await sim("suggest", "--rank", "cr", "--trials", "20", "--limit", "500")).out).candidates.length + 1
    );
    expect(forest.excluded.filtered).toBeGreaterThan(0);
  }, 400_000);

  it("ranks by outcome over the bestiary: every candidate carries fit and avgHpLost, within the time budget", async () => {
    const started = Date.now();
    const result = await sim("suggest", "--rank", "outcome", "--trials", "20", "--limit", "50");
    expect(result.code, result.err).toBe(0);
    expect(Date.now() - started).toBeLessThan(5 * 60_000);
    const doc = JSON.parse(result.out);
    expect(doc.target).toEqual({ difficulty: "challenging", targetTotal: "1/2", benchmark: "1/2", rank: "outcome" });
    expect(doc.candidates.length).toBeGreaterThan(0);
    for (const c of doc.candidates) {
      expect(["fit", "too-easy", "too-hard"]).toContain(c.fit);
      expect(c.avgHpLost).toBeGreaterThanOrEqual(0);
      expect(c.avgHpLost).toBeLessThanOrEqual(1);
      expect(c.base).toBeUndefined();
      expect(c.composition.count).toBeLessThanOrEqual(30);
    }
    // The wider sweep reaches totals beyond twice the target (1), up to 4 x the benchmark (2).
    const all = JSON.parse((await sim("suggest", "--rank", "outcome", "--trials", "20", "--limit", "5000")).out);
    const totals = all.candidates.map((c: { totalCr: string }) => {
      const [a, b] = c.totalCr.split("/").map(Number);
      return b ? a / b : a;
    });
    expect(Math.max(...totals)).toBeGreaterThan(1);
    expect(Math.max(...totals)).toBeLessThanOrEqual(2);
  }, 400_000);

  it("adds a base group to every suggested fight: Hobgoblin with one small kind", async () => {
    const result = await sim(
      "suggest",
      "--rank",
      "cr",
      "--base",
      HOBGOBLIN,
      "--cr",
      "1/8",
      "--trials",
      "20",
      "--limit",
      "50"
    );
    expect(result.code, result.err).toBe(0);
    const doc = JSON.parse(result.out);
    expect(doc.candidates.length).toBeGreaterThan(0);
    for (const c of doc.candidates) {
      expect(c.base).toHaveLength(1);
      expect(c.base[0]).toMatchObject({ count: 1, cr: "1/2" });
      expect(c.base[0].note).toMatch(/Hobgoblin\.md$/);
      expect(c.composition.cr).toBe("1/8");
      const [a, b] = c.totalCr.split("/").map(Number);
      expect(b ? a / b : a).toBeGreaterThanOrEqual(0.5);
      expect(["fit", "too-easy", "too-hard"]).toContain(c.fit);
    }
    // One CR-1/8 monster on top of the Hobgoblin's 1/2: the total is 5/8.
    expect(
      doc.candidates.some(
        (c: { composition: { count: number }; totalCr: string }) => c.composition.count === 1 && c.totalCr === "5/8"
      )
    ).toBe(true);
  }, 400_000);

  it("keeps an encounter catalog: init, draft the arctic table (dry run, then accept), check, suggest", async () => {
    const arctic = "tales-of-the-valiant/gm-tools/tables/game-masters-guide/Arctic Encounters.md";
    const files = () => (readdirSync(ctx.root, { recursive: true, encoding: "utf8" }) as string[]).sort();
    const catalog = async (...tokens: string[]) => {
      const result = await sim("catalog", ...tokens);
      expect(result.code, result.err).toBe(0);
      return JSON.parse(result.out) as Record<string, any>;
    };

    const made = await catalog("init", "--party-name", "E2E Party");
    const path = made.catalog as string;
    expect(path).toBe("tales-of-the-valiant/gm-tools/encounter-catalog/e2e-party.md");
    expect(made.pcs).toEqual(DEFAULT_PARTY);

    // A dry run writes nothing.
    const before = files();
    const dry = await catalog("draft", arctic, "--catalog", path);
    expect(files()).toEqual(before);
    expect(dry.accepted).toBeUndefined();
    expect(dry.total).toBeGreaterThan(5);
    const bandits = dry.drafts.find((d: { id: string }) => d.id === "arctic-t1-6-bandit-captain-2-bandit");
    expect(bandits).toMatchObject({
      name: "Arctic T1 #6: Bandit Captain + 2 Bandit",
      monsters: [
        { note: "Bandit Captain", count: 1 },
        { note: "Bandit", count: 2 },
      ],
      confidence: "high",
    });
    expect(bandits.tags).toEqual(expect.arrayContaining(["arctic", "tier-1", "game-masters-guide"]));

    const accepted = await catalog("draft", arctic, "--catalog", path, "--accept");
    expect(accepted.accepted).toBe(accepted.byConfidence.high);
    const drafted = parseCatalog(readFileSync(join(ctx.root, path), "utf8")).entries;
    expect(drafted).toHaveLength(accepted.accepted);
    expect(drafted.every((e) => e.review === "draft" && !e.fit)).toBe(true);

    // The arctic table has rows of all four tiers: --tiers all checks every one.
    const checked = await catalog("check", "--catalog", path, "--trials", "50", "--tiers", "all");
    expect(checked).toMatchObject({ checked: drafted.length, unchanged: 0, errors: [] });
    const states = checked.partition.fit + checked.partition.tooEasy + checked.partition.tooHard;
    expect(states).toBe(drafted.length);
    const again = await catalog("check", "--catalog", path, "--trials", "50", "--tiers", "all");
    expect(again).toMatchObject({ checked: 0, unchanged: drafted.length });

    // Nothing is confirmed yet, so the default suggestion is empty; with drafts and every state it is not.
    expect((await catalog("suggest", "--catalog", path, "--tag", "arctic")).entries).toEqual([]);
    const suggested = await catalog(
      "suggest",
      "--catalog",
      path,
      "--tag",
      "arctic",
      "--include-draft",
      "--state",
      "fit",
      "--state",
      "too-easy",
      "--state",
      "too-hard",
      "--limit",
      "50"
    );
    expect(suggested.needsCheck).toBe(0);
    expect(suggested.hint).toBeUndefined();
    expect(suggested.entries.length).toBeGreaterThan(0);
    for (const entry of suggested.entries) {
      expect(entry.tags).toContain("arctic");
      expect(["fit", "too-easy", "too-hard"]).toContain(entry.fit.state);
    }

    // An adventure's keyed areas: the bold creatures of each *Creatures.* paragraph, keyed by the area.
    const heist = await catalog(
      "draft",
      "tales-of-the-valiant/worldbuilding/adventures/griffon-heist/Part 2, The Still Tower.md",
      "--catalog",
      path
    );
    expect(heist.drafts).toContainEqual(
      expect.objectContaining({
        name: "Part 2: The Still Tower #B3: Goblin Captain + Hobgoblin Conjurer + 4 Goblin",
        confidence: "high",
      })
    );
    // A map's linked tokens, the PCs' names left out.
    const ambush = await catalog("draft", "tales-of-the-valiant/atlas/maps/Kobold Ambush.md", "--catalog", path);
    expect(ambush.drafts[0]).toMatchObject({ name: "Kobold Ambush #map: Tinkerer Kobold + Elite Kobold + 2 Kobold" });
    // A template a row names is kept on the creature.
    const voidT2 = await catalog(
      "draft",
      "tales-of-the-valiant/gm-tools/tables/labyrinth-worldbook/Near Void Encounters (Tier 2).md",
      "--catalog",
      path
    );
    const mage = voidT2.drafts.find((d: { name: string }) => d.name.includes("Mage (Void-Blessed)"));
    expect(mage.monsters).toContainEqual({ note: "Mage with Void-Blessed", count: 1 });
  }, 400_000);

  it("refuses --base on run with a usage error", async () => {
    const result = await sim("run", "--monster", HOBGOBLIN, "--base", HOBGOBLIN);
    expect(result.code).toBe(1);
    expect(result.err).toContain("--monster");
  });
});
