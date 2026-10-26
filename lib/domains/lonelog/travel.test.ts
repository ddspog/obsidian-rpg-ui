import { describe, expect, it } from "vitest";
import { extractTags, parseLonelog } from "./parser";

describe("travel in the log (hex-map-design §14.2)", () => {
  it("names a map's level by depth", () => {
    const [entry] = parseLonelog("[TRAVEL: [[Pointy Woods]] level 2]");
    expect(entry).toMatchObject({
      map: "[[Pointy Woods]]",
      level: [
        [0, 0],
        [0, 0],
      ],
    });
  });

  it("opens a travel on a map and a level, and closes it with its fields", () => {
    const entries = parseLonelog(
      [
        "[TRAVEL: [[Caulkin coast]]]",
        "[TRAVEL: [[Caulkin coast]] (1,0) (0,0)]",
        "[/TRAVEL]",
        "[/TRAVEL: arrive Day 4, 18:00 | 92 mi | 3 days | rations -6 | outcome Reached Featherbark; Lilith wounded]",
      ].join("\n")
    );
    expect(entries).toEqual([
      { type: "travel_marker", state: "open", map: "[[Caulkin coast]]" },
      {
        type: "travel_marker",
        state: "open",
        map: "[[Caulkin coast]]",
        level: [
          [1, 0],
          [0, 0],
        ],
      },
      { type: "travel_marker", state: "close" },
      {
        type: "travel_marker",
        state: "close",
        end: {
          arrive: "Day 4, 18:00",
          outcome: "Reached Featherbark; Lilith wounded",
          stats: ["92 mi", "3 days", "rations -6"],
        },
      },
    ]);
  });

  it("reads hexes in positions and moves, and keeps squares as they were", () => {
    expect(extractTags("[Pos: Party (2,0); Talon (3, -1); Lilith C4]")).toEqual([
      {
        kind: "position",
        entries: [
          { name: "Party", at: "(2,0)" },
          { name: "Talon", at: "(3,-1)" },
          { name: "Lilith", at: "C4" },
        ],
      },
    ]);
    expect(extractTags("[Mv: (3,0) > (4, -1)]")).toEqual([{ kind: "move", path: ["(3,0)", "(4,-1)"] }]);
    expect(extractTags("[Mv: Scouts (5,-2)]")).toEqual([{ kind: "move", who: "Scouts", path: ["(5,-2)"] }]);
    const [action] = parseLonelog("@(Scouts) [Mv: (3,0)>(4,-1)] Ride ahead");
    expect(action).toMatchObject({ type: "action", actor: "Scouts", text: "Ride ahead", tags: [{ kind: "move" }] });
  });

  it("reads every group verb", () => {
    const g = (s: string) => extractTags(`[Group: ${s}]`)[0];
    expect(g("Party = Elara, Thorne, Talon")).toEqual({
      kind: "group",
      op: "define",
      group: "Party",
      members: ["Elara", "Thorne", "Talon"],
    });
    expect(g("Party > Scouts = Talon, Lilith")).toMatchObject({
      op: "split",
      group: "Party",
      to: "Scouts",
      members: ["Talon", "Lilith"],
    });
    expect(g("Scouts > Party")).toMatchObject({ op: "merge", group: "Scouts", to: "Party" });
    expect(g("Scouts as Wolfpack")).toMatchObject({ op: "rename", group: "Scouts", to: "Wolfpack" });
    expect(g("Wolfpack + Kowyn")).toMatchObject({ op: "add", members: ["Kowyn"] });
    expect(g("Wolfpack - Lilith")).toMatchObject({ op: "remove", members: ["Lilith"] });
    // A tag line on its own is a mechanical entry, not prose.
    expect(parseLonelog("[Group: Party > Scouts = Talon, Lilith]")[0]).toMatchObject({ type: "consequence" });
  });

  it("reads marks starting, moving and ending", () => {
    expect(extractTags("[Mark: Ambush|here-red[skull]@(4,-1)|until long rest]")[0]).toEqual({
      kind: "mark",
      name: "Ambush",
      spec: "here-red[skull]",
      at: [4, -1],
      until: "long rest",
    });
    expect(extractTags("[Mark: Ambush|@(5.5,-1)]")[0]).toEqual({ kind: "mark", name: "Ambush", at: [5.5, -1] });
    expect(extractTags("[Mark: -Ambush]")[0]).toEqual({ kind: "mark", name: "Ambush", end: true });
  });
});
