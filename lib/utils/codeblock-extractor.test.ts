import { describe, it, expect } from "vitest";
import { extractCodeBlocks, extractFirstCodeBlock } from "./codeblock-extractor";

describe("codeblock-extractor", () => {
  describe("extractCodeBlocks", () => {
    it("should extract single code block", () => {
      const text = `Some text
\`\`\`ability
ability:
  strength: 10
\`\`\``;

      const blocks = extractCodeBlocks(text, "ability");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe("ability:\n  strength: 10");
    });

    it("should extract multiple code blocks", () => {
      const text = `First block:
\`\`\`ability
first: 1
\`\`\`

Second block:
\`\`\`ability
second: 2
\`\`\``;

      const blocks = extractCodeBlocks(text, "ability");
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe("first: 1");
      expect(blocks[1]).toBe("second: 2");
    });

    it("should extract code blocks from callouts", () => {
      const text = `> \`\`\`ability
> ability:
>   strength: 15
> \`\`\``;

      const blocks = extractCodeBlocks(text, "ability");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe("ability:\n  strength: 15");
    });

    it("should extract code blocks from nested callouts", () => {
      const text = `>>> \`\`\`skills
>>> proficiencies:
>>>   - athletics
>>>   - intimidation
>>> \`\`\``;

      const blocks = extractCodeBlocks(text, "skills");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe("proficiencies:\n  - athletics\n  - intimidation");
    });

    it("should return empty array when no blocks found", () => {
      const text = "No code blocks here";

      const blocks = extractCodeBlocks(text, "ability");
      expect(blocks).toEqual([]);
    });

    it("should only extract blocks of specified type", () => {
      const text = `\`\`\`ability
ability: test
\`\`\`

\`\`\`skills
skills: test
\`\`\``;

      const abilityBlocks = extractCodeBlocks(text, "ability");
      expect(abilityBlocks).toHaveLength(1);
      expect(abilityBlocks[0]).toBe("ability: test");

      const skillsBlocks = extractCodeBlocks(text, "skills");
      expect(skillsBlocks).toHaveLength(1);
      expect(skillsBlocks[0]).toBe("skills: test");
    });

    it("should handle empty content blocks", () => {
      const text = `\`\`\`ability
\`\`\``;

      const blocks = extractCodeBlocks(text, "ability");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe("");
    });

    it("should extract rpg meta blocks with single word meta", () => {
      const text = `Some text
\`\`\`rpg attributes
strength: 10
dexterity: 12
\`\`\``;

      const blocks = extractCodeBlocks(text, "rpg attributes");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe("strength: 10\ndexterity: 12");
    });

    it("should extract multiple rpg meta blocks", () => {
      const text = `First block:
\`\`\`rpg skills
proficiencies:
  - Stealth
\`\`\`

Second block:
\`\`\`rpg skills
proficiencies:
  - Perception
\`\`\``;

      const blocks = extractCodeBlocks(text, "rpg skills");
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe("proficiencies:\n  - Stealth");
      expect(blocks[1]).toBe("proficiencies:\n  - Perception");
    });

    it("should extract rpg blocks from callouts", () => {
      const text = `> \`\`\`rpg attributes
> strength: 15
> \`\`\``;

      const blocks = extractCodeBlocks(text, "rpg attributes");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe("strength: 15");
    });

    it("should only extract rpg blocks with matching meta", () => {
      const text = `\`\`\`rpg attributes
str: 10
\`\`\`

\`\`\`rpg skills
stealth: 5
\`\`\``;

      const attrBlocks = extractCodeBlocks(text, "rpg attributes");
      expect(attrBlocks).toHaveLength(1);
      expect(attrBlocks[0]).toBe("str: 10");

      const skillBlocks = extractCodeBlocks(text, "rpg skills");
      expect(skillBlocks).toHaveLength(1);
      expect(skillBlocks[0]).toBe("stealth: 5");
    });
  });

  describe("extractFirstCodeBlock", () => {
    it("should extract first block when multiple exist", () => {
      const text = `\`\`\`ability
first: 1
\`\`\`

\`\`\`ability
second: 2
\`\`\``;

      const content = extractFirstCodeBlock(text, "ability");
      expect(content).toBe("first: 1");
    });

    it("should return null when no blocks found", () => {
      const text = "No code blocks here";

      const content = extractFirstCodeBlock(text, "ability");
      expect(content).toBeNull();
    });

    it("should extract from callout", () => {
      const text = `> \`\`\`ability
> test: value
> \`\`\``;

      const content = extractFirstCodeBlock(text, "ability");
      expect(content).toBe("test: value");
    });
  });

  describe("entity block extraction (rpg entityType.blockName)", () => {
    it("should extract rpg entity block by dotted meta", () => {
      const text = `\`\`\`rpg character.header
name: Aria
race: Elf
\`\`\``;

      const blocks = extractCodeBlocks(text, "rpg character.header");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe("name: Aria\nrace: Elf");
    });

    it("should extract multiple entity blocks of the same type", () => {
      const text = `\`\`\`rpg statblock.header
name: Goblin
\`\`\`

\`\`\`rpg statblock.header
name: Orc
\`\`\``;

      const blocks = extractCodeBlocks(text, "rpg statblock.header");
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe("name: Goblin");
      expect(blocks[1]).toBe("name: Orc");
    });

    it("should not confuse different entity block types", () => {
      const text = `\`\`\`rpg character.header
name: Aria
\`\`\`

\`\`\`rpg character.health
hp: 45
\`\`\``;

      const headerBlocks = extractCodeBlocks(text, "rpg character.header");
      expect(headerBlocks).toHaveLength(1);
      expect(headerBlocks[0]).toBe("name: Aria");

      const healthBlocks = extractCodeBlocks(text, "rpg character.health");
      expect(healthBlocks).toHaveLength(1);
      expect(healthBlocks[0]).toBe("hp: 45");
    });
  });
});
