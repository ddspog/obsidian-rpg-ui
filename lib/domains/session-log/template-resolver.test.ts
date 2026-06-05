import { describe, it, expect } from "vitest";
import {
  parseLogTemplate,
  needsUserInput,
  resolveLogTemplate,
  resolveWithContext,
  buildAutoValues,
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
    const result = resolveWithContext(
      "@ {{actor}} uses {{name}} on {{target}}",
      ctx,
      { target: "Goblin" },
    );
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
    const result = resolveWithContext(
      "d: {{expression}} -> {{result}}",
      ctx,
      { expression: "d20+5=18 vs DC 15", result: "Success" },
    );
    expect(result).toBe("d: d20+5=18 vs DC 15 -> Success");
  });
});
