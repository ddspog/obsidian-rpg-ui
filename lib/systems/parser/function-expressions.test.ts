/**
 * Tests for function expression parser
 */

import { describe, it, expect } from "vitest";
import {
  parseFunctionBlock,
  compileFunctionExpressions,
  parseFunctionExpressions,
  isFunctionExpressionBlock,
} from "./function-expressions";

describe("isFunctionExpressionBlock", () => {
  it("should detect function declarations", () => {
    expect(isFunctionExpressionBlock("function PB(this) { return 1; }")).toBe(true);
  });

  it("should detect async function declarations", () => {
    expect(isFunctionExpressionBlock("async function Check(ability) { return 1; }")).toBe(true);
  });

  it("should not detect YAML content", () => {
    expect(isFunctionExpressionBlock("id: modifier\nparams: [score]\nformula: \"{{score}}\"")).toBe(false);
  });

  it("should not detect plain text", () => {
    expect(isFunctionExpressionBlock("some random text")).toBe(false);
  });

  it("should detect functions that start after whitespace", () => {
    expect(isFunctionExpressionBlock("\n\nfunction Foo() { return 1; }")).toBe(true);
  });
});

describe("parseFunctionBlock", () => {
  it("should parse a simple function", () => {
    const source = `function PB(this) {
  return 2 + Math.floor((this.level - 1) / 4);
}`;
    const result = parseFunctionBlock(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("PB");
    expect(result[0].params).toEqual([]);
    expect(result[0].usesContext).toBe(true);
    expect(result[0].isAsync).toBe(false);
    expect(result[0].body).toContain("Math.floor");
  });

  it("should parse function with this and additional params", () => {
    const source = `function Modifier(this, ability) {
  return Math.floor((this[ability] - 10) / 2);
}`;
    const result = parseFunctionBlock(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Modifier");
    expect(result[0].params).toEqual(["ability"]);
    expect(result[0].usesContext).toBe(true);
  });

  it("should parse function without this context", () => {
    const source = `function Modifier(ability) {
  return AttributeMod(ability) + ProficiencyMod(ability);
}`;
    const result = parseFunctionBlock(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Modifier");
    expect(result[0].params).toEqual(["ability"]);
    expect(result[0].usesContext).toBe(false);
  });

  it("should parse async functions", () => {
    const source = `async function Check(ability) {
  return await D20() + Modifier(ability);
}`;
    const result = parseFunctionBlock(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Check");
    expect(result[0].params).toEqual(["ability"]);
    expect(result[0].isAsync).toBe(true);
  });

  it("should parse multiple functions", () => {
    const source = `function PB(this) {
  return 2 + Math.floor((this.level - 1) / 4);
}

function Modifier(this, ability) {
  return Math.floor((this[ability] - 10) / 2);
}

async function Check(ability) {
  return await D20() + Modifier(ability);
}`;
    const result = parseFunctionBlock(source);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("PB");
    expect(result[1].name).toBe("Modifier");
    expect(result[2].name).toBe("Check");
  });

  it("should handle nested braces in function body", () => {
    const source = `function ProficiencyMod(this, ability) {
  if (ability in this.attributes) {
    if (ability in this.saves) {
      return this.saves[ability] * PB();
    }
  }
  return 0;
}`;
    const result = parseFunctionBlock(source);
    expect(result).toHaveLength(1);
    expect(result[0].body).toContain("if (ability in this.attributes)");
    expect(result[0].body).toContain("return 0;");
  });

  it("should handle string literals with braces", () => {
    const source = `function Test() {
  const msg = "hello { world }";
  return msg;
}`;
    const result = parseFunctionBlock(source);
    expect(result).toHaveLength(1);
    expect(result[0].body).toContain('"hello { world }"');
  });

  it("should handle no parameters", () => {
    const source = `function GetValue() {
  return 42;
}`;
    const result = parseFunctionBlock(source);
    expect(result).toHaveLength(1);
    expect(result[0].params).toEqual([]);
    expect(result[0].usesContext).toBe(false);
  });
});

describe("compileFunctionExpressions", () => {
  it("should compile a simple context-based function", () => {
    const functions = parseFunctionBlock(`function PB(this) {
  return 2 + Math.floor((this.level - 1) / 4);
}`);

    const expressions = compileFunctionExpressions(functions);
    expect(expressions.size).toBe(1);

    const pb = expressions.get("PB");
    expect(pb).toBeDefined();
    expect(pb?.id).toBe("PB");

    // Level 1 → PB = 2 + floor(0/4) = 2
    expect(pb?.evaluate({ level: 1 })).toBe(2);
    // Level 5 → PB = 2 + floor(4/4) = 3
    expect(pb?.evaluate({ level: 5 })).toBe(3);
    // Level 9 → PB = 2 + floor(8/4) = 4
    expect(pb?.evaluate({ level: 9 })).toBe(4);
  });

  it("should compile functions that call each other", () => {
    const functions = parseFunctionBlock(`function BaseValue(this) {
  return this.score;
}

function Modifier() {
  return BaseValue() - 10;
}`);

    const expressions = compileFunctionExpressions(functions);
    const modifier = expressions.get("Modifier");
    expect(modifier).toBeDefined();

    // score = 16 → BaseValue = 16 → Modifier = 6
    expect(modifier?.evaluate({ score: 16 })).toBe(6);
  });

  it("should compile functions with parameters", () => {
    const functions = parseFunctionBlock(`function AttributeMod(this, ability) {
  return Math.floor((this[ability] - 10) / 2);
}`);

    const expressions = compileFunctionExpressions(functions);
    const attrMod = expressions.get("AttributeMod");
    expect(attrMod).toBeDefined();

    // strength = 16 → floor((16-10)/2) = 3
    expect(attrMod?.evaluate({ ability: "strength", strength: 16 })).toBe(3);
    // dexterity = 8 → floor((8-10)/2) = -1
    expect(attrMod?.evaluate({ ability: "dexterity", dexterity: 8 })).toBe(-1);
  });

  it("should support helpers injection", () => {
    const functions = parseFunctionBlock(`function Roll() {
  return D20();
}`);

    const helpers = {
      D20: () => 15,
    };

    const expressions = compileFunctionExpressions(functions, helpers);
    const roll = expressions.get("Roll");
    expect(roll).toBeDefined();
    expect(roll?.evaluate({})).toBe(15);
  });

  it("should compile the full user example", () => {
    const source = `function PB(this) {
  return 2 + Math.floor((this.level - 1) / 4);
}

function ProficiencyMod(this, ability) {
  if (ability in this.attributes) {
    if (ability in this.saves) {
      return this.saves[ability] * PB();
    }
  } else {
    if (ability in this.proficiencies) {
      return this.proficiencies[ability] * PB();
    }
  }
  return 0;
}

function AttributeMod(this, ability) {
  if (ability in this.system.skills) {
    const attr = this.system.skills[ability].attribute;
    return Math.floor((this[attr] - 10) / 2);
  }
  if (ability in this.system.attributes) {
    return Math.floor((this[ability] - 10) / 2);
  }

  return 0;
}

function Modifier(ability) {
  return AttributeMod(ability) + ProficiencyMod(ability);
}

function Passive(ability, vantage) {
  return 10 + vantage + Modifier(ability);
}`;

    const functions = parseFunctionBlock(source);
    expect(functions).toHaveLength(5);

    const expressions = compileFunctionExpressions(functions);
    expect(expressions.size).toBe(5);

    // Create a context simulating a D&D character
    const context = {
      level: 5,
      strength: 16,
      dexterity: 14,
      attributes: {
        strength: true,
        dexterity: true,
      },
      saves: {
        strength: 1, // proficient in STR saves
      },
      proficiencies: {
        athletics: 1, // proficient in athletics
        acrobatics: 0, // not proficient
      },
      system: {
        skills: {
          athletics: { attribute: "strength" },
          acrobatics: { attribute: "dexterity" },
        },
        attributes: {
          strength: true,
          dexterity: true,
        },
      },
    };

    // PB at level 5 = 2 + floor(4/4) = 3
    const pb = expressions.get("PB");
    expect(pb?.evaluate(context)).toBe(3);

    // AttributeMod for strength = floor((16-10)/2) = 3
    const attrMod = expressions.get("AttributeMod");
    expect(attrMod?.evaluate({ ...context, ability: "strength" })).toBe(3);

    // AttributeMod for athletics (skill → looks up strength) = 3
    expect(attrMod?.evaluate({ ...context, ability: "athletics" })).toBe(3);

    // ProficiencyMod for strength (attribute, proficient in saves) = 1 * 3 = 3
    const profMod = expressions.get("ProficiencyMod");
    expect(profMod?.evaluate({ ...context, ability: "strength" })).toBe(3);

    // ProficiencyMod for athletics (skill, proficient) = 1 * 3 = 3
    expect(profMod?.evaluate({ ...context, ability: "athletics" })).toBe(3);

    // ProficiencyMod for acrobatics (skill, not proficient) = 0 * 3 = 0
    expect(profMod?.evaluate({ ...context, ability: "acrobatics" })).toBe(0);

    // Modifier for strength = AttributeMod(3) + ProficiencyMod(3) = 6
    const modifier = expressions.get("Modifier");
    expect(modifier?.evaluate({ ...context, ability: "strength" })).toBe(6);

    // Passive for strength with no advantage = 10 + 0 + 6 = 16
    const passive = expressions.get("Passive");
    expect(passive?.evaluate({ ...context, ability: "strength", vantage: 0 })).toBe(16);

    // Passive for acrobatics (dex 14 → mod 2, no prof → 0) = 10 + 0 + 2 = 12
    expect(passive?.evaluate({ ...context, ability: "acrobatics", vantage: 0 })).toBe(12);
  });

  it("should handle compilation errors gracefully", () => {
    const functions = [{
      name: "Bad",
      params: [],
      usesContext: false,
      isAsync: false,
      body: "return }{;", // Invalid JS
    }];

    const expressions = compileFunctionExpressions(functions);
    // Should return empty map on compilation failure
    expect(expressions.size).toBe(0);
  });

  it("should handle evaluation errors gracefully", () => {
    const functions = parseFunctionBlock(`function Boom() {
  throw new Error("explosion");
}`);

    const expressions = compileFunctionExpressions(functions);
    const boom = expressions.get("Boom");
    expect(boom).toBeDefined();

    // Should return 0 on error
    expect(boom?.evaluate({})).toBe(0);
  });

  it("should set isAsync flag on expression def", () => {
    const functions = parseFunctionBlock(`async function AsyncFn() {
  return 42;
}

function SyncFn() {
  return 42;
}`);

    const expressions = compileFunctionExpressions(functions);
    expect(expressions.get("AsyncFn")?.isAsync).toBe(true);
    expect(expressions.get("SyncFn")?.isAsync).toBeUndefined();
  });

  it("should set body on expression def", () => {
    const functions = parseFunctionBlock(`function Simple() {
  return 42;
}`);

    const expressions = compileFunctionExpressions(functions);
    expect(expressions.get("Simple")?.body).toContain("return 42;");
  });

  it("should generate readable formula display", () => {
    const functions = parseFunctionBlock(`function PB(this) {
  return 2;
}

function Modifier(this, ability) {
  return 1;
}

async function Check(ability) {
  return 1;
}`);

    const expressions = compileFunctionExpressions(functions);
    expect(expressions.get("PB")?.formula).toBe("function PB(this) { ... }");
    expect(expressions.get("Modifier")?.formula).toBe("function Modifier(this, ability) { ... }");
    expect(expressions.get("Check")?.formula).toBe("async function Check(ability) { ... }");
  });
});

describe("parseFunctionExpressions (integration)", () => {
  it("should parse and compile in one call", () => {
    const source = `function Double(this) {
  return this.value * 2;
}`;

    const expressions = parseFunctionExpressions(source);
    expect(expressions.size).toBe(1);
    expect(expressions.get("Double")?.evaluate({ value: 5 })).toBe(10);
  });

  it("should work with system parser when block is JS", () => {
    // This tests that isFunctionExpressionBlock + parseFunctionExpressions
    // produces the same ExpressionDef interface as YAML parsing
    const source = `function Modifier(this, ability) {
  return Math.floor((this[ability] - 10) / 2);
}`;

    const expressions = parseFunctionExpressions(source);
    const mod = expressions.get("Modifier");
    expect(mod).toBeDefined();
    expect(mod?.id).toBe("Modifier");
    expect(mod?.params).toEqual(["ability"]);
    expect(typeof mod?.evaluate).toBe("function");

    // Verify it works like the D&D 5e modifier expression
    expect(mod?.evaluate({ ability: "strength", strength: 10 })).toBe(0);
    expect(mod?.evaluate({ ability: "strength", strength: 16 })).toBe(3);
    expect(mod?.evaluate({ ability: "strength", strength: 8 })).toBe(-1);
  });
});
