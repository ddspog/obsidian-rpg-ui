import { describe, it, expect } from "vitest";
import { addHeaderMap, parseSessionLogBlock } from "./session-log";
import { parseSquareMap } from "./battlemap/square-map";

const source = `state_key: sandbox
maps:
  Clearing:
    image: "[[ambush.png]]"
    cell: 33
    offset: -1, -1
    tokens:
      Talon: J14
  Ford:
    legend: { "~": water, ".": grass }
    cells: |
      . . ~ ~ . .
      . . ~ ~ . .
---
[COMBAT: Clearing]
T1`;

describe("maps declared in the log's header", () => {
  const block = parseSessionLogBlock(source);

  it("reads each by name, leaving the rest of the header as it was", () => {
    expect(block.state_key).toBe("sandbox");
    expect(Object.keys(block.maps ?? {})).toEqual(["Clearing", "Ford"]);
    expect(block.body).toBe("[COMBAT: Clearing]\nT1");
  });

  it("gives a picture map as an rpg map block would", () => {
    const map = parseSquareMap(block.maps!.Clearing);
    expect(map.image).toEqual({ link: "[[ambush.png]]", cell: 33, offsetX: -1, offsetY: -1 });
    expect(map.tokens.Talon).toEqual({ col: 9, row: 13 });
  });

  it("takes a drawn grid from cells:", () => {
    const map = parseSquareMap(block.maps!.Ford);
    expect([map.cols, map.rows]).toEqual([6, 2]);
    expect(map.legend["~"]).toEqual({ terrain: "water" });
  });

  it("has none when the header declares none", () => {
    expect(parseSessionLogBlock("state_key: x\n---\nT1").maps).toBeUndefined();
  });
});

describe("addHeaderMap", () => {
  const map = { name: "Clearing", image: "[[ambush.png]]", cell: 33, offsetX: -1, offsetY: -1 };

  it("adds maps: above the --- when the header has none", () => {
    expect(addHeaderMap("```rpg log\nstate_key: s\n---\n", map)).toBe(
      '```rpg log\nstate_key: s\nmaps:\n  Clearing:\n    image: "[[ambush.png]]"\n    cell: 33\n    offset: -1, -1\n---\n'
    );
  });

  it("adds under an existing maps:, keeping the rest as written", () => {
    const opening = "```rpg log\nstate_key: s\nmaps:\n  Ford:\n    cell: 40\nscene: 2\n---\n";
    const out = addHeaderMap(opening, map);
    expect(out).toBe(
      '```rpg log\nstate_key: s\nmaps:\n  Ford:\n    cell: 40\n  Clearing:\n    image: "[[ambush.png]]"\n    cell: 33\n    offset: -1, -1\nscene: 2\n---\n'
    );
    const block = parseSessionLogBlock(out.replace(/^```rpg log\n/, "") + "T1");
    expect(Object.keys(block.maps ?? {})).toEqual(["Ford", "Clearing"]);
    expect(block.scene).toBe("2");
  });
});
