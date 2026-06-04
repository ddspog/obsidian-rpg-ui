import { describe, expect, it } from "vitest";
import { extractNestedTabs } from "./extract-nested-tabs";

const TICK = "`".repeat(3);

function tab(yaml: string, body: string): string {
  return [`${TICK}rpg rule.tab`, yaml, "---", body, TICK].join("\n");
}

function contentFence(yaml: string, body: string): string {
  return [`${TICK}rpg rule.content`, yaml, "---", body, TICK].join("\n");
}

describe("extractNestedTabs", () => {
  it("returns null when the body has no tab fences", () => {
    expect(extractNestedTabs("# Heading\n\nJust prose, no tabs.")).toBeNull();
    expect(extractNestedTabs(contentFence("id: x", "Body only."))).toBeNull();
  });

  it("extracts a run of tabs and the preceding intro", () => {
    const body = [
      "## Movement",
      contentFence("name: summary", "Summary prose."),
      tab("name: Speed\nicon: zap", "### Speed\nSpeed body."),
      tab("name: Special\nicon: star", "### Special\nSpecial body."),
      tab("name: Terrain", "### Terrain\nTerrain body."),
    ].join("\n");

    const result = extractNestedTabs(body);
    expect(result).not.toBeNull();
    expect(result!.tabs).toHaveLength(3);
    expect(result!.tabs.map((t) => t.name)).toEqual(["Speed", "Special", "Terrain"]);
    expect(result!.tabs[0].icon).toBe("zap");
    expect(result!.tabs[0].body).toContain("Speed body.");
    // Intro keeps the heading + the summary content fence (rendered separately).
    expect(result!.intro).toContain("## Movement");
    expect(result!.intro).toContain("rpg rule.content");
    // Intro stops before the first tab fence.
    expect(result!.intro).not.toContain("rpg rule.tab");
  });

  it("preserves a tab body that itself contains a fenced block", () => {
    const innerFence = ["```js", "const x = 1;", "```"].join("\n");
    const body = [
      tab("name: Code", `Intro line.\n${innerFence}\nAfter fence.`),
      tab("name: Plain", "Plain body."),
    ].join("\n");

    const result = extractNestedTabs(body);
    expect(result!.tabs).toHaveLength(2);
    expect(result!.tabs[0].name).toBe("Code");
    expect(result!.tabs[0].body).toContain("const x = 1;");
    expect(result!.tabs[1].name).toBe("Plain");
  });

  it("has an empty intro when a tab fence is the first thing in the body", () => {
    const body = tab("name: Only", "Only body.");
    const result = extractNestedTabs(body);
    expect(result!.intro).toBe("");
    expect(result!.tabs).toHaveLength(1);
  });
});
