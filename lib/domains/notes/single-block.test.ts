import { describe, expect, it } from "vitest";

import { namesItself, singleBlockNote } from "./single-block";

const fm = "---\ncssclasses:\n  - note-statblock\n---\n";
const block = '```rpg stat.monster\nname: "Troll"\n```';

describe("singleBlockNote", () => {
  it("is a title and one rpg block, frontmatter and blank lines aside", () => {
    expect(singleBlockNote(`${fm}# Troll\n${block}\n`)).toEqual({
      single: true,
      meta: "stat.monster",
      heading: "Troll",
    });
    expect(singleBlockNote(`${fm}\n${block}\n\n`)).toEqual({ single: true, meta: "stat.monster" });
    expect(singleBlockNote(`# Troll\n\n${block.replace(/```/g, "````")}`)).toEqual({
      single: true,
      meta: "stat.monster",
      heading: "Troll",
    });
  });

  it("keeps lore after the block", () => {
    expect(singleBlockNote(`${fm}# Troll\n${block}\n**Bullies.** Trolls are natural bullies.`)).toEqual({
      single: true,
      meta: "stat.monster",
      heading: "Troll",
    });
  });

  it("knows the blocks that print their own name", () => {
    expect(["stat.monster", "item.magic", "spell", "feature.details"].map(namesItself)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(["rule.content", "table.weather-gods", "map", undefined].map(namesItself)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("is not when there is an introduction, a second block or another kind of block", () => {
    expect(singleBlockNote(`${fm}# Troll\nA hulking brute.\n${block}`).single).toBe(false);
    expect(singleBlockNote(`${fm}# Troll\n${block}\n${block}`).single).toBe(false);
    expect(singleBlockNote(`${fm}# Troll\n\`\`\`js\nx\n\`\`\``).single).toBe(false);
    expect(singleBlockNote(`${fm}# Troll\n## Lore\n${block}`).single).toBe(false);
    expect(singleBlockNote(`# Troll\n\`\`\`rpg stat.monster\nunclosed`).single).toBe(false);
  });
});
