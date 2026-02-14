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

  const createMockElement = (): HTMLElement => {
    return {} as HTMLElement;
  };

  describe("extractMeta", () => {
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

    it("should return null when getSectionInfo returns null", () => {
      const ctx = {
        getSectionInfo: vi.fn().mockReturnValue(null),
      } as unknown as MarkdownPostProcessorContext;
      const el = createMockElement();

      const meta = extractMeta(ctx, el);
      expect(meta).toBeNull();
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
});
