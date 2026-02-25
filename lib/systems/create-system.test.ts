import { describe, it, expect } from "vitest";
import { CreateSystem } from "./create-system";
import type { SystemConfig } from "./types";

describe("CreateSystem", () => {
  describe("validation", () => {
    it("should throw if name is missing", () => {
      expect(() => CreateSystem({ name: "", attributes: ["strength"] })).toThrow("'name' is required");
    });

    it("should throw if attributes is empty", () => {
      expect(() => CreateSystem({ name: "Test", attributes: [] })).toThrow("'attributes' is required");
    });

    it("should throw if attributes is not an array", () => {
      expect(() => CreateSystem({ name: "Test", attributes: "strength" as any })).toThrow("'attributes' is required");
    });
  });

  describe("attribute normalization", () => {
    it("should normalize string attributes into AttributeDefinitions", async () => {
      const system = await CreateSystem({ name: "Test", attributes: ["strength", "dexterity"] });
      expect(system.attributes.map((a) => a.$name)).toEqual(["strength", "dexterity"]);
    });

    it("should preserve full AttributeDefinition objects", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: [{ $name: "strength", alias: "STR", subtitle: "Physical power" }],
      });
      expect(system.attributes[0].alias).toBe("STR");
    });

    it("should normalize plain string attributes to objects with just name", async () => {
      const system = await CreateSystem({ name: "Test", attributes: ["strength"] });
      expect(system.attributes[0]).toEqual({ $name: "strength" });
    });

    it("should include all attributes as AttributeDefinition objects", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["strength", { $name: "dexterity", alias: "DEX" }],
      });
      expect(system.attributes).toHaveLength(2);
      expect(system.attributes[0].$name).toBe("strength");
      expect(system.attributes[1].alias).toBe("DEX");
    });
  });

  describe("entity normalization", () => {
    it("should produce an empty entities record when none are specified", async () => {
      const system = await CreateSystem({ name: "Test", attributes: ["str"] });
      expect(system.entities).toEqual({});
    });

    it("should normalize string fields", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { frontmatter: ["level", "name"] },
        },
      });
      expect(system.entities.character.frontmatter).toHaveLength(2);
      expect(system.entities.character.frontmatter[0]).toEqual({ name: "level", type: "string" });
    });

    it("should preserve full field definitions", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { frontmatter: [{ name: "level", type: "number", default: 1 }] },
        },
      });
      expect(system.entities.character.frontmatter[0]).toMatchObject({
        name: "level",
        type: "number",
        default: 1,
      });
    });

    it("should include entity features", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { features: [{ $name: "Dash", type: "action" }] },
        },
      });
      expect(system.entities.character.features).toHaveLength(1);
      expect(system.entities.character.features![0].$name).toBe("Dash");
    });
  });

  describe("computed expressions", () => {
    it("should convert computed functions to ExpressionDef entries", async () => {
      const modifier = (_args: any, ctx: any) => {
        const score = Number(ctx.score) || 0;
        return Math.floor((score - 10) / 2);
      };

      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { expressions: { modifier } },
        },
      });

      expect(system.expressions.has("modifier")).toBe(true);
      const expr = system.expressions.get("modifier")!;
      expect(expr.id).toBe("modifier");
      expect(typeof expr.evaluate).toBe("function");
      expect(expr.evaluate({ score: 10 })).toBe(0);
      expect(expr.evaluate({ score: 15 })).toBe(2);
    });

    it("should collect computed expressions from multiple entities", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { expressions: { charFn: () => 1 } },
          monster: { expressions: { monsterFn: () => 2 } },
        },
      });

      expect(system.expressions.has("charFn")).toBe(true);
      expect(system.expressions.has("monsterFn")).toBe(true);
    });

    it("should include formula description for computed expressions", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: { expressions: { modifier: (_args: any, ctx: any) => ctx.score } },
        },
      });
      const expr = system.expressions.get("modifier")!;
      expect(expr.formula).toContain("modifier");
    });
  });

  describe("defaults", () => {
    it("should provide empty defaults for features, spellcasting, and conditions", async () => {
      const system = await CreateSystem({ name: "Test", attributes: ["str"] });
      expect(system.features.categories).toEqual([]);
      expect(system.features.providers).toEqual([]);
      expect(system.features.collectors).toEqual([]);
      expect(system.spellcasting.circles).toEqual([]);
      expect(system.spellcasting.providers).toEqual([]);
      expect(system.spellcasting.collectors).toEqual([]);
      expect(system.conditions).toEqual([]);
    });

    it("should accept conditions as an array shorthand", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        conditions: [{ $name: "Blinded" }, { $name: "Poisoned" }],
      });
      expect(system.conditions).toHaveLength(2);
      expect(system.conditions[0].$name).toBe("Blinded");
    });

    it("should accept conditions as a flattened array", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        conditions: [{ $name: "Frightened" }],
      });
      expect(system.conditions[0].$name).toBe("Frightened");
    });
  });

  describe("traits", () => {
    it("should pass traits through to the system", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        traits: [
          { $name: "Darkvision", $contents: "See in darkness", mechanical: true },
        ],
      });
      expect(system.traits).toHaveLength(1);
      expect(system.traits![0].$name).toBe("Darkvision");
    });

    it("should have undefined traits when not provided", async () => {
      const system = await CreateSystem({ name: "Test", attributes: ["str"] });
      expect(system.traits).toBeUndefined();
    });
  });

  describe("skills", () => {
    it("should pass skills through to the system", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["dex"],
        skills: [{ $name: "Acrobatics", attribute: "dex" }],
      });
      expect(system.skills).toHaveLength(1);
      expect(system.skills[0].$name).toBe("Acrobatics");
    });
  });

  describe("spellcasting casters", () => {
    it("should pass casters through spellcasting config", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        spellcasting: {
          circles: [],
          providers: [],
          collectors: [],
          casters: {
            full: { name: "Full Caster", levelConversion: (l) => l },
            half: { name: "Half Caster", levelConversion: (l) => Math.floor(l / 2) },
          },
        },
      });
      expect(system.spellcasting.casters).toBeDefined();
      expect(system.spellcasting.casters!.full.name).toBe("Full Caster");
      expect(system.spellcasting.casters!.half.name).toBe("Half Caster");
      expect(system.spellcasting.casters!.full.levelConversion(10)).toBe(10);
      expect(system.spellcasting.casters!.half.levelConversion(10)).toBe(5);
    });

    it("should have undefined casters when not provided", async () => {
      const system = await CreateSystem({ name: "Test", attributes: ["str"] });
      expect(system.spellcasting.casters).toBeUndefined();
    });
  });

  describe("spellcasting slots", () => {
    it("should carry slots through spellcasting config", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        spellcasting: {
          circles: [],
          providers: [],
          collectors: [],
          slots: [[2], [3], [4, 2]],
        },
      });
      expect(system.spellcasting.slots).toEqual([[2], [3], [4, 2]]);
    });

    it("should have undefined slots when not provided", async () => {
      const system = await CreateSystem({ name: "Test", attributes: ["str"] });
      expect(system.spellcasting.slots).toBeUndefined();
    });
  });

  describe("block validation", () => {
    it("should accept valid block definitions", async () => {
      const system = await CreateSystem({
        name: "Test",
        attributes: ["str"],
        entities: {
          character: {
            blocks: {
              header: (props: any) => null,
            },
          },
        },
      });
      expect(system.entities.character.blocks).toBeDefined();
      expect(system.entities.character.blocks!.header).toBeDefined();
    });

    it("should throw when block component is not a function", () => {
      expect(() =>
        CreateSystem({
          name: "Test",
          attributes: ["str"],
          entities: {
            character: {
              blocks: {
                header: "not-a-function" as any,
              },
            },
          },
        }),
      ).toThrow("block 'header' must have a callable 'component'");
    });
  });

  describe("full system build", () => {
    it("should build a complete system similar to D&D 5e", async () => {
      const config: SystemConfig = {
        name: "D&D 5e Test",
        attributes: [
          { $name: "strength", alias: "STR" },
          { $name: "dexterity", alias: "DEX" },
        ],
        entities: {
          character: {
            frontmatter: [
              { name: "proficiency_bonus", type: "number", default: 2 },
              { name: "level", type: "number", default: 1 },
            ],
            expressions: {
              modifier: (_args: any, ctx: any) => Math.floor((Number(ctx.score) - 10) / 2),
            },
          },
        },
        skills: [{ $name: "Acrobatics", attribute: "dexterity" }],
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
        conditions: [{ $name: "Blinded" }],
        traits: [{ $name: "Darkvision", mechanical: true }],
      };

      const system = await CreateSystem(config);

      expect(system.name).toBe("D&D 5e Test");
      expect(system.attributes.map((a) => a.$name)).toEqual(["strength", "dexterity"]);
      expect(system.attributes[0].alias).toBe("STR");
      expect(system.entities.character.frontmatter).toHaveLength(2);
      expect(system.expressions.has("modifier")).toBe(true);
      expect(system.skills[0].$name).toBe("Acrobatics");
      expect(system.features.categories[0].id).toBe("action");
      expect(system.spellcasting.circles[0].id).toBe("cantrip");
      expect(system.conditions[0].$name).toBe("Blinded");
      expect(system.traits![0].$name).toBe("Darkvision");
    });
  });
});
