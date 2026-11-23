import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  SKIP_REASONS,
  type CombatActor,
  type FidelityRecord,
  type ModelledAction,
} from "lib/domains/encounter-sim/types";
import { parseDamage } from "lib/domains/session-log/session-actions";
import type { Ctx } from "../app";
import { characterSheet } from "../commands/character";
import { ammunitionFor, DEFAULT_PARTY, loadParty } from "./party";
import {
  basic,
  FIXTURE_SYSTEM,
  initSystemLoader,
  makeCtx,
  pcNote,
  put,
  spellNote,
  weapon,
  type FixturePc,
} from "./test-support";

const SPELLS: Record<string, string> = {
  Spark: spellNote(
    "Spark",
    "Cantrip",
    { form: "ranged", circle: 0, damage: { roll: "1d10", type: "fire" } },
    "A bolt of fire strikes one creature."
  ),
  "Frost Burst": spellNote(
    "Frost Burst",
    "Cantrip",
    {
      form: "save",
      circle: 0,
      save: { ability: "CON", on_success: "no damage" },
      damage: { roll: "1d6", type: "cold" },
    },
    "One creature in range is chilled."
  ),
  "Douse Light": spellNote("Douse Light", "Cantrip", undefined, "You put out a small light source.", "Put out lights."),
  "Burning Wave": spellNote(
    "Burning Wave",
    "1st-Circle",
    {
      form: "save",
      circle: 1,
      save: { ability: "DEX", on_success: "half damage" },
      damage: { roll: "2d6", type: "fire" },
    },
    "Each creature in a 10-foot cube must make a DEX save."
  ),
  Mend: spellNote(
    "Mend",
    "1st-Circle",
    { form: "healing", circle: 1, damage: { roll: "1d8", type: "healing" } },
    "A creature you touch regains hit points."
  ),
  "Hold Roots": spellNote(
    "Hold Roots",
    "1st-Circle",
    // Grappled is a condition the engine does not play: a control spell it skips.
    { form: "save", circle: 1, save: { ability: "STR", on_success: "negates grappled" }, effects: ["grappled"] },
    "Weeds grasp at a creature."
  ),
};

const CASTER_ABILITY_WIS = { source: "Cleric", ability: "Wisdom", level: 1, slots: [2, 0, 0, 0, 0, 0, 0, 0, 0] };

/** Fixture PCs by file stem, written to `fixture/pcs/<stem>.md`. */
const PCS: Record<string, FixturePc> = {
  Aria: {
    name: "Aria",
    ac: 14,
    hp: 11,
    actions: [
      basic("Dash"),
      weapon("Staff", "+2 (STR)", "1d6 bludgeoning"),
      weapon("Dagger", "-1 (STR)", "1d4-1 piercing"),
      { name: "Healing Word", origin: "feature", bucket: "action", heal: "1d4" },
    ],
    casters: [CASTER_ABILITY_WIS],
    spells: [
      "casters:",
      "  Cleric:",
      "    cantrips:",
      '      - "[[Spark]]"',
      '      - "[[Frost Burst]]"',
      '      - "[[Douse Light]]"',
      "    prepared:",
      '      "1":',
      '        - "[[Burning Wave]]"',
      '        - "[[Mend]]"',
      '        - "[[Hold Roots]]"',
      "    rituals:",
      '      "1":',
      '        - "[[Missing Ritual]]"',
      "    spent:",
      '      "1": 2',
    ].join("\n"),
  },
  Brute: {
    name: "Brute",
    ac: 17,
    hp: 15,
    actions: [weapon("Greataxe", "+5 (STR)", "1d12+3 slashing")],
    spells: "",
  },
  Pacifist: { name: "Pacifist", ac: 10, hp: 6, actions: [basic("Dash")] },
  "No HP": { name: "No HP", ac: 10, actions: [weapon("Club", "+2 (STR)", "1d4 bludgeoning")] },
  "No AC": { name: "No AC", hp: 8, actions: [weapon("Club", "+2 (STR)", "1d4 bludgeoning")] },
};

/** A caster with `source` in the spell fence, listing `cantrip`, and the given header casters. */
function casterPc(name: string, casters: FixturePc["casters"], cantrip: string, source = "Wanderer"): FixturePc {
  return {
    name,
    ac: 12,
    hp: 9,
    actions: [weapon("Cudgel", "+2 (STR)", "1d4 bludgeoning")],
    casters,
    spells: `casters:\n  ${source}:\n    cantrips:\n      - "[[${cantrip}]]"\n    prepared:\n      "1":\n        - "[[Hold Roots]]"`,
  };
}

Object.assign(PCS, {
  "Blank Utility": casterPc(
    "Blank Utility",
    [{ source: "Wanderer", ability: "", level: 1, slots: [2] }],
    "Douse Light"
  ),
  "Blank Attack": casterPc("Blank Attack", [{ source: "Wanderer", ability: "", level: 1, slots: [2] }], "Spark"),
  "Unpicked Attack": casterPc(
    "Unpicked Attack",
    [{ source: "Wanderer", ability: "ability not picked", level: 1, slots: [2] }],
    "Spark"
  ),
  "Orphan Utility": casterPc("Orphan Utility", [], "Douse Light", "Heritage"),
  "Orphan Attack": casterPc("Orphan Attack", [], "Spark", "Heritage"),
  "Lost Spell": casterPc("Lost Spell", [CASTER_ABILITY_WIS], "Vanished Cantrip", "Cleric"),
  "Short Ability": {
    name: "Short Ability",
    ac: 12,
    hp: 9,
    casters: [{ source: "Cleric", ability: "wis", level: 1, slots: [3] }],
    spells: 'casters:\n  Cleric:\n    cantrips:\n      - "[[Spark]]"',
  },
} satisfies Record<string, FixturePc>);

let fixtureRoot: string;

const pcPath = (stem: string) => `fixture/pcs/${stem}.md`;

beforeAll(async () => {
  await initSystemLoader();
}, 120_000);

describe("loadParty over a fixture vault", () => {
  let ctx: Ctx;

  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), "rpg-party-"));
    put(fixtureRoot, "fixture/config/index.ts", FIXTURE_SYSTEM);
    for (const [stem, pc] of Object.entries(PCS)) put(fixtureRoot, pcPath(stem), pcNote(pc));
    for (const [name, text] of Object.entries(SPELLS)) put(fixtureRoot, `fixture/spells/${name}.md`, text);
    put(fixtureRoot, "Stray.md", pcNote({ name: "Stray", ac: 10, hp: 5 }));
    ctx = makeCtx(fixtureRoot);
  }, 60_000);

  const load = (...stems: string[]) => loadParty(ctx, stems.map(pcPath));

  it("resolves a PC to an actor carrying the sheet's numbers and weapon attacks", async () => {
    const { actors, fidelity } = await load("Aria");
    const sheet = await characterSheet(ctx, pcPath("Aria"));
    const actor = actors[0];
    expect(actor).toMatchObject({
      key: pcPath("Aria"),
      name: "Aria",
      side: "party",
      level: 1,
      proficiencyBonus: 2,
      armorClass: 14,
      maxHp: 11,
      initiativeModifier: 1,
    });
    expect(actor.level).toBe(sheet.level);
    expect(actor.proficiencyBonus).toBe(sheet.proficiencyBonus);
    expect(actor.initiativeModifier).toBe(sheet.initiative);
    for (const [index, key] of (["str", "dex", "con", "int", "wis", "cha"] as const).entries()) {
      const a = sheet.abilities[index];
      expect(actor.abilities[key]).toEqual({ score: a.score, modifier: a.modifier, saveModifier: a.save });
    }
    expect(actor.abilities.wis).toEqual({ score: 16, modifier: 3, saveModifier: 3 });

    // The weapon actions are the sheet's weapon actions: same bonus, same dice, same order.
    const weapons = actor.actions.filter((a) => a.kind === "weapon");
    const sheetWeapons = (sheet.actions as Array<{ name: string; origin: string; hit: string; damage: string }>).filter(
      (a) => a.origin === "weapon"
    );
    expect(weapons).toEqual(
      sheetWeapons.map((w) => ({
        kind: "weapon",
        name: w.name,
        hitBonus: parseInt(w.hit, 10),
        damage: { expr: parseDamage(w.damage)!.dice, type: parseDamage(w.damage)!.type },
        // A melee weapon reaches 5 feet unless its range says more.
        reach: { melee: 5 },
      }))
    );
    expect(weapons.map((w) => (w as { hitBonus: number }).hitBonus)).toEqual([2, -1]);

    // Each weapon attack is listed as a modelled fidelity record, keyed by the PC's name.
    expect(Object.keys(fidelity)).toEqual(["Aria"]);
    expect(fidelity.Aria.slice(0, 2)).toEqual([
      { name: "Staff", owner: "Aria", status: "modelled" },
      { name: "Dagger", owner: "Aria", status: "modelled" },
    ]);
  });

  it("refuses the same PC twice, since a party member's name keys the results", async () => {
    await expect(load("Brute", "Brute")).rejects.toThrow(/two party members are named "Brute"/);
  });

  it("loads several PCs in the order given", async () => {
    const { actors, fidelity } = await load("Brute", "Aria");
    expect(actors.map((a) => a.name)).toEqual(["Brute", "Aria"]);
    expect(Object.keys(fidelity)).toEqual(["Brute", "Aria"]);
  });

  it("orders actions as weapon attacks, slotted spells, then cantrips, with full slots from the sheet", async () => {
    const { actors, fidelity } = await load("Aria");
    const actions: ModelledAction[] = actors[0].actions;
    expect(actions.map((a) => `${a.kind}:${a.name}`)).toEqual([
      "weapon:Staff",
      "weapon:Dagger",
      "save:Burning Wave",
      "heal:Mend",
      "spell-attack:Spark",
      "save:Frost Burst",
    ]);
    // Wisdom 16 (+3), proficiency +2: attack +5, DC 13, heal gains the modifier.
    expect(actions[2]).toMatchObject({
      dc: 13,
      ability: "dex",
      onSuccess: "half",
      area: true,
      circle: 1,
      damage: { expr: "2d6", type: "fire" },
    });
    expect(actions[3]).toMatchObject({ expr: "1d8+3", circle: 1 });
    expect(actions[4]).toMatchObject({ hitBonus: 5, circle: 0, damage: { expr: "1d10", type: "fire" } });
    expect(actions[5]).toMatchObject({ dc: 13, ability: "con", onSuccess: "none", circle: 0 });
    // The note spent 2 first-circle slots; a trial starts with the sheet's full count.
    expect(actors[0].slots[0]).toBe(2);
    expect(actors[0].slots.slice(1).every((n) => n === 0)).toBe(true);
    // The sheet's healing feature action is not a spell and is not a weapon: not listed.
    expect(fidelity.Aria.map((r) => `${r.name}:${r.status}${r.reason ? `:${r.reason}` : ""}`)).toEqual([
      "Staff:modelled",
      "Dagger:modelled",
      "Spark:modelled",
      "Frost Burst:modelled",
      "Douse Light:skipped:utility-spell",
      "Burning Wave:modelled",
      "Mend:modelled",
      "Hold Roots:skipped:control-spell",
    ]);
  });

  it("leaves rituals out, so an unresolvable ritual does not fail the load", async () => {
    const note = readFileSync(join(fixtureRoot, pcPath("Aria")), "utf8");
    expect(note).toContain("Missing Ritual");
    const { fidelity } = await load("Aria");
    expect(fidelity.Aria.map((r) => r.name)).not.toContain("Missing Ritual");
  });

  it("reads a caster's ability short or long, in any case", async () => {
    const { actors } = await load("Short Ability");
    expect(actors[0].actions[0]).toMatchObject({ kind: "spell-attack", hitBonus: 5 });
    expect(actors[0].slots).toEqual([3]);
  });

  it("loads a PC whose empty character.spells fence lists no spells", async () => {
    const { actors, fidelity } = await load("Brute");
    expect(actors[0].actions.map((a) => a.name)).toEqual(["Greataxe"]);
    expect(actors[0].slots).toEqual([]);
    expect(fidelity.Brute).toEqual([{ name: "Greataxe", owner: "Brute", status: "modelled" }]);
  });

  it("gives a PC with nothing damaging one actor-level no-damaging-action record", async () => {
    const { actors, fidelity } = await load("Pacifist");
    expect(actors[0].actions).toEqual([]);
    expect(fidelity.Pacifist).toEqual([
      { name: "Pacifist", owner: "Pacifist", status: "skipped", reason: "no-damaging-action" },
    ]);
  });

  it("names the note when it is missing, unmapped, or has no max HP or AC", async () => {
    await expect(load("Nobody")).rejects.toThrow(/fixture\/pcs\/Nobody\.md/);
    await expect(loadParty(ctx, ["Stray.md"])).rejects.toThrow(/Stray\.md/);
    await expect(load("No HP")).rejects.toThrow(/fixture\/pcs\/No HP\.md.*hit points/);
    await expect(load("No AC")).rejects.toThrow(/fixture\/pcs\/No AC\.md.*armor class/);
  });

  it("loads casters without usable numbers when every spell is a skipped classification", async () => {
    const blank = await load("Blank Utility");
    expect(blank.actors[0].slots).toEqual([]);
    expect(blank.actors[0].actions.map((a) => a.name)).toEqual(["Cudgel"]);
    expect(blank.fidelity["Blank Utility"].slice(1)).toEqual([
      { name: "Douse Light", owner: "Blank Utility", status: "skipped", reason: "utility-spell" },
      { name: "Hold Roots", owner: "Blank Utility", status: "skipped", reason: "control-spell" },
    ]);

    const orphan = await load("Orphan Utility");
    expect(orphan.actors[0].slots).toEqual([]);
    expect(orphan.fidelity["Orphan Utility"].map((r) => r.status)).toEqual(["modelled", "skipped", "skipped"]);
  });

  it("fails naming the note and the caster source when a spell needs a casting modifier", async () => {
    for (const stem of ["Blank Attack", "Unpicked Attack"]) {
      await expect(load(stem)).rejects.toThrow(new RegExp(`fixture/pcs/${stem}\\.md.*Spark.*"Wanderer"`));
    }
    await expect(load("Orphan Attack")).rejects.toThrow(/fixture\/pcs\/Orphan Attack\.md.*Spark.*"Heritage"/);
  });

  it("fails naming a spell note that does not resolve", async () => {
    await expect(load("Lost Spell")).rejects.toThrow(/Vanished Cantrip/);
  });

  it("keeps the default party to the four level-1 PCs in the vault's characters folder", () => {
    expect(DEFAULT_PARTY).toEqual(
      ["Jacqui Ilitul", "Kowyn", "Lilith", "Talon Pallton"].map(
        (name) => `tales-of-the-valiant/adventuring/characters/${name}.md`
      )
    );
  });
});

// The real PCs, when the testing vault is beside the plugin (as in CI).
const VAULT = process.env.RPG_VAULT_ROOT ?? resolve(__dirname, "../../../../testing-vault");
const SYSTEM_DIR = "tales-of-the-valiant";

describe.skipIf(!existsSync(join(VAULT, SYSTEM_DIR, "config", "index.ts")))("the vault's party", () => {
  let ctx: Ctx;
  let party: { actors: CombatActor[]; fidelity: Record<string, FidelityRecord[]> };
  const byName = (name: string) => party.actors.find((a) => a.name === name)!;
  const record = (owner: string, name: string) => party.fidelity[owner].find((r) => r.name === name);

  beforeAll(async () => {
    // Read-only: loading a party writes nothing, so the vault is read in place.
    ctx = makeCtx(VAULT);
    party = await loadParty(ctx, DEFAULT_PARTY);
  }, 180_000);

  it("loads the four PCs in the default order", () => {
    expect(party.actors.map((a) => a.name)).toEqual(["Jacqui Ilitul", "Kowyn", "Lilith", "Talon Pallton"]);
    expect(Object.keys(party.fidelity)).toEqual(party.actors.map((a) => a.name));
  });

  it("resolves Kowyn's spells to spell attack +6 and save DC 14", () => {
    const kowyn = byName("Kowyn");
    const attacks = kowyn.actions.filter((a) => a.kind === "spell-attack");
    const saves = kowyn.actions.filter((a) => a.kind === "save");
    expect(attacks.length).toBeGreaterThan(0);
    expect(saves.length).toBeGreaterThan(0);
    for (const a of attacks) expect(a).toMatchObject({ hitBonus: 6 });
    for (const a of saves) expect(a).toMatchObject({ dc: 14 });
  });

  it("models Thunderwave as a CON save for 2d8 thunder, half on success", () => {
    expect(byName("Kowyn").actions.find((a) => a.name === "Thunderwave")).toMatchObject({
      kind: "save",
      ability: "con",
      dc: 14,
      damage: { expr: "2d8", type: "thunder" },
      onSuccess: "half",
      circle: 1,
    });
    expect(record("Kowyn", "Thunderwave")).toEqual({ name: "Thunderwave", owner: "Kowyn", status: "modelled" });
  });

  it("models Kowyn's attack and save cantrips", () => {
    const cantrips = byName("Kowyn").actions.filter((a) => "circle" in a && a.circle === 0);
    expect(cantrips.map((a) => a.kind).sort()).toEqual(expect.arrayContaining(["save", "spell-attack"]));
    expect(record("Kowyn", "Magnetobolt º")?.status).toBe("modelled");
    expect(record("Kowyn", "Create Bonfire ᴰ")?.status).toBe("modelled");
  });

  it("takes the first-circle slot count from the sheet, full despite the note's spent", async () => {
    const note = readFileSync(join(ctx.root, DEFAULT_PARTY[1]), "utf8");
    expect(note).toMatch(/spent:\s*\n\s*"1": 1/);
    const sheet = await characterSheet(ctx, DEFAULT_PARTY[1]);
    const druid = sheet.casters.find((c) => c.source === "Druid");
    expect(druid?.slots[0]).toBeGreaterThan(0);
    expect(byName("Kowyn").slots[0]).toBe(druid!.slots[0]);
  });

  it("models Entangle as a control spell: a save that deals nothing and restrains", () => {
    expect(record("Kowyn", "Entangle")).toEqual({ name: "Entangle", owner: "Kowyn", status: "modelled" });
    expect(byName("Kowyn").actions.find((a) => a.name === "Entangle")).toMatchObject({
      kind: "save",
      ability: "str",
      dc: 14,
      damage: { expr: "0" },
      targets: 4,
      inflicts: { condition: "restrained", lasts: "fight" },
    });
  });

  it("skips Jacqui's Sanctuary as a control spell and models Cure Wounds as a heal", () => {
    expect(record("Jacqui Ilitul", "Sanctuary")).toMatchObject({ status: "skipped", reason: "control-spell" });
    expect(record("Jacqui Ilitul", "Cure Wounds")).toMatchObject({ status: "modelled" });
    expect(byName("Jacqui Ilitul").actions.find((a) => a.name === "Cure Wounds")).toMatchObject({
      kind: "heal",
      circle: 1,
    });
  });

  it("loads Lilith and Talon with their weapon attacks", () => {
    expect(byName("Lilith").actions.map((a) => a.name)).toContain("Glaive");
    expect(byName("Talon Pallton").actions.filter((a) => a.kind === "weapon").length).toBeGreaterThan(0);
  });

  it("draws every skipped reason from the six-reason vocabulary", () => {
    for (const records of Object.values(party.fidelity)) {
      for (const r of records) {
        expect(["modelled", "skipped"]).toContain(r.status);
        if (r.status === "skipped") expect(SKIP_REASONS).toContain(r.reason);
        else expect(r.reason).toBeUndefined();
      }
    }
  });
});

describe("ammunitionFor", () => {
  const inventory = {
    items: [
      { name: "[[Longbow]]" },
      { name: "[[Quiver]]", contents: [{ name: "[[Arrows]]", qty: 19 }] },
      { name: "[[Pouch]]", contents: [{ name: "[[Crossbow Bolts]]", qty: 10 }, "[[Arrow]]"] },
    ],
  };

  it("counts the shots the inventory holds for a ranged weapon, in containers too", () => {
    expect(ammunitionFor("Longbow", inventory)).toBe(19);
    expect(ammunitionFor("Crossbow, light", inventory)).toBe(10);
    expect(ammunitionFor("Sling", inventory)).toBe(0);
  });

  it("needs none for a weapon that shoots no ammunition", () => {
    expect(ammunitionFor("Dagger", inventory)).toBeUndefined();
  });
});
