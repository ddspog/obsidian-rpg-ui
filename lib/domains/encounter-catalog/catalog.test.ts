import { describe, expect, it } from "vitest";

import {
  addEntry,
  type Catalog,
  type CatalogEntry,
  mergeDrafts,
  parseCatalog,
  removeEntry,
  serializeCatalog,
  slugId,
} from "./catalog";

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: "goblin-ambush",
  name: "Goblin ambush",
  monsters: [{ note: "tales-of-the-valiant/bestiary/Goblin.md", count: 4, dice: "1d4+2" }],
  tags: ["forest", "goblinoid"],
  source: { note: "tables/Forest.md", table: "forest-encounters", row: "12", book: "Nomicon" },
  review: "confirmed",
  notes: "Spring the trap on round one.\nThey flee at half strength.",
  fit: {
    state: "fit",
    stamp: "00ff00ff11aa22bb",
    difficulty: "challenging",
    winRate: 0.9,
    tpkRate: 0.05,
    avgHpLost: 0.52,
    checkedOn: "2026-11-21T10:00:00.000Z",
    checkedAtSession: 3,
  },
  ...over,
});

const catalog = (entries: CatalogEntry[] = [entry()]): Catalog => ({
  party: { name: "The Ashen Four: Kowyn & co", pcs: ["chars/Kowyn.md", "chars/Talon.md"] },
  difficulty: "challenging",
  session: 3,
  recheckEverySessions: 5,
  reuseAfterSessions: 3,
  entries,
});

describe("slugId", () => {
  it("makes a kebab id from the name", () => {
    expect(slugId("Goblin Ambush!", [])).toBe("goblin-ambush");
    expect(slugId("  Ørc  Raiders (Lair) ", [])).toBe("rc-raiders-lair");
  });

  it("falls back to the monsters, then to a constant", () => {
    const monsters = [
      { note: "bestiary/Goblin.md", count: 2 },
      { note: "bestiary/Hobgoblin Captain.md", count: 1 },
    ];
    expect(slugId("", monsters)).toBe("2-goblin-1-hobgoblin-captain");
    expect(slugId("???", [])).toBe("encounter");
  });

  it("dedupes by suffix", () => {
    expect(slugId("Goblin", [], ["goblin"])).toBe("goblin-2");
    expect(slugId("Goblin", [], ["goblin", "goblin-2"])).toBe("goblin-3");
    expect(slugId("Goblin", [], [])).toBe("goblin");
  });
});

describe("serializeCatalog", () => {
  it("writes frontmatter, a title and one yaml encounter block per entry", () => {
    const text = serializeCatalog(catalog([entry(), entry({ id: "wolves", name: "Wolves", fit: undefined })]));
    expect(text.startsWith("---\ntype: encounter-catalog\n")).toBe(true);
    expect(text).toContain("# Encounter catalog: The Ashen Four: Kowyn & co");
    expect(text.match(/^```yaml encounter$/gm)).toHaveLength(2);
    expect(text).toContain("difficulty: challenging");
    expect(text).toContain("recheckEverySessions: 5");
  });

  it("keeps the keys in a fixed order and omits what is undefined", () => {
    const text = serializeCatalog(catalog([entry({ source: undefined, notes: undefined, fit: undefined })]));
    const block = /```yaml encounter\n([\s\S]*?)```/.exec(text)?.[1] ?? "";
    expect(block.split("\n").filter((l) => /^\w/.test(l))).toEqual([
      "id: goblin-ambush",
      "name: Goblin ambush",
      "monsters:",
      "tags:",
      "review: confirmed",
    ]);
    expect(text).not.toContain("undefined");
  });
});

describe("parseCatalog round trip", () => {
  it("parse(serialize(c)) deep-equals c", () => {
    const c = catalog([
      entry(),
      entry({
        id: "wolves",
        name: "Wolves: a pack",
        monsters: [{ note: "Wolf", count: 3 }],
        tags: [],
        source: undefined,
        notes: undefined,
        fit: undefined,
        review: "draft",
      }),
      entry({ id: "numeric", name: "007", source: { note: "x.md", row: "12" } }),
    ]);
    expect(parseCatalog(serializeCatalog(c))).toEqual(c);
  });

  it("serialize(parse(t)) is stable for a t that came from serialize", () => {
    const text = serializeCatalog(catalog([entry(), entry({ id: "b", name: "B", fit: undefined })]));
    expect(serializeCatalog(parseCatalog(text))).toBe(text);
  });

  it("round-trips an empty catalog", () => {
    const c = catalog([]);
    expect(parseCatalog(serializeCatalog(c))).toEqual(c);
  });

  it("tolerates hand edits: prose, comments, blank lines, reordered keys, missing optional keys", () => {
    const text = `---
party: Hand Party
pcs:
  - chars/A.md
difficulty: deadly
type: encounter-catalog
---

# My encounters

Some thoughts of mine, in prose.

\`\`\`yaml encounter
# a comment
review: confirmed

monsters:
  - count: 2
    note: Ogre
name: Two ogres
\`\`\`

More prose, and an unrelated block:

\`\`\`yaml
foo: bar
\`\`\`

\`\`\`yaml encounter
name: Lone wolf
monsters:
  - note: Wolf
tags: [Forest]
\`\`\`
`;
    const c = parseCatalog(text);
    expect(c.party).toEqual({ name: "Hand Party", pcs: ["chars/A.md"] });
    expect(c.difficulty).toBe("deadly");
    expect(c.session).toBe(0);
    expect(c.recheckEverySessions).toBe(5);
    expect(c.entries).toEqual([
      {
        id: "two-ogres",
        name: "Two ogres",
        monsters: [{ note: "Ogre", count: 2 }],
        tags: [],
        review: "confirmed",
      },
      {
        id: "lone-wolf",
        name: "Lone wolf",
        monsters: [{ note: "Wolf", count: 1 }],
        tags: ["Forest"],
        review: "draft",
      },
    ]);
    // and a hand-edited note settles after one write
    const once = serializeCatalog(c);
    expect(serializeCatalog(parseCatalog(once))).toBe(once);
  });

  it("reads CRLF notes", () => {
    const text = serializeCatalog(catalog()).replace(/\n/g, "\r\n");
    expect(parseCatalog(text)).toEqual(catalog());
  });
});

describe("parseCatalog errors", () => {
  const wrap = (block: string): string =>
    `---\ntype: encounter-catalog\nparty: P\npcs: []\ndifficulty: easy\n---\n\n# T\n\n\`\`\`yaml encounter\n${block}\n\`\`\`\n`;

  it("names a malformed entry", () => {
    expect(() => parseCatalog(wrap("name: Broken\nmonsters: Goblin"))).toThrow(
      /Encounter entry #1 \("Broken"\): `monsters` must be a non-empty list/
    );
    expect(() => parseCatalog(wrap("monsters:\n  - note: A"))).toThrow(/Encounter entry #1: `name` is missing/);
    expect(() => parseCatalog(wrap("name: X\nmonsters:\n  - note: A\n    count: 0"))).toThrow(/count/);
    expect(() => parseCatalog(wrap("name: X\nmonsters:\n  - note: A\nreview: maybe"))).toThrow(/review/);
    expect(() => parseCatalog(wrap("name: X\nmonsters:\n  - note: A\nfit:\n  state: fit"))).toThrow(/fit\./);
    expect(() => parseCatalog(wrap("name: [unclosed"))).toThrow(/not valid YAML/);
  });

  it("rejects a duplicate id in the note", () => {
    const one = "id: same\nname: A\nmonsters:\n  - note: A";
    const text = wrap(one) + "\n```yaml encounter\nid: same\nname: B\nmonsters:\n  - note: B\n```\n";
    expect(() => parseCatalog(text)).toThrow(/Encounter entry #2 \("B"\): id "same" is already used/);
  });

  it("rejects an unclosed block, missing frontmatter and a bad header", () => {
    expect(() => parseCatalog("---\nparty: P\ndifficulty: easy\n---\n```yaml encounter\nname: X\n")).toThrow(
      /never closed/
    );
    expect(() => parseCatalog("# nothing")).toThrow(/no frontmatter/);
    expect(() => parseCatalog("---\ndifficulty: easy\n---\n")).toThrow(/party/);
    expect(() => parseCatalog("---\nparty: P\ndifficulty: brutal\n---\n")).toThrow(/difficulty/);
    expect(() => parseCatalog("---\ntype: note\nparty: P\ndifficulty: easy\n---\n")).toThrow(/type/);
  });
});

describe("addEntry / removeEntry", () => {
  it("adds without mutating, and rejects a duplicate id by name", () => {
    const c = catalog();
    const next = addEntry(c, entry({ id: "other", name: "Other" }));
    expect(next.entries.map((e) => e.id)).toEqual(["goblin-ambush", "other"]);
    expect(c.entries).toHaveLength(1);
    expect(() => addEntry(next, entry({ id: "other" }))).toThrow(/"other"/);
  });

  it("removes by id and rejects an unknown id", () => {
    const c = catalog([entry(), entry({ id: "b", name: "B" })]);
    expect(removeEntry(c, "b").entries.map((e) => e.id)).toEqual(["goblin-ambush"]);
    expect(() => removeEntry(c, "zzz")).toThrow(/"zzz"/);
  });
});

describe("mergeDrafts", () => {
  const draft = (id: string, monsters: CatalogEntry["monsters"]): CatalogEntry => ({
    id,
    name: id,
    monsters,
    tags: [],
    review: "draft",
  });

  it("skips drafts whose monster set and counts equal an existing entry's", () => {
    const c = catalog([
      entry({
        monsters: [
          { note: "Goblin", count: 3 },
          { note: "Wolf", count: 1 },
        ],
      }),
    ]);
    const {
      catalog: merged,
      added,
      skipped,
    } = mergeDrafts(c, [
      draft("same-reordered", [
        { note: "wolf", count: 1 },
        { note: "Goblin", count: 3 },
      ]),
      draft("more-goblins", [
        { note: "Goblin", count: 4 },
        { note: "Wolf", count: 1 },
      ]),
      draft("again", [
        { note: "Wolf", count: 1 },
        { note: "Goblin", count: 3 },
      ]),
    ]);
    expect(skipped.map((e) => e.id)).toEqual(["same-reordered", "again"]);
    expect(added.map((e) => e.id)).toEqual(["more-goblins"]);
    expect(merged.entries).toHaveLength(2);
  });

  it("skips duplicates inside the drafts themselves and re-ids a taken id", () => {
    const c = catalog([entry({ monsters: [{ note: "Ogre", count: 1 }] })]);
    const {
      catalog: merged,
      added,
      skipped,
    } = mergeDrafts(c, [
      draft("goblin-ambush", [{ note: "Wolf", count: 2 }]),
      draft("w2", [{ note: "Wolf", count: 2 }]),
    ]);
    expect(added.map((e) => e.id)).toEqual(["goblin-ambush-2"]);
    expect(skipped.map((e) => e.id)).toEqual(["w2"]);
    expect(new Set(merged.entries.map((e) => e.id)).size).toBe(2);
  });
});

describe("parseCatalog: the scene, uses and a rolled count's range", () => {
  it("round-trips the row text, the uses, the reuse interval and atMin/atMax", () => {
    const base = entry();
    const full = catalog([
      {
        ...base,
        source: { ...(base.source as NonNullable<CatalogEntry["source"]>), text: 'Goblins leap: "Ambush!"' },
        fit: { ...(base.fit as NonNullable<CatalogEntry["fit"]>), atMin: "too-easy", atMax: "too-hard" },
        uses: 2,
        lastUsedSession: 3,
      },
    ]);
    const back = parseCatalog(serializeCatalog({ ...full, reuseAfterSessions: 0 }));
    expect(back).toEqual({ ...full, reuseAfterSessions: 0 });
  });

  it("defaults the reuse interval to 3 and refuses bad values", () => {
    const text = serializeCatalog(catalog()).replace(/^reuseAfterSessions: 3\n/m, "");
    expect(parseCatalog(text).reuseAfterSessions).toBe(3);
    expect(() => parseCatalog(text.replace("session: 3", "session: 3\nreuseAfterSessions: -1"))).toThrow(
      /reuseAfterSessions/
    );
    const bad = serializeCatalog(catalog([entry({ uses: 1 })])).replace("uses: 1", "uses: lots");
    expect(() => parseCatalog(bad)).toThrow(/`uses` must be a whole number/);
    const badFit = serializeCatalog(catalog()).replace("checkedAtSession: 3", "checkedAtSession: 3\n  atMax: brutal");
    expect(() => parseCatalog(badFit)).toThrow(/fit.atMax/);
  });
});
