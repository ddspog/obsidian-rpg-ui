import { describe, expect, it } from "vitest";
import { findRuleContentBlock, findGMFeatureById, findRuleFenceBodyById, resolveTabBlockFields } from "./resolve-tab";

// Triple-backtick fence opener can't be written literally inside a template
// literal, so build fences from a constant.
const TICK = "`".repeat(3);

function contentBlock(yaml: string, body: string): string {
  return [`${TICK}rpg rule.content`, yaml, "---", body, TICK].join("\n");
}

function file(...blocks: string[]): string {
  return ["# Heading", "", "Intro prose.", "", ...blocks].join("\n");
}

describe("findRuleContentBlock", () => {
  it("matches a block by frontmatter id", () => {
    const text = file(contentBlock("id: main-content\nname: Death Saves", "Body of main."));
    const block = findRuleContentBlock(text, "main-content");
    expect(block).not.toBeNull();
    expect(block?.body).toBe("Body of main.");
    expect(block?.frontmatter.name).toBe("Death Saves");
  });

  it("matches a block by frontmatter name when id is absent", () => {
    const text = file(contentBlock("name: Stabilizing", "How to stabilize."));
    const block = findRuleContentBlock(text, "Stabilizing");
    expect(block?.body).toBe("How to stabilize.");
  });

  it("returns null when no block matches", () => {
    const text = file(contentBlock("id: main-content", "Body."));
    expect(findRuleContentBlock(text, "missing")).toBeNull();
  });

  it("returns null when there are no content blocks", () => {
    expect(findRuleContentBlock("# Just prose\n\nNo fences here.", "x")).toBeNull();
  });

  it("picks the correct block among several", () => {
    const text = file(
      contentBlock("id: first", "First body."),
      "",
      contentBlock("id: second\nicon: star", "Second body.")
    );
    const block = findRuleContentBlock(text, "second");
    expect(block?.body).toBe("Second body.");
    expect(block?.frontmatter.icon).toBe("star");
  });

  it("does not match a rule.content opener nested inside another block's body", () => {
    // The first block's body contains text that mentions a fence opener; the
    // line-skip past the body keeps it from being treated as a real block.
    const inner = `Example:\n${TICK}rpg rule.content\nid: trap\n---\nnested\n${TICK}`;
    const text = file(contentBlock("id: real\n# (no real second block)", inner));
    // "trap" lives inside "real"'s body, so it must not be found as its own block.
    expect(findRuleContentBlock(text, "trap")).toBeNull();
    expect(findRuleContentBlock(text, "real")?.frontmatter.id).toBe("real");
  });
});

describe("resolveTabBlockFields", () => {
  const fileName = "Life and Death";

  it("reads name/icon/color/order from the targeted block", () => {
    const text = file(
      contentBlock(
        'id: main-content\nname: Death Saves\nicon: heart-pulse\ncolor: "#c0392b"\norder: 1',
        "When you drop to 0 hit points..."
      )
    );
    const r = resolveTabBlockFields(text, {}, fileName, "main-content");
    expect(r).toEqual({
      name: "Death Saves",
      icon: "heart-pulse",
      color: "#c0392b",
      order: 1,
      body: "When you drop to 0 hit points...",
    });
  });

  it("falls back to file tab-* keys when the block omits styling", () => {
    const text = file(contentBlock("id: main-content", "Body."));
    const fileFm = {
      "tab-name": "Death & Dying",
      "tab-icon": "skull",
      "tab-color": "red",
      "tab-order": 2,
    };
    const r = resolveTabBlockFields(text, fileFm, fileName, "main-content");
    expect(r).toEqual({
      name: "Death & Dying",
      icon: "skull",
      color: "red",
      order: 2,
      body: "Body.",
    });
  });

  it("block styling wins over file tab-* keys", () => {
    const text = file(contentBlock("id: main-content\nname: Block Name\nicon: heart\norder: 1", "Body."));
    const fileFm = {
      "tab-name": "File Name",
      "tab-icon": "skull",
      "tab-color": "red",
      "tab-order": 9,
    };
    const r = resolveTabBlockFields(text, fileFm, fileName, "main-content");
    expect(r?.name).toBe("Block Name");
    expect(r?.icon).toBe("heart");
    expect(r?.order).toBe(1);
    // color absent on block -> file fallback still applies
    expect(r?.color).toBe("red");
  });

  it("uses block title when name is absent", () => {
    const text = file(contentBlock("id: main-content\ntitle: Titled", "Body."));
    expect(resolveTabBlockFields(text, {}, fileName, "main-content")?.name).toBe("Titled");
  });

  it("falls back to file tab-name, then the file name, for the label", () => {
    const text = file(contentBlock("id: main-content", "Body."));
    expect(resolveTabBlockFields(text, { "tab-name": "Tabbed" }, fileName, "main-content")?.name).toBe("Tabbed");
    expect(resolveTabBlockFields(text, {}, fileName, "main-content")?.name).toBe(fileName);
  });

  it("uses the matched name as the label when matched by name", () => {
    const text = file(contentBlock("name: Stabilizing", "Body."));
    expect(resolveTabBlockFields(text, {}, fileName, "Stabilizing")?.name).toBe("Stabilizing");
  });

  it("defaults order to Infinity when neither block nor file specify it", () => {
    const text = file(contentBlock("id: main-content", "Body."));
    expect(resolveTabBlockFields(text, {}, fileName, "main-content")?.order).toBe(Infinity);
  });

  it("returns null when the block is missing (caller falls back to whole file)", () => {
    const text = file(contentBlock("id: main-content", "Body."));
    expect(resolveTabBlockFields(text, {}, fileName, "nope")).toBeNull();
  });

  it("ignores a non-numeric block order and falls back to the file order", () => {
    const text = file(contentBlock("id: main-content\norder: high", "Body."));
    expect(resolveTabBlockFields(text, { "tab-order": 3 }, fileName, "main-content")?.order).toBe(3);
  });
});

describe("findGMFeatureById", () => {
  function gmBlock(yaml: string): string {
    return [`${TICK}rpg feature.gm`, yaml, TICK].join("\n");
  }

  it("matches a feature.gm block by id", () => {
    const text = file(gmBlock("id: scene-check\nname: Testing the Expected Scene"));
    const gm = findGMFeatureById(text, "Scene Check", "scene-check");
    expect(gm?.name).toBe("Testing the Expected Scene");
  });

  it("falls back to matching by name when id is absent", () => {
    const text = file(gmBlock("name: Chaos Factor\ndial: { abbr: CF, min: 1, max: 9, default: 5 }"));
    expect(findGMFeatureById(text, "Chaos Factor", "Chaos Factor")?.dial?.abbr).toBe("CF");
  });

  it("returns null when no feature.gm matches", () => {
    const text = file(gmBlock("id: scene-check\nname: Scene Check"));
    expect(findGMFeatureById(text, "Scene Check", "missing")).toBeNull();
  });
});

describe("findRuleFenceBodyById", () => {
  it("finds a rule.tab's body by its id", () => {
    const text = [
      "````rpg rule.tab",
      "id: options",
      "name: Options",
      "---",
      "### Weapon Options",
      "body",
      "````",
      "```rpg rule.content",
      "id: other",
      "---",
      "x",
      "```",
    ].join("\n");
    expect(findRuleFenceBodyById(text, "options")).toBe("### Weapon Options\nbody");
    expect(findRuleFenceBodyById(text, "missing")).toBeNull();
  });
});
