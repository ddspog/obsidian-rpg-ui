import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { boot, type Ctx } from "../app";
import { bestiaryPaths, loadMonster, readMonsterNote } from "./monsters";

const BESTIARY = "tales-of-the-valiant/worldbuilding/bestiary";

function monsterNote(name: string, extra: string, refs: string[]): string {
  return [
    `# ${name}`,
    "```rpg stat.monster",
    `name: "${name}"`,
    'type: "Large [[Beast]]"',
    extra,
    "stats:",
    '  ac: "13 (natural armor)"',
    '  hp: "27 (5d8 + 5)"',
    '  speed: "40 ft., climb 30 ft."',
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
  ]
    .filter((l) => l !== "")
    .join("\n");
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
  'name: "Bite (Recharge 5-6)"',
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
  "```rpg feature.details",
  'name: "Howl"',
  "---",
  "The wolf howls at the moon.",
  "```",
  "",
].join("\n");

function fixtureVault(): Ctx {
  const root = mkdtempSync(join(tmpdir(), "rpg-sim-monsters-"));
  const put = (path: string, text: string) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const ref = (block: string) => `@[[Traits]]#${block}`;
  put("Traits.md", TRAITS);
  put(
    `${BESTIARY}/Wolf.md`,
    monsterNote("Wolf", 'cr: "1/2"\nhabitat: "[[Forest]], [[Hills|the hills]]"', [
      ref("Wolf: Multiattack"),
      ref("Bite (Recharge 5-6)"),
      ref("Keen Smell"),
    ])
  );
  put(`${BESTIARY}/Mute.md`, monsterNote("Mute", "cr: 2", [ref("Keen Smell"), ref("Howl")]));
  put(`${BESTIARY}/Lost.md`, monsterNote("Lost", "cr: 1", [ref("Bite (Recharge 5-6)"), "@[[Nowhere]]#Claw"]));
  put(`${BESTIARY}/NoBlock.md`, monsterNote("NoBlock", "cr: 1", [ref("Bite (Recharge 5-6)"), ref("Ghost Block")]));
  put(`${BESTIARY}/Pup.md`, monsterNote("Pup", 'cr: 0\ncategory: "[[Dogs]]"', [ref("Bite (Recharge 5-6)")]));
  put(`${BESTIARY}/Dogs.md`, '# Dogs\n```rpg stat.category\nname: "Dogs"\nhabitat: "[[Grassland]], [[Hills]]"\n```\n');
  put(`${BESTIARY}/Lore.md`, "# Lore\nJust prose, no statblock.\n");
  put(`${BESTIARY}/Broken.md`, "# Broken\n```rpg stat.monster\nname: [unterminated\n```\n");
  put(`${BESTIARY}/NoCr.md`, "# NoCr\n```rpg stat.monster\nname: NoCr\nstats:\n  ac: 12\n  hp: 5\n```\n");
  put(`${BESTIARY}/NoAc.md`, '# NoAc\n```rpg stat.monster\nname: NoAc\ncr: 1\nstats:\n  hp: "5"\n```\n');
  put(`${BESTIARY}/NoHp.md`, '# NoHp\n```rpg stat.monster\nname: NoHp\ncr: 1\nstats:\n  ac: "12"\n```\n');
  put("elsewhere/Other.md", "# Other\n");
  return boot(root);
}

describe("readMonsterNote", () => {
  const ctx = fixtureVault();

  it("reads a monster note's fence", () => {
    const state = readMonsterNote(ctx, `${BESTIARY}/Wolf.md`);
    expect(state.kind).toBe("monster");
    if (state.kind !== "monster") return;
    expect(state.data.cr).toBe("1/2");
    expect(state.file.path).toBe(`${BESTIARY}/Wolf.md`);
  });

  it("reports a note with no stat.monster fence as non-monster", () => {
    expect(readMonsterNote(ctx, `${BESTIARY}/Lore.md`)).toEqual({ kind: "non-monster" });
  });

  it("reports invalid YAML and a fence lacking ac, hp or cr as unresolvable, without throwing", () => {
    for (const [note, why] of [
      ["Broken", /YAML/],
      ["NoCr", /cr/],
      ["NoAc", /ac/],
      ["NoHp", /hp/],
    ] as const) {
      const state = readMonsterNote(ctx, `${BESTIARY}/${note}.md`);
      expect(state.kind, note).toBe("unresolvable");
      if (state.kind === "unresolvable") expect(state.why).toMatch(why);
    }
  });

  it("reports a missing note as unresolvable rather than throwing", () => {
    expect(readMonsterNote(ctx, `${BESTIARY}/Nothing.md`).kind).toBe("unresolvable");
  });
});

describe("bestiaryPaths", () => {
  it("lists the notes under the bestiary folder only", () => {
    const paths = bestiaryPaths(fixtureVault());
    expect(paths).toContain(`${BESTIARY}/Wolf.md`);
    expect(paths).toContain(`${BESTIARY}/Lore.md`);
    expect(paths).not.toContain("elsewhere/Other.md");
    expect(paths).not.toContain("Traits.md");
    expect(paths.every((p) => p.startsWith(`${BESTIARY}/`))).toBe(true);
  });
});

describe("loadMonster", () => {
  const ctx = fixtureVault();

  it("builds the actor from the fence", async () => {
    const m = await loadMonster(ctx, `${BESTIARY}/Wolf.md`);
    expect(m.note).toBe(`${BESTIARY}/Wolf.md`);
    expect(m.name).toBe("Wolf");
    expect(m.cr).toBe("1/2");
    expect(m.speed).toBe(40);
    expect(m.habitat).toEqual(["Forest", "Hills"]);
    expect(m.monsterType).toBe("Large Beast");
    expect(m.actor).toMatchObject({
      side: "monsters",
      armorClass: 13,
      maxHp: 27,
      initiativeModifier: 3,
      proficiencyBonus: 2,
      slots: [],
    });
    expect(m.actor.abilities.str).toEqual({ modifier: 2, saveModifier: 2 });
    expect(m.actor.abilities.int).toEqual({ modifier: -4, saveModifier: -4 });
  });

  it("inherits the habitat of its category note when it writes none", async () => {
    const m = await loadMonster(ctx, `${BESTIARY}/Pup.md`);
    expect(m.habitat).toEqual(["Grassland", "Hills"]);
  });

  it("finds a note by its bare name and keeps actions in feature-ref order", async () => {
    const m = await loadMonster(ctx, "Wolf");
    expect(m.actor.actions.map((a) => a.kind)).toEqual(["multiattack", "weapon"]);
    const [multi, bite] = m.actor.actions;
    expect(multi.kind === "multiattack" && multi.swings).toEqual([bite, bite]);
    expect(bite).toMatchObject({ hitBonus: 4, damage: { type: "piercing" } });
  });

  it("records every feature ref once, modelled or skipped", async () => {
    const owner = `${BESTIARY}/Wolf.md`;
    const m = await loadMonster(ctx, "Wolf");
    expect(m.fidelity).toEqual([
      { name: "Multiattack", owner, status: "modelled" },
      { name: "Bite (Recharge 5-6)", owner, status: "modelled" },
      { name: "Keen Smell", owner, status: "skipped", reason: "unsupported-feature" },
    ]);
  });

  it("gives an actor with nothing damaging exactly one no-damaging-action record", async () => {
    const owner = `${BESTIARY}/Mute.md`;
    const m = await loadMonster(ctx, owner);
    expect(m.actor.actions).toEqual([]);
    expect(m.fidelity.filter((r) => r.reason === "no-damaging-action")).toEqual([
      { name: owner, owner, status: "skipped", reason: "no-damaging-action" },
    ]);
    expect(m.fidelity.map((r) => r.name)).toEqual(["Keen Smell", "Howl", owner]);
    expect(m.fidelity.slice(0, 2).every((r) => r.reason === "unsupported-feature")).toBe(true);
  });

  it("fails naming the note and ref when a feature's note is missing", async () => {
    await expect(loadMonster(ctx, `${BESTIARY}/Lost.md`)).rejects.toThrow(
      new RegExp(`${BESTIARY}/Lost\\.md.*@\\[\\[Nowhere\\]\\]#Claw`)
    );
  });

  it("fails naming the note and ref when a feature's block is missing", async () => {
    await expect(loadMonster(ctx, `${BESTIARY}/NoBlock.md`)).rejects.toThrow(
      new RegExp(`${BESTIARY}/NoBlock\\.md.*@\\[\\[Traits\\]\\]#Ghost Block`)
    );
  });

  it("throws naming a missing note", async () => {
    await expect(loadMonster(ctx, `${BESTIARY}/Nothing.md`)).rejects.toThrow(/Nothing\.md/);
  });

  it("throws naming a note that is not a monster or cannot be read as one", async () => {
    await expect(loadMonster(ctx, `${BESTIARY}/Lore.md`)).rejects.toThrow(/Lore\.md.*not a monster/);
    await expect(loadMonster(ctx, `${BESTIARY}/NoCr.md`)).rejects.toThrow(/NoCr\.md.*cr/);
  });
});

// The real bestiary, when the testing vault is beside the plugin (as in CI).
const VAULT = process.env.RPG_VAULT_ROOT ?? resolve(__dirname, "../../../../testing-vault");
const HOBGOBLIN = `${BESTIARY}/families/humanoids/Hobgoblin.md`;
const CONJURER = `${BESTIARY}/families/humanoids/Hobgoblin Conjurer.md`;

describe.skipIf(!existsSync(join(VAULT, HOBGOBLIN)))("the vault's bestiary", () => {
  const ctx = boot(VAULT);

  it("lists the bestiary notes", () => {
    const paths = bestiaryPaths(ctx);
    expect(paths.length).toBeGreaterThan(500);
    expect(paths).toContain(HOBGOBLIN);
  });

  it("loads the Hobgoblin", async () => {
    const m = await loadMonster(ctx, HOBGOBLIN);
    expect(m.actor).toMatchObject({ armorClass: 18, maxHp: 18, initiativeModifier: 1, side: "monsters" });
    expect(m.cr).toBe("1/2");
    expect(m.speed).toBe(30);
    expect(m.habitat).toEqual(["Forest", "Grassland", "Hills", "Underground"]);
    expect(m.monsterType).toBe("Medium Humanoid");
    for (const stat of Object.values(m.actor.abilities)) expect(stat.saveModifier).toBe(stat.modifier);

    const [multi, longsword, longbow] = m.actor.actions;
    expect(m.actor.actions).toHaveLength(3);
    expect(longsword).toMatchObject({ kind: "weapon", name: "Longsword", hitBonus: 3 });
    expect(longbow).toMatchObject({ kind: "weapon", name: "Longbow", hitBonus: 3 });
    if (longsword.kind !== "weapon" || longbow.kind !== "weapon") throw new Error("expected weapon attacks");
    expect(longsword.damage).toEqual({ expr: "1d8+1", type: "slashing" });
    expect(longbow.damage).toEqual({ expr: "1d8+1", type: "piercing" });
    expect(multi.kind).toBe("multiattack");
    if (multi.kind === "multiattack") {
      expect(multi.swings).toHaveLength(2);
      expect(multi.swings.every((s) => s === longsword)).toBe(true);
    }

    expect(m.fidelity.map((r) => [r.name, r.status, r.reason])).toEqual([
      ["Multiattack", "modelled", undefined],
      ["Longsword", "modelled", undefined],
      ["Longbow", "modelled", undefined],
      ["Tactical Analysis", "skipped", "unsupported-feature"],
    ]);
    expect(m.fidelity.every((r) => r.owner === HOBGOBLIN)).toBe(true);
  });

  it("reads the Hobgoblin Conjurer's Spellcasting: a record a spell, its cantrips skipped as utility", async () => {
    const m = await loadMonster(ctx, CONJURER);
    expect(m.fidelity.find((r) => r.name === "Spellcasting")).toBeUndefined();
    expect(m.fidelity.filter((r) => r.reason === "utility-spell").length).toBeGreaterThan(0);
  });
});
