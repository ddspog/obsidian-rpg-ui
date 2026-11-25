/**
 * `rpg sim catalog` over a fixture vault: one system, four level-1 PCs, a small
 * bestiary of monsters that differ in strength (a harmless rat, wolves, an ogre
 * that wipes the party) and a table of forest encounters. A shared vault root
 * holds every test's catalog under its own name; a test that edits a PC boots
 * the root again (the vault caches what it has read).
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseCatalog } from "lib/domains/encounter-catalog/catalog";
import type { Ctx } from "../app";
import { createSimCatalog } from "./catalog";
import { spokenName } from "./catalog-draft";
import { simMain } from "./dispatch";
import { simPlan } from "./plan";
import { simRun } from "./run";
import { simSuggest } from "./suggest";
import { FIXTURE_SYSTEM, initSystemLoader, makeCtx, pcNote, put, weapon } from "./test-support";

const BESTIARY = "tales-of-the-valiant/worldbuilding/bestiary";
const PCS = ["Aria", "Bram", "Cora", "Dax"];
const pcPath = (name: string) => `fixture/pcs/${name}.md`;
const TABLES = "fixture/gm-tools/tables";
const FOREST = `${TABLES}/Forest Encounters.md`;
const CATALOGS = "fixture/gm-tools/encounter-catalog";

const FEATURES = [
  "# Traits",
  "```rpg feature.details",
  'name: "Bite"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 5 (1d6 + 2) piercing damage.",
  "```",
  "```rpg feature.details",
  'name: "Nibble"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +0 to hit, reach 5 ft., one target. *Hit:* 1 (1d2) piercing damage.",
  "```",
  "```rpg feature.details",
  'name: "Annihilate"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +20 to hit, reach 5 ft., one target. *Hit:* 60 (10d10 + 5) force damage.",
  "```",
  "",
].join("\n");

interface FixtureMonster {
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
    'type: "Medium [[Beast]]"',
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

const MONSTERS: Record<string, FixtureMonster> = {
  // Harmless: a fight with rats costs the party next to nothing.
  Rat: { cr: "1/8", habitat: "[[Forest]], [[Swamp]]", hp: 1, ac: 5, refs: ["@[[Traits]]#Nibble"] },
  Wolf: { cr: "1/4", habitat: "[[Forest]], [[Hills]]", refs: ["@[[Traits]]#Bite"] },
  // One ogre wipes the party in a round or two.
  Ogre: { cr: 2, habitat: "[[Hills]]", hp: 500, ac: 12, refs: ["@[[Traits]]#Annihilate"] },
  // Reads fine, loads badly: its feature ref points at a missing note.
  Wraith: { cr: 1, habitat: "[[Forest]]", refs: ["@[[Nowhere]]#Claw"] },
};

const FOREST_TABLE = [
  "---",
  'source: "From **Fixture** \\"Test Guide\\" by **Nobody**"',
  "---",
  "# Forest Encounters",
  "",
  "### Forest Encounters (Tier 1)",
  "```rpg table.forest-encounters-tier-1",
  "|d6*|ENCOUNTER|",
  "|---|---|",
  "|1|Two rats scurry out of the undergrowth and attack the PCs.|",
  "|2|A pack of three wolves stalks the PCs and attacks.|",
  "|3|An ogre blocks the road and attacks anyone who comes near.|",
  "|4|A calm meadow full of wildflowers, with a stream.|",
  "|5|Wolf tracks lead away into the trees.|",
  "|6|A wraith drifts out of the mist and attacks the PCs.|",
  "|---|---|",
  "|= {{ roll }} =|",
  "```",
  "",
].join("\n");

const MEADOW = `${TABLES}/Meadow Encounters.md`;
const MEADOW_TABLE = [
  "# Meadow Encounters",
  "",
  "```rpg table.meadow-encounters",
  "|d4*|ENCOUNTER|",
  "|---|---|",
  "|1|A wolf drinks from the stream and watches the PCs walk by.|",
  "|2|Three wolves leap out of the long grass and attack the PCs.|",
  "```",
  "",
].join("\n");

// A plural environment ("forests") and a rolled count.
const FORESTS = "fixture/gm-tools/more-tables/Forests Encounters.md";
const FORESTS_TABLE = [
  "# Forests Encounters",
  "",
  "```rpg table.forests-encounters",
  "|d4*|ENCOUNTER|",
  "|---|---|",
  "|1|1d4 + 1 wolves leap out of the brush and attack the PCs.|",
  "```",
  "",
].join("\n");

/** A session note as `rpg session list` sees one: `pcs` and an `rpg log`. */
const sessionNote = (pcs: string[]) =>
  ["---", "pcs:", ...pcs.map((p) => `  - "[[${p}]]"`), "---", "# Session", "```rpg log", "Hello.", "```", ""].join(
    "\n"
  );

let root: string;
let ctx: Ctx;
const clock = { value: "2026-11-21" };

beforeAll(async () => {
  await initSystemLoader();
  root = mkdtempSync(join(tmpdir(), "rpg-catalog-"));
  put(root, "fixture/config/index.ts", FIXTURE_SYSTEM);
  for (const name of PCS) {
    put(
      root,
      pcPath(name),
      pcNote({ name, ac: 14, hp: 11, actions: [weapon("Staff", "+3 (STR)", "1d6+1 bludgeoning")] })
    );
  }
  put(
    root,
    pcPath("Edda"),
    pcNote({ name: "Edda", ac: 14, hp: 11, actions: [weapon("Staff", "+3 (STR)", "1d6+1 bludgeoning")] })
  );
  put(root, "Traits.md", FEATURES);
  for (const [name, m] of Object.entries(MONSTERS)) put(root, `${BESTIARY}/${name}.md`, monsterNote(name, m));
  put(root, FOREST, FOREST_TABLE);
  put(root, MEADOW, MEADOW_TABLE);
  put(root, FORESTS, FORESTS_TABLE);
  put(root, "fixture/sessions/01. Into the Woods.md", sessionNote(["Aria", "Bram"]));
  put(root, "fixture/sessions/01. Edda's Errand.md", sessionNote(["Aria", "Edda"]));
  // Outside the party's system folder: a test note, not one of its sessions.
  put(root, "Sandbox/Session Test.md", sessionNote(["Aria", "Bram"]));
  ctx = makeCtx(root);
}, 120_000);

interface Ran {
  code: number;
  doc: Record<string, any>;
  err: string;
}

async function simIn(where: Ctx, ...tokens: string[]): Promise<Ran> {
  let out = "";
  let err = "";
  const code = await simMain(
    ["catalog", ...tokens],
    { out: (s) => (out += s), err: (s) => (err += s) },
    {
      context: () => where,
      run: async () => {
        throw new Error("run is not under test");
      },
      suggest: async () => {
        throw new Error("suggest is not under test");
      },
      catalog: createSimCatalog({ now: () => clock.value }),
    }
  );
  return { code, doc: out ? JSON.parse(out) : {}, err };
}

const sim = (...tokens: string[]) => simIn(ctx, ...tokens);

const read = (path: string) => readFileSync(join(root, path), "utf8");

/** Every file of the vault, as a sorted list: what a command that must write nothing is compared by. */
const files = (): string[] => (readdirSync(root, { recursive: true, encoding: "utf8" }) as string[]).sort();

const PARTY_PCS = PCS.flatMap((n) => ["--pc", pcPath(n)]);

/** The fixture party's profile: four level-1 PCs. */
const TIER1 = { size: 4, averageLevel: 1, tier: 1, benchmark: "1/2", singleCr: "1/8-1/2" };

/** A new catalog of the four PCs (file `fixture/gm-tools/encounter-catalog/<kebab name>.md`). */
async function init(name: string, ...extra: string[]): Promise<string> {
  const made = await sim("init", "--party-name", name, ...PARTY_PCS, ...extra);
  expect(made.code, made.err).toBe(0);
  return made.doc.catalog as string;
}

/** A catalog holding the four forest drafts, checked: a rat fight (too-easy), three wolves (fit), an ogre (too-hard), a wraith that cannot load. */
async function seeded(name: string, ...extra: string[]): Promise<string> {
  const path = await init(name, ...extra);
  const drafted = await sim("draft", FOREST, "--catalog", path, "--accept");
  expect(drafted.code, drafted.err).toBe(0);
  const checked = await sim("check", "--catalog", path);
  expect(checked.code, checked.err).toBe(0);
  return path;
}

const entriesOf = (path: string) => parseCatalog(read(path)).entries;
const byId = (path: string, id: string) => entriesOf(path).find((e) => e.id === id);

describe("catalog init", () => {
  it("writes the note at <system folder>/gm-tools/encounter-catalog/<kebab party name>.md with the party's PCs", async () => {
    const made = await sim("init", "--party-name", "The Ashen Four", ...PARTY_PCS);
    expect(made.code, made.err).toBe(0);
    expect(made.doc).toEqual({
      catalog: `${CATALOGS}/the-ashen-four.md`,
      party: "The Ashen Four",
      pcs: PCS.map(pcPath),
      difficulty: "challenging",
      session: 0,
      recheckEverySessions: 5,
      reuseAfterSessions: 3,
    });
    const catalog = parseCatalog(read(made.doc.catalog));
    expect(catalog).toEqual({
      party: { name: "The Ashen Four", pcs: PCS.map(pcPath) },
      difficulty: "challenging",
      session: 0,
      recheckEverySessions: 5,
      reuseAfterSessions: 3,
      entries: [],
    });
  });

  it("takes the difficulty, the recheck interval, the session and an explicit catalog path", async () => {
    const made = await sim(
      "init",
      "--party-name",
      "Deadly Few",
      "--pc",
      pcPath("Aria"),
      "--difficulty",
      "deadly",
      "--every",
      "0",
      "--session",
      "7",
      "--catalog",
      "fixture/elsewhere/few"
    );
    expect(made.code, made.err).toBe(0);
    expect(made.doc.catalog).toBe("fixture/elsewhere/few.md");
    expect(parseCatalog(read("fixture/elsewhere/few.md"))).toMatchObject({
      difficulty: "deadly",
      recheckEverySessions: 0,
      session: 7,
      party: { name: "Deadly Few", pcs: [pcPath("Aria")] },
    });
  });

  it("refuses to overwrite a catalog, naming it, and leaves it as it was", async () => {
    await init("Keep Me");
    const path = `${CATALOGS}/keep-me.md`;
    const before = read(path);
    const again = await sim("init", "--party-name", "Keep Me", ...PARTY_PCS);
    expect(again.code).toBe(1);
    expect(again.err).toContain(path);
    expect(again.err).toContain("already exists");
    expect(read(path)).toBe(before);
  });

  it("needs a party name (usage error) and PC notes that exist (runtime error)", async () => {
    const nameless = await sim("init", ...PARTY_PCS);
    expect(nameless.code).toBe(1);
    expect(nameless.err).toContain("--party-name");
    await expect(sim("init", "--party-name", "Ghosts", "--pc", "fixture/pcs/Nobody.md")).rejects.toThrow(/Nobody/);
    expect(existsSync(join(root, CATALOGS, "ghosts.md"))).toBe(false);
  });
});

describe("catalog draft", () => {
  it("is a dry run without --accept: it lists the drafts, confidence first, and writes nothing", async () => {
    const path = await init("Dry Run");
    const before = files();
    const text = read(path);
    const dry = await sim("draft", TABLES, "--catalog", path);
    expect(dry.code, dry.err).toBe(0);
    expect(files()).toEqual(before);
    expect(read(path)).toBe(text);

    const { doc } = dry;
    expect(doc).toMatchObject({
      notes: 2,
      tables: 2,
      considered: 8,
      total: 5,
      byConfidence: { high: 4, medium: 1, low: 0 },
      shown: 5,
      skipped: { "combat-unlikely": 1, duplicate: 1, "no-monster": 1 },
    });
    expect(doc.accepted).toBeUndefined();
    expect(doc.drafts.map((d: { confidence: string }) => d.confidence)).toEqual([
      "high",
      "high",
      "high",
      "high",
      "medium",
    ]);
    expect(doc.drafts[0]).toEqual({
      id: "forest-t1-1-2-rat",
      name: "Forest T1 #1: 2 Rat",
      monsters: [{ note: "Rat", count: 2 }],
      tags: ["forest", "tier-1", "test-guide", "swamp"],
      scene: expect.any(String),
      confidence: "high",
      combat: "likely",
      reasons: [],
    });
    // The habitat of the monsters is a tag, lower-cased, without repeating the table's own.
    expect(doc.drafts.find((d: { id: string }) => d.id === "forest-t1-2-3-wolf").tags).toEqual([
      "forest",
      "tier-1",
      "test-guide",
      "hills",
    ]);
    // The medium one says why.
    expect(doc.drafts[4]).toMatchObject({ id: "meadow-1-wolf", combat: "possible" });
    expect(doc.drafts[4].reasons).toEqual(["creatures named, but no fighting words"]);
  });

  it("needs no catalog for a dry run, and caps the list at --limit while reporting the total", async () => {
    // No catalog exists under that name yet: a dry run still works, with nothing to compare against.
    const capped = await sim("draft", TABLES, "--catalog", "no-such-catalog-yet.md", "--limit", "2");
    expect(capped.code, capped.err).toBe(0);
    expect(capped.doc).toMatchObject({ total: 5, shown: 2 });
    expect(capped.doc.drafts).toHaveLength(2);
  });

  it("names a note or folder that is not in the vault", async () => {
    const missing = await sim("draft", "fixture/gm-tools/nowhere", "--catalog", "x.md");
    expect(missing.code).toBe(1);
    expect(missing.err).toContain("fixture/gm-tools/nowhere");
  });

  it("with --accept writes only the drafts at or above --min-confidence (default high)", async () => {
    const path = await init("Accepting");
    const high = await sim("draft", TABLES, "--catalog", path, "--accept");
    expect(high.code, high.err).toBe(0);
    expect(high.doc).toMatchObject({ catalog: path, minConfidence: "high", accepted: 4 });
    expect(entriesOf(path).map((e) => e.id)).toEqual([
      "forest-t1-1-2-rat",
      "forest-t1-2-3-wolf",
      "forest-t1-3-ogre",
      "forest-t1-6-wraith",
    ]);
    expect(entriesOf(path).every((e) => e.review === "draft" && e.fit === undefined)).toBe(true);
    expect(byId(path, "forest-t1-2-3-wolf")).toMatchObject({
      name: "Forest T1 #2: 3 Wolf",
      monsters: [{ note: `${BESTIARY}/Wolf.md`, count: 3 }],
      source: { note: FOREST, table: "forest-encounters-tier-1", row: "2", book: "test-guide" },
    });

    const medium = await sim("draft", TABLES, "--catalog", path, "--accept", "--min-confidence", "medium");
    expect(medium.doc).toMatchObject({ minConfidence: "medium", accepted: 1 });
    expect(entriesOf(path).map((e) => e.id)).toContain("meadow-1-wolf");
  });

  it("does not add what the catalog has: a rerun accepts nothing, lists nothing and rewrites nothing", async () => {
    const path = await init("Rerun");
    await sim("draft", FOREST, "--catalog", path, "--accept");
    const text = read(path);
    const backups = existsSync(join(root, ".rpg-backups", "cli")) ? readdirSync(join(root, ".rpg-backups", "cli")) : [];
    const again = await sim("draft", FOREST, "--catalog", path, "--accept");
    expect(again.code, again.err).toBe(0);
    expect(again.doc).toMatchObject({ total: 0, accepted: 0, skipped: { duplicate: 4 } });
    expect(read(path)).toBe(text);
    const after = existsSync(join(root, ".rpg-backups", "cli")) ? readdirSync(join(root, ".rpg-backups", "cli")) : [];
    expect(after).toEqual(backups);
  });

  it("with --accept needs a catalog: a usage error that points to init", async () => {
    const none = await sim("draft", FOREST, "--catalog", "fixture/gm-tools/encounter-catalog/absent.md", "--accept");
    expect(none.code).toBe(1);
    expect(none.err).toContain("absent.md");
    expect(none.err).toContain("catalog init");
  });

  it("backs the catalog up before it changes it", async () => {
    const path = await init("Backed Up");
    await sim("draft", FOREST, "--catalog", path, "--accept");
    const backups = readdirSync(join(root, ".rpg-backups", "cli"));
    expect(backups.some((b) => b.endsWith("fixture__gm-tools__encounter-catalog__backed-up.md"))).toBe(true);
  });
});

describe("catalog check", () => {
  it("stamps every entry with a fit state and reports one that cannot load, without aborting", async () => {
    const path = await init("Checking");
    await sim("draft", FOREST, "--catalog", path, "--accept");
    const checked = await sim("check", "--catalog", path);
    expect(checked.code, checked.err).toBe(0);
    const { doc } = checked;
    expect(doc).toMatchObject({
      catalog: path,
      party: { name: "Checking", pcs: 4 },
      session: 0,
      difficulty: "challenging",
      seed: 1,
      trials: 200,
      checked: 3,
      unchanged: 0,
      remaining: 0,
      partition: { fit: 1, tooEasy: 1, tooHard: 1, stale: 0, unchecked: 1, draft: 4 },
    });
    expect(doc.party.stamp).toMatch(/^[0-9a-f]{16}$/);
    expect(doc.errors).toHaveLength(1);
    expect(doc.errors[0].id).toBe("forest-t1-6-wraith");
    expect(doc.errors[0].error).toContain("Wraith.md");

    expect(byId(path, "forest-t1-1-2-rat")?.fit).toMatchObject({
      state: "too-easy",
      stamp: doc.party.stamp,
      difficulty: "challenging",
      checkedOn: "2026-11-21",
      checkedAtSession: 0,
    });
    expect(byId(path, "forest-t1-2-3-wolf")?.fit?.state).toBe("fit");
    expect(byId(path, "forest-t1-3-ogre")?.fit?.state).toBe("too-hard");
    expect(byId(path, "forest-t1-6-wraith")?.fit).toBeUndefined();
  });

  it("is idempotent: a second check simulates nothing and leaves the note as it was", async () => {
    const path = await seeded("Idempotent");
    const text = read(path);
    clock.value = "2027-01-01";
    const again = await sim("check", "--catalog", path);
    clock.value = "2026-11-21";
    expect(again.doc).toMatchObject({ checked: 0, unchanged: 3, remaining: 0 });
    expect(again.doc.errors).toHaveLength(1);
    expect(read(path)).toBe(text);
  });

  it("gives the same fits for the same seed and catalog, and --force simulates every entry again", async () => {
    const path = await seeded("Forced");
    const before = entriesOf(path).map((e) => e.fit);
    const forced = await sim("check", "--catalog", path, "--force");
    expect(forced.doc).toMatchObject({ checked: 3, unchanged: 0 });
    expect(entriesOf(path).map((e) => e.fit)).toEqual(before);
    // A different seed may move the numbers; the check still runs and is stored.
    const other = await sim("check", "--catalog", path, "--force", "--seed", "99", "--trials", "50");
    expect(other.doc).toMatchObject({ checked: 3, seed: 99, trials: 50 });
  });

  it("stops at --limit and says how many are left", async () => {
    const path = await init("Limited");
    await sim("draft", FOREST, "--catalog", path, "--accept");
    const first = await sim("check", "--catalog", path, "--limit", "1");
    expect(first.doc).toMatchObject({ checked: 1, remaining: 3 });
    expect(
      entriesOf(path)
        .filter((e) => e.fit)
        .map((e) => e.id)
    ).toEqual(["forest-t1-1-2-rat"]);
    const rest = await sim("check", "--catalog", path);
    expect(rest.doc).toMatchObject({ checked: 2, unchanged: 1 });
  });

  it("checks again when the party changes (a PC levels up)", async () => {
    const made = await sim("init", "--party-name", "Edda's Pair", "--pc", pcPath("Edda"), "--pc", pcPath("Bram"));
    const path = made.doc.catalog as string;
    await sim("draft", FOREST, "--catalog", path, "--accept");
    const first = await sim("check", "--catalog", path);
    expect(first.doc.checked).toBe(3);
    const stamp = first.doc.party.stamp;

    // Edda reaches level 5: a new boot reads the new note.
    put(
      root,
      pcPath("Edda"),
      pcNote({ name: "Edda", level: 5, ac: 16, hp: 40, actions: [weapon("Staff", "+6 (STR)", "1d6+4 bludgeoning")] })
    );
    const fresh = makeCtx(root);
    const second = await simIn(fresh, "check", "--catalog", path);
    expect(second.code, second.err).toBe(0);
    expect(second.doc.party.stamp).not.toBe(stamp);
    expect(second.doc).toMatchObject({ checked: 3, unchanged: 0 });
    for (const entry of entriesOf(path).filter((e) => e.fit)) expect(entry.fit?.stamp).toBe(second.doc.party.stamp);

    // And the stronger party is no longer beaten by the ogre's one-round wipe, or at least it is judged anew.
    const third = await simIn(fresh, "check", "--catalog", path);
    expect(third.doc).toMatchObject({ checked: 0, unchanged: 3 });
  });

  it("checks again when the session passes the recheck interval, and not before", async () => {
    const path = await seeded("Sessions", "--every", "2");
    const early = await sim("check", "--catalog", path, "--session", "1");
    expect(early.doc).toMatchObject({ session: 1, checked: 0, unchanged: 3 });
    expect(parseCatalog(read(path)).session).toBe(1);

    clock.value = "2026-12-24";
    const due = await sim("check", "--catalog", path, "--session", "2");
    clock.value = "2026-11-21";
    expect(due.doc).toMatchObject({ session: 2, checked: 3, unchanged: 0 });
    expect(byId(path, "forest-t1-2-3-wolf")?.fit).toMatchObject({ checkedAtSession: 2, checkedOn: "2026-12-24" });

    const again = await sim("check", "--catalog", path);
    expect(again.doc).toMatchObject({ session: 2, checked: 0, unchanged: 3 });
  });

  it("does not recheck for a session interval of 0", async () => {
    const path = await seeded("Never Stale", "--every", "0");
    const later = await sim("check", "--catalog", path, "--session", "500");
    expect(later.doc).toMatchObject({ checked: 0, unchanged: 3 });
  });

  it("checks again when the difficulty in the note is changed by hand", async () => {
    const path = await seeded("Deadly Edit");
    put(root, path, read(path).replace("difficulty: challenging", "difficulty: deadly"));
    const next = await sim("check", "--catalog", path);
    expect(next.doc).toMatchObject({ difficulty: "deadly", checked: 3 });
    expect(byId(path, "forest-t1-2-3-wolf")?.fit?.difficulty).toBe("deadly");
  });

  it("keeps a too-easy entry marked too-easy for an unchanged party (it is not rechecked into another state)", async () => {
    const path = await seeded("Still Easy");
    const text = read(path);
    await sim("check", "--catalog", path);
    expect(read(path)).toBe(text);
    expect(byId(path, "forest-t1-1-2-rat")?.fit?.state).toBe("too-easy");
    const suggested = await sim("suggest", "--catalog", path, "--include-draft");
    expect(suggested.doc.entries.map((e: { id: string }) => e.id)).not.toContain("forest-t1-1-2-rat");
  });
});

describe("catalog adjust", () => {
  it("tries changes on an entry that does not fit, and with --accept adds the best as a draft linked to it", async () => {
    const path = await init("Adjusting");
    await sim("draft", FOREST, "--catalog", path, "--accept");
    await sim("check", "--catalog", path);
    const dry = await sim("adjust", "forest-t1-1-2-rat", "--catalog", path, "--trials", "60");
    expect(dry.code, dry.err).toBe(0);
    const rat = dry.doc.adjusted[0];
    expect(rat).toMatchObject({ id: "forest-t1-1-2-rat", fit: "too-easy", make: "harder" });
    expect(rat.tried).toBeGreaterThan(0);
    expect(rat.tactics.join(" ")).toMatch(/ambush/);
    expect(dry.doc.hint).toMatch(/--accept/);
    expect(byId(path, "forest-t1-1-2-rat-adjusted-count")).toBeUndefined();

    if (rat.options.length > 0) {
      const accepted = await sim("adjust", "forest-t1-1-2-rat", "--catalog", path, "--trials", "60", "--accept");
      const added = accepted.doc.adjusted[0].added;
      expect(added).toMatch(/^forest-t1-1-2-rat-adjusted-/);
      expect(byId(path, added)).toMatchObject({
        review: "draft",
        adjustedFrom: "forest-t1-1-2-rat",
        adjustment: rat.options[0].change,
        fit: { state: "fit" },
      });
      expect(byId(path, added)?.tags).toContain("adjusted");
    } else {
      expect(rat.closest).toBeDefined();
    }
  });

  it("names an id the catalog does not have", async () => {
    const path = await init("Adjust Missing");
    const r = await sim("adjust", "nope", "--catalog", path);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/No entry with id "nope"/);
  });
});

describe("catalog suggest", () => {
  it("returns the fit entries that match every --tag, leaving drafts out unless asked", async () => {
    const path = await seeded("Suggesting");
    const hidden = await sim("suggest", "--catalog", path, "--tag", "forest");
    expect(hidden.code, hidden.err).toBe(0);
    expect(hidden.doc).toMatchObject({ catalog: path, party: "Suggesting", session: 0, matched: 0, entries: [] });

    const shown = await sim("suggest", "--catalog", path, "--tag", "forest", "--include-draft");
    expect(shown.doc.matched).toBe(1);
    expect(shown.doc.entries).toEqual([
      {
        id: "forest-t1-2-3-wolf",
        name: "Forest T1 #2: 3 Wolf",
        monsters: [{ note: "Wolf", count: 3 }],
        tags: ["forest", "tier-1", "test-guide", "hills"],
        review: "draft",
        fit: { state: "fit", winRate: 0.92, tpkRate: 0.08, avgHpLost: 0.4102 },
        scene: "A pack of three wolves stalks the PCs and attacks.",
      },
    ]);
    expect(shown.doc.partition).toEqual({ fit: 1, tooEasy: 1, tooHard: 1, stale: 0, unchecked: 1, draft: 4 });

    // Every tag must match; --any-tag needs one.
    expect(
      (await sim("suggest", "--catalog", path, "--include-draft", "--tag", "forest", "--tag", "swamp")).doc.matched
    ).toBe(0);
    expect(
      (await sim("suggest", "--catalog", path, "--include-draft", "--tag", "FOREST", "--tag", "Hills")).doc.matched
    ).toBe(1);
    expect(
      (await sim("suggest", "--catalog", path, "--include-draft", "--any-tag", "swamp", "--any-tag", "hills")).doc
        .matched
    ).toBe(1);
    expect((await sim("suggest", "--catalog", path, "--include-draft", "--any-tag", "desert")).doc.matched).toBe(0);
  });

  it("shows a confirmed entry by default and selects by --state", async () => {
    const path = await seeded("Confirmed");
    await sim("confirm", "forest-t1-2-3-wolf", "forest-t1-1-2-rat", "--catalog", path);
    const fit = await sim("suggest", "--catalog", path);
    expect(fit.doc.entries.map((e: { id: string }) => e.id)).toEqual(["forest-t1-2-3-wolf"]);
    expect(fit.doc.entries[0].review).toBe("confirmed");
    const easy = await sim("suggest", "--catalog", path, "--state", "too-easy");
    expect(easy.doc.entries.map((e: { id: string }) => e.id)).toEqual(["forest-t1-1-2-rat"]);
    const both = await sim("suggest", "--catalog", path, "--state", "too-easy", "--state", "fit", "--limit", "1");
    expect(both.doc).toMatchObject({ matched: 2 });
    expect(both.doc.entries).toHaveLength(1);
    // The one nearest the difficulty's aim comes first.
    expect(both.doc.entries[0].id).toBe("forest-t1-2-3-wolf");
  });

  it("is read-only, says when entries need a check, and hides stale ones unless --include-stale", async () => {
    const path = await seeded("Stale Reads");
    await sim("confirm", "forest-t1-2-3-wolf", "--catalog", path);
    put(root, path, read(path).replace("difficulty: challenging", "difficulty: deadly"));
    const text = read(path);
    const before = files();

    const stale = await sim("suggest", "--catalog", path);
    expect(stale.doc).toMatchObject({ matched: 0, entries: [], needsCheck: 4 });
    expect(stale.doc.partition).toMatchObject({ stale: 3, unchecked: 1 });
    expect(stale.doc.hint).toContain("catalog check");
    expect(stale.doc.hint).toContain("4 entries");

    const included = await sim("suggest", "--catalog", path, "--include-stale");
    expect(included.doc.entries).toHaveLength(1);
    expect(included.doc.entries[0].fit).toMatchObject({ state: "fit", stale: "difficulty-changed" });

    expect(read(path)).toBe(text);
    expect(files()).toEqual(before);
  });

  it("with --refresh checks first, writes the note, and then suggests with no hint", async () => {
    const path = await seeded("Refreshing");
    await sim("confirm", "forest-t1-2-3-wolf", "--catalog", path);
    put(root, path, read(path).replace("difficulty: challenging", "difficulty: deadly"));
    const refreshed = await sim(
      "suggest",
      "--catalog",
      path,
      "--refresh",
      "--state",
      "fit",
      "--state",
      "too-easy",
      "--state",
      "too-hard"
    );
    expect(refreshed.code, refreshed.err).toBe(0);
    expect(refreshed.doc.refreshed).toMatchObject({ checked: 3, remaining: 0 });
    expect(refreshed.doc.difficulty).toBe("deadly");
    expect(refreshed.doc.needsCheck).toBe(1); // the wraith, which cannot load
    expect(refreshed.doc.refreshed.errors).toHaveLength(1);
    expect(byId(path, "forest-t1-2-3-wolf")?.fit?.difficulty).toBe("deadly");
    // Only the confirmed wolf is offered (the others are drafts), judged against the deadly profile.
    expect(refreshed.doc.entries.map((e: { id: string }) => e.id)).toEqual(["forest-t1-2-3-wolf"]);
  });

  it("caps the list at 10 by default", async () => {
    const path = await init("Many");
    for (let i = 1; i <= 12; i++) {
      const add = await sim("add", "--catalog", path, "--name", `Pack ${i}`, "--monster", `${BESTIARY}/Wolf.md:${i}`);
      expect(add.code, add.err).toBe(0);
    }
    await sim("check", "--catalog", path);
    const all = await sim("suggest", "--catalog", path, "--state", "fit", "--state", "too-easy", "--state", "too-hard");
    expect(all.doc.matched).toBe(12);
    expect(all.doc.entries).toHaveLength(10);
  });
});

describe("catalog add, confirm, remove and list", () => {
  it("adds a confirmed entry for existing monster notes, with an id from the name", async () => {
    const path = await init("Adding");
    const added = await sim(
      "add",
      "--catalog",
      path,
      "--name",
      "Wolf Pack & Cub",
      "--monster",
      "Wolf:3",
      "--monster",
      "Rat",
      "--tag",
      "forest",
      "--tag",
      "pack",
      "--tag",
      "forest"
    );
    expect(added.code, added.err).toBe(0);
    expect(added.doc).toEqual({
      catalog: path,
      added: {
        id: "wolf-pack-cub",
        name: "Wolf Pack & Cub",
        monsters: [
          { note: "Wolf", count: 3 },
          { note: "Rat", count: 1 },
        ],
      },
    });
    expect(byId(path, "wolf-pack-cub")).toEqual({
      id: "wolf-pack-cub",
      name: "Wolf Pack & Cub",
      monsters: [
        { note: `${BESTIARY}/Wolf.md`, count: 3 },
        { note: `${BESTIARY}/Rat.md`, count: 1 },
      ],
      tags: ["forest", "pack"],
      review: "confirmed",
    });
    // The same name gets a suffixed id.
    const again = await sim("add", "--catalog", path, "--name", "Wolf Pack & Cub", "--monster", "Wolf");
    expect(again.doc.added.id).toBe("wolf-pack-cub-2");
  });

  it("keeps the note's hand-written prose when a write renews the entries", async () => {
    const path = await init("Prose Kept");
    await sim("add", "--catalog", path, "--name", "Wolf Pack", "--monster", "Wolf:3");
    const file = join(root, path);
    writeFileSync(
      file,
      readFileSync(file, "utf8")
        .replace(
          "> [!abstract]- 1 entry as written",
          "The pack table we actually play.\n\n> [!abstract]- 1 entry as written"
        )
        .replace("> ^wolf-pack\n", "> ^wolf-pack\n> Kowyn owes them a favour.\n")
        .concat("At the bottom, by hand.\n")
    );
    const written = await sim("tag", "--catalog", path, "wolf-pack", "--add-tag", "forest");
    expect(written.code, written.err).toBe(0);
    const text = readFileSync(file, "utf8");
    expect(text).toContain("The pack table we actually play.");
    expect(text).toContain("> Kowyn owes them a favour.");
    expect(text).toContain("At the bottom, by hand.");
  });

  it("fails naming a monster note that does not exist or is not a monster", async () => {
    const path = await init("Bad Adds");
    await expect(sim("add", "--catalog", path, "--name", "X", "--monster", "Dragonling:2")).rejects.toThrow(
      /Dragonling/
    );
    await expect(sim("add", "--catalog", path, "--name", "X", "--monster", "Traits")).rejects.toThrow(
      /Traits.*not a monster/
    );
    expect(entriesOf(path)).toEqual([]);
  });

  it("confirms drafts and removes entries by id; an unknown id is a usage error that changes nothing", async () => {
    const path = await seeded("Editing");
    const text = read(path);
    const bad = await sim("confirm", "forest-t1-2-3-wolf", "no-such-id", "--catalog", path);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain("no-such-id");
    expect(read(path)).toBe(text);

    const confirmed = await sim("confirm", "forest-t1-2-3-wolf", "--catalog", path);
    expect(confirmed.doc).toEqual({ catalog: path, confirmed: ["forest-t1-2-3-wolf"], alreadyConfirmed: [] });
    expect(byId(path, "forest-t1-2-3-wolf")?.review).toBe("confirmed");
    // The fit survives the edit.
    expect(byId(path, "forest-t1-2-3-wolf")?.fit?.state).toBe("fit");
    const twice = await sim("confirm", "forest-t1-2-3-wolf", "--catalog", path);
    expect(twice.doc).toMatchObject({ confirmed: [], alreadyConfirmed: ["forest-t1-2-3-wolf"] });

    const removed = await sim("remove", "forest-t1-3-ogre", "forest-t1-6-wraith", "--catalog", path);
    expect(removed.doc).toEqual({ catalog: path, removed: ["forest-t1-3-ogre", "forest-t1-6-wraith"], remaining: 2 });
    expect(entriesOf(path).map((e) => e.id)).toEqual(["forest-t1-1-2-rat", "forest-t1-2-3-wolf"]);
    const gone = await sim("remove", "forest-t1-3-ogre", "--catalog", path);
    expect(gone.code).toBe(1);
    expect(gone.err).toContain("forest-t1-3-ogre");
  });

  it("lists every entry, compactly, with stale and unchecked marked, and filters by tag, review and state", async () => {
    const path = await seeded("Listing");
    await sim("confirm", "forest-t1-3-ogre", "--catalog", path);
    const all = await sim("list", "--catalog", path);
    expect(all.code, all.err).toBe(0);
    expect(all.doc).toMatchObject({ matched: 4, needsCheck: 1 });
    expect(
      all.doc.entries.map((e: { id: string; fit: { state: string } | null }) => [e.id, e.fit?.state ?? null])
    ).toEqual([
      ["forest-t1-1-2-rat", "too-easy"],
      ["forest-t1-2-3-wolf", "fit"],
      ["forest-t1-3-ogre", "too-hard"],
      ["forest-t1-6-wraith", null],
    ]);

    expect(
      (await sim("list", "--catalog", path, "--review", "confirmed")).doc.entries.map((e: { id: string }) => e.id)
    ).toEqual(["forest-t1-3-ogre"]);
    expect((await sim("list", "--catalog", path, "--review", "draft")).doc.matched).toBe(3);
    expect((await sim("list", "--catalog", path, "--tag", "hills")).doc.matched).toBe(2);
    expect((await sim("list", "--catalog", path, "--state", "too-easy", "--state", "fit")).doc.matched).toBe(2);
    const limited = await sim("list", "--catalog", path, "--limit", "1");
    expect(limited.doc).toMatchObject({ matched: 4 });
    expect(limited.doc.entries).toHaveLength(1);

    put(root, path, read(path).replace("difficulty: challenging", "difficulty: easy"));
    const stale = await sim("list", "--catalog", path, "--tag", "swamp");
    expect(stale.doc.entries[0].fit).toMatchObject({ state: "too-easy", stale: "difficulty-changed" });
    expect(stale.doc.needsCheck).toBe(4);
  });
});

describe("catalog location", () => {
  it("takes the one catalog of the vault when --catalog is omitted, a party name or a path otherwise", async () => {
    // Every vault of these specs holds the fixture system: the registry the contexts share maps its folders once.
    const lone = mkdtempSync(join(tmpdir(), "rpg-catalog-lone-"));
    put(lone, "fixture/config/index.ts", FIXTURE_SYSTEM);
    for (const name of ["Aria", "Bram"]) put(lone, pcPath(name), pcNote({ name, ac: 14, hp: 11 }));
    const here = makeCtx(lone);
    const made = await simIn(here, "init", "--party-name", "Only Ones", "--pc", pcPath("Aria"));
    expect(made.code, made.err).toBe(0);
    const path = made.doc.catalog as string;

    expect((await simIn(here, "list")).doc.catalog).toBe(path);
    expect((await simIn(here, "list", "--catalog", "Only Ones")).doc.catalog).toBe(path);
    expect((await simIn(here, "list", "--catalog", "only-ones")).doc.catalog).toBe(path);
    expect((await simIn(here, "list", "--catalog", path)).doc.catalog).toBe(path);

    const none = await simIn(here, "list", "--catalog", "Other Party");
    expect(none.code).toBe(1);
    expect(none.err).toContain("Other Party");
    expect(none.err).toContain(path);

    // A second catalog: --catalog becomes necessary.
    await simIn(here, "init", "--party-name", "Second Crew", "--pc", pcPath("Bram"));
    const several = await simIn(here, "list");
    expect(several.code).toBe(1);
    expect(several.err).toContain("--catalog");
    expect(several.err).toContain("only-ones.md");
    expect(several.err).toContain("second-crew.md");
  });

  it("is a usage error when the vault has no catalog, saying how to make one", async () => {
    const bare = mkdtempSync(join(tmpdir(), "rpg-catalog-empty-"));
    put(bare, "fixture/config/index.ts", FIXTURE_SYSTEM);
    const empty = makeCtx(bare);
    const none = await simIn(empty, "check");
    expect(none.code).toBe(1);
    expect(none.err).toContain("catalog init");
  });

  it("reports a malformed catalog as a runtime error naming the note", async () => {
    const path = await init("Broken");
    put(root, path, read(path) + "\n```yaml encounter\nname: Oops\nmonsters: []\n```\n");
    await expect(sim("list", "--catalog", path)).rejects.toThrow(/broken\.md[\s\S]*monsters/);
  });
});

describe("spokenName", () => {
  it("says a bestiary name the way a table does", () => {
    expect(spokenName("Wolf, Dire")).toBe("Dire Wolf");
    expect(spokenName("Druid, A")).toBe("Druid");
    expect(spokenName("Rat, Swarm of Rats")).toBe("Swarm of Rats");
    expect(spokenName("Bandit Captain")).toBe("Bandit Captain");
    expect(spokenName("Bat (Giant)")).toBe("Bat (Giant)");
  });
});

/** `rpg sim <tokens>` with every handler wired; the output of plan and the brief forms is one JSON document too. */
async function simAll(...tokens: string[]): Promise<Ran & { out: string }> {
  let out = "";
  let err = "";
  const code = await simMain(
    tokens,
    { out: (s) => (out += s), err: (s) => (err += s) },
    {
      context: () => ctx,
      run: simRun,
      suggest: simSuggest,
      catalog: createSimCatalog({ now: () => clock.value }),
      plan: simPlan,
    }
  );
  return { code, doc: out ? JSON.parse(out) : {}, err, out };
}

describe("--brief", () => {
  it("run: the groups as --monster takes them, the rates, the fit for each difficulty, and no per-trial arrays", async () => {
    const full = await simAll("run", "--monster", "Wolf:3", ...PARTY_PCS);
    const brief = await simAll("run", "--monster", "Wolf:3", ...PARTY_PCS, "--brief");
    expect(brief.code, brief.err).toBe(0);
    expect(Object.keys(brief.doc)).toEqual([
      "monsters",
      "party",
      "seed",
      "trials",
      "winRate",
      "tpkRate",
      "stalemateRate",
      "avgRounds",
      "avgHpLost",
      "koRate",
      "anyDeathRate",
      "difficulty",
      "fit",
      "skipped",
    ]);
    expect(brief.doc.monsters).toEqual(["Wolf:3"]);
    expect(brief.doc.party).toEqual(PCS);
    // The same simulation as the full document.
    for (const key of ["winRate", "tpkRate", "avgRounds", "koRate", "difficulty"]) {
      expect(brief.doc[key]).toEqual(full.doc[key]);
    }
    // 41% of HP lost and an 8% TPK rate is within reach of challenging's aim, past easy's.
    expect(brief.doc.fit).toEqual({ easy: "too-hard", challenging: "fit", deadly: "too-easy" });
    expect(brief.doc.skipped).toEqual({});
    expect(brief.out.length).toBeLessThan(full.out.length / 4);
  });

  it("run: one of a kind is written without a count, and the brief layout is valid JSON, one item to a line", async () => {
    const brief = await simAll("run", "--monster", "Wolf", "--monster", "Rat:2", ...PARTY_PCS, "--brief");
    expect(brief.doc.monsters).toEqual(["Wolf", "Rat:2"]);
    expect(brief.out).toContain('  "monsters": [\n    "Wolf",\n    "Rat:2"\n  ],');
  });

  it("suggest: each candidate as its groups and outcome", async () => {
    const brief = await simAll("suggest", ...PARTY_PCS, "--rank", "outcome", "--limit", "2", "--brief");
    expect(brief.code, brief.err).toBe(0);
    expect(brief.doc.target).toEqual({ difficulty: "challenging", targetTotal: "1/2", rank: "outcome" });
    expect(brief.doc.candidates).toHaveLength(2);
    for (const c of brief.doc.candidates) {
      expect(Object.keys(c)).toEqual([
        "monsters",
        "totalCr",
        "label",
        "fit",
        "winRate",
        "tpkRate",
        "avgHpLost",
        "avgRounds",
      ]);
      expect(c.monsters[0]).toMatch(/^(Wolf|Rat|Ogre)(:\d+)?$/);
    }
  });

  it("catalog suggest: entries with their groups and a flat fit", async () => {
    const path = await seeded("Brief Suggest");
    const brief = await simAll("catalog", "suggest", "--catalog", path, "--include-draft", "--brief");
    expect(brief.code, brief.err).toBe(0);
    expect(brief.doc).toEqual({
      difficulty: "challenging",
      profile: TIER1,
      needsCheck: 1,
      hint: expect.stringContaining("catalog check"),
      matched: 1,
      entries: [
        {
          id: "forest-t1-2-3-wolf",
          name: "Forest T1 #2: 3 Wolf",
          monsters: ["Wolf:3"],
          tags: ["forest", "tier-1", "test-guide", "hills"],
          review: "draft",
          fit: "fit",
          winRate: 0.92,
          tpkRate: 0.08,
          avgHpLost: 0.4102,
          scene: "A pack of three wolves stalks the PCs and attacks.",
        },
      ],
    });
  });

  it("is refused by the catalog actions that do not print a suggestion", async () => {
    const path = await init("Brief List");
    const list = await simAll("catalog", "list", "--catalog", path, "--brief");
    expect(list.code).toBe(1);
    expect(list.err).toContain("--brief is not a flag of `catalog list`");
  });
});

describe("plan", () => {
  it("offers the catalog's confirmed fit entries first, and writes nothing", async () => {
    const path = await seeded("Plan Confirmed");
    await sim("confirm", "forest-t1-2-3-wolf", "--catalog", path);
    const before = files();
    const text = read(path);
    const plan = await simAll("plan", "--catalog", path, "--limit", "1");
    expect(plan.code, plan.err).toBe(0);
    expect(plan.doc).toEqual({
      party: PCS,
      profile: TIER1,
      difficulty: "challenging",
      catalog: path,
      options: [
        {
          from: "catalog",
          id: "forest-t1-2-3-wolf",
          name: "Forest T1 #2: 3 Wolf",
          monsters: ["Wolf:3"],
          tags: ["forest", "tier-1", "test-guide", "hills"],
          fit: "fit",
          winRate: 0.92,
          tpkRate: 0.08,
          avgHpLost: 0.4102,
          scene: "A pack of three wolves stalks the PCs and attacks.",
        },
      ],
      // The wraith's entry could not be checked.
      notes: [expect.stringContaining("1 catalog entry was not offered")],
    });
    expect(files()).toEqual(before);
    expect(read(path)).toBe(text);
  });

  it("fills up to --limit (3) with swept fit groups, never one the catalog already offered", async () => {
    const path = await seeded("Plan Fill");
    const plan = await simAll("plan", "--catalog", path);
    expect(plan.code, plan.err).toBe(0);
    const options = plan.doc.options as Array<Record<string, any>>;
    expect(options).toHaveLength(3);
    expect(options[0]).toMatchObject({ from: "catalog-draft", monsters: ["Wolf:3"] });
    for (const option of options.slice(1)) {
      expect(option).toMatchObject({ from: "sweep", fit: "fit" });
      expect(option.monsters).not.toEqual(["Wolf:3"]);
      expect(option.totalCr).toBeDefined();
    }
    expect(plan.doc.notes).toEqual(
      expect.arrayContaining([expect.stringContaining("catalog confirm"), expect.stringContaining("catalog add")])
    );
    // Each option can be run as it is.
    const again = await simAll("run", ...options[1].monsters.flatMap((m: string) => ["--monster", m]), ...PARTY_PCS);
    expect(again.code, again.err).toBe(0);
  });

  it("matches theme words and --habitat (plural or not) against the catalog's entries", async () => {
    const path = await seeded("Plan Theme");
    const wolf = await simAll("plan", "wolves", "--catalog", path, "--limit", "1");
    expect(wolf.doc.options[0]).toMatchObject({ from: "catalog-draft", id: "forest-t1-2-3-wolf" });
    const hills = await simAll("plan", "--habitat", "Hills", "--catalog", path, "--limit", "1");
    expect(hills.doc.options[0]).toMatchObject({ id: "forest-t1-2-3-wolf" });
    const forests = await simAll("plan", "--habitat", "forests", "--catalog", path, "--limit", "1");
    expect(forests.doc.options[0]).toMatchObject({ id: "forest-t1-2-3-wolf" });
    const swamp = await simAll("plan", "--habitat", "swamp", "--catalog", path, "--limit", "1");
    expect(swamp.doc.options.every((o: { from: string }) => o.from === "sweep")).toBe(true);
  });

  it("sweeps again without the theme words when no monster they name fits", async () => {
    const path = await seeded("Plan Ogre");
    const plan = await simAll("plan", "ogre", "--catalog", path, "--limit", "2", "--tag", "swamp");
    expect(plan.code, plan.err).toBe(0);
    expect(plan.doc.notes).toEqual(expect.arrayContaining([expect.stringContaining("theme words (ogre)")]));
    expect(plan.doc.options.length).toBeGreaterThan(0);
    for (const option of plan.doc.options) expect(option.monsters.join()).not.toContain("Ogre");
  });

  it("does not offer a catalog judged at another difficulty", async () => {
    const path = await seeded("Plan Deadly");
    const plan = await simAll("plan", "--catalog", path, "--difficulty", "deadly", "--limit", "2");
    expect(plan.code, plan.err).toBe(0);
    expect(plan.doc.difficulty).toBe("deadly");
    expect(plan.doc.notes[0]).toContain("for challenging, not deadly");
    expect(plan.doc.options.every((o: { from: string }) => o.from === "sweep")).toBe(true);
  });

  it("with --pc reads no catalog; --pc with --catalog, and a flag of another command, are usage errors", async () => {
    const plan = await simAll("plan", ...PARTY_PCS, "--limit", "1");
    expect(plan.code, plan.err).toBe(0);
    expect(plan.doc.catalog).toBeNull();
    expect(plan.doc.options).toHaveLength(1);
    expect(plan.doc.options[0].from).toBe("sweep");

    const both = await simAll("plan", "--pc", pcPath("Aria"), "--catalog", "x");
    expect(both.code).toBe(1);
    expect(both.err).toContain("--pc and --catalog");
    const rank = await simAll("plan", "--rank", "cr");
    expect(rank.code).toBe(1);
    expect(rank.err).toContain("--rank is not a flag of `plan`");
  });

  it("says why there is nothing to sweep when the party's benchmark is 0", async () => {
    const plan = await simAll("plan", "--pc", pcPath("Aria"), "--pc", pcPath("Bram"));
    expect(plan.code, plan.err).toBe(0);
    expect(plan.doc.options).toEqual([]);
    expect(plan.doc.notes).toEqual([expect.stringContaining("benchmark is 0")]);
  });
});

describe("catalog tag", () => {
  it("adds and drops tags (plural or not), and says which entries did not change", async () => {
    const path = await seeded("Tagging");
    const done = await sim(
      "tag",
      "forest-t1-2-3-wolf",
      "forest-t1-1-2-rat",
      "--add-tag",
      "Ambush",
      "--drop-tag",
      "Hills",
      "--catalog",
      path
    );
    expect(done.code, done.err).toBe(0);
    // In the catalog's order (the rat's row comes first).
    expect(done.doc.changed).toEqual([
      { id: "forest-t1-1-2-rat", tags: ["forest", "tier-1", "test-guide", "swamp", "ambush"] },
      { id: "forest-t1-2-3-wolf", tags: ["forest", "tier-1", "test-guide", "ambush"] },
    ]);
    expect(byId(path, "forest-t1-2-3-wolf")?.tags).toEqual(["forest", "tier-1", "test-guide", "ambush"]);
    const again = await sim("tag", "forest-t1-2-3-wolf", "--add-tag", "ambushes", "--catalog", path);
    expect(again.doc).toMatchObject({ changed: [], unchanged: ["forest-t1-2-3-wolf"] });
  });

  it("needs ids that exist and a tag to add or drop", async () => {
    const path = await init("Tag Errors");
    expect((await sim("tag", "nope", "--add-tag", "x", "--catalog", path)).code).toBe(1);
    const none = await sim("tag", "nope", "--catalog", path);
    expect(none.code).toBe(1);
    expect(none.err).toContain("--add-tag or --drop-tag");
  });
});

describe("catalog use", () => {
  it("records a run, and suggest and plan hold the entry back for --reuse-after sessions", async () => {
    const path = await seeded("Reuse");
    await sim("confirm", "forest-t1-2-3-wolf", "--catalog", path);
    const used = await sim("use", "forest-t1-2-3-wolf", "--catalog", path);
    expect(used.code, used.err).toBe(0);
    expect(used.doc).toEqual({
      catalog: path,
      used: [{ id: "forest-t1-2-3-wolf", uses: 1, lastUsedSession: 0 }],
      offeredAgainFrom: 3,
    });
    expect(byId(path, "forest-t1-2-3-wolf")).toMatchObject({ uses: 1, lastUsedSession: 0 });

    const held = await sim("suggest", "--catalog", path);
    expect(held.doc).toMatchObject({ matched: 0, recentlyUsed: 1 });
    const shown = await sim("suggest", "--catalog", path, "--include-used");
    expect(shown.doc.entries[0]).toMatchObject({ id: "forest-t1-2-3-wolf", uses: 1, lastUsedSession: 0 });

    const plan = await simAll("plan", "--catalog", path, "--limit", "1");
    expect(plan.doc.options[0].from).toBe("sweep");
    expect(plan.doc.notes).toEqual(expect.arrayContaining([expect.stringContaining("run in the last 3 sessions")]));
  });
});

describe("catalog session", () => {
  it("counts the vault's session notes played by the party only, and can be set", async () => {
    const path = await init("Session Count");
    const counted = await sim("session", "--catalog", path);
    expect(counted.code, counted.err).toBe(0);
    // Edda is not in the party, and the Sandbox note is outside the party's system folder.
    expect(counted.doc).toEqual({
      catalog: path,
      session: 1,
      was: 0,
      from: "vault",
      sessions: ["fixture/sessions/01. Into the Woods.md"],
    });
    expect(parseCatalog(read(path)).session).toBe(1);
    const set = await sim("session", "--session", "7", "--catalog", path);
    expect(set.doc).toMatchObject({ session: 7, was: 1, from: "set" });
    expect(parseCatalog(read(path)).session).toBe(7);
  });
});

describe("draft and check: one tag spelling, the scene, a rolled count", () => {
  it("folds a table's plural to the bestiary's habitat, keeps the row, and checks the fewest and most", async () => {
    const path = await init("Rolled");
    const drafted = await sim("draft", FORESTS, "--catalog", path, "--accept", "--min-confidence", "low");
    expect(drafted.code, drafted.err).toBe(0);
    const [entry] = entriesOf(path);
    expect(entry.tags).toEqual(["forest", "hills"]);
    expect(entry.source?.text).toBe("1d4 + 1 wolves leap out of the brush and attack the PCs.");
    expect(entry.monsters).toEqual([{ note: `${BESTIARY}/Wolf.md`, count: 4, dice: "1d4 + 1" }]);

    const checked = await sim("check", "--catalog", path);
    expect(checked.code, checked.err).toBe(0);
    const fit = entriesOf(path)[0].fit;
    expect(fit?.atMin).toMatch(/^(fit|too-easy|too-hard)$/);
    expect(fit?.atMax).toBe("too-hard");
    const brief = await simAll(
      "catalog",
      "suggest",
      "--catalog",
      path,
      "--include-draft",
      "--state",
      "too-hard",
      "--brief"
    );
    expect(brief.doc.entries[0]).toMatchObject({ atMax: "too-hard", scene: expect.stringContaining("wolves leap") });
  });
});

describe("suggest: --fit and a benchmark of 0", () => {
  it("keeps only the fits asked for", async () => {
    const hard = await simAll("suggest", ...PARTY_PCS, "--fit", "too-hard", "--limit", "100");
    expect(hard.code, hard.err).toBe(0);
    expect(hard.doc.candidates.length).toBeGreaterThan(0);
    expect(hard.doc.candidates.every((c: { fit: string }) => c.fit === "too-hard")).toBe(true);
    expect((await simAll("suggest", "--fit", "brutal")).code).toBe(1);
  });

  it("says why a party with a benchmark of 0 gets nothing", async () => {
    const two = await simAll("suggest", "--pc", pcPath("Aria"), "--pc", pcPath("Bram"));
    expect(two.doc.candidates).toEqual([]);
    expect(two.doc.note).toContain("benchmark is 0");
    const brief = await simAll("suggest", "--pc", pcPath("Aria"), "--pc", pcPath("Bram"), "--brief");
    expect(brief.doc.note).toContain("benchmark is 0");
  });
});

describe("the party's tier", () => {
  it("checks, suggests and plans only the party's tier unless --tiers says otherwise", async () => {
    const path = await seeded("Tiered");
    // Untagged with a CR 2 ogre (above a level-1 party's 1/2), and tagged tier 2: both another tier's.
    expect(
      (await sim("add", "--name", "Ogre by hand", "--monster", `${BESTIARY}/Ogre.md`, "--catalog", path)).code
    ).toBe(0);
    expect(
      (
        await sim(
          "add",
          "--name",
          "Wolves of tier 2",
          "--monster",
          `${BESTIARY}/Wolf.md:2`,
          "--tag",
          "tier-2",
          "--catalog",
          path
        )
      ).code
    ).toBe(0);

    const checked = await sim("check", "--catalog", path);
    expect(checked.doc).toMatchObject({ checked: 0, otherTier: 2, profile: TIER1, tiers: "same" });
    expect(byId(path, "ogre-by-hand")?.fit).toBeUndefined();

    const suggested = await sim("suggest", "--catalog", path, "--include-draft", "--state", "too-hard");
    expect(suggested.doc).toMatchObject({ otherTier: 2, needsCheck: 1 });
    expect(suggested.doc.entries.map((e: { id: string }) => e.id)).toEqual(["forest-t1-3-ogre"]);

    const plan = await simAll("plan", "--catalog", path, "--limit", "1");
    expect(plan.doc.notes).toEqual(
      expect.arrayContaining([expect.stringContaining("2 catalog entries are from another tier")])
    );

    const all = await sim("check", "--catalog", path, "--tiers", "all");
    expect(all.doc).toMatchObject({ checked: 2, otherTier: 0 });
    expect(byId(path, "ogre-by-hand")?.fit?.state).toBe("too-hard");
  });

  it("lists every entry unless --tiers is written", async () => {
    const path = await seeded("Tier List");
    await sim("add", "--name", "Ogre by hand", "--monster", `${BESTIARY}/Ogre.md`, "--catalog", path);
    expect((await sim("list", "--catalog", path)).doc.matched).toBe(5);
    expect((await sim("list", "--catalog", path, "--tiers", "same")).doc.matched).toBe(4);
  });
});

describe("catalog prepare", () => {
  it("writes an [Enc:] line into the party's latest session log, which Start Combat offers", async () => {
    const path = await seeded("Preparing");
    const done = await sim("prepare", "forest-t1-2-3-wolf", "--catalog", path);
    expect(done.code, done.err).toBe(0);
    const line = `[Enc:[[${path.replace(/\.md$/, "")}#^forest-t1-2-3-wolf|3 Wolf]]|3 [[Wolf]]|prepared]`;
    expect(done.doc).toEqual({
      catalog: path,
      session: "fixture/sessions/01. Into the Woods.md",
      prepared: [{ id: "forest-t1-2-3-wolf", line }],
    });
    const note = read("fixture/sessions/01. Into the Woods.md");
    expect(note).toContain(`Hello.\n${line}\n\`\`\``);
    expect((await sim("prepare", "nope", "--catalog", path)).code).toBe(1);
  });
});
