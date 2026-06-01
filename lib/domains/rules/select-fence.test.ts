import { describe, expect, it } from "vitest";
import { fenceBodyMarkdown, selectFenceBodyByIndex, sliceFenceInner } from "./select-fence";

// Mirrors the real `concepts/actions/Attack.md` shape: a `feature.details`
// intro block first, then `rule.content` blocks (melee, ranged).
const ATTACK = `# Attack
\`\`\`rpg feature.details
type: action
---
The most common action in combat is the [[Attack]] action.
\`\`\`
## Melee
\`\`\`rpg rule.content
id: melee
---
Used in hand-to-hand combat, a melee attack typically uses a handheld weapon.
\`\`\`
## Ranged
\`\`\`rpg rule.content
id: ranged
---
When you make a ranged attack, you might fire a bow.
\`\`\`
`;

// Mirrors `worldbuilding/items/tools/*.md`: an `item.element` (4-tick fence)
// whose body contains a nested 3-tick `rpg table` fence and an embed.
const TOOLS = `# Artist Tools
\`\`\`\`rpg item.element
name: Artist Tools
cost: 10 gp
---
Artist tools are used to create illustrated art objects.

\`\`\`rpg table.artist-tools-example-tasks
|TASK|DC|
|---|---|
|Sketch an image|10|
\`\`\`
![[artist-tools.webp|284]]
\`\`\`\`
`;

describe("selectFenceBodyByIndex", () => {
  it("returns the FIRST fence body whatever its entity (feature.details)", () => {
    const body = selectFenceBodyByIndex(ATTACK, 0);
    expect(body).toBe("The most common action in combat is the [[Attack]] action.");
  });

  it("returns subsequent fence bodies by index", () => {
    expect(selectFenceBodyByIndex(ATTACK, 1)).toBe(
      "Used in hand-to-hand combat, a melee attack typically uses a handheld weapon."
    );
    expect(selectFenceBodyByIndex(ATTACK, 2)).toBe(
      "When you make a ranged attack, you might fire a bow."
    );
  });

  it("keeps a nested table fence inside the selected item.element body", () => {
    const body = selectFenceBodyByIndex(TOOLS, 0);
    expect(body).toContain("Artist tools are used to create illustrated art objects.");
    // The inner 3-tick table fence must survive so the table processor renders it.
    expect(body).toContain("```rpg table.artist-tools-example-tasks");
    expect(body).toContain("|Sketch an image|10|");
    expect(body).toContain("![[artist-tools.webp|284]]");
  });

  it("returns null when the index is out of range", () => {
    expect(selectFenceBodyByIndex(ATTACK, 3)).toBeNull();
    expect(selectFenceBodyByIndex("# no fences here", 0)).toBeNull();
  });

  it("returns null for negative or non-integer indices", () => {
    expect(selectFenceBodyByIndex(ATTACK, -1)).toBeNull();
    expect(selectFenceBodyByIndex(ATTACK, 1.5)).toBeNull();
  });
});

describe("fenceBodyMarkdown", () => {
  it("drops the YAML head up to the first standalone --- line", () => {
    expect(fenceBodyMarkdown("id: melee\n---\nbody text")).toBe("body text");
  });

  it("treats a body with no separator as all-body", () => {
    expect(fenceBodyMarkdown("just prose, no yaml")).toBe("just prose, no yaml");
  });

  it("trims leading and trailing blank lines", () => {
    expect(fenceBodyMarkdown("k: v\n---\n\n\nbody\n\n")).toBe("body");
  });
});

describe("sliceFenceInner", () => {
  it("strips the trailing closing-fence line", () => {
    const text = "```rpg rule.content\nid: x\n---\nbody\n```\n";
    // start at offset 0 (the open fence), end just past the closing ```
    const end = text.indexOf("```\n", 4) + 3;
    expect(sliceFenceInner(text, 0, end)).toBe("id: x\n---\nbody");
  });
});
