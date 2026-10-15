import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { buildSidebarItems, checkResult, withCheckResults } from "./prose-model";
import { parseLogTemplate, requiredFilled, resolveLogTemplate } from "./template-resolver";
import { foldHealth, leftWith, withTargetAc, withTargetHealth } from "./health";

const segments = (lines: string[]) => groupIntoProse(parseLonelog(lines.join("\n")));
const sheets: Record<string, { current: number; max: number }> = {
  talon: { current: 10, max: 10 },
  "kobold, elite": { current: 26, max: 26 },
};
const start = (name: string) => sheets[name.replace(/\[\[|\]\]/g, "").toLowerCase()];

describe("an attack against an AC", () => {
  it("hits or misses, the result against the AC", () => {
    expect(checkResult("Attack | d20+4=17 vs AC 17", {})).toBe("Hit");
    expect(checkResult("Attack | d20+4=16 vs AC 17", {})).toBe("Miss");
    expect(checkResult("Insight | d20+2=10 vs DC 10", {})).toBe("Success");
  });
});

describe("healing", () => {
  const healed = [
    "@(Kobold, Tinkerer) Parts-Filled Sling → Talon",
    "d: Attack | d20+4=22 vs AC 17 ->",
    "d: Damage | 1d4+2=6",
    '@(Kowyn) @[[Kowyn]].action("Nature\'s Gift") → Talon',
    "d: Healing | 2d4=3",
    '@(Kowyn) @[[Kowyn]].action("Nature\'s Gift") → Talon',
    "d: Healing | 2d4=8",
  ];

  it("gives its target hit points back, up to their max", () => {
    const h = foldHealth(segments(healed), start);
    const [, first, second] = [...h.hits.values()];
    expect(first).toEqual({ target: "Talon", damage: 0, healed: 3, health: { current: 7, max: 10 } });
    expect(second.health).toEqual({ current: 10, max: 10 });
    expect(h.now("Talon")).toEqual({ current: 10, max: 10 });
  });

  it("says on the healing row what it left them with", () => {
    const h = foldHealth(segments(healed), start);
    const items = withTargetHealth(buildSidebarItems(segments(healed)), h.hits);
    const row = items[1].rows.find((r) => r.content.startsWith("Healing"));
    expect(row?.leaves).toEqual({ target: "Talon", left: "7/10 HP" });
  });
});

describe("foldHealth", () => {
  const fight = [
    "[COMBAT]",
    "T1",
    "@(Kobold, Tinkerer) Parts-Filled Sling → Talon",
    "d: Attack | d20+4=22 vs AC 17 ->",
    "d: Damage | 1d4+2=4",
    "@(Kobold, Tinkerer) Parts-Filled Sling → Talon",
    "d: Attack | d20+4=7 vs AC 17 ->",
    "d: Damage | 1d4+2=6",
  ];

  it("takes a hit's damage — its result — from its target", () => {
    const h = foldHealth(segments(fight), start);
    const [first, second] = [...h.hits.values()];
    expect(first).toEqual({ target: "Talon", hit: true, damage: 4, health: { current: 6, max: 10 } });
    expect(second).toEqual({ target: "Talon", hit: false, damage: 0, health: { current: 6, max: 10 } });
    expect(h.now("Talon")).toEqual({ current: 6, max: 10 });
  });

  it("lets an HP tag written for the target be the record instead", () => {
    const h = foldHealth(
      segments([
        "[COMBAT]",
        "@(Talon) Shortsword → Kobold, Elite",
        "d: Attack | d20+6=19 vs AC 14 ->",
        "d: Piercing damage | 1d6+4=8",
        "=> I found the gap in its leather. [F:[[Kobold, Elite]]|HP-8]",
      ]),
      start
    );
    expect([...h.hits.values()][0]).toMatchObject({
      target: "Kobold, Elite",
      hit: true,
      damage: 8,
      health: { current: 18, max: 26 },
    });
  });

  it("starts a foe from its [F:] tag, and tells the health as of any entry", () => {
    const segs = segments([
      "? Combat begins. [F:Fat [[Kobold, A]]|HP 9]",
      "[COMBAT]",
      "@(Jacqui) Longsword → Fat Kobold, A",
      "d: Attack | d20+5=18 vs AC 12 ->",
      "d: Slashing damage | 1d8+3=8",
    ]);
    const h = foldHealth(segs, start);
    expect(h.now("Fat Kobold, A")).toEqual({ current: 1, max: 9 });
    expect(h.at(segs[0].sourceIndex, "Fat Kobold, A")).toEqual({ current: 9, max: 9 });
  });
});

describe("an AC left to the target", () => {
  const acs: Record<string, number> = { talon: 15, jacqui: 16 };
  const acOf = (name: string) => acs[name.toLowerCase()];

  it("judges a bare `vs AC`, or an attack with no `vs`, against the target's", () => {
    const h = foldHealth(
      segments([
        "[COMBAT]",
        "@(Kobold) Sling → Talon",
        "d: Attack | d20+4=15 vs AC ->",
        "d: Damage | 1d4+2=4",
        "@(Kobold) Sling → Jacqui",
        "d: Attack | d20+4=15",
        "d: Damage | 1d4+2=6",
      ]),
      start,
      acOf
    );
    const [talon, jacqui] = [...h.hits.values()];
    expect(talon).toMatchObject({ target: "Talon", hit: true, damage: 4 });
    expect(jacqui).toMatchObject({ target: "Jacqui", hit: false, damage: 0 });
  });

  it("shows the Log's attack rows against it", () => {
    const items = withCheckResults(
      withTargetAc(
        buildSidebarItems(segments(["@(Kobold) Sling → Talon", "d: Attack | d20+4=17", "d: Damage | 1d4+2=4"])),
        acOf
      )
    );
    const attack = items[0].rows.find((r) => /Attack/.test(r.content))!;
    expect(attack.content).toBe("Attack | d20+4=17 vs AC → Hit");
    expect(attack.vars).toMatchObject({ AC: 15 });
  });
});

describe("a card's Target AC, left blank", () => {
  const card = "@({{actor}}) Sling → {{target}}\nd: Attack | d20+4= vs AC {{target_ac}} ->";

  it("isn't required, and writes a bare `vs AC`", () => {
    const slots = parseLogTemplate(card).filter((p) => p.kind !== "actor");
    expect(requiredFilled(slots, { target: "Talon", target_ac: "" })).toBe(true);
    expect(resolveLogTemplate(card, { actor: "Kobold", target: "Talon", target_ac: "" })).toBe(
      "@(Kobold) Sling → Talon\nd: Attack | d20+4= vs AC ->"
    );
    expect(resolveLogTemplate(card, { actor: "Kobold", target: "Talon", target_ac: "17" })).toContain("vs AC 17 ->");
  });
});

describe("what the damage leaves, on the Log's last damage row", () => {
  it("comes after every die of it — a rider's too — and says KO at 0", () => {
    const segs = segments([
      "? Fight. [F:Fat [[Kobold, A]]|HP 9]",
      "[COMBAT]",
      "@(Talon) Longbow → Fat Kobold, A with Mystic Mark",
      "d: Attack | d20+6=15 vs AC 12 ->",
      "d: Piercing damage | 1d8+4=8",
      "d: Mystic Mark damage | 1d4=3",
      "=> [F:Fat Kobold, A|+marked] [Talon/Mystic Mark-1]",
    ]);
    const items = withTargetHealth(withCheckResults(buildSidebarItems(segs)), foldHealth(segs, () => undefined).hits);
    const rows = items.find((i) => i.kind === "action")!.rows;
    expect(rows.find((r) => /Piercing/.test(r.content))?.leaves).toBeUndefined();
    // The target named once, as the log wrote it (its link), with what it's left with.
    expect(rows.find((r) => /Mystic Mark damage/.test(r.content))?.leaves).toEqual({
      target: "Fat [[Kobold, A]]",
      left: "KO",
    });
    expect(rows.some((r) => r.foe && /Fat/.test(r.content))).toBe(false);
    // The bookkeeping line shows no text of its own.
    expect(rows.some((r: { content: string }) => r.content.includes("[F:"))).toBe(false);
  });
});

describe("life and death at 0 HP", () => {
  const party = (name: string) => /talon|lilith/i.test(name);
  const fold = (lines: string[]) => foldHealth(segments(["[COMBAT]", "T1", ...lines]), start, () => undefined, party);
  const hitTalon = (n: number) => [
    "@(Kobold, Elite) Mining Pick → Talon",
    "d: Attack | d20+5=20 vs AC 15",
    `d: Damage | 1d6+3=${n}`,
  ];

  it("leaves a PC dying at 0 — killed outright only by damage past its maximum", () => {
    expect(fold(hitTalon(12)).now("Talon")).toEqual({
      current: 0,
      max: 10,
      life: { state: "dying", successes: 0, failures: 0 },
    });
    expect(fold(hitTalon(20)).now("Talon")?.life?.state).toBe("dead");
  });

  it("counts death saves — a 1 two failures, three of them death; a 20 back at 1 HP", () => {
    const save = (n: number) => ["@(Talon) Death save", `d: Death save | d20=${n} vs DC 10`];
    expect(fold([...hitTalon(12), ...save(12), ...save(4)]).now("Talon")?.life).toEqual({
      state: "dying",
      successes: 1,
      failures: 1,
    });
    expect(fold([...hitTalon(12), ...save(1), ...save(4)]).now("Talon")?.life?.state).toBe("dead");
    expect(fold([...hitTalon(12), ...save(20)]).now("Talon")).toEqual({ current: 1, max: 10 });
    expect(fold([...hitTalon(12), ...save(12), ...save(15), ...save(10)]).now("Talon")?.life?.state).toBe("stable");
  });

  it("fails a death save on damage at 0, and brings the dying back with healing — not the dead", () => {
    const healTalon = ["@(Kowyn) Nature's Gift → Talon", "d: Healing | 2d4=5"];
    expect(fold([...hitTalon(12), ...hitTalon(2)]).now("Talon")?.life).toEqual({
      state: "dying",
      successes: 0,
      failures: 1,
    });
    expect(fold([...hitTalon(12), ...healTalon]).now("Talon")).toEqual({ current: 5, max: 10 });
    const late = fold([...hitTalon(25), ...healTalon]);
    expect(late.now("Talon")?.life?.state).toBe("dead");
    expect([...late.hits.values()].pop()?.wasted).toBe(true);
  });

  it("drops a monster dead at 0", () => {
    const h = fold(["@(Talon) Longbow → Kobold, Elite", "d: Attack | d20+6=20 vs AC 14", "d: Damage | 1d8+4=30"]);
    expect(h.now("Kobold, Elite")?.life).toEqual({ state: "dead", successes: 0, failures: 0, monster: true });
  });
});

describe("leftWith", () => {
  it("says what a creature's left with — HP, or how it stands at 0", () => {
    expect(leftWith({ current: 6, max: 10 })).toBe("6/10 HP");
    expect(leftWith({ current: 0, max: 26, life: { state: "dead", successes: 0, failures: 0, monster: true } })).toBe(
      "KO"
    );
    expect(leftWith({ current: 0, max: 10, life: { state: "dying", successes: 1, failures: 2 } })).toBe(
      "dying (1✓ 2✗)"
    );
    expect(leftWith({ current: 0, max: 10, life: { state: "dead", successes: 0, failures: 0 } }, true)).toBe(
      "dead — healing can't help"
    );
  });
});

describe("a critical hit, and being stabilized", () => {
  const party = (name: string) => /talon/i.test(name);
  const fold = (lines: string[]) => foldHealth(segments(["[COMBAT]", "T1", ...lines]), start, () => undefined, party);
  const down = ["@(Kobold, Elite) Mining Pick → Talon", "d: Attack | d20+5=20 vs AC 15", "d: Damage | 1d6+3=12"];

  it("counts a crit on a dying PC as two failures — a natural 20, kept from a pool too", () => {
    const crit = (attack: string) => [
      "@(Kobold, Elite) Mining Pick → Talon",
      `d: Attack | ${attack} vs AC 15`,
      "d: Damage | 1d6+3=5",
    ];
    expect(fold([...down, ...crit("d20+5=25")]).now("Talon")?.life?.failures).toBe(2);
    expect(fold([...down, ...crit("2d20kh1+5=[20,3]=25")]).now("Talon")?.life?.failures).toBe(2);
    expect(fold([...down, ...crit("d20+5=24")]).now("Talon")?.life?.failures).toBe(1);
  });

  it("stops a dying PC's death saves once stabilized", () => {
    const h = fold([...down, "@(Kowyn) Stabilizes Talon", "d: Medicine | d20+2=14 vs DC 10", "=> [PC:Talon|+stable]"]);
    expect(h.now("Talon")).toEqual({ current: 0, max: 10, life: { state: "stable", successes: 0, failures: 0 } });
  });
});

describe("healing with no target named", () => {
  it("heals whoever rolls it — a hit die spent on a short rest", () => {
    const h = foldHealth(
      segments([
        "@(Kobold, Elite) Mining Pick → Talon",
        "d: Attack | d20+5=20 vs AC 15",
        "d: Damage | 1d6+3=6",
        "@(Party) Short rest",
        "@(Talon) Spends a hit die",
        "d: Healing | 1d10+0=4",
      ]),
      start
    );
    expect(h.now("Talon")).toEqual({ current: 8, max: 10 });
  });
});
