import { describe, expect, it } from "vitest";
import { memberTerrainStack, partyTerrainStack } from "./terrain-cards";

describe("terrain cards", () => {
  it("gives the party Navigate and Make Camp, rolled by a member, with the weather's disadvantage", () => {
    const st = partyTerrainStack({ terrain: "forest", weather: "inclement" }, ["Talon", "Lilith"])!;
    expect(st.label).toBe("Forest");
    expect(st.cards.map((c) => c.name)).toEqual(["Navigate", "Make Camp"]);
    expect(st.cards[0].logTemplate).toBe(
      [
        "@(Party) Navigates the forest",
        "d({{who:Talon|Lilith}}): Survival | 2d20kl1+[[Survival]]= vs DC 15 ->",
        "=> {{outcome?}}",
      ].join("\n")
    );
  });

  it("has no camp to make in a city, and nothing off the map", () => {
    expect(partyTerrainStack({ terrain: "urban" }, [])!.cards.map((c) => c.name)).toEqual(["Navigate"]);
    expect(partyTerrainStack({}, ["Talon"])).toBeNull();
    expect(memberTerrainStack({}, "Talon")).toBeNull();
  });

  it("gives each member Forage, Search and Keep Watch, foraging with advantage in nice weather", () => {
    const st = memberTerrainStack({ terrain: "grassland", weather: "nice" }, "Talon")!;
    expect(st.cards.map((c) => c.name)).toEqual(["Forage", "Search the Area", "Keep Watch"]);
    expect(st.cards[0].logTemplate).toContain("d({{actor}}): Survival | 2d20kh1+[[Survival]]= vs DC 15 ->");
    expect(st.cards[0].actor).toBe("Talon");
  });
});
