import { describe, expect, it } from "vitest";

import { buildCandidates, sizeVariants, type BuildMonster } from "./build";

const m = (
  name: string,
  cr: number,
  role: BuildMonster["role"],
  subrole: BuildMonster["subrole"],
  legendary = false
) => ({
  note: name,
  name,
  cr,
  role,
  subrole,
  tags: legendary ? (["legendary"] as BuildMonster["tags"]) : [],
});

const pool: BuildMonster[] = [
  m("Dragon", 5, "striker", "solo", true),
  m("Ogre", 2, "soldier", "brute"),
  m("Captain", 2, "leader", "commander"),
  m("Hobgoblin", 0.5, "soldier", "rank-and-file"),
  m("Goblin", 0.25, "soldier", "rank-and-file"),
  m("Kobold", 0.125, "soldier", "rank-and-file"),
  m("Rat", 0, "soldier", "rank-and-file"),
];
const party = { size: 4, averageLevel: 5, benchmark: 4, maxSingleCr: 3 };

describe("buildCandidates", () => {
  it("fills each model the way the book sizes it", () => {
    const built = buildCandidates(["single", "double", "boss", "matched", "horde"], pool, party, 2);
    const of = (model: string) => built.filter((c) => c.model === model);
    expect(of("single")[0]).toMatchObject({ monsters: [{ note: "Dragon", count: 1 }] });
    expect(of("double")[0]).toMatchObject({ monsters: [{ note: "Ogre", count: 2 }] });
    expect(of("boss")[0].monsters[0]).toEqual({ note: "Captain", count: 1 });
    expect(of("boss")[0].monsters[1].count).toBeGreaterThanOrEqual(2);
    expect(of("matched").every((c) => c.monsters[0].count === 4)).toBe(true);
    expect(of("horde")[0].monsters[0].count).toBeGreaterThanOrEqual(6);
    expect(built.some((c) => c.monsters.some((x) => x.note === "Rat"))).toBe(false);
  });

  it("builds nothing toward a benchmark of 0", () => {
    expect(buildCandidates(["single", "horde"], pool, { ...party, benchmark: 0 })).toEqual([]);
  });
});

describe("sizeVariants", () => {
  it("tries the largest group one fewer and one more, but keeps a single or a double as it is", () => {
    const sized = sizeVariants({ model: "matched", monsters: [{ note: "Goblin", count: 4 }], label: "4 Goblin" }, 30);
    expect(sized.map((c) => c.monsters[0].count)).toEqual([4, 3, 5]);
    expect(sized[1].label).toBe("3 Goblin");
    expect(sizeVariants({ model: "double", monsters: [{ note: "Ogre", count: 2 }], label: "2 Ogre" }, 30)).toHaveLength(
      1
    );
  });
});
