import { describe, expect, it } from "vitest";
import { classifySpellCircle, stripWikilinkToName } from "./spellcasting";

describe("classifySpellCircle", () => {
  it("identifies cantrips", () => {
    expect(classifySpellCircle("Cantrip")).toBe("Cantrip");
    expect(classifySpellCircle("cantrip")).toBe("Cantrip");
    expect(classifySpellCircle(" CANTRIP ")).toBe("Cantrip");
  });

  it("identifies rituals (ritual wins over leveled)", () => {
    expect(classifySpellCircle("1st-Circle Ritual")).toBe("Ritual");
    expect(classifySpellCircle("3rd-Circle Ritual")).toBe("Ritual");
    expect(classifySpellCircle("ritual")).toBe("Ritual");
  });

  it("identifies leveled spells", () => {
    expect(classifySpellCircle("1st-Circle")).toBe("Leveled");
    expect(classifySpellCircle("2nd-Circle")).toBe("Leveled");
    expect(classifySpellCircle("9th-Circle")).toBe("Leveled");
  });

  it("returns null for empty / unknown input", () => {
    expect(classifySpellCircle("")).toBeNull();
    expect(classifySpellCircle("   ")).toBeNull();
    expect(classifySpellCircle(undefined as unknown as string)).toBeNull();
  });
});

describe("stripWikilinkToName", () => {
  it("strips bracket wrapper", () => {
    expect(stripWikilinkToName("[[Divine]]")).toBe("Divine");
  });

  it("prefers target over alias", () => {
    expect(stripWikilinkToName("[[path/to/Divine|Divine magic]]")).toBe("Divine");
  });

  it("passes non-wikilink input through", () => {
    expect(stripWikilinkToName("Divine")).toBe("Divine");
    expect(stripWikilinkToName("  Divine  ")).toBe("Divine");
  });

  it("handles empty input", () => {
    expect(stripWikilinkToName("")).toBe("");
  });
});
