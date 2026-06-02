import { describe, expect, it } from "vitest";
import { parseStatVehicleBlock } from "./parse-stat-block";

describe("parseStatVehicleBlock", () => {
  it("parses a full vehicle statblock", () => {
    const source = `name: Galley
size: Gargantuan
type: Water Vehicle
dimensions: 130 ft. by 20 ft.
stats:
  ac: 15 (damage threshold 20)
  hp: 500
  speed: 35 ft., 4 mph (96 miles per day)
  immune: Vehicle Resilience
  initiative: 4
  crew: 80
  passengers: 40
  cargo: 150 tons
abilities:
  str: 7
  dex: -3
  con: 5
  int: 0
  wis: 0
  cha: 0
features:
  - ref: "[[Sails]]"
  - ref: "[[Fire Ballista]]"
    hit: 7
    range: 120/480 ft.
    targets: one target
    damage: 23 (3d10 + 7) piercing damage
---
On its turn, the galley can take two actions.`;

    const result = parseStatVehicleBlock(source);

    expect(result.name).toBe("Galley");
    expect(result.size).toBe("Gargantuan");
    expect(result.type).toBe("Water Vehicle");
    expect(result.dimensions).toBe("130 ft. by 20 ft.");
    expect(result.stats.ac).toBe("15 (damage threshold 20)");
    expect(result.stats.hp).toBe("500");
    expect(result.stats.crew).toBe("80");
    expect(result.abilities).toEqual({ str: 7, dex: -3, con: 5, int: 0, wis: 0, cha: 0 });
    expect(result.features).toHaveLength(2);
    expect(result.features[0]).toEqual({ ref: "[[Sails]]" });
    expect(result.features[1]).toEqual({
      ref: "[[Fire Ballista]]",
      hit: 7,
      range: "120/480 ft.",
      targets: "one target",
      damage: "23 (3d10 + 7) piercing damage",
    });
    expect(result.text).toBe("On its turn, the galley can take two actions.");
  });

  it("handles missing optional fields", () => {
    const source = `name: Rowboat
size: Large
type: Water Vehicle
stats:
  hp: 50
abilities:
  str: 3
  dex: 0
  con: 2
  int: 0
  wis: 0
  cha: 0
features: []`;

    const result = parseStatVehicleBlock(source);

    expect(result.name).toBe("Rowboat");
    expect(result.dimensions).toBeUndefined();
    expect(result.text).toBeUndefined();
    expect(result.features).toEqual([]);
  });

  it("normalizes bare wikilink features", () => {
    const source = `name: Test
size: Medium
type: Land Vehicle
stats: {}
abilities:
  str: 0
  dex: 0
  con: 0
  int: 0
  wis: 0
  cha: 0
features:
  - "[[Dash]]"
  - "[[Ram]]"`;

    const result = parseStatVehicleBlock(source);

    expect(result.features).toEqual([
      { ref: "[[Dash]]" },
      { ref: "[[Ram]]" },
    ]);
  });

  it("handles source with no separator", () => {
    const source = `name: Cart
size: Large
type: Land Vehicle
stats:
  hp: 20
abilities:
  str: 2
  dex: -2
  con: 1
  int: 0
  wis: 0
  cha: 0
features: []`;

    const result = parseStatVehicleBlock(source);

    expect(result.text).toBeUndefined();
  });
});
