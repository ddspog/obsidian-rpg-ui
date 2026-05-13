import { describe, expect, it } from "vitest";
import {
  coerceSource,
  parseRuleBlock,
  parseRuleCompendium,
  parseRuleContent,
  parseRuleRelated,
  parseRuleSide,
  SIDE_PRESETS,
  subtypeFromMeta,
} from "./parse-rule-block";

describe("subtypeFromMeta", () => {
  it("recognizes each of the four subtypes", () => {
    expect(subtypeFromMeta("rule.content")).toBe("content");
    expect(subtypeFromMeta("rule.side")).toBe("side");
    expect(subtypeFromMeta("rule.related")).toBe("related");
    expect(subtypeFromMeta("rule.compendium")).toBe("compendium");
  });
  it("rejects non-rule meta", () => {
    expect(subtypeFromMeta("table.progression")).toBeNull();
    expect(subtypeFromMeta("rule.unknown")).toBeNull();
    expect(subtypeFromMeta("rule.")).toBeNull();
  });
});

describe("coerceSource", () => {
  it("accepts a full tuple", () => {
    expect(coerceSource({ system: "tov", book: "Player's Guide", company: "Kobold" })).toEqual({
      system: "tov",
      book: "Player's Guide",
      company: "Kobold",
    });
  });
  it("accepts system-only", () => {
    expect(coerceSource({ system: "tov" })).toEqual({ system: "tov", book: undefined, company: undefined });
  });
  it("rejects when system is missing or blank", () => {
    expect(coerceSource({ book: "x" })).toBeUndefined();
    expect(coerceSource({ system: "" })).toBeUndefined();
    expect(coerceSource(null)).toBeUndefined();
    expect(coerceSource("tov")).toBeUndefined();
  });
});

describe("parseRuleContent", () => {
  it("splits YAML frontmatter from markdown body on the first `---`", () => {
    const src = `name: Grappling
action: 1 action
---
To grapple a creature within reach, make a special melee attack.`;
    const b = parseRuleContent(src);
    expect(b.kind).toBe("content");
    expect(b.frontmatter).toEqual({ name: "Grappling", action: "1 action" });
    expect(b.body).toBe("To grapple a creature within reach, make a special melee attack.");
  });

  it("treats pure markdown (no separator) as body only, empty frontmatter", () => {
    const b = parseRuleContent("Plain markdown **text**.");
    expect(b.frontmatter).toEqual({});
    expect(b.body).toBe("Plain markdown **text**.");
    expect(b.source).toBeUndefined();
  });

  it("captures a source tuple from frontmatter", () => {
    const src = `source:
  system: dnd5e
  company: WotC
---
Foreign content.`;
    const b = parseRuleContent(src);
    expect(b.source).toEqual({ system: "dnd5e", book: undefined, company: "WotC" });
  });

  it("survives malformed YAML frontmatter by emptying it", () => {
    const src = `this is: not: valid: yaml :: :
---
body`;
    const b = parseRuleContent(src);
    expect(b.frontmatter).toEqual({});
    expect(b.body).toBe("body");
  });

  it("strips surrounding blank lines from body", () => {
    const src = `name: X
---


body line


`;
    const b = parseRuleContent(src);
    expect(b.body).toBe("body line");
  });
});

describe("parseRuleSide", () => {
  it("parses explicit title + content", () => {
    const src = `title: Quick note
content: |
  Body text with **markdown**.`;
    const b = parseRuleSide(src);
    expect(b.kind).toBe("side");
    expect(b.title).toBe("Quick note");
    expect(b.content.trim()).toBe("Body text with **markdown**.");
    expect(b.preset).toBeUndefined();
  });

  it("applies preset defaults when `type` is set", () => {
    const src = `type: tip
content: Short tip.`;
    const b = parseRuleSide(src);
    expect(b.preset).toBe("tip");
    expect(b.title).toBe(SIDE_PRESETS.tip.title);
    expect(b.icon).toBe(SIDE_PRESETS.tip.icon);
    expect(b.color).toBe(SIDE_PRESETS.tip.color);
    expect(b.content).toBe("Short tip.");
  });

  it("lets explicit fields override preset defaults", () => {
    const src = `type: tip
title: Custom tip
icon: swords
color: "#ff0000"
content: body`;
    const b = parseRuleSide(src);
    expect(b.title).toBe("Custom tip");
    expect(b.icon).toBe("swords");
    expect(b.color).toBe("#ff0000");
    expect(b.preset).toBe("tip");
  });

  it("ignores unknown preset values", () => {
    const src = `type: bogus
title: Plain
content: x`;
    const b = parseRuleSide(src);
    expect(b.preset).toBeUndefined();
    expect(b.title).toBe("Plain");
  });

  it("captures a source tuple", () => {
    const src = `title: X
content: y
source:
  system: dnd5e`;
    const b = parseRuleSide(src);
    expect(b.source).toEqual({ system: "dnd5e", book: undefined, company: undefined });
  });

  it("returns an empty-title block when body is malformed YAML", () => {
    const b = parseRuleSide(":: not: valid ::");
    expect(b.title).toBe("");
    expect(b.content).toBe("");
  });

  it("defaults direction to right and honors `direction: left`", () => {
    expect(parseRuleSide("title: t\ncontent: c").direction).toBe("right");
    expect(parseRuleSide("title: t\ndirection: left\ncontent: c").direction).toBe("left");
    expect(parseRuleSide("title: t\ndirection: right\ncontent: c").direction).toBe("right");
    // Unknown direction values fall back to right.
    expect(parseRuleSide("title: t\ndirection: bogus\ncontent: c").direction).toBe("right");
  });

  it("defaults variant to float and honors `kind: commentary` / `kind: callout`", () => {
    expect(parseRuleSide("title: t\ncontent: c").variant).toBe("float");
    expect(parseRuleSide("kind: commentary\ncontent: c").variant).toBe("commentary");
    expect(parseRuleSide("kind: callout\ncontent: c").variant).toBe("callout");
    expect(parseRuleSide("kind: float\ncontent: c").variant).toBe("float");
    // Unknown kind values fall back to float.
    expect(parseRuleSide("kind: bogus\ncontent: c").variant).toBe("float");
    // Commentary doesn't require a title — content can stand alone.
    expect(parseRuleSide("kind: commentary\ncontent: c").title).toBe("");
  });
});

describe("parseRuleRelated", () => {
  it("parses a flat list of embed tokens", () => {
    const src = `- "![[ammunition]]"
- "![[bow]]"`;
    const r = parseRuleRelated(src);
    expect(r.entries).toEqual([{ embed: "![[ammunition]]" }, { embed: "![[bow]]" }]);
    expect(r.level).toBe(3);
  });

  it("parses heading-prefixed string entries", () => {
    const src = `- "See also: ![[shoving]]"`;
    const r = parseRuleRelated(src);
    expect(r.entries).toEqual([{ heading: "See also", embed: "![[shoving]]" }]);
  });

  it("parses object entries with `{heading: embed}`", () => {
    const src = `- Prerequisite: "![[ammunition]]"`;
    const r = parseRuleRelated(src);
    expect(r.entries).toEqual([{ heading: "Prerequisite", embed: "![[ammunition]]" }]);
  });

  it("rejects bare wikilinks (without `!`)", () => {
    const src = `- "[[ammunition]]"
- "See also: [[shoving]]"`;
    const r = parseRuleRelated(src);
    expect(r.entries).toEqual([]);
  });

  it("supports object form with explicit level + entries", () => {
    const src = `level: 4
entries:
  - "![[ammunition]]"
  - "See also: ![[shoving]]"`;
    const r = parseRuleRelated(src);
    expect(r.level).toBe(4);
    expect(r.entries).toEqual([
      { embed: "![[ammunition]]" },
      { heading: "See also", embed: "![[shoving]]" },
    ]);
  });

  it("clamps level to the 1–6 range; out-of-range values fall back to default", () => {
    expect(parseRuleRelated("level: 0\nentries: []").level).toBe(3);
    expect(parseRuleRelated("level: 7\nentries: []").level).toBe(3);
    expect(parseRuleRelated("level: 1\nentries: []").level).toBe(1);
    expect(parseRuleRelated("level: 6\nentries: []").level).toBe(6);
  });

  it("supports embeds with aliases / pipe forms", () => {
    const src = `- "![[ammunition|short]]"`;
    const r = parseRuleRelated(src);
    expect(r.entries[0].embed).toBe("![[ammunition|short]]");
  });

  it("supports the documented mixed syntax (plain + quoted key + unquoted key)", () => {
    const src = `- "![[ammunition|no-h1 no-title clean]]"
- "See also": "![[shoving]]"
- Prerequisite: "![[bow]]"`;
    const r = parseRuleRelated(src);
    expect(r.entries).toEqual([
      { embed: "![[ammunition|no-h1 no-title clean]]" },
      { heading: "See also", embed: "![[shoving]]" },
      { heading: "Prerequisite", embed: "![[bow]]" },
    ]);
  });

  it("returns an empty list when body is malformed", () => {
    expect(parseRuleRelated("not: a: list").entries).toEqual([]);
  });
});

describe("parseRuleCompendium", () => {
  it("parses a list of tabs with optional color + icon", () => {
    const src = `tabs:
  - name: Grappling
    color: red
    icon: swords
    content: "@[[rules/grappling]].view()"
  - name: Shoving
    content: "Shoving lets you push a creature."`;
    const c = parseRuleCompendium(src);
    expect(c.tabs).toHaveLength(2);
    expect(c.tabs[0]).toEqual({
      name: "Grappling",
      color: "red",
      icon: "swords",
      content: "@[[rules/grappling]].view()",
    });
    expect(c.tabs[1].color).toBeUndefined();
  });

  it("drops tabs missing a name", () => {
    const src = `tabs:
  - content: anonymous`;
    expect(parseRuleCompendium(src).tabs).toEqual([]);
  });

  it("returns empty tabs when body is malformed", () => {
    expect(parseRuleCompendium("::nope::").tabs).toEqual([]);
  });
});

describe("parseRuleBlock dispatch", () => {
  it("routes to the right parser per subtype", () => {
    expect(parseRuleBlock("content", "x").kind).toBe("content");
    expect(parseRuleBlock("side", "title: t\ncontent: c").kind).toBe("side");
    expect(parseRuleBlock("related", "- \"[[a]]\"").kind).toBe("related");
    expect(parseRuleBlock("compendium", "tabs: []").kind).toBe("compendium");
  });
});

