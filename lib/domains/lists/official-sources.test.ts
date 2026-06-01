import { describe, it, expect, afterEach } from "vitest";
import { isHomebrewSource, homebrewBySetting, setOfficialSourcesResolver } from "./official-sources";

describe("isHomebrewSource", () => {
  const official = ["Tales of the Valiant"];

  it("is off (never homebrew) when no official sources are configured", () => {
    expect(isHomebrewSource("From D&D 5e Homebrew", [])).toBe(false);
    expect(isHomebrewSource(undefined, [])).toBe(false);
  });

  it("treats missing / blank / non-string source as homebrew when configured", () => {
    expect(isHomebrewSource(undefined, official)).toBe(true);
    expect(isHomebrewSource("", official)).toBe(true);
    expect(isHomebrewSource("   ", official)).toBe(true);
    expect(isHomebrewSource(42, official)).toBe(true);
  });

  it("is official when the source contains an official substring (case-insensitive)", () => {
    expect(isHomebrewSource('From **Tales of the Valiant** "Player\'s Guide"', official)).toBe(false);
    expect(isHomebrewSource("from tales of the valiant", official)).toBe(false);
  });

  it("is homebrew when the source matches no official string", () => {
    expect(isHomebrewSource("From **D&D 5e** Deep Magic by Kobold Press", official)).toBe(true);
    expect(isHomebrewSource("Adapted from D&D 5e Homebrew", official)).toBe(true);
  });

  it("matches any of several official strings", () => {
    const many = ["Tales of the Valiant", "Kobold Press"];
    expect(isHomebrewSource("From D&D 5e Deep Magic by Kobold Press", many)).toBe(false);
  });

  it("uses % as the wildcard and keeps * literal (sources have ** bold markers)", () => {
    // % = any run of text
    expect(
      isHomebrewSource('From **D&D 5e** "Deep Magic" by **Kobold Press**', ["D&D 5e%Kobold Press"])
    ).toBe(false);
    expect(isHomebrewSource("From Tales of the Valiant", ["D&D 5e%Kobold Press"])).toBe(true);

    // `*` is LITERAL — a pattern can include the markdown bold markers verbatim
    expect(isHomebrewSource("From **Tales of the Valiant**", ["**Tales of the Valiant**"])).toBe(
      false
    );
    expect(isHomebrewSource("From Tales of the Valiant (no bold)", ["**Tales of the Valiant**"])).toBe(
      true
    );

    // plain text = case-insensitive substring (still works through the ** markers)
    expect(isHomebrewSource('From **Tales of the Valiant** "PG"', ["tales of the valiant"])).toBe(
      false
    );
  });
});

describe("homebrewBySetting", () => {
  afterEach(() => setOfficialSourcesResolver(null));

  it("returns null when the file's system declares no official sources (defer to caller)", () => {
    setOfficialSourcesResolver(() => []);
    expect(homebrewBySetting("From anywhere", "notes/x.md")).toBeNull();
    setOfficialSourcesResolver(null);
    expect(homebrewBySetting("From anywhere", "notes/x.md")).toBeNull();
  });

  it("resolves official vs homebrew via the path's configured patterns", () => {
    setOfficialSourcesResolver(() => ['From **Tales of the Valiant** "%" by **Kobold Press**.']);
    expect(
      homebrewBySetting(
        'From **Tales of the Valiant** "Campaign Builder: Dungeons & Ruins" by **Kobold Press**.',
        "tales-of-the-valiant/x.md"
      )
    ).toBe(false);
    expect(homebrewBySetting("From **D&D 5e** by **Mage Hand Press**", "tales-of-the-valiant/x.md")).toBe(
      true
    );
    // missing source with sources configured → homebrew
    expect(homebrewBySetting(undefined, "tales-of-the-valiant/x.md")).toBe(true);
  });
});
