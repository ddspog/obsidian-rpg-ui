import { describe, expect, it } from "vitest";
import { emptyGrid } from "lib/domains/hexmap/terrain";
import { landRolls } from "./five-miles";

describe("five-mile rolls", () => {
  it("gives each hex entered its terrain's table, one roll per five miles", () => {
    const grid = emptyGrid();
    grid.terrain.set("1,0", "forest");
    grid.terrain.set("2,0", "water");
    grid.terrain.set("3,0", "mountain");
    const rolls = landRolls(
      [1, 2, 3].map((q) => ({ q, r: 0 })),
      grid,
      6
    );
    expect(rolls.map((r) => [r.table, r.rolls])).toEqual([
      ["overarching-terrain-forest-jungle", 1],
      ["overarching-terrain-mountains", 1],
    ]);
    expect(landRolls([{ q: 1, r: 0 }], grid, 30)[0].rolls).toBe(6);
  });
});
