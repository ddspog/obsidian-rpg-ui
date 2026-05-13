import { describe, expect, it } from "vitest";
import { isHomebrew, resolveSource } from "./source";

describe("resolveSource", () => {
  it("returns the block source when present", () => {
    expect(
      resolveSource({ source: { system: "tov", company: "Kobold" } }, { source: { system: "dnd5e" } })
    ).toEqual({ system: "tov", book: undefined, company: "Kobold" });
  });

  it("falls back to file frontmatter when block has no source", () => {
    expect(resolveSource({}, { source: { system: "tov" } })).toEqual({
      system: "tov",
      book: undefined,
      company: undefined,
    });
  });

  it("returns undefined when neither has a source", () => {
    expect(resolveSource({}, {})).toBeUndefined();
    expect(resolveSource({}, null)).toBeUndefined();
  });
});

describe("isHomebrew", () => {
  const tov = { system: "tov" };
  const dnd = { system: "dnd5e" };

  it("flags any block with no source, regardless of context", () => {
    expect(isHomebrew(undefined, tov)).toBe(true);
    expect(isHomebrew(undefined, undefined)).toBe(true);
  });

  it("does not flag a block with a tuple when context is undefined", () => {
    expect(isHomebrew(tov, undefined)).toBe(false);
  });

  it("flags blocks whose system differs from context's", () => {
    expect(isHomebrew(dnd, tov)).toBe(true);
  });

  it("does not flag blocks whose system matches context's", () => {
    expect(isHomebrew(tov, tov)).toBe(false);
  });

  it("flags blocks with a different company when context declares one", () => {
    expect(isHomebrew({ system: "tov", company: "Paizo" }, { system: "tov", company: "Kobold" })).toBe(true);
  });

  it("does not flag when context has no company constraint", () => {
    expect(isHomebrew({ system: "tov", company: "Paizo" }, { system: "tov" })).toBe(false);
  });

  it("flags blocks with a different book when context declares one", () => {
    expect(isHomebrew({ system: "tov", book: "Monster Vault" }, { system: "tov", book: "Player's Guide" })).toBe(true);
  });
});
