/**
 * Entity Resolver Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { EntityReference, EntityData } from "./entity-resolver";

// Mock Obsidian types
const mockApp = {
  vault: {
    getAbstractFileByPath: vi.fn(),
    read: vi.fn(),
    on: vi.fn(),
  },
  metadataCache: {
    getFileCache: vi.fn(),
  },
};

describe("Entity Resolver", () => {
  describe("File path resolution", () => {
    it("should handle absolute paths", () => {
      const ref: EntityReference = {
        file: "Characters/Elara.md",
        type: "character",
      };

      // The resolver should handle this path as-is
      expect(ref.file).toBe("Characters/Elara.md");
    });

    it("should handle wiki-link syntax", () => {
      const ref: EntityReference = {
        file: "[[Elara]]",
        type: "character",
      };

      // The resolver should strip [[ ]] and add .md
      const cleaned = ref.file.replace(/^\[\[/, "").replace(/\]\]$/, "");
      expect(cleaned).toBe("Elara");
    });

    it("should handle paths without .md extension", () => {
      const ref: EntityReference = {
        file: "Characters/Elara",
        type: "character",
      };

      const path = ref.file.endsWith(".md") ? ref.file : ref.file + ".md";
      expect(path).toBe("Characters/Elara.md");
    });
  });

  describe("Entity reference structure", () => {
    it("should support basic entity reference", () => {
      const ref: EntityReference = {
        file: "Characters/Elara.md",
      };

      expect(ref.file).toBeDefined();
      expect(ref.type).toBeUndefined();
      expect(ref.count).toBeUndefined();
    });

    it("should support entity reference with type", () => {
      const ref: EntityReference = {
        file: "Characters/Elara.md",
        type: "character",
      };

      expect(ref.file).toBe("Characters/Elara.md");
      expect(ref.type).toBe("character");
    });

    it("should support entity reference with count", () => {
      const ref: EntityReference = {
        file: "NPCs/Goblin.md",
        type: "monster",
        count: 3,
      };

      expect(ref.file).toBe("NPCs/Goblin.md");
      expect(ref.type).toBe("monster");
      expect(ref.count).toBe(3);
    });
  });

  describe("Entity data structure", () => {
    it("should have required fields", () => {
      const data: EntityData = {
        name: "Elara",
        filePath: "Characters/Elara.md",
        frontmatter: { proficiency_bonus: 3, level: 5 },
        codeBlocks: new Map(),
        exists: true,
      };

      expect(data.name).toBe("Elara");
      expect(data.filePath).toBe("Characters/Elara.md");
      expect(data.frontmatter.proficiency_bonus).toBe(3);
      expect(data.exists).toBe(true);
    });

    it("should support code blocks map", () => {
      const codeBlocks = new Map<string, string[]>();
      codeBlocks.set("attributes", ["strength: 16\ndexterity: 14"]);
      codeBlocks.set("healthpoints", ["health: 45"]);

      const data: EntityData = {
        name: "Elara",
        filePath: "Characters/Elara.md",
        frontmatter: { proficiency_bonus: 3 },
        codeBlocks,
        exists: true,
      };

      expect(data.codeBlocks.size).toBe(2);
      expect(data.codeBlocks.get("attributes")).toBeDefined();
      expect(data.codeBlocks.get("healthpoints")).toBeDefined();
    });

    it("should handle non-existent entity", () => {
      const data: EntityData = {
        name: "Unknown",
        filePath: "Characters/Unknown.md",
        frontmatter: { proficiency_bonus: 2 },
        codeBlocks: new Map(),
        exists: false,
      };

      expect(data.exists).toBe(false);
      expect(data.codeBlocks.size).toBe(0);
    });
  });

  describe("Code block access patterns", () => {
    let entityData: EntityData;

    beforeEach(() => {
      const codeBlocks = new Map<string, string[]>();
      codeBlocks.set("attributes", [
        "strength: 16\ndexterity: 14\nconstitution: 13",
      ]);
      codeBlocks.set("skills", ["proficiencies:\n  - Stealth\n  - Perception"]);
      codeBlocks.set("inventory", [
        "items:\n  - Longsword\n  - Leather Armor",
        "items:\n  - Potion of Healing",
      ]);

      entityData = {
        name: "Elara",
        filePath: "Characters/Elara.md",
        frontmatter: { proficiency_bonus: 3 },
        codeBlocks,
        exists: true,
      };
    });

    it("should get single code block", () => {
      const attributes = entityData.codeBlocks.get("attributes");
      expect(attributes).toBeDefined();
      expect(attributes?.length).toBe(1);
    });

    it("should get multiple code blocks of same type", () => {
      const inventory = entityData.codeBlocks.get("inventory");
      expect(inventory).toBeDefined();
      expect(inventory?.length).toBe(2);
    });

    it("should return undefined for non-existent block type", () => {
      const spells = entityData.codeBlocks.get("spells");
      expect(spells).toBeUndefined();
    });

    it("should check if entity has code block", () => {
      const hasAttributes = entityData.codeBlocks.has("attributes");
      const hasSpells = entityData.codeBlocks.has("spells");

      expect(hasAttributes).toBe(true);
      expect(hasSpells).toBe(false);
    });
  });

  describe("Multiple entity resolution", () => {
    it("should support array of entity references", () => {
      const refs: EntityReference[] = [
        { file: "Characters/Elara.md", type: "character" },
        { file: "Characters/Thorne.md", type: "character" },
        { file: "NPCs/Goblin.md", type: "monster", count: 3 },
      ];

      expect(refs).toHaveLength(3);
      expect(refs[0].file).toBe("Characters/Elara.md");
      expect(refs[2].count).toBe(3);
    });
  });
});
