import { describe, expect, it } from "vitest";
import { fillSummon, ordinal, parseSummonBlock, summonVars } from "./summon";

const LEVIATHAN = parseSummonBlock({
  name: "Leviathan Avatar",
  type: "Huge Monstrosity",
  params: {
    circle: { label: "Circle", min: 7, max: 9, default: 7, ordinal: true },
    attack: { label: "Spell attack", default: 9, from: "pb + max(mod_int, mod_wis, mod_cha)" },
  },
  stats: { ac: "{{ 13 + circle }}", hp: "{{ 70 + 10 * (circle - 7) }}", speed: "10 ft., swim 50 ft." },
  abilities: { str: 5, dex: 0 },
  features: [
    { ref: "@[[Traits]]#Amphibious" },
    { name: "Multiattack", type: "action", text: "It makes {{ floor(circle / 2) }} Rend attacks." },
    { name: "Rend", type: "action", text: "+{{ attack }} to hit." },
  ],
  forms: [{ name: "Deep", stats: { speed: "swim 80 ft." }, features: [{ name: "Dive", text: "It dives." }] }],
});

describe("stat.summon", () => {
  it("reads params written as a map, and keeps them in bounds", () => {
    expect(LEVIATHAN.params.map((p) => p.name)).toEqual(["circle", "attack"]);
    expect(summonVars(LEVIATHAN, {})).toMatchObject({ circle: 7, attack: 9 });
    expect(summonVars(LEVIATHAN, { circle: 12 })).toMatchObject({ circle: 9 });
    // From a summoner: PB 4, WIS +3.
    expect(summonVars(LEVIATHAN, {}, { pb: 4, mod_int: 0, mod_wis: 3, mod_cha: 1 })).toMatchObject({
      attack: 7,
      pb: 4,
    });
  });

  it("fills its stats and features with formula spans, and passes the values to refs", () => {
    const filled = fillSummon(LEVIATHAN, summonVars(LEVIATHAN, { circle: 8 }), "Deep");
    expect(filled.stats.ac).toContain('data-formula="13 + circle"');
    expect(filled.stats.ac).toContain(">21</span>");
    expect(filled.stats.hp).toContain(">80</span>");
    expect(filled.stats.speed).toBe("swim 80 ft.");
    expect(filled.features.map((f) => f.name)).toEqual(["Multiattack", "Rend", "Dive"]);
    expect(filled.features[0].text).toContain(">4</span> Rend attacks");
    expect(filled.refs).toEqual([expect.objectContaining({ ref: "@[[Traits]]#Amphibious", circle: 8 })]);
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 21].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "21st"]);
  });
});
