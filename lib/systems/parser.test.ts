/**
 * Tests for system markdown parser
 */

import { describe, it, expect } from "vitest";
import { parseSystemFromMarkdown, FileLoader, FolderLister } from "./parser/index";

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
\`\`\`rpg system.features
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
\`\`\`rpg system.spellcasting
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

  it("should load spellcasting from wikilink reference [[path]]", async () => {
    // In YAML, [[07. Spellcasting]] is parsed as [["07. Spellcasting"]]
    const markdown = `
\`\`\`rpg system
name: "System with Wikilink Spellcasting"
attributes: [intelligence]
spellcasting: [[07. Spellcasting]]
\`\`\`
    `;

    const spellsFile = `
\`\`\`rpg system.spellcasting
circles:
  - id: cantrip
    label: Cantrip
providers: [class]
collectors: [character]
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "07. Spellcasting") return spellsFile;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.spellcasting.circles).toHaveLength(1);
    expect(system?.spellcasting.circles[0].id).toBe("cantrip");
    expect(system?.spellcasting.providers).toEqual(["class"]);
  });

  it("should load attributes from wikilink reference [[path]]", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Wikilink Attributes"
attributes: [[Ability Modifier]]
\`\`\`
    `;

    const attributesFile = `
\`\`\`rpg system.attributes
- name: strength
  alias: STR
- name: dexterity
  alias: DEX
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "Ability Modifier") return attributesFile;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.attributes).toEqual(["strength", "dexterity"]);
    expect(system?.attributeDefinitions).toHaveLength(2);
    expect(system?.attributeDefinitions?.[0].alias).toBe("STR");
  });

  it("should load features from wikilink reference [[path]]", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Wikilink Features"
features: [[Features Definition]]
\`\`\`
    `;

    const featuresFile = `
\`\`\`rpg system.features
categories:
  - id: action
    label: Action
    icon: ⚔️
providers: [class]
collectors: [character]
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "Features Definition") return featuresFile;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.features.categories).toHaveLength(1);
    expect(system?.features.categories[0].id).toBe("action");
    expect(system?.features.providers).toEqual(["class"]);
  });

  it("should parse inline features with traits", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Traits"
features:
  categories:
    - id: action
      label: Action
      icon: ⚔️
  traits:
    - id: hit-points
      label: Hit Points
      icon: 💔
    - id: save-proficiency
      label: Saves
      icon: 💾
  providers: [class, lineage]
  collectors: [character]
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.features.categories).toHaveLength(1);
    expect(system?.features.traits).toHaveLength(2);
    expect(system?.features.traits?.[0]).toEqual({
      id: "hit-points",
      label: "Hit Points",
      icon: "💔",
    });
    expect(system?.features.traits?.[1]).toEqual({
      id: "save-proficiency",
      label: "Saves",
      icon: "💾",
    });
    expect(system?.features.providers).toEqual(["class", "lineage"]);
    expect(system?.features.collectors).toEqual(["character"]);
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
\`\`\`rpg system.skills
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
\`\`\`rpg system.skills
- label: "Acrobatics"
  attribute: dexterity
- label: "Athletics"
  attribute: strength
\`\`\`
    `;

    const mentalSkills = `
\`\`\`rpg system.skills
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

  it("should parse inline wikilink-format system.skills block", async () => {
    const markdown = `
\`\`\`rpg system
name: "Wikilink Skills System"
attributes: [strength, dexterity]
\`\`\`

\`\`\`rpg system.skills
- [[Acrobatics]]
- [[Athletics]]
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(2);
    expect(system?.skills[0].name).toBe("Acrobatics");
    expect(system?.skills[1].name).toBe("Athletics");
    // attribute is empty when no fileLoader is present
    expect(system?.skills[0].attribute).toBe("");
  });

  it("should load wikilink skills from external file and resolve attribute/description from linked notes", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Wikilink Skills"
attributes: [strength, dexterity]
skills: "skills/dnd5e-skills.md"
\`\`\`
    `;

    const skillsIndexFile = `
\`\`\`rpg system.skills
- [[skills/Acrobatics]]
- [[skills/Athletics]]
\`\`\`
    `;

    const acrobaticsNote = `---
attribute: dexterity
---
Your ability to stay on your feet and maintain balance.
`;

    const athleticsNote = `---
attribute: strength
---
Covers difficult situations you encounter while climbing, jumping, or swimming.
`;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "skills/dnd5e-skills.md") return skillsIndexFile;
      if (path === "skills/Acrobatics.md") return acrobaticsNote;
      if (path === "skills/Athletics.md") return athleticsNote;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(2);

    const acrobatics = system?.skills[0];
    expect(acrobatics?.name).toBe("Acrobatics");
    expect(acrobatics?.attribute).toBe("dexterity");
    expect(acrobatics?.description).toContain("stay on your feet");

    const athletics = system?.skills[1];
    expect(athletics?.name).toBe("Athletics");
    expect(athletics?.attribute).toBe("strength");
    expect(athletics?.description).toContain("climbing");
  });

  it("should parse wikilink-format system.skills block wrapped in skills: key", async () => {
    const markdown = `
\`\`\`rpg system
name: "Wrapped Wikilink Skills System"
attributes: [strength, dexterity]
\`\`\`

\`\`\`rpg system.skills
skills:
  - [[Acrobatics]]
  - [[Athletics]]
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(2);
    expect(system?.skills[0].name).toBe("Acrobatics");
    expect(system?.skills[1].name).toBe("Athletics");
    expect(system?.skills[0].attribute).toBe("");
  });

  it("should parse all 18 wikilink skills with skills: key wrapper", async () => {
    const markdown = `
\`\`\`rpg system
name: "Full DnD5e Wikilink Skills"
attributes: [strength, dexterity, constitution, intelligence, wisdom, charisma]
\`\`\`

\`\`\`rpg system.skills
skills:
  - [[Acrobatics]]
  - [[Animal Handling]]
  - [[Arcana]]
  - [[Athletics]]
  - [[Deception]]
  - [[History]]
  - [[Insight]]
  - [[Intimidation]]
  - [[Investigation]]
  - [[Medicine]]
  - [[Nature]]
  - [[Perception]]
  - [[Performance]]
  - [[Persuasion]]
  - [[Religion]]
  - [[Sleight of Hand]]
  - [[Stealth]]
  - [[Survival]]
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(18);
    expect(system?.skills.map((s) => s.name)).toEqual([
      "Acrobatics", "Animal Handling", "Arcana", "Athletics",
      "Deception", "History", "Insight", "Intimidation",
      "Investigation", "Medicine", "Nature", "Perception",
      "Performance", "Persuasion", "Religion", "Sleight of Hand",
      "Stealth", "Survival",
    ]);
  });

  it("should support wikilink display-name alias in skills block", async () => {
    const markdown = `
\`\`\`rpg system
name: "Alias Skills System"
attributes: [dexterity]
\`\`\`

\`\`\`rpg system.skills
- [[skills/acrobatics|Acrobatics]]
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(1);
    expect(system?.skills[0].name).toBe("Acrobatics");
  });

  it("should load individual skill note files deriving name from filename", async () => {
    // Each path in the skills array points directly to a skill note file – no
    // rpg system.skills block inside it.  Name comes from the filename.
    const markdown = `
\`\`\`rpg system
name: "Individual Skill Notes"
attributes: [strength, dexterity]
skills:
  - "skills/Acrobatics.md"
  - "skills/Athletics.md"
\`\`\`
    `;

    const acrobaticsNote = `---
attribute: dexterity
subtitle: "Associated Ability: DEX"
---
Your ability to stay on your feet in a tricky situation.
`;

    const athleticsNote = `---
attribute: strength
---
Covers difficult situations you encounter while climbing, jumping, or swimming.
`;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "skills/Acrobatics.md") return acrobaticsNote;
      if (path === "skills/Athletics.md") return athleticsNote;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(2);

    const acrobatics = system?.skills[0];
    expect(acrobatics?.name).toBe("Acrobatics");
    expect(acrobatics?.attribute).toBe("dexterity");
    expect(acrobatics?.subtitle).toBe("Associated Ability: DEX");
    expect(acrobatics?.description).toContain("stay on your feet");

    const athletics = system?.skills[1];
    expect(athletics?.name).toBe("Athletics");
    expect(athletics?.attribute).toBe("strength");
    expect(athletics?.description).toContain("climbing");
  });

  it("should derive skill name from filename without .md extension", async () => {
    const markdown = `
\`\`\`rpg system
name: "Name From Filename Test"
attributes: [wisdom]
skills:
  - "skills/Perception.md"
\`\`\`
    `;

    const note = `---
attribute: wisdom
---
Lets you spot, hear, or otherwise detect the presence of something.
`;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "skills/Perception.md") return note;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(1);
    expect(system?.skills[0].name).toBe("Perception");
    expect(system?.skills[0].attribute).toBe("wisdom");
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
\`\`\`rpg system.expressions
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

  it("should parse inline conditions as array of objects", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Conditions"
attributes: [strength]
conditions:
  - name: Blinded
    icon: "🙈"
    description: "A blinded creature can't see."
  - name: Charmed
    icon: "💖"
    description: "A charmed creature can't attack the charmer."
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.conditions.conditions).toHaveLength(2);
    expect(system?.conditions.conditions[0].name).toBe("Blinded");
    expect(system?.conditions.conditions[0].icon).toBe("🙈");
    expect(system?.conditions.conditions[0].description).toBe("A blinded creature can't see.");
    expect(system?.conditions.conditions[1].name).toBe("Charmed");
  });

  it("should parse conditions from external file", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with External Conditions"
attributes: [strength]
conditions: "conditions.md"
\`\`\`
    `;

    const conditionsFile = `
# Conditions

\`\`\`rpg system.conditions
- name: Poisoned
  icon: "🤢"
  description: "A poisoned creature has disadvantage on attack rolls."
- name: Prone
  icon: "🛌"
  description: "A prone creature's only movement option is to crawl."
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "conditions.md") return conditionsFile;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.conditions.conditions).toHaveLength(2);
    expect(system?.conditions.conditions[0].name).toBe("Poisoned");
    expect(system?.conditions.conditions[1].name).toBe("Prone");
  });

  it("should parse conditions with wikilink list format from external file", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Wikilink Conditions"
attributes: [strength]
conditions: "conditions.md"
\`\`\`
    `;

    const conditionsFile = `
# Conditions

\`\`\`rpg system.conditions
- [[Blinded]]
- [[Charmed]]
- [[conditions/Poisoned|Poisoned]]
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "conditions.md") return conditionsFile;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.conditions.conditions).toHaveLength(3);
    expect(system?.conditions.conditions[0].name).toBe("Blinded");
    expect(system?.conditions.conditions[1].name).toBe("Charmed");
    expect(system?.conditions.conditions[2].name).toBe("Poisoned");
  });

  it("should default to empty conditions when not specified", async () => {
    const markdown = `
\`\`\`rpg system
name: "System without Conditions"
attributes: [strength]
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.conditions).toEqual({ conditions: [] });
  });

  it("should use defaults when external conditions file cannot be loaded", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Missing Conditions"
attributes: [strength]
conditions: "missing-conditions.md"
\`\`\`
    `;

    const fileLoader: FileLoader = async () => null;

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.conditions).toEqual({ conditions: [] });
  });

  it("should parse conditions as simple string names in inline array", async () => {
    const markdown = `
\`\`\`rpg system
name: "System with Simple Conditions"
attributes: [strength]
conditions:
  - Blinded
  - Charmed
  - Poisoned
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.conditions.conditions).toHaveLength(3);
    expect(system?.conditions.conditions[0].name).toBe("Blinded");
    expect(system?.conditions.conditions[1].name).toBe("Charmed");
    expect(system?.conditions.conditions[2].name).toBe("Poisoned");
  });

  // ── Folder-based loading tests ─────────────────────────────────────────

  it("should load skills from a folder path", async () => {
    const markdown = `
\`\`\`rpg system
name: "Folder Skills System"
attributes: [strength, dexterity]
skills: "skills/"
\`\`\`
    `;

    const files: Record<string, string> = {
      "skills/Acrobatics.md": `---\nattribute: dexterity\nsubtitle: "DEX"\n---\nYour DEX check covers acrobatic stunts.`,
      "skills/Athletics.md": `---\nattribute: strength\nsubtitle: "STR"\n---\nYour STR check covers climbing and jumping.`,
    };

    const fileLoader: FileLoader = async (path) => files[path] ?? null;
    const folderLister: FolderLister = async (folder) => {
      if (folder === "skills/") return ["skills/Acrobatics.md", "skills/Athletics.md"];
      return [];
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader, folderLister);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(2);
    expect(system?.skills[0].name).toBe("Acrobatics");
    expect(system?.skills[0].attribute).toBe("dexterity");
    expect(system?.skills[0].description).toBe("Your DEX check covers acrobatic stunts.");
    expect(system?.skills[1].name).toBe("Athletics");
    expect(system?.skills[1].attribute).toBe("strength");
  });

  it("should load conditions from a folder path", async () => {
    const markdown = `
\`\`\`rpg system
name: "Folder Conditions System"
attributes: [strength]
conditions: "conditions/"
\`\`\`
    `;

    const files: Record<string, string> = {
      "conditions/Blinded.md": `\`\`\`rpg system.conditions\n- name: Blinded\n  icon: "🙈"\n  description: "Can't see."\n\`\`\``,
      "conditions/Poisoned.md": `\`\`\`rpg system.conditions\n- name: Poisoned\n  icon: "🤢"\n  description: "Disadvantage on attacks."\n\`\`\``,
    };

    const fileLoader: FileLoader = async (path) => files[path] ?? null;
    const folderLister: FolderLister = async (folder) => {
      if (folder === "conditions/") return ["conditions/Blinded.md", "conditions/Poisoned.md"];
      return [];
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader, folderLister);
    expect(system).not.toBeNull();
    expect(system?.conditions.conditions).toHaveLength(2);
    expect(system?.conditions.conditions[0].name).toBe("Blinded");
    expect(system?.conditions.conditions[1].name).toBe("Poisoned");
  });

  it("should load attributes from a folder path", async () => {
    const markdown = `
\`\`\`rpg system
name: "Folder Attributes System"
attributes: "attributes/"
\`\`\`
    `;

    const files: Record<string, string> = {
      "attributes/Strength.md": `---\nname: strength\nalias: STR\n---\nPhysical power and carrying capacity.`,
      "attributes/Dexterity.md": `---\nname: dexterity\nalias: DEX\n---\nAgility, reflexes, and balance.`,
    };

    const fileLoader: FileLoader = async (path) => files[path] ?? null;
    const folderLister: FolderLister = async (folder) => {
      if (folder === "attributes/") return ["attributes/Dexterity.md", "attributes/Strength.md"];
      return [];
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader, folderLister);
    expect(system).not.toBeNull();
    expect(system?.attributes).toHaveLength(2);
    expect(system?.attributes).toContain("strength");
    expect(system?.attributes).toContain("dexterity");
    expect(system?.attributeDefinitions).toHaveLength(2);
    const strDef = system?.attributeDefinitions?.find(d => d.name === "strength");
    expect(strDef?.alias).toBe("STR");
    expect(strDef?.description).toBe("Physical power and carrying capacity.");
  });

  it("should fall back to file loading when folder is empty", async () => {
    const markdown = `
\`\`\`rpg system
name: "Fallback System"
attributes: [strength]
skills: "skills.md"
\`\`\`
    `;

    const skillsFile = `\`\`\`rpg system.skills\n- name: Acrobatics\n  attribute: dexterity\n\`\`\``;

    const fileLoader: FileLoader = async (path) => {
      if (path === "skills.md") return skillsFile;
      return null;
    };
    const folderLister: FolderLister = async () => [];

    const system = await parseSystemFromMarkdown(markdown, fileLoader, folderLister);
    expect(system).not.toBeNull();
    expect(system?.skills).toHaveLength(1);
    expect(system?.skills[0].name).toBe("Acrobatics");
  });

  it("should parse JavaScript function expressions in rpg system.expressions blocks", async () => {
    const markdown = `
\`\`\`rpg system
name: "Custom JS Expressions System"
attributes: [strength, dexterity]
\`\`\`

\`\`\`rpg system.expressions
function PB(this) {
  return 2 + Math.floor((this.level - 1) / 4);
}

function AttributeMod(this, ability) {
  return Math.floor((this[ability] - 10) / 2);
}

function Modifier(ability) {
  return AttributeMod(ability) + PB();
}
\`\`\`
    `;

    const system = await parseSystemFromMarkdown(markdown);
    expect(system).not.toBeNull();
    expect(system?.expressions.size).toBe(3);
    expect(system?.expressions.has("PB")).toBe(true);
    expect(system?.expressions.has("AttributeMod")).toBe(true);
    expect(system?.expressions.has("Modifier")).toBe(true);

    // Test PB at level 5 → 2 + floor(4/4) = 3
    const pb = system?.expressions.get("PB");
    expect(pb?.evaluate({ level: 5 })).toBe(3);

    // Test AttributeMod for strength 16 → floor((16-10)/2) = 3
    const attrMod = system?.expressions.get("AttributeMod");
    expect(attrMod?.evaluate({ ability: "strength", strength: 16 })).toBe(3);

    // Test Modifier: AttributeMod(3) + PB(3) = 6
    const modifier = system?.expressions.get("Modifier");
    expect(modifier?.evaluate({ ability: "strength", strength: 16, level: 5 })).toBe(6);
  });

  it("should load JavaScript function expressions from external file", async () => {
    const markdown = `
\`\`\`rpg system
name: "External JS Expressions"
attributes: [strength]
expressions: "expressions/functions.md"
\`\`\`
    `;

    const expressionsFile = `
\`\`\`rpg system.expressions
function Modifier(this, ability) {
  return Math.floor((this[ability] - 10) / 2);
}
\`\`\`
    `;

    const fileLoader: FileLoader = async (path: string) => {
      if (path === "expressions/functions.md") return expressionsFile;
      return null;
    };

    const system = await parseSystemFromMarkdown(markdown, fileLoader);
    expect(system).not.toBeNull();
    expect(system?.expressions.size).toBe(1);
    expect(system?.expressions.has("Modifier")).toBe(true);

    const mod = system?.expressions.get("Modifier");
    expect(mod?.evaluate({ ability: "strength", strength: 14 })).toBe(2);
  });
});
