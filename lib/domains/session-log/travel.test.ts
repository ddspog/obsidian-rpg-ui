import { describe, expect, it } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { clockText, foldClock } from "./clock";
import { groupIntoProse } from "./prose-grouper";
import { foldTravels, foldTravelTrack, journeyAt, trackAt } from "./travel";

const LOG = `S1 The road north
[Group: Party = Elara, Thorne, Talon, Lilith]
[Pos: Party (2,0)]
[TRAVEL: [[Caulkin coast]]]
@(Party) [Mv: (3,0)] Over the ridge
[Group: Party > Scouts = Talon, Lilith]
@(Scouts) [Mv: (5,-1)] Ride ahead
[Mark: Ambush|here-red[skull]@(4,-1)|until dawn]
@(Elara) [Mv: (3,1)] Goes to the river alone
[Group: Scouts as Wolfpack]
[Mark: -Ambush]
[/TRAVEL: arrive Day 4, 18:00 | 92 mi | 3 days | outcome Reached Featherbark]
[Group: Wolfpack > Party]`;

const segments = groupIntoProse(parseLonelog(LOG));

describe("travel in the log", () => {
  const [j] = foldTravels(segments);

  it("finds the journey, its map and its summary", () => {
    expect(foldTravels(segments)).toHaveLength(1);
    expect(j.map).toBe("[[Caulkin coast]]");
    expect(j.summary).toEqual({ arrive: "Day 4, 18:00", outcome: "Reached Featherbark", stats: ["92 mi", "3 days"] });
    expect(j.opening.positions).toEqual({ Party: [2, 0] });
    expect(j.opening.groups).toEqual({ Party: ["Elara", "Thorne", "Talon", "Lilith"] });
  });

  it("splits, moves, sends one off alone, renames — and keeps each trail", () => {
    const last = j.frames[j.frames.length - 1];
    expect(last.groups).toEqual({ Party: ["Thorne"], Wolfpack: ["Talon", "Lilith"] });
    expect(last.positions).toEqual({ Party: [3, 0], Wolfpack: [5, -1], Elara: [3, 1] });
    expect(last.trails.Party).toEqual([
      [2, 0],
      [3, 0],
    ]);
    // The scouts start where the party was when they split, and walk two hexes.
    expect(last.trails.Wolfpack).toEqual([
      [3, 0],
      [4, 0],
      [5, -1],
    ]);
    expect(last.marks).toEqual([]);
  });

  it("gives the state at any entry, with marks while they last", () => {
    // The mark is written under the scouts' ride: it stands from then until it ends.
    const ride = j.frames.find((f) => f.actor === "Scouts")!;
    expect(journeyAt(j, ride.id).marks).toEqual([{ name: "Ambush", spec: "here-red[skull]", at: [4, -1], until: "dawn" }]);
    const elara = j.frames.find((f) => f.actor === "Elara")!;
    // The tags under her line (the rename, the mark's end) are her entry's: the mark is gone there.
    expect(journeyAt(j, elara.id).marks).toEqual([]);
    expect(elara.moved).toEqual(["Elara"]);
    expect(journeyAt(j, j.start)).toBe(j.opening);
  });

  it("sets the clock to the arrival", () => {
    expect(clockText(foldClock(segments).now)).toBe("Day 4, 18:00");
  });
});

describe("a fight during a journey", () => {
  it("leaves the journey running through it, and the fight's own map bound", async () => {
    const { foldBattles } = await import("lib/domains/battlemap/battle");
    const log = `[Pos: Party (0,0)]
[TRAVEL: [[Caulkin coast]]]
@(Party) [Mv: (1,0)] Into the pass
[COMBAT: [[Kobold Ambush]]]
[Pos: Talon C4]
@(Talon) [Mv: D4] Shortsword → Kobold
[/COMBAT]
@(Party) [Mv: (2,0)] On through the pass
[/TRAVEL: arrive Day 2, 12:00]`;
    const segs = groupIntoProse(parseLonelog(log));
    const [journey] = foldTravels(segs);
    expect(journey.frames[journey.frames.length - 1].positions).toEqual({ Party: [2, 0] });
    // The battle squares stay the fight's; the journey only reads hexes.
    expect(Object.keys(journey.frames[journey.frames.length - 1].positions)).toEqual(["Party"]);
    expect(foldBattles(segs)[0]?.map).toBe("[[Kobold Ambush]]");
  });
});

describe("the travel track across the log", () => {
  const log = `S1 In town
@(Party) Buy supplies
=> They stock up.
S2 The road north
[Pos: Party (0,0)]
@(Party) Set out at dawn
[TRAVEL: [[Caulkin coast]]]
@(Party) [Mv: (2,0)] Down the road
[/TRAVEL: arrive Day 2, 18:00]
@(Party) [Mv: (3,0)] Wander to the market
@(Party) [Mv: (9,-4) | teleport] The circle flares
S3 Far away
@(Party) [Mv: (9,-3)>(10,-3) | ship] Sail on`;
  const segs = groupIntoProse(parseLonelog(log));
  const track = foldTravelTrack(segs);
  const sceneOf = (title: string) => segs.find((s) => s.type === "scene" && s.entry.context === title)!.sourceIndex;

  it("starts at the scene the first map is set out in, positions before the [TRAVEL] included", () => {
    expect(track.from).toBe(sceneOf("The road north"));
    expect(trackAt(track, sceneOf("In town"))).toBeNull();
    const before = trackAt(track, sceneOf("The road north") + 1)!;
    expect(before.map).toBe("[[Caulkin coast]]");
    expect(before.positions).toEqual({ Party: [0, 0] });
    expect(before.travelling).toBe(false);
  });

  it("goes on after the journey: a walk moves without a path, special moves are jumps", () => {
    const last = track.frames[track.frames.length - 1];
    expect(last.positions).toEqual({ Party: [10, -3] });
    // The journey's path stays as drawn: the market stroll isn't on it.
    expect(last.trails.Party).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(last.jumps).toEqual([
      { token: "Party", via: "teleport", points: [[3, 0], [9, -4]] },
      { token: "Party", via: "ship", points: [[9, -4], [9, -3], [10, -3]] },
    ]);
    expect(last.map).toBe("[[Caulkin coast]]");
  });
});
