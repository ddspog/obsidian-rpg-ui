import { describe, it, expect, vi } from "vitest";
import { extractMeta } from "./meta-extractor";
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

    it("should detect 'system' from name key", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "name: D&D 5e\ndescription: Core ruleset\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBe("system");
    });

    it("should return null when source has no matching keys", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();
      const source = "unknown_key: value\n";

      const meta = extractMeta(ctx, el, source);
      expect(meta).toBeNull();
    });

    it("should return null when no source provided and getSectionInfo is null", () => {
      const ctx = createReadingViewContext();
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBeNull();
    });
  });
});
