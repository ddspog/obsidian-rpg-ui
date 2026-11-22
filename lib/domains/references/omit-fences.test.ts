import { describe, expect, it } from "vitest";
import { omitFences, omittedIds } from "./omit-fences";

describe("omitFences", () => {
  const note = [
    "# Dwarf",
    "Dwarves are a hardy people.",
    "```rpg feature.details",
    'name: "Dwarf Lineage Traits"',
    "```",
    "```rpg stat.template",
    "id: npc",
    "name: Dwarf",
    "kind: lineage",
    "```",
    "",
  ].join("\n");

  it("leaves out the blocks with an omitted id, keeping the rest", () => {
    const out = omitFences(note, ["npc"]);
    expect(out).toContain("Dwarf Lineage Traits");
    expect(out).not.toContain("stat.template");
    expect(omitFences(note, [])).toBe(note);
    expect(omitFences(note, ["gm"])).toBe(note);
  });

  it("reads the ids from a call's chain", () => {
    expect(
      omittedIds([
        { fn: "omit", args: ["npc", "gm"] },
        { fn: "highlight", args: [] },
      ])
    ).toEqual(["npc", "gm"]);
  });
});
