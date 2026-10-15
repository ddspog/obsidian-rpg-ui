import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import { foldBattles } from "./battle";
import { checkMoves, parseMoveGrant, routeFeet } from "./movement-rules";
import { parseSquare, parseSquareMap, type Square } from "./square-map";

const sq = (...names: string[]) => names.map((n) => parseSquare(n) as Square);

describe("routeFeet", () => {
  it("costs 5 ft a square, a diagonal too", () => {
    expect(routeFeet(sq("C4", "D4", "E5", "E7"))).toBe(5 + 5 + 10);
  });

  it("counts every second diagonal twice on an `alternate` map, and difficult squares double", () => {
    const map = parseSquareMap(
      "diagonals: alternate\nlegend:\n  '~': { terrain: mud, difficult: true }\n---\n. . . .\n. . . .\n. . ~ .\n. . . ."
    );
    expect(routeFeet(sq("A1", "B2", "C3"), { ...map, cells: map.cells.map((r) => r.map(() => ".")) })).toBe(5 + 10);
    expect(routeFeet(sq("A1", "B1", "C1"), map)).toBe(10);
    expect(routeFeet(sq("B3", "C3"), map)).toBe(10);
  });
});

describe("checkMoves", () => {
  const log = (lines: string[]) =>
    foldBattles(
      groupIntoProse(
        parseLonelog(
          ["[Init: Lilith 15 @C4; [[Kobold, Elite]] 12 @D4]", "[COMBAT: [[Ambush]]]", "T1", ...lines].join("\n")
        )
      )
    )[0];
  const info = (name: string) => ({ speed: /lilith/i.test(name) ? 30 : 30, reach: 5, foe: /kobold/i.test(name) });
  const round =
    (dashed = false, disengaged = false, current = true) =>
    () => ({ dashed, disengaged, start: 0, current });

  it("adds a round's moves against its speed, and says who it provoked", () => {
    const b = log(["R(Lilith)", "@(Lilith) [Mv: C6] Glaive → Kobold, Elite", "@(Lilith) Steps away [Mv: C11]"]);
    const checks = [...checkMoves(b, undefined, info, round()).values()].flat();
    expect(checks.map((c) => [c.feet, c.spent, c.allowance, c.provokes])).toEqual([
      [10, 10, 30, ["[[Kobold, Elite]]"]],
      [25, 35, 30, []],
    ]);
  });

  it("provokes no one once it Disengaged, and a Dash doubles what it may walk", () => {
    const b = log(["R(Lilith)", "@(Lilith) Steps away [Mv: C8]"]);
    const [c] = [...checkMoves(b, undefined, info, round(true, true)).values()].flat();
    expect([c.provokes, c.allowance]).toEqual([[], 60]);
  });

  it("isn't provoked by a foe that's down", () => {
    const b = log(["R(Lilith)", "@(Lilith) Steps away [Mv: C8]"]);
    const [c] = [...checkMoves(b, undefined, info, round(), (name) => /kobold/i.test(name)).values()].flat();
    expect(c.provokes).toEqual([]);
  });

  it("says when a condition holds it at speed 0", () => {
    const b = log(["R(Lilith)", "=> [PC:Lilith|+grappled]", "@(Lilith) Struggles [Mv: C5]"]);
    const checks = [...checkMoves(b, undefined, info, round()).values()].flat();
    expect(checks[checks.length - 1]?.held).toBe("grappled");
  });
});

describe("a move an effect grants", () => {
  it("is read off the card's text — feet, half or all its speed, provoking or not; a Dash isn't one", () => {
    expect(parseMoveGrant("Scurry", "The Humanoid moves up to 15 feet without provoking Opportunity Attacks.")).toEqual(
      {
        limit: 15,
        noProvoke: true,
        from: "Scurry",
      }
    );
    expect(parseMoveGrant("Fall Back", "As a reaction, you move up to half your speed.")).toEqual({
      limit: "half",
      noProvoke: false,
      from: "Fall Back",
    });
    expect(parseMoveGrant("Dash", "Move up to your speed, effectively doubling your movement.")).toBeUndefined();
  });

  const log = (lines: string[]) =>
    foldBattles(
      groupIntoProse(
        parseLonelog(
          ["[Init: Lilith 15 @C4; [[Kobold, Elite]] 12 @D4]", "[COMBAT: [[Ambush]]]", "T1", ...lines].join("\n")
        )
      )
    )[0];
  const info = (name: string) => ({ speed: 30, reach: 5, foe: /kobold/i.test(name) });

  it("keeps to its own limit, apart from the round's speed — and provokes no one when it says so", () => {
    const b = log(["R(Kobold, Elite)", "@(Kobold, Elite) Scurry [Mv: D7]"]);
    const scurry = { limit: 15, noProvoke: true, from: "Scurry" };
    const [c] = [
      ...checkMoves(
        b,
        undefined,
        info,
        () => ({ dashed: false, disengaged: false, start: 0, current: true }),
        undefined,
        () => scurry
      ).values(),
    ].flat();
    expect([c.feet, c.spent, c.allowance, c.granted, c.provokes]).toEqual([15, 15, 15, "Scurry", []]);
  });

  it("says a plain move outside the creature's own round", () => {
    const b = log(["R(Kobold, Elite)", "@(Lilith) Steps [Mv: C5]"]);
    const [c] = [
      ...checkMoves(b, undefined, info, () => ({
        dashed: false,
        disengaged: false,
        start: 0,
        current: false,
      })).values(),
    ].flat();
    expect([c.offTurn, c.allowance]).toEqual([true, undefined]);
  });
});
