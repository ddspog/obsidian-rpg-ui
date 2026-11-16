import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { boot, type Ctx } from "../app";
import { forkLine, listLines, packSession, switchLine, unpackSession } from "../session/lines";
import { manifest } from "../session/manifest";
import { appendToFence, setFrontmatter } from "../write";
import { unzip, zip } from "../zip";
import { gmMode, type GmOptions, gmPlay, gmPrep, gmReveal, gmRoll, gmSay } from "./commands";
import { consult } from "./consult";
import { readNotebook } from "./notebook";
import { findCard, playCard, rollDice, slotsOf } from "./play";
import { loadScreen, type Screen } from "./screen";

/** A die that always shows the same share of its faces. */
const fixed = (share: number) => () => share;

const OPTIONS: GmOptions = {
  set: [],
  pick: [],
  dry: false,
  nth: 1,
  attach: [],
  hex: [],
  note: [],
  dice: false,
  all: false,
};

function vault(): string {
  const root = mkdtempSync(join(tmpdir(), "rpg-gm-"));
  const put = (path: string, text: string) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put(
    "game/binder/One.md",
    '---\npcs:\n  - "[[Ana]]"\n---\n# One\n```rpg log\n=> S01 The road\n=> They set out.\n```\n'
  );
  put("game/party/characters/Ana.md", "# Ana\nCarries [[Rope]].\n");
  put("game/party/items/Rope.md", "# Rope\n");
  put("game/party/items/Lamp.md", "# Lamp\n");
  put(
    "game/books/Rules.md",
    "# Rules\n## Falling\nA creature that falls takes 1d6 damage for each 10 feet.\n## Swimming\nWater is wet.\n"
  );
  return root;
}

describe("zip", () => {
  it("reads back what it wrote", () => {
    const files = [
      { path: "vault/a note.md", data: Buffer.from("héllo\n".repeat(200)) },
      { path: "state.json", data: Buffer.from("{}") },
    ];
    const back = unzip(zip(files));
    expect(back.map((f) => f.path)).toEqual(files.map((f) => f.path));
    expect(back[0].data.equals(files[0].data)).toBe(true);
  });
});

describe("writing a note", () => {
  it("adds lines at the end of the nth block, before trailing blanks", () => {
    const text = "x\n```rpg log\na\n```\n```rpg log\nb\n\n```\ny";
    expect(appendToFence(text, "log", 2, ["c"])).toBe("x\n```rpg log\na\n```\n```rpg log\nb\nc\n\n```\ny");
    expect(() => appendToFence(text, "log", 3, ["c"])).toThrow();
  });
  it("sets a frontmatter key", () => {
    expect(setFrontmatter("---\na: 1\n---\nbody", "gm-mode", "open")).toBe("---\na: 1\ngm-mode: open\n---\nbody");
    expect(setFrontmatter("---\ngm-mode: open\n---\nbody", "gm-mode", "secret")).toBe(
      "---\ngm-mode: secret\n---\nbody"
    );
    expect(setFrontmatter("body", "gm-mode", "open")).toBe("---\ngm-mode: open\n---\nbody");
  });
});

describe("dice", () => {
  it("rolls, keeps and compares", () => {
    expect(rollDice("2d6+3", undefined, fixed(0.5))).toBe("d: 2d6+3=11 (2d6: 4,4)");
    expect(rollDice("d20+5 vs 14", "Attack", fixed(0.5))).toBe("d: Attack | d20+5=16 vs 14 -> Success");
    expect(rollDice("d20-1 vs DC 15", undefined, fixed(0))).toBe("d: d20-1=0 vs DC 15 -> Failure");
    expect(() => rollDice("a lot", undefined)).toThrow();
    expect(() => rollDice("7", undefined)).toThrow();
  });
});

describe("a card played", () => {
  const screen: Screen = {
    note: "GM.md",
    features: [],
    ctx: {} as Screen["ctx"],
    cards: [
      {
        name: "Wander",
        stack: "Table",
        template: "? What crosses the road? ({{where:Forest|Hills}})\ntbl: Wandering d20=\n=> {{result?}}",
      },
      { name: "Mark", stack: "Scene", template: "=> Focus: {{thread}}" },
    ],
  };
  it("takes a slot's option by its beginning and rolls the dice itself", () => {
    const played = playCard(screen, findCard(screen, "wander"), "", { where: "for" }, [], fixed(0.5));
    expect(played.lines).toEqual(["? What crosses the road? (Forest)", "tbl: Wandering d20=11"]);
  });
  it("holds back what the rolls come to", () => {
    const played = playCard(screen, findCard(screen, "Wander"), "", { where: "Hills" }, []);
    expect(played.conclusions).toEqual(["=> <result>"]);
  });
  it("asks for what it needs", () => {
    expect(() => playCard(screen, findCard(screen, "Wander"), "", {}, [])).toThrow(/--set where=<Forest\|Hills>/);
    expect(() => playCard(screen, findCard(screen, "Mark"), "", {}, [])).toThrow(/--set thread/);
    expect(() => playCard(screen, findCard(screen, "Wander"), "", { where: "Sea" }, [])).toThrow(/not one of/);
    expect(() => findCard(screen, "Nothing")).toThrow();
    expect(slotsOf(findCard(screen, "Wander")).map((s) => s.name)).toEqual(["where", "result"]);
  });
});

describe("the notebook and the log", () => {
  it("keeps prep hidden until revealed, and moves with the mode", async () => {
    const root = vault();
    let ctx: Ctx = boot(root);
    await gmPrep(ctx, "One", "Bandits at the ford", {
      ...OPTIONS,
      note: ["They want the toll."],
      when: "the party reaches the river",
    });
    await gmRoll(ctx, "One", "d20+2 vs 12", { ...OPTIONS, into: "Bandits at the ford", label: "Lookout" });
    const hidden = join(root, "game/binder/.gm/One.md");
    expect(readFileSync(hidden, "utf8")).toMatch(
      /\(note: They want the toll\.\)\nd: Lookout \| d20\+2=\d+ vs 12 -> (Success|Failure)/
    );
    expect(readNotebook(ctx, ctx.note("One")).prep[0]).toMatchObject({
      title: "Bandits at the ford",
      status: "idea",
      when: "the party reaches the river",
    });
    // Obsidian (and the vault the CLI reads) does not see the hidden notebook.
    expect(ctx.vault.getFileByPath("game/binder/.gm/One.md")).toBeNull();

    await gmReveal(ctx, "One", "Bandits at the ford", OPTIONS);
    expect(readFileSync(join(root, "game/binder/One (GM).md"), "utf8")).toContain("### Bandits at the ford");
    expect(readNotebook(ctx, ctx.note("One")).prep).toHaveLength(0);

    await gmPrep(ctx, "One", "A storm", { ...OPTIONS, status: "ready" });
    await gmMode(ctx, "One", "open");
    ctx = boot(root);
    expect(existsSync(hidden)).toBe(false);
    expect(readNotebook(ctx, ctx.note("One")).prep.map((p) => p.title)).toEqual(["Bandits at the ford", "A storm"]);
  });

  it("writes lines to the log, and refuses a roll typed by hand", async () => {
    const root = vault();
    const ctx = boot(root);
    await expect(gmSay(ctx, "One", "d: Attack | d20+5=19", OPTIONS)).rejects.toThrow(/holds a roll/);
    await expect(gmRoll(ctx, "One", "d20", OPTIONS)).rejects.toThrow(/--into/);
    await gmSay(ctx, "One", "=> Rain began.", OPTIONS);
    await gmRoll(boot(root), "One", "d20", { ...OPTIONS, into: "log" });
    const text = readFileSync(join(root, "game/binder/One.md"), "utf8");
    expect(text).toMatch(/=> They set out\.\n=> Rain began\.\nd: d20=\d+\n```/);
    expect(existsSync(join(root, ".rpg-backups/cli"))).toBe(true);
  });
});

describe("consulting the books", () => {
  it("finds the passage under its heading", () => {
    const found = consult(boot(vault()), "falling damage");
    expect(found[0]).toMatchObject({ note: "game/books/Rules.md", heading: "Falling" });
    expect(consult(boot(vault()), "falling", { under: ["party"] })).toEqual([]);
  });
});

describe("a session's lines", () => {
  it("names what play changes: the session and everything under the party's folder", () => {
    const m = manifest(boot(vault()), "One");
    expect(m.play).toEqual([
      "game/binder/One.md",
      "game/party/characters/Ana.md",
      "game/party/items/Lamp.md",
      "game/party/items/Rope.md",
    ]);
  });

  it("forks, switches back and forth, and packs", async () => {
    const root = vault();
    const original = readFileSync(join(root, "game/binder/One.md"), "utf8");
    forkLine(boot(root), "One", "Trial run");
    await gmSay(boot(root), "One", "=> A different road.", OPTIONS);
    await gmPrep(boot(root), "One", "Ambush", OPTIONS);
    writeFileSync(join(root, "game/party/characters/Ana.md"), "# Ana\nLevel 2.\n");

    switchLine(boot(root), "One", "main");
    expect(readFileSync(join(root, "game/binder/One.md"), "utf8")).toBe(original);
    expect(readFileSync(join(root, "game/party/characters/Ana.md"), "utf8")).toContain("Carries");
    expect(existsSync(join(root, "game/binder/.gm/One.md"))).toBe(false);

    switchLine(boot(root), "One", "trial-run");
    expect(readFileSync(join(root, "game/binder/One.md"), "utf8")).toContain("A different road.");
    expect(readFileSync(join(root, "game/party/characters/Ana.md"), "utf8")).toContain("Level 2");
    expect(existsSync(join(root, "game/binder/.gm/One.md"))).toBe(true);
    expect(listLines(boot(root), "One")).toMatch(/\*\*trial-run\*\* \(in the vault\)/);
    expect(() => forkLine(boot(root), "One", "trial run")).toThrow(/already/);

    const out = join(root, "pack.zip");
    packSession(boot(root), "One", { out });
    switchLine(boot(root), "One", "main");
    expect(() => unpackSession(boot(root), out, false)).toThrow(/differ/);
    unpackSession(boot(root), out, true);
    expect(readFileSync(join(root, "game/binder/One.md"), "utf8")).toContain("A different road.");
  });
});

// The real GM Screen, when the testing vault is beside the plugin (as in CI).
const VAULT = process.env.RPG_VAULT_ROOT ?? resolve(__dirname, "../../../../testing-vault");
const SESSION = "tales-of-the-valiant/binder/01. Journey to Wisdom's Path.md";

describe.skipIf(!existsSync(join(VAULT, SESSION)))("the vault's GM Screen", () => {
  it("plays its cards with what they roll read out", async () => {
    const ctx = boot(VAULT);
    const screen = (await loadScreen(ctx, ctx.note(SESSION)))!;
    expect(screen.cards.length).toBeGreaterThan(20);
    const name = playCard(
      screen,
      findCard(screen, "Name Generator"),
      "",
      { subject: "the guide", style: "Dwarven", kind: "Masculine name" },
      []
    );
    expect(name.lines.join("\n")).toMatch(/\+ Name: @pick\(Start=1\+Ending=2\) -> \S+/);
    expect(name.conclusions).toEqual(["=> the guide is named <result>"]);
    const event = playCard(screen, findCard(screen, "Random Event"), "", { focus: "Roll" }, ["Actions"]);
    expect(event.lines.join("\n")).toMatch(/\+ Event Focus: d100=\d+ -> \S+/);
    expect(event.waiting).toEqual([]);
    const meaning = playCard(screen, findCard(screen, "Discover Meaning"), "", { question: "Why?" }, []);
    expect(meaning.waiting[0].options).toContain("Actions");
  });

  it("answers a Fate Question at the log's Chaos Factor, in a copy of the session", async () => {
    const root = mkdtempSync(join(tmpdir(), "rpg-gm-real-"));
    mkdirSync(join(root, "binder"));
    writeFileSync(join(root, "binder/S.md"), `---\ngm: "[[GM]]"\n---\n\`\`\`rpg log\n=> S01 Start [CF-2]\n\`\`\`\n`);
    const tools = join(VAULT, "tales-of-the-valiant/gm-tools");
    writeFileSync(join(root, "binder/GM.md"), '---\ngm-tools:\n  - "[[Chaos Factor]]"\n  - "[[Fate Chart]]"\n---\n');
    writeFileSync(join(root, "binder/Chaos Factor.md"), readFileSync(join(tools, "dials/Chaos Factor.md")));
    writeFileSync(join(root, "binder/Fate Chart.md"), readFileSync(join(tools, "oracle/Fate Chart.md")));
    const r = await gmPlay(boot(root), "S", "Fate Question", {
      ...OPTIONS,
      set: ["question=Is it raining?", "odds=likely"],
      into: "The weather",
    });
    const value = r.value as { lines: string[]; reads: string[] };
    expect(value.lines[0]).toBe("? [CF:3] Is it raining?");
    expect(value.lines[1]).toMatch(/^o: Fate Chart \(Likely\) d100=\d+ -> (Yes|No)/);
    expect(value.reads[0]).toMatch(/against 35 \(Likely, Chaos Factor 3\)/);
  });
});
