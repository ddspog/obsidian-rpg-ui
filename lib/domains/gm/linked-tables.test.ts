import { describe, expect, it } from "vitest";
import { parseTableBlock } from "../tables/parse-table-block";
import {
  headingKey,
  linkTargets,
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
      /^Unusual border \(Table 5-21 \(d4 [1-4]: Magical Wards\. Not death to pass\.\)\)$/
    );
  });

  it("reads the same chain for the same seed, a new one for another", () => {
    const row = "[[#Table 5-21 Unusual Border|Table 5-21]]";
    expect(rollLinkedTables(row, "Borders.md", lookup, "a")).toBe(rollLinkedTables(row, "Borders.md", lookup, "a"));
  });

  it("leaves a link that isn't to a table as it is", () => {
    const row = "Beast [[Leaders#Beasts|🔗]]";
    expect(rollLinkedTables(row, "Borders.md", lookup, "s")).toBe(row);
  });

  it("does not follow a table back onto itself", () => {
    const out = rollLinkedTables("[[#Loop|Loop]]", "Borders.md", lookup, "s");
    expect(out).toMatch(/^Loop \(d2 [12]: Again: \[\[#Loop\|Loop\]\]\)$/);
  });

  it("reads a `\\|` alias too", () => {
    expect(rollLinkedTables("[[#Table 5-21 Unusual Border\\|Table 5-21]]", "Borders.md", lookup, "s")).toMatch(
      /^Table 5-21 \(d4 [1-4]: /
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
    expect(out).toMatch(/^Shell creatures \(Base Creature d6 \d: Crab; Modification d6 \d: Colossal\)$/);
  });

  it("reads a link written right after a bracket", () => {
    const out = rollLinkedTables("[[[#Table 5-21 Unusual Border|Table 5-21]]]", "Borders.md", lookup, "s");
    expect(out).toMatch(/^\[Table 5-21 \(d4 /);
  });
});

describe("linkTargets", () => {
  it("lists the notes a table's cells link to", () => {
    expect(linkTargets(borders)).toEqual([""]);
  });
});
