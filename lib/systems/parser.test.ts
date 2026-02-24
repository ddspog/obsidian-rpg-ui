import { describe, it, expect, vi } from "vitest";
import {
  parseAttributeBlocks,
  parseSkillBlocks,
  parseExpressionBlocks,
  parseConditionBlocks,
  parseMarkdownSystemFile,
  loadMarkdownSystem,
} from "./parser";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ATTRIBUTES_BLOCK = `
\`\`\`rpg system.attributes
- name: strength
  alias: STR
  subtitle: "Associated Skills: Athletics"
  description: "Strength measures bodily power."
- name: dexterity
  alias: DEX
  subtitle: "Associated Skills: Acrobatics, Sleight of Hand, Stealth"
\`\`\`
`;

const SKILLS_BLOCK = `
\`\`\`rpg system.skills
- label: "Acrobatics"
  attribute: dexterity
- label: "Athletics"
  attribute: strength
- label: "Stealth"
  attribute: dexterity
\`\`\`
`;

const EXPRESSIONS_BLOCK = `
\`\`\`rpg system.expressions
- id: modifier
  params: [score]
  formula: "{{floor (divide (subtract score 10) 2)}}"
- id: proficiency_bonus
  params: [level]
  formula: "{{add 2 (floor (divide (subtract level 1) 4))}}"
\`\`\`
`;

const CONDITIONS_BLOCK = `
\`\`\`rpg system.conditions
- name: Blinded
  icon: "🙈"
  description: "Can't see. Auto-fails sight checks."
- name: Poisoned
  icon: "🤢"
  description: "Disadvantage on attack rolls and ability checks."
\`\`\`
`;

const INLINE_SYSTEM_BLOCK = `
\`\`\`rpg system
name: "Test System"
attributes:
  - strength
  - dexterity
  - constitution
\`\`\`
`;

const SPLIT_SYSTEM_BLOCK = `
\`\`\`rpg system
name: "D&D 5e Split"
attributes:
  - strength
  - dexterity
skills: "systems/dnd5e/skills.md"
expressions:
  - "systems/dnd5e/core-expressions.md"
  - "systems/dnd5e/combat-expressions.md"
conditions: "systems/dnd5e/conditions.md"
\`\`\`
`;

// ─── parseAttributeBlocks ────────────────────────────────────────────────────

describe("parseAttributeBlocks", () => {
  it("should parse attributes from rpg system.attributes block", () => {
    const result = parseAttributeBlocks(ATTRIBUTES_BLOCK);
    expect(result).toHaveLength(2);
    expect(result[0].$name).toBe("strength");
    expect(result[0].alias).toBe("STR");
    expect(result[0].subtitle).toBe("Associated Skills: Athletics");
    expect(result[0].$contents).toBe("Strength measures bodily power.");
  });

  it("should normalise $name key variant", () => {
    const content = `\`\`\`rpg system.attributes\n- $name: wisdom\n  alias: WIS\n\`\`\``;
    const result = parseAttributeBlocks(content);
    expect(result[0].$name).toBe("wisdom");
  });

  it("should return empty array when no attribute blocks found", () => {
    const result = parseAttributeBlocks("No blocks here");
    expect(result).toEqual([]);
  });

  it("should handle multiple attribute blocks", () => {
    const content = ATTRIBUTES_BLOCK + "\n" + `\`\`\`rpg system.attributes\n- name: constitution\n  alias: CON\n\`\`\``;
    const result = parseAttributeBlocks(content);
    expect(result).toHaveLength(3);
  });

  it("should preserve extra properties", () => {
    const content = `\`\`\`rpg system.attributes\n- name: strength\n  alias: STR\n  measures: "Physical might"\n\`\`\``;
    const result = parseAttributeBlocks(content);
    expect((result[0] as any).measures).toBe("Physical might");
  });
});

// ─── parseSkillBlocks ─────────────────────────────────────────────────────────

describe("parseSkillBlocks", () => {
  it("should parse skills using label key", () => {
    const result = parseSkillBlocks(SKILLS_BLOCK);
    expect(result).toHaveLength(3);
    expect(result[0].$name).toBe("Acrobatics");
    expect(result[0].attribute).toBe("dexterity");
  });

  it("should normalise $name key variant", () => {
    const content = `\`\`\`rpg system.skills\n- $name: Stealth\n  attribute: dexterity\n\`\`\``;
    const result = parseSkillBlocks(content);
    expect(result[0].$name).toBe("Stealth");
  });

  it("should normalise name key variant", () => {
    const content = `\`\`\`rpg system.skills\n- name: Athletics\n  attribute: strength\n\`\`\``;
    const result = parseSkillBlocks(content);
    expect(result[0].$name).toBe("Athletics");
  });

  it("should return empty array when no skill blocks found", () => {
    expect(parseSkillBlocks("No blocks here")).toEqual([]);
  });
});

// ─── parseExpressionBlocks ────────────────────────────────────────────────────

describe("parseExpressionBlocks", () => {
  it("should parse expressions and expose id, params, formula", () => {
    const result = parseExpressionBlocks(EXPRESSIONS_BLOCK);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("modifier");
    expect(result[0].params).toEqual(["score"]);
    expect(result[0].formula).toContain("floor");
  });

  it("should compile formulas into working evaluate functions", () => {
    const result = parseExpressionBlocks(EXPRESSIONS_BLOCK);
    const modifierExpr = result.find((e) => e.id === "modifier")!;
    expect(modifierExpr).toBeDefined();
    // floor((10 - 10) / 2) = 0
    expect(modifierExpr.evaluate({ score: 10 })).toBe(0);
    // floor((16 - 10) / 2) = 3
    expect(modifierExpr.evaluate({ score: 16 })).toBe(3);
    // floor((8 - 10) / 2) = -1
    expect(modifierExpr.evaluate({ score: 8 })).toBe(-1);
  });

  it("should evaluate proficiency_bonus correctly", () => {
    const result = parseExpressionBlocks(EXPRESSIONS_BLOCK);
    const pbExpr = result.find((e) => e.id === "proficiency_bonus")!;
    expect(pbExpr.evaluate({ level: 1 })).toBe(2);
    expect(pbExpr.evaluate({ level: 5 })).toBe(3);
    expect(pbExpr.evaluate({ level: 9 })).toBe(4);
  });

  it("should return empty array when no expression blocks found", () => {
    expect(parseExpressionBlocks("No blocks here")).toEqual([]);
  });

  it("should skip items missing id or formula", () => {
    const content = `\`\`\`rpg system.expressions\n- id: noFormula\n- formula: "{{score}}"\n\`\`\``;
    const result = parseExpressionBlocks(content);
    expect(result).toHaveLength(0);
  });

  it("should handle empty params array", () => {
    const content = `\`\`\`rpg system.expressions\n- id: simple\n  formula: "42"\n\`\`\``;
    const result = parseExpressionBlocks(content);
    expect(result[0].params).toEqual([]);
    expect(result[0].evaluate({})).toBe(42);
  });
});

// ─── parseConditionBlocks ─────────────────────────────────────────────────────

describe("parseConditionBlocks", () => {
  it("should parse conditions with name, icon, description", () => {
    const result = parseConditionBlocks(CONDITIONS_BLOCK);
    expect(result).toHaveLength(2);
    expect(result[0].$name).toBe("Blinded");
    expect(result[0].icon).toBe("🙈");
    expect(result[0].$contents).toBe("Can't see. Auto-fails sight checks.");
  });

  it("should normalise $name and $contents key variants", () => {
    const content = `\`\`\`rpg system.conditions\n- $name: Stunned\n  $contents: "Incapacitated."\n\`\`\``;
    const result = parseConditionBlocks(content);
    expect(result[0].$name).toBe("Stunned");
    expect(result[0].$contents).toBe("Incapacitated.");
  });

  it("should return empty array when no condition blocks found", () => {
    expect(parseConditionBlocks("No blocks here")).toEqual([]);
  });
});

// ─── parseMarkdownSystemFile ──────────────────────────────────────────────────

describe("parseMarkdownSystemFile", () => {
  it("should return null when no rpg system block found", () => {
    expect(parseMarkdownSystemFile("No blocks here")).toBeNull();
  });

  it("should return null when system block has no name", () => {
    const content = `\`\`\`rpg system\nversion: "1.0"\n\`\`\``;
    expect(parseMarkdownSystemFile(content)).toBeNull();
  });

  it("should parse inline attribute strings from system block", () => {
    const result = parseMarkdownSystemFile(INLINE_SYSTEM_BLOCK);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Test System");
    expect(result!.attributes).toHaveLength(3);
    expect(result!.attributes[0].$name).toBe("strength");
  });

  it("should prefer rpg system.attributes blocks over inline attribute list", () => {
    const content = INLINE_SYSTEM_BLOCK + "\n" + ATTRIBUTES_BLOCK;
    const result = parseMarkdownSystemFile(content);
    expect(result).not.toBeNull();
    // ATTRIBUTES_BLOCK has 2 attributes; the inline system block has 3
    expect(result!.attributes).toHaveLength(2);
    expect(result!.attributes[0].alias).toBe("STR");
  });

  it("should parse inline skill blocks", () => {
    const content = INLINE_SYSTEM_BLOCK + "\n" + SKILLS_BLOCK;
    const result = parseMarkdownSystemFile(content);
    expect(result!.skills).toHaveLength(3);
  });

  it("should parse inline expression blocks", () => {
    const content = INLINE_SYSTEM_BLOCK + "\n" + EXPRESSIONS_BLOCK;
    const result = parseMarkdownSystemFile(content);
    expect(result!.expressions).toHaveLength(2);
  });

  it("should parse inline condition blocks", () => {
    const content = INLINE_SYSTEM_BLOCK + "\n" + CONDITIONS_BLOCK;
    const result = parseMarkdownSystemFile(content);
    expect(result!.conditions).toHaveLength(2);
  });

  it("should collect external file references from split system block", () => {
    const result = parseMarkdownSystemFile(SPLIT_SYSTEM_BLOCK);
    expect(result).not.toBeNull();
    expect(result!.refs.skills).toEqual(["systems/dnd5e/skills.md"]);
    expect(result!.refs.expressions).toEqual([
      "systems/dnd5e/core-expressions.md",
      "systems/dnd5e/combat-expressions.md",
    ]);
    expect(result!.refs.conditions).toEqual(["systems/dnd5e/conditions.md"]);
  });

  it("should have empty refs when nothing is external", () => {
    const result = parseMarkdownSystemFile(INLINE_SYSTEM_BLOCK);
    expect(result!.refs.skills).toBeUndefined();
    expect(result!.refs.expressions).toBeUndefined();
    expect(result!.refs.conditions).toBeUndefined();
  });
});

// ─── loadMarkdownSystem ───────────────────────────────────────────────────────

describe("loadMarkdownSystem", () => {
  it("should return null when content has no valid system block", async () => {
    const readFile = vi.fn().mockResolvedValue(null);
    const result = await loadMarkdownSystem("No blocks here", readFile);
    expect(result).toBeNull();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("should build an RPGSystem from a fully inline markdown file", async () => {
    const content = INLINE_SYSTEM_BLOCK + "\n" + SKILLS_BLOCK + "\n" + CONDITIONS_BLOCK;
    const readFile = vi.fn().mockResolvedValue(null);
    const system = await loadMarkdownSystem(content, readFile);
    expect(system).not.toBeNull();
    expect(system!.name).toBe("Test System");
    expect(system!.attributes).toHaveLength(3);
    expect(system!.skills).toHaveLength(3);
    expect(system!.conditions).toHaveLength(2);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("should inject parsed expressions into the system", async () => {
    const content = INLINE_SYSTEM_BLOCK + "\n" + EXPRESSIONS_BLOCK;
    const system = await loadMarkdownSystem(content, vi.fn());
    expect(system!.expressions.has("modifier")).toBe(true);
    const expr = system!.expressions.get("modifier")!;
    expect(expr.evaluate({ score: 10 })).toBe(0);
    expect(expr.evaluate({ score: 16 })).toBe(3);
  });

  it("should resolve external skill file references", async () => {
    const readFile = vi.fn().mockImplementation(async (path: string) => {
      if (path === "systems/dnd5e/skills.md") return SKILLS_BLOCK;
      return null;
    });
    const system = await loadMarkdownSystem(SPLIT_SYSTEM_BLOCK, readFile);
    expect(system).not.toBeNull();
    expect(system!.skills).toHaveLength(3);
    expect(readFile).toHaveBeenCalledWith("systems/dnd5e/skills.md");
  });

  it("should resolve multiple external expression files", async () => {
    const readFile = vi.fn().mockImplementation(async (path: string) => {
      if (path.includes("expressions")) return EXPRESSIONS_BLOCK;
      return null;
    });
    const system = await loadMarkdownSystem(SPLIT_SYSTEM_BLOCK, readFile);
    // Two expression files each with 2 expressions = 4 total (deduplicated by Map key)
    expect(system!.expressions.size).toBeGreaterThanOrEqual(2);
  });

  it("should resolve external condition file references", async () => {
    const readFile = vi.fn().mockImplementation(async (path: string) => {
      if (path.includes("conditions")) return CONDITIONS_BLOCK;
      return null;
    });
    const system = await loadMarkdownSystem(SPLIT_SYSTEM_BLOCK, readFile);
    expect(system!.conditions).toHaveLength(2);
    expect(system!.conditions[0].$name).toBe("Blinded");
  });

  it("should handle readFile returning null gracefully", async () => {
    const readFile = vi.fn().mockResolvedValue(null);
    const system = await loadMarkdownSystem(SPLIT_SYSTEM_BLOCK, readFile);
    expect(system).not.toBeNull();
    expect(system!.skills).toHaveLength(0);
    expect(system!.conditions).toHaveLength(0);
  });
});
