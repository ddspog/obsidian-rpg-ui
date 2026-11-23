import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { withRoll } from "./spells";

describe("withRoll", () => {
  it("puts the roll before the fence's ---, the vault's way, and the note still parses", () => {
    const note = [
      "# Fireball",
      "```rpg spell",
      "circle: 3rd-Circle",
      'range: "150 feet"',
      "---",
      "Each creature … must make a DEX save.",
      "```",
      "",
    ].join("\n");
    const out = withRoll(note, {
      form: "save",
      circle: 3,
      save: { ability: "DEX", on_success: "half damage" },
      damage: { roll: "8d6", type: "fire" },
      upcast: { 4: { damage: { roll: "9d6", type: "fire" } } },
    })!;
    expect(out).toContain("  upcast:\n    4: { damage: { roll: 9d6, type: fire } }\n---\nEach creature");
    const yaml = out.split("```rpg spell\n")[1].split("\n---\n")[0];
    expect(parse(yaml).roll).toMatchObject({ form: "save", upcast: { 4: { damage: { roll: "9d6", type: "fire" } } } });
    expect(out.startsWith("# Fireball\n```rpg spell\n")).toBe(true);
  });
});
