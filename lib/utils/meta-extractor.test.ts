import { describe, it, expect, vi } from "vitest";
import { extractMeta, detectMetaFromSource } from "./meta-extractor";
import { MarkdownPostProcessorContext } from "obsidian";

describe("meta-extractor", () => {
  const createMockContext = (text: string, lineStart: number): MarkdownPostProcessorContext => {
    return {
      getSectionInfo: vi.fn().mockReturnValue({
        text,
        lineStart,
        lineEnd: lineStart + text.split("\n").length - 1,
      }),
    } as unknown as MarkdownPostProcessorContext;
  };

  const createReadingViewContext = (): MarkdownPostProcessorContext => {
    return {
      getSectionInfo: vi.fn().mockReturnValue(null),
    } as unknown as MarkdownPostProcessorContext;
  };

  const createMockElement = (): HTMLElement => {
    return { getAttribute: () => null } as unknown as HTMLElement;
  };

  describe("extractMeta via getSectionInfo (edit/live preview)", () => {
    it("should extract single-word meta", () => {
      const text = "```rpg attributes\nstrength: 10\n```";
      const ctx = createMockContext(text, 0);
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBe("attributes");
    });

    it("should extract multi-word meta", () => {
      const text = "```rpg spell-components\nverbal: true\n```";
      const ctx = createMockContext(text, 0);
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBe("spell-components");
    });

    it("should extract meta from middle of document", () => {
      const text = "Some text\n\n```rpg skills\nproficiencies:\n  - Stealth\n```\n\nMore text";
      const ctx = createMockContext(text, 2);
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBe("skills");
    });

    it("should handle extra whitespace", () => {
      const text = "```rpg   healthpoints  \nhealth: 100\n```";
      const ctx = createMockContext(text, 0);
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBe("healthpoints");
    });

    it("should return null for empty text", () => {
      const ctx = createMockContext("", 0);
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBeNull();
    });

    it("should return null for non-rpg code block", () => {
      const text = "```javascript\nconsole.log('hello');\n```";
      const ctx = createMockContext(text, 0);
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBeNull();
    });

    it("should return null for rpg block without meta", () => {
      const text = "```rpg\ncontent: here\n```";
      const ctx = createMockContext(text, 0);
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBeNull();
    });
  });

  describe("extractMeta via source YAML keys (reading view fallback)", () => {
    it("should detect 'show' from entries key", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "entries:\n  data: skills\n  properties:\n    - label\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBe("show");
    });

    it("should detect 'show' from table key", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "table:\n  data: attributes\n  columns:\n    - name\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBe("show");
    });

    it("should detect 'show' from cards key", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "cards:\n  data: attributes\n  properties:\n    - label\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBe("show");
    });

    it("detects 'list' from a paginated list body with call/format entries", () => {
      // Regression: a `rpg list.*` body has top-level `entries:` whose items
      // carry `@[[...]]` call tokens. When getSectionInfo is unavailable (e.g.
      // a programmatic previewMode.rerender on app load/reload), this source
      // fallback must route it to the list handler — NOT misread it as
      // rule.related, which rendered the entries as prose and leaked the
      // `.block()` call to the rule-call processor ("View block not registered").
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source =
        "name: Cantrips\n" +
        "paginate: auto\n" +
        "entries:\n" +
        '  - "_Acid Splash_ (Conjuration) Acid bursts over foes."\n' +
        '  - call: "@[[spells/cantrips/]].filter(source like /Arcane/).highlight().block(0)"\n' +
        '    format: "*[[${name}]]* (${school}) ${summary}"\n';

      expect(extractMeta(ctx, el, source)).toBe("list");
    });

    it("detects 'list' from a body with a top-level columns marker", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "name: 1st Circle\ncolumns: 2\nentries:\n  - text: Burning Hands\n";

      expect(extractMeta(ctx, el, source)).toBe("list");
    });

    it("still detects rule.related for a bare embed/call array (no list markers)", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = 'entries:\n  - "@[[Some Rule]].danger()"\n  - "![[Another]]"\nview: card\n';

      expect(extractMeta(ctx, el, source)).toBe("rule.related");
    });

    it("should detect 'system.skills' from skills key", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "skills:\n  - label: Acrobatics\n    attribute: dexterity\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBe("system.skills");
    });

    it("should detect 'system.attributes' from attributes key", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "attributes:\n  - label: Strength\n    short: STR\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBe("system.attributes");
    });

    it("should detect 'healthpoints' from health key", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "health: 45\nstate_key: hp\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBe("healthpoints");
    });

    it("routes bare-`name` blocks to feature.details (compendium docs dominate)", () => {
      // Previously, any block with `name:` defaulted to "system". That heuristic
      // wrongly captured `rpg feature.details` blocks whose YAML happened to be
      // just `name: …` and routed them to SystemView. Compendium feature docs
      // are the dominant use case, so bare-name blocks now route to feature.details.
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "name: D&D 5e\ndescription: Core ruleset\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBe("feature.details");
    });

    it("should return null when source has no matching keys", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "unknown_key: value\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBeNull();
    });

    it("detects feature.choice from `parent` key", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "parent: Manifestation of Faith\nname: Manifest Might\n";
      expect(extractMeta(ctx, el, source)).toBe("feature.choice");
    });

    it("detects feature.unlock from `kind` + `level` keys", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "kind: subclass\nlevel: 3\n";
      expect(extractMeta(ctx, el, source)).toBe("feature.unlock");
    });

    it("detects feature.level from `level` + `traits` without name/parent/kind", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = 'level: 3\ntraits:\n  Spellcasting: "2º Ritual"\n';
      expect(extractMeta(ctx, el, source)).toBe("feature.level");
    });

    it("detects feature.details from `name` + feature marker (subtitle/tag/pick/etc.)", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      // tag marker
      expect(extractMeta(ctx, el, "name: Hit Points\ntag: hp\nlevel: 1\n")).toBe("feature.details");
      // subtitle marker
      expect(extractMeta(ctx, el, 'name: Heroic Boon\nsubtitle: "10th-Level Cleric Feature"\npick: 1\n')).toBe(
        "feature.details"
      );
    });

    it("should return null when no source provided and getSectionInfo is null", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBeNull();
    });
  });

  describe("stat.* fences (nested-render fallback, getSectionInfo null)", () => {
    // Regression: `.bare()` and other nested renders pass a `rpg stat.*` fence
    // through MarkdownRenderer with no section info, so the info string
    // ("rpg stat.category") is gone. Without key-set detection the fence-mode
    // head (level/subtitle/habitat/treasure, no name) defaulted to rule.content
    // — rendering a category's body but dropping its title/subtitle/habitat.
    it("detects 'stat.category' from a fence-mode head (no name, habitat/treasure/subtitle)", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source =
        "level: 2\n" +
        "subtitle: Steward and Sage of Nature\n" +
        "habitat: Any\n" +
        'treasure: "[[Individual]], [[Relics]]"\n' +
        "---\n" +
        "![[druids-category.webp]]\n" +
        "Body prose about druids.\n";
      expect(extractMeta(ctx, el, source)).toBe("stat.category");
    });

    it("detects 'stat.category' even when the head declares an explicit name", () => {
      // Regression: a category with `name:` + `subtitle:` + `level:` matched
      // feature.details (those are feature markers) and lost its category chrome
      // (Habitat/Treasure line). habitat/treasure are stat-only fields, so they
      // classify a category regardless of `name`.
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source =
        "name: Druids\n" +
        "level: 2\n" +
        "subtitle: Steward and Sage of Nature\n" +
        "habitat: Any\n" +
        'treasure: "[[Individual]], [[Relics]]"\n' +
        "---\n" +
        "Body prose about druids.\n";
      expect(extractMeta(ctx, el, source)).toBe("stat.category");
    });

    it("detects 'stat.monster' from a fence-mode head with stats:/abilities:", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source =
        'name: "Eagle"\n' +
        'type: "Small [[Beast]]"\n' +
        'cr: "0"\n' +
        'stats:\n  ac: "11"\n  hp: "8"\n' +
        "abilities:\n  str: -2\n  dex: 1\n" +
        "---\n" +
        "**Keen Sight.** The eagle has advantage on sight-based Perception.\n";
      expect(extractMeta(ctx, el, source)).toBe("stat.monster");
    });

    it("detects 'stat.monster' from a pure-YAML head (cr, no traits body)", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = 'name: "Goblin"\ntype: "Small Humanoid"\ncr: "1/4"\nhabitat: "[[Forest]]"\n';
      expect(extractMeta(ctx, el, source)).toBe("stat.monster");
    });

    it("a categorized monster (name + cr + habitat/treasure) stays 'stat.monster', not a category", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source =
        'name: "Druid"\n' +
        'cr: "2"\n' +
        'category: "[[Druids]]"\n' +
        "habitat: Any\n" +
        'treasure: "[[Relics]]"\n' +
        "---\n" +
        "**Spellcasting.** The druid casts…\n";
      expect(extractMeta(ctx, el, source)).toBe("stat.monster");
    });

    it("does not steal feature.details: name + subtitle (no stat keys) stays feature.details", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = 'name: Heroic Boon\nsubtitle: "10th-Level Cleric Feature"\npick: 1\n';
      expect(extractMeta(ctx, el, source)).toBe("feature.details");
    });
  });
});

describe("detectMetaFromSource — feature.gm fence-mode", () => {
  // When a gm fence is imported into another note the info string ("rpg
  // feature.gm") is gone, so classification falls back to the body. It used to
  // land on `rule.content`, which rendered the lonelog as literal prose.
  it("detects a GM block by its aspect keys, not as rule.content", () => {
    const src = [
      "id: random-event",
      "name: Random Event",
      "heading: none",
      'reads: ["@[[Characters]]", "@[[Threads]]"]',
      "generators:",
      "  - id: random-event",
      "cards:",
      "  - name: Trigger a Random Event",
      "---",
      "? A Random Event fires — what is it?",
      "gen: Random Event",
    ].join("\n");
    expect(detectMetaFromSource(src)).toBe("feature.gm");
  });

  it("recognizes each GM-only aspect key", () => {
    for (const key of ["generators", "cards", "oracle", "dial", "list", "reads", "steps", "scene", "event"]) {
      const src = [`id: x`, `name: X`, `${key}:`, "  - a", "---", "body"].join("\n");
      expect(detectMetaFromSource(src)).toBe("feature.gm");
    }
  });

  it("does not steal a plain rule.content or feature.details block", () => {
    expect(detectMetaFromSource(["id: summary", "---", "Just prose."].join("\n"))).toBe("rule.content");
    expect(detectMetaFromSource(["name: Second Wind", "type: bonus", "---", "Regain HP."].join("\n"))).toBe(
      "feature.details"
    );
  });
});
