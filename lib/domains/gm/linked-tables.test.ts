import { describe, expect, it } from "vitest";
import { parseTableBlock } from "../tables/parse-table-block";
import {
  headingKey,
  linkTargets,
  plainEmphasis,
  rollLinkedTables,
  seededRoll,
  tableHeadings,
  type LinkedTableLookup,
} from "./linked-tables";

const borders = parseTableBlock(
  "minor-upriver-border",
  [
    "|d10*|Border|",
    "|---|---|",
    "|1-9|Tributary enters river|",
    "|10|Unusual border ([[#Table 5-21 Unusual Border|Table 5-21]])|",
  ].join("\n")
);
const unusual = parseTableBlock(
  "unusual-border",
  ["|d4*|Border|", "|---|---|", "|1-4|Magical Wards. Not death to pass.|"].join("\n")
);
const loop = parseTableBlock("loop", ["|d2*|Result|", "|---|---|", "|1-2|Again: [[#Loop|Loop]]|"].join("\n"));

const lookup: LinkedTableLookup = (fromFile, target, heading) => {
  const file = target || fromFile;
  if (file !== "Borders.md") return undefined;
  if (headingKey(heading) === headingKey("Table 5-21 Unusual Border")) return { tables: [unusual], file };
  if (headingKey(heading) === "loop") return { tables: [loop], file };
  return undefined;
};

describe("rollLinkedTables", () => {
  it("rolls the table a result links to, in place of the link", () => {
    const row = "Unusual border ([[#Table 5-21 Unusual Border|Table 5-21]])";
    expect(rollLinkedTables(row, "Borders.md", lookup, "seed")).toMatch(
      /^Unusual border\n↳ Unusual Border: Magical Wards\. Not death to pass \(d4 [1-4]\)$/
    );
  });

  it("drops the instruction that sent you to the table: the roll is done", () => {
    for (const lead of ["Refer to", "Roll on", "roll once on", "See", "go to"]) {
      const row = `Border. ${lead} [[#Table 5-21 Unusual Border|Table 5-21: Unusual Border]].`;
      expect(rollLinkedTables(row, "Borders.md", lookup, "s")).toMatch(
        /^Border\.\n↳ Unusual Border: Magical Wards\. Not death to pass \(d4 [1-4]\)$/
      );
    }
  });

  it("reads the same chain for the same seed, a new one for another", () => {
    const row = "[[#Table 5-21 Unusual Border|Table 5-21]]";
    expect(rollLinkedTables(row, "Borders.md", lookup, "a")).toBe(rollLinkedTables(row, "Borders.md", lookup, "a"));
  });

  it("reads a link that isn't to a table as its words, and drops a bare 🔗", () => {
    expect(rollLinkedTables("Beast [[Leaders#Beasts|🔗]].", "Borders.md", lookup, "s")).toBe("Beast.");
    expect(rollLinkedTables("See [[Leaders#Beasts]] or [[Leaders#^ab12|🔗]]", "Borders.md", lookup, "s")).toBe(
      "See Beasts or"
    );
    expect(rollLinkedTables("Hope [[Gods#^ab12|Hope gods]]", "Borders.md", lookup, "s")).toBe("Hope Hope gods");
    expect(rollLinkedTables("See the [[11. Deities|Deities Chapter]] or [[a/Gods]].", "Borders.md", lookup, "s")).toBe(
      "See the Deities Chapter or Gods."
    );
  });

  it("does not follow a table back onto itself", () => {
    const out = rollLinkedTables("[[#Loop|Loop]]", "Borders.md", lookup, "s");
    expect(out).toMatch(/^↳ Loop: Again: Loop \(d2 [12]\)$/);
  });

  it("takes one of a rolled row's alternatives, as a chain has no picker", () => {
    const types = parseTableBlock(
      "types",
      ["|d4*|1|2|3|", "|---|---|---|---|", "|1-4|Change [[Gods#^a\\|🔗]]|Hope|Shadows|"].join("\n")
    );
    const out = rollLinkedTables("Deity: [[#Types|Types]]", "N.md", () => ({ tables: [types], file: "N.md" }), "s");
    expect(out).toMatch(/^Deity\n↳ Types: (Change|Hope|Shadows) \(d4 [1-4]\)$/);
  });

  it("reads a `\\|` alias too", () => {
    expect(rollLinkedTables("[[#Table 5-21 Unusual Border\\|Table 5-21]]", "Borders.md", lookup, "s")).toMatch(
      /^↳ Unusual Border: Magical Wards\. Not death to pass \(d4 [1-4]\)$/
    );
  });
});

describe("seededRoll", () => {
  it("stays in range and spreads over it", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const n = seededRoll(`s${i}`, 6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect(seen.size).toBe(6);
  });
});

describe("tableHeadings", () => {
  const note = [
    "# Borders",
    "#### Table 5-21: Unusual Border",
    "Roll once.",
    "```rpg table.unusual-border",
    "|d4*|Border|",
    "```",
    "## Shell creatures",
    "```rpg table.base",
    "```",
    "```rpg table.modification",
    "```",
    "## Beasts",
    "### Table 1",
    "```rpg table.one",
    "```",
    "## Lore",
    "Nothing to roll.",
  ].join("\n");

  it("maps a table's heading to it, and a section to the tables under it", () => {
    expect(tableHeadings(note)).toEqual({
      [headingKey("Borders")]: ["unusual-border", "base", "modification", "one"],
      [headingKey("Table 5-21 Unusual Border")]: ["unusual-border"],
      [headingKey("Shell creatures")]: ["base", "modification"],
      [headingKey("Beasts")]: ["one"],
      [headingKey("Table 1")]: ["one"],
    });
  });
});

describe("tableHeadings, a section that opens with its own table", () => {
  it("gives that table alone, however many follow it", () => {
    const note = [
      "## To Explain a Sleeping God",
      "#### Table 11-48: To Explain a Sleeping God",
      "```rpg table.sleeping",
      "```",
      ...["a", "b", "c", "d", "e"].flatMap((n) => [`#### Table ${n}`, `\`\`\`rpg table.${n}`, "```"]),
    ].join("\n");
    expect(tableHeadings(note)[headingKey("To Explain a Sleeping God")]).toEqual(["sleeping"]);
  });

  it("leaves out a section of more than five tables that has no table of its own name", () => {
    const note = [
      "## Guild",
      ...["a", "b", "c", "d", "e", "f"].flatMap((n) => [`#### T ${n}`, `\`\`\`rpg table.${n}`, "```"]),
    ].join("\n");
    expect(tableHeadings(note)[headingKey("Guild")]).toBeUndefined();
  });
});

describe("rollLinkedTables, a section of several tables", () => {
  it("rolls each, named", () => {
    const base = parseTableBlock(
      "base",
      ["|d6*|Base|", "|---|---|", "|1-6|Crab|", "[Table 4-38: Base Creature]"].join("\n")
    );
    const mod = parseTableBlock(
      "mod",
      ["|d6*|Mod|", "|---|---|", "|1-6|Colossal|", "[Table 4-38: Modification]"].join("\n")
    );
    const out = rollLinkedTables(
      "[[#Shell|Shell creatures]]",
      "N.md",
      () => ({ tables: [base, mod], file: "N.md" }),
      "s"
    );
    expect(out).toMatch(/^↳ Base Creature: Crab \(d6 \d\)\n↳ Modification: Colossal \(d6 \d\)$/);
  });

  it("reads a link written right after a bracket", () => {
    const out = rollLinkedTables("[[[#Table 5-21 Unusual Border|Table 5-21]]]", "Borders.md", lookup, "s");
    expect(out).toMatch(/^↳ Unusual Border: Magical Wards\. Not death to pass \(d4 [1-4]\)$/);
  });
});

describe("rollLinkedTables, the words around two links", () => {
  it("drops the instruction and the 'and' between them; each table gets its own line", () => {
    const out = rollLinkedTables(
      "Fey + Monster. Refer to [[#Table 5-21 Unusual Border|Table 5-21]] and Table [[#Table 5-21 Unusual Border|Table 5-21]].",
      "Borders.md",
      lookup,
      "s"
    );
    expect(out).toMatch(/^Fey \+ Monster\.\n↳ Unusual Border: .+ \(d4 [1-4]\)\n↳ Unusual Border: .+ \(d4 [1-4]\)$/);
  });

  it("drops the whole instruction sentence, names and all, and names a table by its heading", () => {
    const out = rollLinkedTables(
      "Deity + Location. Refer to Tables [[#Table 5-21 Unusual Border|5-21]]: Unusual Border and [[#Table 5-21 Unusual Border|5-21]]: Unusual Border, together with more. Then a tale.",
      "Borders.md",
      lookup,
      "s"
    );
    expect(out).toMatch(/^Deity \+ Location\. Then a tale\.\n↳ Unusual Border: .+\n↳ Unusual Border: .+$/);
  });

  it("drops an instruction sentence even when the link sits further on in it", () => {
    for (const row of [
      "Invasion. Refer to “Unusual,” starting with [[#Table 5-21 Unusual Border|Table 5-21]], for names.",
      "The hag is legendary. Roll on the [[#Table 5-21 Unusual Border|Unusual Border]] Table.",
    ]) {
      expect(rollLinkedTables(row, "Borders.md", lookup, "s")).toMatch(
        /^(Invasion|The hag is legendary)\.\n↳ Unusual Border: /
      );
    }
  });

  it("indents what a followed row rolled in turn", () => {
    const outer = parseTableBlock(
      "outer",
      ["|d2*|Result|", "|---|---|", "|1-2|Border: [[#Unusual|Unusual]]|"].join("\n")
    );
    const look: LinkedTableLookup = (_f, _t, heading) =>
      heading === "Outer" ? { tables: [outer], file: "B.md" } : { tables: [unusual], file: "B.md" };
    expect(rollLinkedTables("[[#Outer|Outer]]", "B.md", look, "s")).toMatch(
      /^↳ Outer: Border \(d2 [12]\)\n {2}↳ Unusual: Magical Wards\. Not death to pass \(d4 [1-4]\)$/
    );
  });
});

describe("linkTargets", () => {
  it("lists the notes a table's cells link to", () => {
    expect(linkTargets(borders)).toEqual([""]);
  });
});

describe("plainEmphasis", () => {
  it("drops bold and italic markers from a rolled row", () => {
    expect(plainEmphasis("**Economic Power** – the villain is working on gaining wealth")).toBe(
      "Economic Power – the villain is working on gaining wealth"
    );
    expect(plainEmphasis("Amoeba – **Amoeba body form (formless),** floats in liquids")).toBe(
      "Amoeba – Amoeba body form (formless), floats in liquids"
    );
    expect(plainEmphasis("*Gem* and __stone__ and _river_")).toBe("Gem and stone and river");
  });

  it("leaves asterisks and underscores that are not markers", () => {
    expect(plainEmphasis("Religious Areas* (see note)")).toBe("Religious Areas* (see note)");
    expect(plainEmphasis("2 * 3 and snake_case_name")).toBe("2 * 3 and snake_case_name");
    expect(plainEmphasis("1d6 * 10 gp")).toBe("1d6 * 10 gp");
  });
});
