import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { buildSidebarItems } from "./prose-model";
import { roundEconomies, slotsUsed, withRoundEconomy, type KindOf } from "./round-economy";

const segments = (lines: string[]) => groupIntoProse(parseLonelog(lines.join("\n")));
// Each card as it's taken: Nature's Gift a bonus action, Shield a reaction, the rest actions.
const kindOf: KindOf = (_actor, name, text) => {
  const card = name ?? text.split(/\s+/)[0];
  if (/nature's gift/i.test(card)) return "bonus";
  if (/shield/i.test(card)) return "reaction";
  if (/ducks/i.test(card)) return undefined;
  return "action";
};
const fight = [
  "[COMBAT]",
  "T1",
  "R(Kowyn)",
  '@(Kowyn) @[[Kowyn]].action("Icicle Javelin º") → Kobold',
  "d: Attack | d20+6=17 vs AC 13",
  '@(Kowyn) @[[Kowyn]].action("Nature\'s Gift") → Jacqui',
  "d: Healing | 2d4=8",
  "@(Kowyn) ducks behind a boulder",
  '@(Talon) @[[Talon Pallton|Talon]].action("Shield")',
  "R(Talon)",
  "@(Talon) Longbow → Kobold",
  "d: Attack | d20+6=15 vs AC 12",
  "@(Talon) Longbow → Kobold",
  "d: Attack | d20+6=9 vs AC 12",
];

describe("a round's economy", () => {
  it("counts its owner's action, bonus action and attacks — narration aside", () => {
    const [kowyn, talon] = [...roundEconomies(segments(fight), kindOf).values()];
    expect(kowyn).toMatchObject({ owner: "Kowyn", action: 1, bonus: 1, reaction: 0, attacks: 1, reacted: ["Talon"] });
    expect(kowyn.used).toEqual({ action: ["Icicle Javelin º"], bonus: ["Nature's Gift"], reaction: [] });
    expect(kowyn.reactions).toEqual([{ actor: "Talon", name: "Shield" }]);
    expect(talon).toMatchObject({ action: 2, bonus: 0, reaction: 0, attacks: 2, reacted: [] });
  });

  it("ends with the turn, or the fight", () => {
    const segs = segments(["[COMBAT]", "R(Kowyn)", "@(Kowyn) Dash", "[/COMBAT]", "@(Kowyn) Rests"]);
    expect([...roundEconomies(segs, kindOf).values()][0].action).toBe(1);
  });

  it("counts a Multiattack as one action, its attacks its own — up to its count", () => {
    const multi = (_a: string, name?: string) =>
      name === "Multiattack" ? { count: 2, attacks: ["Parts-Filled Sling"] } : undefined;
    const sling = (to: string) => [
      `@(Tinkerer) @[[Kobold, Tinkerer|Tinkerer]].action("Parts-Filled Sling") → ${to}`,
      "d: Attack | d20+4=21 vs AC 16",
    ];
    const lines = (n: number) => [
      "[COMBAT]",
      "R(Tinkerer)",
      '@(Tinkerer) @[[Kobold, Tinkerer|Tinkerer]].action("Multiattack")',
      ...Array.from({ length: n }, (_, i) => sling(i % 2 ? "Talon" : "Jacqui")).flat(),
    ];
    const [two] = [...roundEconomies(segments(lines(2)), kindOf, multi).values()];
    expect([two.action, two.attacks, two.multiattack?.strikes.length]).toEqual([1, 2, 2]);
    // A third sling is one attack too many: an action of its own, flagged.
    const [three] = [...roundEconomies(segments(lines(3)), kindOf, multi).values()];
    expect([three.action, three.attacks]).toEqual([2, 3]);
  });

  it("draws a Multiattack's line and its attacks together", () => {
    const multi = (_a: string, name?: string) => (name === "Multiattack" ? { count: 2, attacks: [] } : undefined);
    const segs = segments([
      "[COMBAT]",
      "R(Tinkerer)",
      '@(Tinkerer) @[[Kobold, Tinkerer|Tinkerer]].action("Multiattack")',
      '@(Tinkerer) @[[Kobold, Tinkerer|Tinkerer]].action("Sling") → Jacqui',
      "d: Attack | d20+4=21 vs AC 16",
      '@(Tinkerer) @[[Kobold, Tinkerer|Tinkerer]].action("Sling") → Talon',
      "d: Attack | d20+4=9 vs AC 16",
    ]);
    const items = withRoundEconomy(buildSidebarItems(segs), roundEconomies(segs, kindOf, multi));
    const attacks = items.filter((i) => i.kind === "action");
    expect(attacks.map((i) => i.group)).toEqual(["part", "last"]);
    expect(attacks[0].rows[0].pills[0]).toEqual({ name: "Multiattack", value: "2 attacks", kind: "multiattack" });
  });

  it("counts what rides with an attack when it's a bonus action of its own", () => {
    const rides: KindOf = (_a, name) => (name === "Wind Up" ? "bonus" : name === "Mystic Mark" ? undefined : "action");
    const segs = segments([
      "[COMBAT]",
      "R(Lilith)",
      '@(Lilith) @[[Lilith]].action("Glaive") → T. Kobold with @[[Lilith]].action("Wind Up")',
      "d: Attack | d20+5=21 vs AC 12",
      "R(Talon)",
      '@(Talon) @[[Talon Pallton|Talon]].action("Longbow") → Kobold with @[[Talon Pallton|Talon]].action("Mystic Mark")',
      "d: Attack | d20+6=15 vs AC 12",
    ]);
    const [lilith, talon] = [...roundEconomies(segs, rides).values()];
    expect([lilith.action, lilith.bonus]).toEqual([1, 1]);
    expect([talon.action, talon.bonus]).toEqual([1, 0]);
  });

  it("says what a creature has spent now — its round's action and bonus, its reaction since", () => {
    const segs = segments(fight.slice(0, 9));
    const economies = roundEconomies(segs, kindOf);
    expect(slotsUsed(segs, economies, "Kowyn")).toEqual({
      action: ["Icicle Javelin º"],
      bonus: ["Nature's Gift"],
      reaction: [],
    });
    // Talon reacted in Kowyn's round, before his own round came: it's spent.
    expect(slotsUsed(segs, economies, "Talon").reaction).toEqual(["Shield"]);
    const later = segments(fight);
    expect(slotsUsed(later, roundEconomies(later, kindOf), "Kowyn")).toEqual({ action: [], bonus: [], reaction: [] });
  });

  it("groups an Opportunity Attack with the attack it holds — someone else's, in this round", () => {
    const holds = (_a: string, name?: string) =>
      name === "Opportunity Attack" ? { count: 1, attacks: [] } : undefined;
    const reacts: KindOf = (_a, name) => (name === "Opportunity Attack" ? "reaction" : name ? "action" : undefined);
    const segs = segments([
      "[COMBAT]",
      "R(Kobold, Elite)",
      "@(Kobold, Elite) [Mv: L7>I7] Moves",
      '@(Lilith) @[[Lilith]].action("Opportunity Attack")',
      '@(Lilith) @[[Lilith]].action("Glaive") → Kobold, Elite',
      "d: Attack | d20+6=15 vs AC 14",
    ]);
    const economies = roundEconomies(segs, reacts, holds);
    const [elite] = [...economies.values()];
    expect([elite.action, elite.reacted, elite.reactions]).toEqual([
      0,
      ["Lilith"],
      [{ actor: "Lilith", name: "Opportunity Attack" }],
    ]);
    const items = withRoundEconomy(buildSidebarItems(segs), economies);
    const glaive = items.find((i) => i.rows[0]?.content.includes("Glaive"));
    expect(items.some((i) => i.rows[0]?.content.includes("Opportunity Attack"))).toBe(false);
    expect([glaive?.group, glaive?.rows[0].pills[0]]).toEqual([
      "last",
      { name: "Opportunity Attack", value: "1 attack", kind: "multiattack" },
    ]);
  });

  it("spends a reaction from the reactor's own latest round — it lasts until their next", () => {
    const reacts: KindOf = (_a, name) => (name === "Opportunity Attack" ? "reaction" : name ? "action" : undefined);
    const segs = segments([
      "[COMBAT]",
      "T1",
      "R(Lilith)",
      '@(Lilith) @[[Lilith]].action("Glaive") → Kobold, Elite',
      "T2",
      "R(Kobold, Elite)",
      "@(Kobold, Elite) [Mv: L7>I7] Moves",
      '@(Lilith) @[[Lilith]].action("Opportunity Attack")',
    ]);
    const economies = roundEconomies(segs, reacts);
    const [lilith, elite] = [...economies.values()];
    expect([lilith.reaction, lilith.used.reaction]).toEqual([1, ["Opportunity Attack (in Kobold, Elite's round)"]]);
    expect([elite.reaction, elite.reacted]).toEqual([0, ["Lilith"]]);
    expect(slotsUsed(segs, economies, "Lilith").reaction).toEqual(["Opportunity Attack (in Kobold, Elite's round)"]);
  });

  it("is written on the round line", () => {
    const segs = segments(fight);
    const items = withRoundEconomy(buildSidebarItems(segs), roundEconomies(segs, kindOf));
    const line = items.find((i) => i.kind === "turn");
    expect(line?.rows[0].economy?.bonus).toBe(1);
  });
});
