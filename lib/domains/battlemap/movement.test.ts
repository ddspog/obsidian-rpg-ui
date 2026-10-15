import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import { foldBattles } from "./battle";
import { combatOpen, normalizeRoute, squareNow, withMove, withMoveAfter } from "./movement";
import { parseSquareMap } from "./square-map";

const segments = (lines: string[]) => groupIntoProse(parseLonelog(lines.join("\n")));

describe("normalizeRoute", () => {
  it("tidies squares into a route", () => {
    expect(normalizeRoute("e3")).toBe("E3");
    expect(normalizeRoute(" g4 > f4>e4 ")).toBe("G4>F4>E4");
    expect(normalizeRoute("G4, F4")).toBe("G4>F4");
  });

  it("leaves blank as no move, and refuses what isn't a square", () => {
    expect(normalizeRoute("  ")).toBe("");
    expect(normalizeRoute("behind the rocks")).toBeNull();
    expect(normalizeRoute("G4>?")).toBeNull();
  });
});

describe("withMove", () => {
  const attack = "@(Talon) Shortsword → Kobold, Elite\nd: Attack | d20+6=";

  it("puts the move on the action line, before the action", () => {
    expect(withMove(attack, "k12 > l10")).toBe("@(Talon) [Mv: K12>L10] Shortsword → Kobold, Elite\nd: Attack | d20+6=");
  });

  it("changes nothing without a move (or with a bad one)", () => {
    expect(withMove(attack, "")).toBe(attack);
    expect(withMove(attack, "nowhere")).toBe(attack);
    expect(withMove("=> Just a note", "E3")).toBe("=> Just a note");
  });
});

describe("combatOpen", () => {
  it("is on between [COMBAT] and [/COMBAT]", () => {
    expect(combatOpen(segments(["@(Talon) Walks"]))).toBe(false);
    expect(combatOpen(segments(["[COMBAT]", "R1", "@(Talon) Attack"]))).toBe(true);
    expect(combatOpen(segments(["[COMBAT]", "@(Talon) Attack", "[/COMBAT]", "@(Talon) Rests"]))).toBe(false);
  });
});

describe("squareNow", () => {
  const map = parseSquareMap(
    'grid: square\ntokens:\n  Talon: C4\n  "[[Kobold, Elite]]": H2\n---\n. . . . . . . .\n. . . . . . . .\n. . . . . . . .\n. . . . . . . .'
  );
  const maps = { "[[Ambush]]": map };

  it("reads where an actor stands in the open fight", () => {
    const b = foldBattles(
      segments(["[COMBAT: [[Ambush]]]", "[Pos: Talon C4; [[Kobold, Elite]] H2]", "R1", "@(Talon) Dash [Mv: E3]"])
    );
    expect(squareNow(b, maps, "Talon")).toBe("E3");
    expect(squareNow(b, maps, "Kobold, Elite")).toBe("H2");
  });

  it("falls back on the map's default spots before anyone is placed", () => {
    const b = foldBattles(segments(["[COMBAT: [[Ambush]]]"]));
    expect(squareNow(b, maps, "Talon")).toBe("C4");
  });

  it("knows nothing once the fight is over", () => {
    const b = foldBattles(segments(["[COMBAT: [[Ambush]]]", "[Pos: Talon C4]", "[/COMBAT]"]));
    expect(squareNow(b, maps, "Talon")).toBeUndefined();
  });
});

describe("withMoveAfter", () => {
  it("puts the move at the end of the action line, after the action", () => {
    expect(withMoveAfter("@(Talon) Shortsword → Kobold\nd: Attack | d20+6=", "j14")).toBe(
      "@(Talon) Shortsword → Kobold [Mv: J14]\nd: Attack | d20+6="
    );
    expect(withMoveAfter("@(Talon) Dash", "")).toBe("@(Talon) Dash");
  });
});
