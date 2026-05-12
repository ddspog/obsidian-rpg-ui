import { describe, it, expect } from "vitest";
import { parseExpr, substituteExpressions, type EvalContext } from "./expressions";
import { parseTableBlock } from "./parse-table-block";
import type { TableDef } from "./types";

const progression = parseTableBlock(
  "progression",
  `key: level
| LEVEL | PB | CANTRIPS |
|---|---|---|
| 1 | +2 | 3 |
| 2 | +2 | 3 |
| 3 | +2 | 4 |`
);
(progression as TableDef).source = "Cleric";

const wildSurge = parseTableBlock(
  "wild-surge",
  `key: roll
| ROLL | EFFECT |
|---|---|
| 1 | Fireball |
| 2 | Polymorph |
| 3 | Heal |`
);
(wildSurge as TableDef).source = "Sorcerer";

const ctx: EvalContext = {
  tables: {
    "Cleric:progression": progression,
    progression,
    "Sorcerer:wild-surge": wildSurge,
    "wild-surge": wildSurge,
  },
  vars: { LV: 3, CLASS: "Cleric" },
};

describe("parseExpr", () => {
  it("reads a helper with a positional string argument", () => {
    const call = parseExpr('table "Cleric:progression"');
    expect(call.helper).toBe("table");
    expect(call.args).toEqual([{ kind: "string", value: "Cleric:progression" }]);
  });

  it("reads kwargs with mixed value types", () => {
    const call = parseExpr('table "progression" row=LV col="pb"');
    expect(call.helper).toBe("table");
    expect(call.kwargs.row).toEqual({ kind: "ident", name: "LV" });
    expect(call.kwargs.col).toEqual({ kind: "string", value: "pb" });
  });

  it("accepts numeric row values", () => {
    const call = parseExpr('table "progression" row=3');
    expect(call.kwargs.row).toEqual({ kind: "number", value: 3 });
  });
});

describe("substituteExpressions: table", () => {
  it("looks up a cell by key and column, resolving identifiers against vars", () => {
    const out = substituteExpressions('At level {{ table "progression" row=LV col="cantrips" }}.', ctx);
    expect(out).toBe("At level 4.");
  });

  it("works with fully-qualified table names", () => {
    const out = substituteExpressions('{{ table "Cleric:progression" row=2 col="pb" }}', ctx);
    expect(out).toBe("+2");
  });

  it("leaves unresolvable references as the raw {{...}} text", () => {
    const out = substituteExpressions('{{ table "progression" row=99 col="pb" }}', ctx);
    expect(out).toBe('{{ table "progression" row=99 col="pb" }}');
  });

  it("leaves unknown helpers alone", () => {
    const out = substituteExpressions("{{ nope arg }}", ctx);
    expect(out).toBe("{{ nope arg }}");
  });

  it("leaves parse errors alone (no throw)", () => {
    const out = substituteExpressions("{{ bad ] }}", ctx);
    expect(out).toBe("{{ bad ] }}");
  });
});

describe("substituteExpressions: random", () => {
  it("picks a stable row when given a fixed seed", () => {
    const a = substituteExpressions('{{ random "wild-surge" col="effect" seed="abc" }}', ctx);
    const b = substituteExpressions('{{ random "wild-surge" col="effect" seed="abc" }}', ctx);
    expect(a).toBe(b);
    expect(["Fireball", "Polymorph", "Heal"]).toContain(a);
  });

  it("different seeds produce (at least sometimes) different picks", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const picks = new Set(
      seeds.map((s) => substituteExpressions(`{{ random "wild-surge" col="effect" seed="${s}" }}`, ctx))
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe("substituteExpressions: tableRows", () => {
  it("returns the number of body rows", () => {
    expect(substituteExpressions('{{ tableRows "progression" }}', ctx)).toBe("3");
  });
});
