import { describe, it, expect } from "vitest";
import { bindExpressions, buildEntityBlocks, buildEntityContext, entityTypeOf } from "./entity-context";
import type { RPGSystem } from "lib/systems/types";

const system = {
  entities: {
    character: {
      blocks: { sheet: {}, stats: {}, skills: {}, notes: {} },
      lookup: { pb: 2 },
    },
  },
  expressions: new Map([
    [
      "Wis",
      { id: "Wis", params: [], formula: "", evaluate: (c: any) => Math.floor(((c.blocks.stats?.WIS ?? 10) - 10) / 2) },
    ],
    [
      "Modifier",
      {
        id: "Modifier",
        params: ["name"],
        formula: "",
        evaluate: (c: any) => (c.args[0] === "Insight" ? c.expressions.Wis() + c.lookup.pb : undefined),
      },
    ],
  ]),
  skills: [],
  attributes: [],
} as unknown as RPGSystem;

describe("entity context — evaluate an entity's expressions anywhere", () => {
  it("aliases sub-blocks to a merged sheet fence", () => {
    const blocks = buildEntityBlocks(system, "character", new Map([["character.sheet", ["WIS: 16"]]]));
    expect(blocks.stats).toEqual({ WIS: 16 });
    expect(blocks.notes).toEqual({});
  });

  it("binds expressions so they can call each other", () => {
    const ctx = buildEntityContext(system, "character", new Map([["character.stats", ["WIS: 16"]]]), {});
    expect(ctx.expressions.Modifier("Insight")).toBe(5);
    expect(ctx.expressions.Modifier("Arcana")).toBeUndefined();
  });

  it("returns undefined when an expression throws", () => {
    const broken = {
      ...system,
      expressions: new Map([
        [
          "Boom",
          {
            id: "Boom",
            params: [],
            formula: "",
            evaluate: () => {
              throw new Error("x");
            },
          },
        ],
      ]),
    } as unknown as RPGSystem;
    const bound = bindExpressions(broken, { blocks: {}, lookup: {}, frontmatter: {} });
    expect(bound.Boom()).toBeUndefined();
  });

  it("reads the entity type from the file's fences", () => {
    expect(entityTypeOf(system, new Map([["character.sheet", [""]]]))).toBe("character");
    expect(entityTypeOf(system, new Map([["monster.stats", [""]]]))).toBeUndefined();
  });
});

describe("entity-scoped expressions", () => {
  it("binds an entity's own expression over a same-named one from another entity", () => {
    const def = (v: number) => ({ id: "Modifier", params: [], formula: "", evaluate: () => v });
    const sys = {
      entities: {
        character: { blocks: {}, expressions: new Map([["Modifier", def(1)]]) },
        stat: { blocks: {}, expressions: new Map([["Modifier", def(2)]]) },
      },
      expressions: new Map([["Modifier", def(2)]]),
      skills: [],
      attributes: [],
    } as unknown as RPGSystem;
    const ctx = { blocks: {}, lookup: {}, frontmatter: {} };
    expect(bindExpressions(sys, ctx, "character").Modifier()).toBe(1);
    expect(bindExpressions(sys, ctx, "stat").Modifier()).toBe(2);
  });
});

describe("fences with prose after `---`", () => {
  it("parses only the YAML part, keeping the prose as text", () => {
    const sys = {
      entities: { stat: { blocks: { monster: {} } } },
      expressions: new Map(),
      skills: [],
      attributes: [],
    } as unknown as RPGSystem;
    const blocks = buildEntityBlocks(
      sys,
      "stat",
      new Map([["stat.monster", ["name: Kobold\nabilities:\n  dex: 3\n---\n_Swift and lightly armored._"]]])
    );
    expect(blocks.monster).toEqual({ name: "Kobold", abilities: { dex: 3 }, text: "_Swift and lightly armored._" });
  });
});
