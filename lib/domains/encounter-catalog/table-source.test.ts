import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { extractEncounter } from "./extract-row";
import { buildMonsterIndex, type MonsterEntry } from "./monster-index";
import { bookOf, kebab, tablesOfNote } from "./table-source";

const ARCTIC = `---
source: "From **Tales of the Valiant** \\"Game Master's Guide\\" by **Kobold Press**"
---
# Arctic Encounters

The coldest terrains in the world.

### Arctic Encounters (Tier 1)
\`\`\`rpg table.arctic-encounters-tier-1
|d12*|ENCOUNTER|
|---|---|
|1|A giant owl tracks the PCs’ movement but never gets closer than 500 feet to them.|
|2|The PCs come across a hastily abandoned encampment.|
|---|---|
|= {{ roll }} =|
[ARCTIC ENCOUNTERS (TIER 1)]
\`\`\`

### Arctic Encounters (Tier 2)
\`\`\`rpg table.arctic-encounters-tier-2
|d12*|ENCOUNTER|
|---|---|
|1|A young white dragon swoops down.|
|2-3|A winged creature’s shadow passes the PCs.|
|4–5|A master alchemist has devised an ointment.|
|---|---|
|= {{ roll }} =|
\`\`\`
`;

describe("tablesOfNote", () => {
  it("reads the tables of an encounters note with their headings and tags", () => {
    const tables = tablesOfNote("tales/gm-tools/Arctic Encounters.md", ARCTIC);
    expect(tables.map((t) => t.slug)).toEqual(["arctic-encounters-tier-1", "arctic-encounters-tier-2"]);
    const [one, two] = tables;
    expect(one.heading).toBe("Arctic Encounters (Tier 1)");
    expect(one.title).toBe("Arctic Encounters");
    expect(one.columns).toEqual(["d12*", "ENCOUNTER"]);
    expect(one.tags).toEqual(["arctic", "tier-1", "game-masters-guide"]);
    expect(one.environment).toBe("arctic");
    expect(one.book).toBe("game-masters-guide");
    expect(one.line).toBe(9);
    expect(two.tags).toEqual(["arctic", "tier-2", "game-masters-guide"]);
  });

  it("skips the header, separators, the footer and the caption", () => {
    const [one] = tablesOfNote("a/Arctic Encounters.md", ARCTIC);
    expect(one.rows.map((r) => r.roll)).toEqual(["1", "2"]);
    expect(one.rows[0].text).toBe("A giant owl tracks the PCs’ movement but never gets closer than 500 feet to them.");
    expect(one.rows[0].cells).toEqual([one.rows[0].text]);
  });

  it("keeps a roll range, with a plain hyphen", () => {
    const [, two] = tablesOfNote("a/Arctic Encounters.md", ARCTIC);
    expect(two.rows.map((r) => r.roll)).toEqual(["1", "2-3", "4-5"]);
  });

  it("joins the cells of a wider table with ' | ' and exposes them", () => {
    const text = `---
source: 'From **Tales of the Valiant** "Campaign Builder: Dungeons & Ruins" by **Kobold Press**.'
---
# Random Hex Location Encounters
In addition to the random encounter tables.

\`\`\`rpg table.random-hex-location-encounters-table
|d8*|Tier|Name|Description|
|---|---|---|---|
|1|2|Ambushed Bandits|A trail of bodies leads to a hydra.|
|2|2|Bad Mimic|A wooden chest keeps muttering.|
|---|---|---|---|
|= {{ roll }} =|
\`\`\`
`;
    const [t] = tablesOfNote("topics/Random Hex Location Encounters.md", text);
    expect(t.slug).toBe("random-hex-location-encounters-table");
    expect(t.heading).toBeUndefined();
    expect(t.columns).toEqual(["d8*", "Tier", "Name", "Description"]);
    expect(t.rows[0]).toEqual({
      roll: "1",
      text: "2 | Ambushed Bandits | A trail of bodies leads to a hydra.",
      cells: ["2", "Ambushed Bandits", "A trail of bodies leads to a hydra."],
    });
    expect(t.rows).toHaveLength(2);
    expect(t.book).toBe("campaign-builder-dungeons-and-ruins");
    expect(t.environment).toBe("random-hex-location");
  });

  it("derives a CR band from the heading, the title or the slug", () => {
    const text = `---
source: "From **Tales of the Valiant** \\"Campaign Builder: Dungeons & Ruins\\" by **Kobold Press**"
---
# Encounters in Dungeons (CR 1–4)

### Encounters in Dungeons (CR 1–4)
\`\`\`rpg table.encounters-in-dungeons-cr-1-4
|d10*|Encounter|
|---|---|
|1|Two crimson jellies have just finished feeding.|
\`\`\`
`;
    const [t] = tablesOfNote("x/Encounters in Dungeons (CR 1–4).md", text);
    expect(t.tags).toEqual(["dungeons", "cr-1-4", "campaign-builder-dungeons-and-ruins"]);
    const plus = text.replace(/CR 1–4/g, "CR 15+").replace("cr-1-4", "cr-15");
    expect(tablesOfNote("x/y.md", plus)[0].tags).toContain("cr-15-plus");
    const slugOnly = `# Dungeons Encounters\n\`\`\`rpg table.encounters-in-dungeons-cr-5-9\n|d4|E|\n|---|---|\n|1|x|\n\`\`\``;
    expect(tablesOfNote("x/y.md", slugOnly)[0].tags).toEqual(["dungeons", "cr-5-9"]);
  });

  it("derives tiers from a heading with levels, a slug, or a range", () => {
    const heading = `# Town Encounters (Tier 1)

### Encounters: Tier 1 (Levels 1–4)
\`\`\`rpg table.encounters-tier-1-levels-1-4
|d6*|ENCOUNTER|
|---|---|
|1|A kenku thief.|
\`\`\``;
    expect(tablesOfNote("t/Town Encounters (Tier 1).md", heading)[0].tags).toEqual(["town", "tier-1"]);
    const range = `# Oak Road Encounters (Tier 3–4)

\`\`\`rpg table.oak-road-encounters-tier-3-4
|d6*|Encounter|
|---|---|
|1|A kenku thief.|
\`\`\``;
    expect(tablesOfNote("t/Oak Road Encounters (Tier 3–4).md", range)[0].tags).toEqual([
      "oak-road",
      "tier-3",
      "tier-4",
    ]);
    const slug = "# Encounters\n```rpg table.coast-encounters-tier-2\n|d6|E|\n|---|---|\n|1|x|\n```";
    expect(tablesOfNote("t/Encounters.md", slug)[0].tags).toEqual(["tier-2"]);
  });

  it("derives level and difficulty from a slug", () => {
    const text = "# Monster Encounter\n```rpg table.level-5-hard\n|d6|E|\n|---|---|\n|1|x|\n```";
    expect(tablesOfNote("s/Monster Encounter.md", text)[0].tags).toEqual(["monster", "level-5", "hard"]);
  });

  it("returns only encounter tables unless asked for all", () => {
    const text = `# Treasure

\`\`\`rpg table.coins
|d6|Coins|
|---|---|
|1|10 gp|
\`\`\`

### Random Encounters
\`\`\`rpg table.wanderers
|d6|E|
|---|---|
|1|A kenku.|
\`\`\`
`;
    expect(tablesOfNote("x/Treasure.md", text).map((t) => t.slug)).toEqual(["wanderers"]);
    expect(tablesOfNote("x/Treasure.md", text, { all: true }).map((t) => t.slug)).toEqual(["coins", "wanderers"]);
    expect(tablesOfNote("x/Loot.md", "# Loot\n```rpg table.coins\n|d6|C|\n|---|---|\n|1|10 gp|\n```")).toEqual([]);
  });

  it("matches on the title or a slug alone", () => {
    const byTitle = "# Wilderness Encounters\n```rpg table.stuff\n|d6|E|\n|---|---|\n|1|x|\n```";
    expect(tablesOfNote("x/y.md", byTitle)).toHaveLength(1);
    const bySlug = "# Stuff\n```rpg table.random-encounters\n|d6|E|\n|---|---|\n|1|x|\n```";
    expect(tablesOfNote("x/y.md", bySlug)).toHaveLength(1);
  });

  it("leaves other fences and headings in code alone", () => {
    const text = `# Encounters

\`\`\`js
# not a heading
\`\`\`

\`\`\`\`rpg table.long-fence
|d6|E|
|---|---|
|1|A \`\`\` inside|
\`\`\`\`
`;
    const [t] = tablesOfNote("x/Encounters.md", text);
    expect(t.slug).toBe("long-fence");
    expect(t.rows).toEqual([{ roll: "1", text: "A ``` inside", cells: ["A ``` inside"] }]);
  });

  it("keeps a wikilink alias and an escaped pipe inside its cell", () => {
    const text = "# Encounters\n```rpg table.e\n|d6|E|\n|---|---|\n|1|Two [[Ogre|ogres]] and a \\| bar|\n```";
    expect(tablesOfNote("x/Encounters.md", text)[0].rows[0].cells).toEqual(["Two [[Ogre|ogres]] and a | bar"]);
  });

  it("works without a frontmatter and without a heading", () => {
    const text = "```rpg table.encounters\n|d6|E|\n|---|---|\n|1|x|\n```";
    const [t] = tablesOfNote("dir/Wild Encounters.md", text);
    expect(t.title).toBe("Wild Encounters");
    expect(t.heading).toBeUndefined();
    expect(t.book).toBeUndefined();
    expect(t.tags).toEqual(["wild"]);
  });
});

describe("kebab and bookOf", () => {
  it("makes a kebab-case slug", () => {
    expect(kebab("Game Master’s Guide")).toBe("game-masters-guide");
    expect(kebab("Dungeons & Ruins")).toBe("dungeons-and-ruins");
    expect(kebab("Zwölf — Hulk")).toBe("zwolf-hulk");
  });

  it("takes the quoted title of a source line", () => {
    expect(bookOf('From **Tales of the Valiant** "Game Master\'s Guide" by **Kobold Press**')).toBe(
      "game-masters-guide"
    );
    expect(bookOf("From **Tales of the Valiant** “Monster Vault” by **Kobold Press**.")).toBe("monster-vault");
    expect(bookOf("From **Monster Vault** by **Kobold Press**")).toBe("monster-vault");
    expect(bookOf(undefined)).toBeUndefined();
  });
});

// The sanity run against the real vault: skipped where the testing vault is not beside the repo.
const VAULT = process.env.RPG_VAULT_ROOT ?? resolve(process.cwd(), "../testing-vault");
const BESTIARY = join(VAULT, "tales-of-the-valiant/worldbuilding/bestiary");
const TABLES = join(VAULT, "tales-of-the-valiant/gm-tools/tables/game-masters-guide");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

function bestiaryEntries(): MonsterEntry[] {
  const entries: MonsterEntry[] = [];
  for (const file of walk(BESTIARY)) {
    const m = readFileSync(file, "utf8").match(/^```rpg stat\.monster\n([\s\S]*?)\n```/m);
    if (!m) continue;
    const lines = m[1].split("\n");
    const cut = lines.findIndex((l) => l.trim() === "---");
    try {
      const y = parseYaml(cut >= 0 ? lines.slice(0, cut).join("\n") : m[1]) as { name?: unknown; cr?: unknown };
      if (typeof y?.name === "string") {
        entries.push({
          note: file.slice(VAULT.length + 1),
          name: y.name,
          ...(y.cr != null ? { cr: String(y.cr) } : {}),
        });
      }
    } catch {
      // A note whose fence is not YAML has no name to index.
    }
  }
  return entries;
}

describe.skipIf(!existsSync(BESTIARY) || !existsSync(TABLES))("against the testing vault", () => {
  const index = buildMonsterIndex(bestiaryEntries());
  const read = (name: string) => tablesOfNote(join(TABLES, name), readFileSync(join(TABLES, name), "utf8"));

  it("reads the Arctic Encounters tables whole", () => {
    const tables = read("Arctic Encounters.md");
    expect(tables.map((t) => t.rows.length)).toEqual([12, 12, 8, 8]);
    const first = tables[0].rows.map((r) => extractEncounter(r.text, index));
    expect(first[5].monsters.map((m) => [m.name, m.count])).toEqual([
      ["Bandit Captain", 1],
      ["Bandit", 2],
    ]);
    expect(first[6].combat).toBe("unlikely"); // the mammoth and frost giant tracks
    expect(first[7].monsters).toEqual([]); // the earthquake
    expect(first[10].monsters.map((m) => [m.name, m.count])).toEqual([["Ice Mephit", 4]]);
    expect(first[11].monsters.map((m) => [m.name, m.count])).toEqual([["Kobold, A", 5]]);
  });

  it("finds a creature in most rows of the Game Master's Guide encounter tables", () => {
    let rows = 0;
    let withMonster = 0;
    for (const name of readdirSync(TABLES).filter((n) => /Encounters/.test(n))) {
      for (const table of read(name)) {
        for (const row of table.rows) {
          rows++;
          if (extractEncounter(row.text, index).monsters.length > 0) withMonster++;
        }
      }
    }
    expect(rows).toBeGreaterThan(400);
    expect(withMonster / rows).toBeGreaterThan(0.7);
  });
});
