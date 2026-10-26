import { describe, expect, it } from "vitest";
import { buildPrompt, formatDraftBlock, parseDraftBlock, rollTemplate, summarizeNote } from "./draft";

const SRC = `draft: Ambush on the woods road
gm: "[[00. GM Screen]]"
map: "[[Pointy Woods]]"
level: 2
hexes: [[33, -51], [34, -51]]
attach: ["[[Kobold]]", "[[Kowyn's Bag]]"]
ask: encounter
---
The cult tracks Kowyn.
gen: Random Event`;

describe("rpg draft", () => {
  it("reads its head and body", () => {
    expect(parseDraftBlock(SRC)).toEqual({
      title: "Ambush on the woods road",
      gm: "[[00. GM Screen]]",
      map: "[[Pointy Woods]]",
      level: 2,
      hexes: [
        [33, -51],
        [34, -51],
      ],
      attach: ["[[Kobold]]", "[[Kowyn's Bag]]"],
      ask: "encounter",
      body: "The cult tracks Kowyn.\ngen: Random Event",
    });
    expect(parseDraftBlock("draft: Just a title")).toMatchObject({ title: "Just a title", hexes: [], body: "" });
  });

  it("writes it back the way it reads", () => {
    const out = formatDraftBlock(parseDraftBlock(SRC));
    expect(out).toContain("hexes: [[33, -51], [34, -51]]");
    expect(parseDraftBlock(out)).toEqual(parseDraftBlock(SRC));
  });

  it("rolls every unrolled die of a template", () => {
    let i = 0;
    const rng = () => [0.365, 0.2, 0.65][i++ % 3];
    expect(rollTemplate("Event Focus: d100= ->\no: Fate Check (50/50) 2d10=\nd20+3=12 stays", rng)).toBe(
      "Event Focus: d100=37 ->\no: Fate Check (50/50) 2d10=[3,7]\nd20+3=12 stays"
    );
  });

  it("summarises a note by its blocks, else its prose", () => {
    const note = "---\ntags: [x]\n---\n# Kobold\nSmall and sly.\n```rpg stat.monster\nname: Kobold\ncr: 1/8\n```\n";
    const s = summarizeNote("Kobold", note);
    expect(s).toContain("### Kobold");
    expect(s).toContain("[stat.monster]\nname: Kobold\ncr: 1/8");
    expect(s).toContain("Small and sly.");
    expect(summarizeNote("Long", "x ".repeat(3000), 100).length).toBeLessThan(130);
  });

  it("builds the prompt from everything gathered", () => {
    const p = buildPrompt(parseDraftBlock(SRC), {
      note: "Session ideas",
      map: { name: "Pointy Woods", scale: "1 mi" },
      hexes: [{ q: 33, r: -51, terrain: "forest[lush][conifer-1]", regions: ["Balestream"], marks: ["cart"] }],
      attachments: [{ name: "Kobold", summary: "### Kobold\nSmall." }],
    });
    expect(p).toContain("## Task: Encounter");
    expect(p).toContain("The cult tracks Kowyn.");
    expect(p).toContain("- (33,-51): terrain forest[lush][conifer-1], in Balestream, marked cart");
    expect(p).toContain("(1 hex = 1 mi)");
    expect(p).toContain("### Kobold\nSmall.");
  });
});

describe("summarising a note with an empty block", () => {
  it("doesn't let an empty block run on into the next", () => {
    const note = "```rpg character.skills\n```\n```rpg item.element\nname: Chain Mail\n```\n";
    const s = summarizeNote("X", note);
    expect(s).toContain("[item.element]\nname: Chain Mail");
  });
});
