import { describe, it, expect } from "vitest";
import {
  parseLogTemplate,
  needsUserInput,
  resolveLogTemplate,
  resolveWithContext,
  buildAutoValues,
  requiredFilled,
  previewLogTemplate,
} from "./template-resolver";

describe("parseLogTemplate", () => {
  it("extracts placeholders from template", () => {
    const result = parseLogTemplate("@ {{actor}} uses {{name}} on {{target}}");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ kind: "actor", raw: "{{actor}}", autoResolvable: true });
    expect(result[1]).toEqual({ kind: "name", raw: "{{name}}", autoResolvable: true });
    expect(result[2]).toEqual({ kind: "target", raw: "{{target}}", autoResolvable: false });
  });

  it("deduplicates repeated placeholders", () => {
    const result = parseLogTemplate("{{text}} and {{text}} again");
    expect(result).toHaveLength(1);
  });

  it("returns empty array for templates without placeholders", () => {
    expect(parseLogTemplate("@ Simple action")).toEqual([]);
  });

  it("identifies all user-input kinds as non-auto-resolvable", () => {
    const template = "d: {{expression}} tbl: {{source}} {{roll}} -> {{result}}";
    const result = parseLogTemplate(template);
    expect(result.every((p) => !p.autoResolvable)).toBe(true);
  });
});

describe("needsUserInput", () => {
  it("filters to only non-auto-resolvable placeholders", () => {
    const placeholders = parseLogTemplate("@ {{actor}} attacks {{target}} for {{roll}}");
    const userInputs = needsUserInput(placeholders);
    expect(userInputs).toHaveLength(2);
    expect(userInputs[0].kind).toBe("target");
    expect(userInputs[1].kind).toBe("roll");
  });

  it("returns empty when all are auto-resolvable", () => {
    const placeholders = parseLogTemplate("@ {{actor}} uses {{name}}");
    expect(needsUserInput(placeholders)).toHaveLength(0);
  });
});

describe("resolveLogTemplate", () => {
  it("replaces all known placeholders", () => {
    const result = resolveLogTemplate("@ {{actor}} uses {{name}}", {
      actor: "Elara",
      name: "Fireball",
    });
    expect(result).toBe("@ Elara uses Fireball");
  });

  it("leaves unresolved placeholders untouched", () => {
    const result = resolveLogTemplate("@ {{actor}} targets {{target}}", {
      actor: "Elara",
    });
    expect(result).toBe("@ Elara targets {{target}}");
  });

  it("handles multiple occurrences of same placeholder", () => {
    const result = resolveLogTemplate("{{actor}} and {{actor}}", { actor: "X" });
    expect(result).toBe("X and X");
  });
});

describe("buildAutoValues", () => {
  it("provides actor and name", () => {
    const values = buildAutoValues({ actor: "Elara", name: "Shield", entities: [] });
    expect(values).toEqual({ actor: "Elara", name: "Shield" });
  });
});

describe("resolveWithContext", () => {
  it("merges auto values with user values", () => {
    const ctx = { actor: "Thorne", name: "Smite", entities: ["Goblin", "Elara"] };
    const result = resolveWithContext("@ {{actor}} uses {{name}} on {{target}}", ctx, { target: "Goblin" });
    expect(result).toBe("@ Thorne uses Smite on Goblin");
  });

  it("user values override auto values", () => {
    const ctx = { actor: "Thorne", name: "Help", entities: [] };
    const result = resolveWithContext("@ {{actor}} helps {{name}}", ctx, {
      name: "Elara",
    });
    expect(result).toBe("@ Thorne helps Elara");
  });

  it("resolves GM card templates", () => {
    const ctx = { actor: "Game Master", name: "Oracle Question", entities: [] };
    const result = resolveWithContext("? {{question}}", ctx, {
      question: "Is the door trapped?",
    });
    expect(result).toBe("? Is the door trapped?");
  });

  it("resolves complex mechanics template", () => {
    const ctx = { actor: "GM", name: "Roll", entities: [] };
    const result = resolveWithContext("d: {{expression}} -> {{result}}", ctx, {
      expression: "d20+5=18 vs DC 15",
      result: "Success",
    });
    expect(result).toBe("d: d20+5=18 vs DC 15 -> Success");
  });
});

describe("choice placeholders", () => {
  it("reads `{{name:a|b}}` as a slot with options", () => {
    expect(parseLogTemplate("? [CF{{cf:+1|-1}}] Does {{scene}} happen?")).toEqual([
      { kind: "cf", raw: "{{cf:+1|-1}}", autoResolvable: false, options: ["+1", "-1"] },
      { kind: "scene", raw: "{{scene}}", autoResolvable: false },
    ]);
  });

  it("fills the slot with the picked option", () => {
    expect(resolveLogTemplate("? [CF{{cf:+1|-1}}] Go", { cf: "-1" })).toBe("? [CF-1] Go");
  });
});

describe("optional placeholders", () => {
  const tpl = "=> [Threads+ {{threads_added?}}]\n=> [Threads- {{threads_closed?}}]";

  it("marks `{{name?}}` optional", () => {
    expect(parseLogTemplate(tpl).map((p) => [p.kind, p.optional])).toEqual([
      ["threads_added", true],
      ["threads_closed", true],
    ]);
  });

  it("drops the line of an optional slot left blank", () => {
    expect(resolveLogTemplate(tpl, { threads_added: "Find the relic", threads_closed: "" })).toBe(
      "=> [Threads+ Find the relic]"
    );
  });

  it("does not require optional slots to be filled", () => {
    expect(requiredFilled(parseLogTemplate(tpl), {})).toBe(true);
    expect(requiredFilled(parseLogTemplate("{{question}}"), {})).toBe(false);
  });
});

describe("previewLogTemplate — the card as it will append", () => {
  const ctx = { actor: "Kobold, Elite", name: "Mining Pick", entities: [] };

  it("fills what is known and marks what is still empty", () => {
    expect(previewLogTemplate("@({{actor}}) Mining Pick → {{target}}\nd: Attack | d20+5=", ctx, {})).toBe(
      "@(Kobold, Elite) Mining Pick → …\nd: Attack | d20+5="
    );
    expect(previewLogTemplate("@({{actor}}) Mining Pick → {{target}}", ctx, { target: "Lilith" })).toBe(
      "@(Kobold, Elite) Mining Pick → Lilith"
    );
  });

  it("drops an optional line left blank, as appending will", () => {
    expect(
      previewLogTemplate("=> [Threads+ {{added?}}]\n=> [Threads- {{closed?}}]", ctx, { added: "Find the relic" })
    ).toBe("=> [Threads+ Find the relic]");
  });
});

describe("a slot used twice is asked once", () => {
  it("merges repeats of one name, keeping the listed options", () => {
    const slots = parseLogTemplate("d: {{skill:Arcana|History}} | d20+[[{{skill}}]]=");
    expect(slots.map((s) => [s.kind, s.options])).toEqual([["skill", ["Arcana", "History"]]]);
    expect(resolveLogTemplate("d: {{skill:Arcana|History}} | d20+[[{{skill}}]]=", { skill: "History" })).toBe(
      "d: History | d20+[[History]]="
    );
  });
});
