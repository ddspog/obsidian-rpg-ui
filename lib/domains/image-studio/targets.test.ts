import { describe, it, expect } from "vitest";
import { imageLink, imageTargets, imageValue, setFenceKey } from "./targets";

const F = "```";
const note = [
  "---",
  'banner: "[[road.webp]]"',
  "---",
  "# Hematite",
  `${F}rpg item.element`,
  "name: Hematite",
  'image: "![[hematite.webp|384]]"',
  "---",
  "A gem.",
  F,
  `${F}rpg feature.details`,
  "name: Mystic Mark",
  "type: bonus",
  F,
].join("\n");

describe("imageTargets", () => {
  it("finds what a note keeps, what it could add, and its hotbar icons", () => {
    expect(imageTargets(note, "Hematite").map((t) => t.label)).toEqual([
      "Frontmatter · banner",
      'item.element "Hematite" · image',
      'feature.details "Mystic Mark" · add icon',
      "Hotbar icon · Hematite",
      "Hotbar icon · Mystic Mark",
    ]);
  });
});

describe("image values", () => {
  it("reads the link, and writes a new one as the old was", () => {
    expect(imageLink("![[hematite.webp|384]]")).toBe("hematite.webp");
    expect(imageValue("hematite new.png", "![[hematite.webp|384]]")).toBe("![[hematite new.png|384]]");
    expect(imageValue("road.png", "[[road.webp]]")).toBe("[[road.png]]");
  });

  it("sets a block's key where it is, or adds it under its name", () => {
    expect(setFenceKey(note, 0, "image", "![[h2.png|384]]")).toContain('image: "![[h2.png|384]]"');
    expect(setFenceKey(note, 1, "icon", "![[mark.png]]").split("\n")[12]).toBe('icon: "![[mark.png]]"');
  });
});

describe("cardNames", () => {
  it("finds cards however deep, and a statblock's referred actions", async () => {
    const { cardNames } = await import("./targets");
    const text = [
      "````rpg rule.tab",
      "name: Basic",
      "---",
      "```rpg feature.details",
      "name: Mystic Mark",
      "```",
      "````",
      "```rpg stat.monster",
      "features:",
      '  - ref: "@[[Humanoid Traits]]#Pack Tactics"',
      '  - ref: "[[Kobold Traits#Mining Pick (Reach)]]"',
      "```",
    ].join("\n");
    expect(cardNames(text)).toEqual(["Mystic Mark", "Pack Tactics", "Mining Pick"]);
  });
});

describe("a character's portrait", () => {
  it("is offered on a sheet that has none yet, and found where it is", () => {
    const F = "```";
    const bare = ["# Talon", `${F}rpg character.health`, "current_hp: 10", F].join("\n");
    expect(imageTargets(bare, "Talon").map((t) => t.label)).toContain("character.health · add portrait");
    const has = ["# Talon", `${F}rpg character.health`, "portrait: [[face.webp]]", F].join("\n");
    const labels = imageTargets(has, "Talon").map((t) => t.label);
    expect(labels).toContain("character.health · portrait");
    expect(labels.some((l) => /add portrait/.test(l))).toBe(false);
  });
});
