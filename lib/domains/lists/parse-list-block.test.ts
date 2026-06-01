import { describe, expect, it } from "vitest";
import {
  parseListBlock,
  isListMeta,
  listNameFromMeta,
} from "./parse-list-block";

describe("isListMeta / listNameFromMeta", () => {
  it("recognizes the list family", () => {
    expect(isListMeta("list")).toBe(true);
    expect(isListMeta("list.cantrips")).toBe(true);
    expect(isListMeta("table.spells")).toBe(false);
    expect(isListMeta("rule.content")).toBe(false);
  });

  it("extracts the free-form name after the dot", () => {
    expect(listNameFromMeta("list.cantrips")).toBe("cantrips");
    expect(listNameFromMeta("list.arcane-spell-list")).toBe("arcane-spell-list");
    expect(listNameFromMeta("list")).toBe("");
  });
});

describe("parseListBlock", () => {
  it("applies defaults from the block name", () => {
    const b = parseListBlock("arcane-spell-list", "");
    expect(b.name).toBe("Arcane Spell List"); // title-cased from slug
    expect(b.id).toBe("arcane-spell-list"); // id ← block name
    expect(b.columns).toBe("auto");
    expect(b.paginate).toBeUndefined();
    expect(b.subtitle).toBeUndefined();
    expect(b.entries).toEqual([]);
  });

  it("honors explicit name / id / subtitle / columns / paginate", () => {
    const b = parseListBlock(
      "cantrips",
      [
        "name: Cantrips",
        "id: arcane-cantrips",
        "subtitle: 0-level arcane spells",
        "columns: 2",
        "paginate: auto",
      ].join("\n")
    );
    expect(b.name).toBe("Cantrips");
    expect(b.id).toBe("arcane-cantrips");
    expect(b.subtitle).toBe("0-level arcane spells");
    expect(b.columns).toBe(2);
    expect(b.paginate).toBe(true);
  });

  it("coerces columns to auto | 2 | 3 only", () => {
    expect(parseListBlock("x", "columns: 3").columns).toBe(3);
    expect(parseListBlock("x", "columns: 4").columns).toBe("auto");
    expect(parseListBlock("x", "columns: wide").columns).toBe("auto");
    expect(parseListBlock("x", 'columns: "2"').columns).toBe(2);
  });

  it("parses entries, skipping malformed ones and defaulting format", () => {
    const b = parseListBlock(
      "x",
      [
        "entries:",
        '  - call: "@[[/spells/cantrips/]].spell()"',
        '    format: "*[[${name}]]* (${school})"',
        '  - call: "@[[spells/Fire Bolt]].spell()"', // no format → defaults
        "  - format: orphan-without-call", // dropped (no call, no text)
        "  - 42", // dropped (not an object/string)
      ].join("\n")
    );
    expect(b.entries).toEqual([
      { call: "@[[/spells/cantrips/]].spell()", format: "*[[${name}]]* (${school})" },
      { call: "@[[spells/Fire Bolt]].spell()", format: "${name}" },
    ]);
  });

  it("supports literal lines (bare string or `text:`), mixed with calls", () => {
    const b = parseListBlock(
      "x",
      [
        "entries:",
        '  - "*Fixed Spell* (Evocation) Homebrew line."', // bare string → literal
        '  - text: "*Another* (Illusion) Also fixed."', // text: → literal
        '  - call: "@[[/spells/cantrips/]].spell()"',
        '    format: "${name}"',
      ].join("\n")
    );
    expect(b.entries).toEqual([
      { text: "*Fixed Spell* (Evocation) Homebrew line." },
      { text: "*Another* (Illusion) Also fixed." },
      { call: "@[[/spells/cantrips/]].spell()", format: "${name}" },
    ]);
  });

  it("enables pagination for true / auto / positive number, else undefined", () => {
    expect(parseListBlock("x", "paginate: true").paginate).toBe(true);
    expect(parseListBlock("x", "paginate: auto").paginate).toBe(true);
    expect(parseListBlock("x", "paginate: 12").paginate).toBe(true);
    expect(parseListBlock("x", "paginate: false").paginate).toBeUndefined();
    expect(parseListBlock("x", "paginate: 0").paginate).toBeUndefined();
    expect(parseListBlock("x", "").paginate).toBeUndefined();
  });

  it("degrades gracefully on malformed YAML", () => {
    const b = parseListBlock("cantrips", "name: : : not yaml\n  - broken");
    expect(b.name).toBe("Cantrips"); // falls back to title-cased slug
    expect(b.entries).toEqual([]);
  });
});
