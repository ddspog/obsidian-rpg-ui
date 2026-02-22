import { describe, it, expect } from "vitest";
import { CreateSystem } from "./create-system";
import type { SystemConfig } from "./types";

describe("CreateSystem", () => {
  describe("validation", () => {
    it("should throw if name is missing", () => {
      expect(() =>
        CreateSystem({ name: "", attributes: ["strength"] }),
      ).toThrow("'name' is required");
    });

    it("should throw if attributes is empty", () => {
      expect(() =>
        CreateSystem({ name: "Test", attributes: [] }),
      ).toThrow("'attributes' is required");
    });

    it("should throw if attributes is not an array", () => {
      expect(() =>
        CreateSystem({ name: "Test", attributes: "strength" as any }),
      ).toThrow("'attributes' is required");
    });
  });

  describe("attribute normalization", () => {
    it("should normalize string attributes into AttributeDefinitions", () => {
      const system = CreateSystem({ name: "Test", attributes: ["strength", "dexterity"] });
      expect(system.attributes).toEqual(["strength", "dexterity"]);
    });

    it("should preserve full AttributeDefinition objects", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: [{ name: "strength", alias: "STR", subtitle: "Physical power" }],
      });
      expect(system.attributes).toEqual(["strength"]);
      expect(system.attributeDefinitions).toBeDefined();
      expect(system.attributeDefinitions![0].alias).toBe("STR");
    });

    it("should set attributeDefinitions to undefined when all attributes are plain strings", () => {
      const system = CreateSystem({ name: "Test", attributes: ["strength"] });
      expect(system.attributeDefinitions).toBeUndefined();
    });

    it("should include attributeDefinitions when any attribute has extra fields", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["strength", { name: "dexterity", alias: "DEX" }],
      });
      expect(system.attributeDefinitions).toHaveLength(2);
      expect(system.attributeDefinitions![0].name).toBe("strength");
      expect(system.attributeDefinitions![1].alias).toBe("DEX");
    });
  });

  describe("entity normalization", () => {
    it("should produce an empty entities record when none are specified", () => {
      const system = CreateSystem({ name: "Test", attributes: ["str"] });
      expect(system.entities).toEqual({});
    });

    it("should normalize string fields", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { fields: ["level", "name"] },
        },
      });
      expect(system.entities.character.frontmatter).toHaveLength(2);
      expect(system.entities.character.frontmatter[0]).toEqual({ name: "level", type: "string" });
    });

    it("should preserve full field definitions", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { fields: [{ name: "level", type: "number", default: 1 }] },
        },
      });
      expect(system.entities.character.frontmatter[0]).toMatchObject({
        name: "level",
        type: "number",
        default: 1,
      });
    });

    it("should include entity features", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { features: [{ name: "Dash", type: "action" }] },
        },
      });
      expect(system.entities.character.features).toHaveLength(1);
      expect(system.entities.character.features![0].name).toBe("Dash");
    });
  });

  describe("computed expressions", () => {
    it("should convert computed functions to ExpressionDef entries", () => {
      const modifier = (ctx: Record<string, unknown>) => {
        const score = Number(ctx.score) || 0;
        return Math.floor((score - 10) / 2);
      };

      const system = CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { computed: { modifier } },
        },
      });

      expect(system.expressions.has("modifier")).toBe(true);
      const expr = system.expressions.get("modifier")!;
      expect(expr.id).toBe("modifier");
      expect(typeof expr.evaluate).toBe("function");
      expect(expr.evaluate({ score: 10 })).toBe(0);
      expect(expr.evaluate({ score: 15 })).toBe(2);
    });

    it("should collect computed expressions from multiple entities", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { computed: { charFn: () => 1 } },
          monster: { computed: { monsterFn: () => 2 } },
        },
      });

      expect(system.expressions.has("charFn")).toBe(true);
      expect(system.expressions.has("monsterFn")).toBe(true);
    });

    it("should include formula description for computed expressions", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { computed: { modifier: (ctx: Record<string, unknown>) => ctx.score } },
        },
      });
      const expr = system.expressions.get("modifier")!;
      expect(expr.formula).toContain("modifier");
    });
  });

  describe("defaults", () => {
    it("should provide empty defaults for features, spellcasting, and conditions", () => {
      const system = CreateSystem({ name: "Test", attributes: ["str"] });
      expect(system.features.categories).toEqual([]);
      expect(system.features.providers).toEqual([]);
      expect(system.features.collectors).toEqual([]);
      expect(system.spellcasting.circles).toEqual([]);
      expect(system.spellcasting.providers).toEqual([]);
      expect(system.spellcasting.collectors).toEqual([]);
      expect(system.conditions.conditions).toEqual([]);
    });

    it("should accept conditions as an array shorthand", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["str"],
        conditions: [{ name: "Blinded" }, { name: "Poisoned" }],
      });
      expect(system.conditions.conditions).toHaveLength(2);
      expect(system.conditions.conditions[0].name).toBe("Blinded");
    });

    it("should accept conditions as a ConditionsSystemConfig object", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["str"],
        conditions: { conditions: [{ name: "Frightened" }] },
      });
      expect(system.conditions.conditions[0].name).toBe("Frightened");
    });
  });

  describe("traits", () => {
    it("should pass traits through to the system", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["str"],
        traits: [
          { name: "Darkvision", description: "See in darkness", mechanical: true },
        ],
      });
      expect(system.traits).toHaveLength(1);
      expect(system.traits![0].name).toBe("Darkvision");
    });

    it("should have undefined traits when not provided", () => {
      const system = CreateSystem({ name: "Test", attributes: ["str"] });
      expect(system.traits).toBeUndefined();
    });
  });

  describe("skills", () => {
    it("should pass skills through to the system", () => {
      const system = CreateSystem({
        name: "Test",
        attributes: ["dex"],
        skills: [{ name: "Acrobatics", attribute: "dex" }],
      });
      expect(system.skills).toHaveLength(1);
      expect(system.skills[0].name).toBe("Acrobatics");
    });
  });

  describe("full system build", () => {
    it("should build a complete system similar to D&D 5e", () => {
      const config: SystemConfig = {
        name: "D&D 5e Test",
        attributes: [
          { name: "strength", alias: "STR" },
          { name: "dexterity", alias: "DEX" },
        ],
        entities: {
          character: {
            fields: [
              { name: "proficiency_bonus", type: "number", default: 2 },
              { name: "level", type: "number", default: 1 },
            ],
            computed: {
              modifier: (ctx: Record<string, unknown>) => Math.floor((Number(ctx.score) - 10) / 2),
            },
          },
        },
        skills: [{ name: "Acrobatics", attribute: "dexterity" }],
        features: {
          categories: [{ id: "action", label: "Action" }],
          providers: ["class", "race"],
          collectors: ["character"],
        },
        spellcasting: {
          circles: [{ id: "cantrip", label: "Cantrip" }],
          providers: ["class"],
          collectors: ["character"],
        },
        conditions: [{ name: "Blinded" }],
        traits: [{ name: "Darkvision", mechanical: true }],
      };

      const system = CreateSystem(config);

      expect(system.name).toBe("D&D 5e Test");
      expect(system.attributes).toEqual(["strength", "dexterity"]);
      expect(system.attributeDefinitions).toBeDefined();
      expect(system.entities.character.frontmatter).toHaveLength(2);
      expect(system.expressions.has("modifier")).toBe(true);
      expect(system.skills[0].name).toBe("Acrobatics");
      expect(system.features.categories[0].id).toBe("action");
      expect(system.spellcasting.circles[0].id).toBe("cantrip");
      expect(system.conditions.conditions[0].name).toBe("Blinded");
      expect(system.traits![0].name).toBe("Darkvision");
    });
  });
});
