/**
 * Tests for system markdown parser
 */

import { describe, it, expect } from "vitest";
import { parseSystemFromMarkdown } from "./parser";

describe("parseSystemFromMarkdown", () => {
  it("should return null when no system block is found", () => {
    const markdown = "# Just a title\nSome content";
    const result = parseSystemFromMarkdown(markdown);
    expect(result).toBeNull();
  });

  it("should parse a basic system definition", () => {
    const markdown = `
# Test System

\`\`\`rpg system
name: "Test RPG"
attributes:
  - strength
  - dexterity
  - intelligence
\`\`\`
    `;

    const system = parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.name).toBe("Test RPG");
    expect(system?.attributes).toEqual(["strength", "dexterity", "intelligence"]);
  });

  it("should parse entity types with frontmatter fields", () => {
    const markdown = `
\`\`\`rpg system
name: "Test System"
attributes:
  - strength
types:
  character:
    fields:
      - name: level
        type: number
        default: 1
      - name: class
        type: string
      - name: proficiency_bonus
        type: number
        derived: "{{multiply 2 level}}"
        aliases: [proficiencyBonus, prof]
\`\`\`
    `;

    const system = parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.entities.character).toBeDefined();
    
    const charFields = system?.entities.character.frontmatter;
    expect(charFields).toHaveLength(3);
    
    const levelField = charFields?.find(f => f.name === "level");
    expect(levelField).toEqual({
      name: "level",
      type: "number",
      default: 1,
    });

    const profField = charFields?.find(f => f.name === "proficiency_bonus");
    expect(profField).toEqual({
      name: "proficiency_bonus",
      type: "number",
      derived: "{{multiply 2 level}}",
      aliases: ["proficiencyBonus", "prof"],
    });
  });

  it("should parse expression blocks", () => {
    const markdown = `
\`\`\`rpg system
name: "Test System"
attributes: [strength]
\`\`\`

\`\`\`rpg expression
id: modifier
params:
  - score
formula: "{{floor (divide (subtract score 10) 2)}}"
\`\`\`

\`\`\`rpg expression
id: simple_add
params:
  - a
  - b
formula: "{{add a b}}"
\`\`\`
    `;

    const system = parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.expressions.size).toBe(2);
    
    const modifierExpr = system?.expressions.get("modifier");
    expect(modifierExpr).toBeDefined();
    expect(modifierExpr?.id).toBe("modifier");
    expect(modifierExpr?.params).toEqual(["score"]);
    expect(modifierExpr?.formula).toBe("{{floor (divide (subtract score 10) 2)}}");
    
    const simpleAddExpr = system?.expressions.get("simple_add");
    expect(simpleAddExpr).toBeDefined();
  });

  it("should parse skill-list blocks", () => {
    const markdown = `
\`\`\`rpg system
name: "Test System"
attributes: [strength, dexterity, intelligence]
\`\`\`

\`\`\`rpg skill-list
skills:
  - label: "Athletics"
    attribute: strength
  - label: "Acrobatics"
    attribute: dexterity
  - label: "Arcana"
    attribute: intelligence
\`\`\`
    `;

    const system = parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(3);
    
    expect(system?.skills[0]).toEqual({
      label: "Athletics",
      attribute: "strength",
    });
    
    expect(system?.skills[1]).toEqual({
      label: "Acrobatics",
      attribute: "dexterity",
    });
  });

  it("should handle multiple entity types", () => {
    const markdown = `
\`\`\`rpg system
name: "Multi-Type System"
attributes: [strength]
types:
  character:
    fields:
      - name: level
        type: number
  monster:
    fields:
      - name: cr
        type: number
        default: 0
  item:
    fields:
      - name: value
        type: number
\`\`\`
    `;

    const system = parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(Object.keys(system?.entities || {})).toContain("character");
    expect(Object.keys(system?.entities || {})).toContain("monster");
    expect(Object.keys(system?.entities || {})).toContain("item");
  });

  it("should use default values for missing system properties", () => {
    const markdown = `
\`\`\`rpg system
name: "Minimal System"
\`\`\`
    `;

    const system = parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.name).toBe("Minimal System");
    expect(system?.attributes).toEqual([]);
    expect(system?.entities).toEqual({});
    expect(system?.skills).toEqual([]);
    expect(system?.expressions.size).toBe(0);
    expect(system?.features).toEqual({
      categories: [],
      providers: [],
      collectors: [],
    });
    expect(system?.spellcasting).toEqual({
      circles: [],
      providers: [],
      collectors: [],
    });
  });
});
