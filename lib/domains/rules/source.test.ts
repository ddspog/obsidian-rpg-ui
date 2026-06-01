import { afterEach, describe, expect, it } from "vitest";
import { isHomebrew, isHomebrewForFile, resolveSource } from "./source";
import { setOfficialSourcesResolver } from "lib/domains/lists/official-sources";

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

  it("returns a string source from block frontmatter", () => {
    expect(resolveSource({ source: 'From **ToV** "Player\'s Guide"' }, {})).toBe(
      'From **ToV** "Player\'s Guide"'
    );
  });

  it("falls back to file string source when block has none", () => {
    expect(resolveSource({}, { source: 'From **ToV** "Player\'s Guide"' })).toBe(
      'From **ToV** "Player\'s Guide"'
    );
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

  it("does not flag when block inherits same string source as context", () => {
    const src = 'From **ToV** "Player\'s Guide" by **Kobold Press**.';
    expect(isHomebrew(src, src)).toBe(false);
  });

  it("flags when block has a different string source than context", () => {
    expect(isHomebrew('From **D&D 5e** "PHB"', 'From **ToV** "Player\'s Guide"')).toBe(true);
  });

  it("flags mixed string vs tuple as homebrew", () => {
    expect(isHomebrew("some string", { system: "tov" })).toBe(true);
    expect(isHomebrew({ system: "tov" }, "some string")).toBe(true);
  });
});

describe("isHomebrewForFile", () => {
  afterEach(() => setOfficialSourcesResolver(null));

  it("falls back to context-based isHomebrew when no official sources are configured", () => {
    setOfficialSourcesResolver(() => []);
    // Self-referential: a block with a source and no context is canonical.
    expect(isHomebrewForFile("Some Book", undefined, "notes/x.md")).toBe(false);
    // No source at all is still homebrew under the context model.
    expect(isHomebrewForFile(undefined, undefined, "notes/x.md")).toBe(true);
  });

  it("uses the official-sources setting when the system declares one", () => {
    setOfficialSourcesResolver(() => ['From **Tales of the Valiant** "%" by **Kobold Press**.']);
    // A ToV supplement matches the % pattern → official, even standalone.
    expect(
      isHomebrewForFile(
        'From **Tales of the Valiant** "Campaign Builder: Dungeons & Ruins" by **Kobold Press**.',
        undefined,
        "tales-of-the-valiant/x.md"
      )
    ).toBe(false);
    // A non-official source → homebrew.
    expect(
      isHomebrewForFile("From **D&D 5e** by **Mage Hand Press**", undefined, "tales-of-the-valiant/x.md")
    ).toBe(true);
  });
});
