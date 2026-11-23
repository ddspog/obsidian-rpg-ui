import { describe, expect, it } from "vitest";
import { areaKey, areasOfNote, boldNames, plainParagraph } from "./area-source";

const NOTE = [
  "---",
  'source: From **Tales of the Valiant** "The Old Margreve" by **Kobold Press**.',
  "---",
  "# Part 2: The Still Tower",
  "````rpg rule.tab",
  "### Area B3. Main Hall",
  "```rpg rule.side",
  "A side note.",
  "```",
  "*Creatures.* A **goblin captain** and four **goblins** lounge here, sent by the lieutenants in **Area C1**.",
  "### Area C1. Treaty Room",
  "*Creatures.* Two **bugbears** (see the **Appendix**) play cards.",
  "*Creature.* A **hobgoblin** watches.",
  "````",
  "```rpg stat.monster",
  "# a YAML comment, not a heading",
  "*Creatures.* not prose",
  "```",
].join("\n");

describe("areasOfNote", () => {
  const [source] = areasOfNote("tov/worldbuilding/adventures/griffon-heist/Part 2, The Still Tower.md", NOTE);

  it("reads each Creatures paragraph inside the note's tabs as a row keyed by its area", () => {
    expect(source.rows.map((r) => r.roll)).toEqual(["B3", "C1", "C1 (2)"]);
    expect(source.rows[0].text).toBe("A goblin captain and four goblins lounge here, sent by the lieutenants nearby.");
    expect(source.rows[1].named).toEqual(["bugbears"]);
  });

  it("tags the rows with the adventure, its folder, and the book", () => {
    expect(source.slug).toBe("areas");
    expect(source.title).toBe("Part 2: The Still Tower");
    expect(source.tags).toEqual(["adventure", "griffon-heist", "the-old-margreve"]);
  });

  it("finds nothing in a note with no Creatures paragraph", () => {
    expect(areasOfNote("a.md", "# A\nSome text.")).toEqual([]);
  });

  it("keys a note that is one area by its title", () => {
    const [one] = areasOfNote("a.md", "# Area 3. A Floor of Honey\n*Creatures.* Two **giant honey bees** wait.");
    expect(one.rows[0].roll).toBe("3");
  });
});

describe("area words", () => {
  it("keys areas", () => {
    expect(areaKey("Area B3. Main Hall")).toBe("B3");
    expect(areaKey("Area a2. Secret Library")).toBe("a2");
    expect(areaKey("The Brigand Camp")).toBe("The Brigand Camp");
  });

  it("reads the bold names, a hyphenated one whole, and not the cross-references", () => {
    expect(
      boldNames("The **Would**-**Be**-**King of Wolves** and two **shadows** in **Area 9** (see the **Appendix**)")
    ).toEqual(["Would-Be-King of Wolves", "shadows"]);
  });

  it("drops the cross-references from the words", () => {
    expect(plainParagraph("A **vine golem** (see the **Appendix**) guards it (see **Area 6**).")).toBe(
      "A vine golem guards it (see Area 6)."
    );
  });
});
