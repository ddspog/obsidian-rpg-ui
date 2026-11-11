import { describe, expect, it } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { fogKey, rememberedBy, seenByMap, withLog } from "./fog-memory";
import { groupIntoProse } from "./prose-grouper";
import { foldTravelTrack } from "./travel";

describe("fog that remembers", () => {
  it("collects what each log saw, by map, and gives back only the other logs'", () => {
    const log = `S1 Out
[Group: Party = Elara]
[TRAVEL: [[Coast]]]
[Pos: Party (0,0)]
@(Party) [Mv: (2,0)] East
[/TRAVEL: arrive Day 2]`;
    const seen = seenByMap(foldTravelTrack(groupIntoProse(parseLonelog(log))));
    const coast = seen.get("[[Coast]]")!;
    expect(coast).toContain("0,0");
    expect(coast).toContain("2,0");
    expect(coast).toContain("3,0"); // the ring round where they stood
    expect(fogKey("[[Coast|the coast]]")).toBe("travel-fog:Coast");
    let store = withLog({}, "a.md", coast);
    expect(withLog(store, "a.md", coast)).toBe(store);
    store = withLog(store, "b.md", ["9,9"]);
    expect([...rememberedBy(store, "b.md")]).toEqual(coast);
    expect(rememberedBy(store, "a.md").has("9,9")).toBe(true);
  });
});
