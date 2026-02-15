/**
 * Tests for system markdown parser
 */

import { describe, it, expect } from "vitest";
import { parseSystemFromMarkdown, FileLoader } from "./parser";

describe("parseSystemFromMarkdown", () => {
  it("should return null when no system block is found", async () => {
    const markdown = "# Just a title\nSome content";
    const result = await parseSystemFromMarkdown(markdown);
    expect(result).toBeNull();
  });

  it("should parse a basic system definition", async () => {
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

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.name).toBe("Test RPG");
    expect(system?.attributes).toEqual(["strength", "dexterity", "intelligence"]);
  });

  it("should parse entity types with frontmatter fields", async () => {
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

    const system = await parseSystemFromMarkdown(markdown);
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

  it("should parse expression blocks", async () => {
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

    const system = await parseSystemFromMarkdown(markdown);
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

  it("should parse skill-list blocks", async () => {
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

    const system = await parseSystemFromMarkdown(markdown);
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

  it("should handle multiple entity types", async () => {
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

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(Object.keys(system?.entities || {})).toContain("character");
    expect(Object.keys(system?.entities || {})).toContain("monster");
    expect(Object.keys(system?.entities || {})).toContain("item");
  });

  it("should use default values for missing system properties", async () => {
    const markdown = `
\`\`\`rpg system
name: "Minimal System"
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
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

  it("should load features from external file when path is provided", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with External Features"
attributes: [strength]
features: "features/dnd5e-features.md"
\`\`\`
    `;

    const featuresFile = `
\`\`\`rpg system-features
categories:
  - id: action
    label: Action
    icon: ⚔️
  - id: bonus_action
    label: Bonus Action
    icon: ⚡
providers: [class, race]
collectors: [character]
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "features/dnd5e-features.md") {
        return featuresFile;
      }
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.features.categories).toHaveLength(2);
    expect(system?.features.categories[0]).toEqual({
      id: "action",
      label: "Action",
      icon: "⚔️",
    });
    expect(system?.features.providers).toEqual(["class", "race"]);
    expect(system?.features.collectors).toEqual(["character"]);
  });

  it("should load spellcasting from external file when path is provided", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with External Spellcasting"
attributes: [intelligence]
spellcasting: "spells/dnd5e-spells.md"
\`\`\`
    `;

    const spellsFile = `
\`\`\`rpg system-spellcasting
circles:
  - id: cantrip
    label: Cantrip
  - id: "1"
    label: 1st Level
providers: [class]
collectors: [character]
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "spells/dnd5e-spells.md") {
        return spellsFile;
      }
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.spellcasting.circles).toHaveLength(2);
    expect(system?.spellcasting.circles[0]).toEqual({
      id: "cantrip",
      label: "Cantrip",
    });
    expect(system?.spellcasting.providers).toEqual(["class"]);
    expect(system?.spellcasting.collectors).toEqual(["character"]);
  });

  it("should load skills from external file when path is provided", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with External Skills"
attributes: [strength, dexterity]
skills: "skills/dnd5e-skills.md"
\`\`\`
    `;

    const skillsFile = `
\`\`\`rpg system-skills
skills:
  - label: "Acrobatics"
    attribute: dexterity
  - label: "Athletics"
    attribute: strength
  - label: "Stealth"
    attribute: dexterity
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "skills/dnd5e-skills.md") {
        return skillsFile;
      }
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(3);
    expect(system?.skills[0]).toEqual({
      label: "Acrobatics",
      attribute: "dexterity",
    });
    expect(system?.skills[1]).toEqual({
      label: "Athletics",
      attribute: "strength",
    });
  });

  it("should load skills from multiple external files", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Multiple Skill Files"
attributes: [strength, dexterity, wisdom]
skills:
  - "skills/physical.md"
  - "skills/mental.md"
\`\`\`
    `;

    const physicalSkills = `
\`\`\`rpg system-skills
skills:
  - label: "Acrobatics"
    attribute: dexterity
  - label: "Athletics"
    attribute: strength
\`\`\`
    `;

    const mentalSkills = `
\`\`\`rpg system-skills
skills:
  - label: "Insight"
    attribute: wisdom
  - label: "Perception"
    attribute: wisdom
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "skills/physical.md") return physicalSkills;
      if (path === "skills/mental.md") return mentalSkills;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(4);
    expect(system?.skills.map(s => s.label)).toEqual([
      "Acrobatics",
      "Athletics",
      "Insight",
      "Perception",
    ]);
  });

  it("should load expressions from external file when path is provided", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with External Expressions"
attributes: [strength]
expressions: "expressions/dnd5e-expressions.md"
\`\`\`
    `;

    const expressionsFile = `
\`\`\`rpg system-expressions
expressions:
  - id: modifier
    params: [score]
    formula: "{{floor (divide (subtract score 10) 2)}}"
  - id: saving_throw
    params: [modifier, proficient, proficiency_bonus]
    formula: "{{add modifier (if proficient proficiency_bonus 0)}}"
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "expressions/dnd5e-expressions.md") {
        return expressionsFile;
      }
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.expressions.size).toBe(2);
    expect(system?.expressions.has("modifier")).toBe(true);
    expect(system?.expressions.has("saving_throw")).toBe(true);
    
    const modifierExpr = system?.expressions.get("modifier");
    expect(modifierExpr?.params).toEqual(["score"]);
    expect(modifierExpr?.evaluate({ score: 16 })).toBe(3);
  });

  it("should load expressions from multiple external files", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Multiple Expression Files"
attributes: [strength]
expressions:
  - "expressions/basic.md"
  - "expressions/advanced.md"
\`\`\`
    `;

    const basicExpressions = `
\`\`\`rpg expression
id: modifier
params: [score]
formula: "{{floor (divide (subtract score 10) 2)}}"
\`\`\`
    `;

    const advancedExpressions = `
\`\`\`rpg expression
id: saving_throw
params: [modifier, proficient, proficiency_bonus]
formula: "{{add modifier (if proficient proficiency_bonus 0)}}"
\`\`\`

\`\`\`rpg expression
id: attack_bonus
params: [modifier, proficient, proficiency_bonus]
formula: "{{add modifier (if proficient proficiency_bonus 0)}}"
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "expressions/basic.md") return basicExpressions;
      if (path === "expressions/advanced.md") return advancedExpressions;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.expressions.size).toBe(3);
    expect(system?.expressions.has("modifier")).toBe(true);
    expect(system?.expressions.has("saving_throw")).toBe(true);
    expect(system?.expressions.has("attack_bonus")).toBe(true);
  });

  it("should support backward compatibility with inline skill-list blocks", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Inline Skills"
attributes: [strength, dexterity]
\`\`\`

\`\`\`rpg skill-list
skills:
  - label: "Acrobatics"
    attribute: dexterity
  - label: "Athletics"
    attribute: strength
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(2);
    expect(system?.skills[0].label).toBe("Acrobatics");
  });

  it("should support backward compatibility with inline expression blocks", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Inline Expressions"
attributes: [strength]
\`\`\`

\`\`\`rpg expression
id: modifier
params: [score]
formula: "{{floor (divide (subtract score 10) 2)}}"
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.expressions.size).toBe(1);
    expect(system?.expressions.has("modifier")).toBe(true);
  });

  it("should use defaults when external file cannot be loaded", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Missing File"
attributes: [strength]
features: "missing-file.md"
\`\`\`
    `;

    const fileLoader: FileLoader = async () => null;

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.features).toEqual({
      categories: [],
      providers: [],
      collectors: [],
    });
  });
});
