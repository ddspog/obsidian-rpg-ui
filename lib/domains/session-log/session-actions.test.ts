import { describe, it, expect } from "vitest";
import { actionTemplate, parseDamage, sessionActionCards } from "./session-actions";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { buildSidebarItems } from "./prose-model";
import { resolveLogTemplate } from "./template-resolver";

describe("parseDamage", () => {
  it("reads a statblock's average-then-dice form", () => {
    expect(parseDamage("6 (1d6 + 3) piercing")).toEqual({ dice: "1d6+3", type: "piercing" });
  });

  it("reads plain dice with a type", () => {
    expect(parseDamage("1d8+4 slashing")).toEqual({ dice: "1d8+4", type: "slashing" });
    expect(parseDamage("2d6")).toEqual({ dice: "2d6" });
  });

  it("gives nothing without dice", () => {
    expect(parseDamage("5 piercing")).toBeNull();
  });
});

describe("a heal", () => {
  const gift = {
    name: "Nature's Gift",
    heal: "2d4",
    spends: { resource: "Nature's Gift", amount: 1 },
    bucket: "bonus",
  };

  it("heals its target, and spends a use", () => {
    expect(actionTemplate(gift, { page: "Kowyn", label: "Kowyn" }).split("\n")).toEqual([
      '@({{actor}}) @[[Kowyn]].action("Nature\'s Gift") → {{target}}',
      "d: Healing | 2d4=",
      "=> [{{actor}}/Nature's Gift-1]",
    ]);
  });

  it("is aimed at the party, and says what it heals", () => {
    const [card] = sessionActionCards([gift], "Kowyn", "pc");
    expect(card.targets).toBe("allies");
    expect(card.bucket).toBe("bonus");
    expect(card.summary).toBe("Nature's Gift: heal 2d4 hit points.");
  });
});

describe("an attack that also forces a save", () => {
  it("writes the hit's damage before the save — the save is for what more it does", () => {
    expect(
      actionTemplate({ name: "Magnetobolt º", hit: "6", damage: "1d6 force", save: "STR 14" }).split("\n")
    ).toEqual([
      "@({{actor}}) Magnetobolt º → {{target}}",
      "d: Attack | d20+6= vs AC {{target_ac}} ->",
      "d: Force damage | 1d6=",
      "d: STR save | d20= vs DC 14 ->",
    ]);
  });

  it("writes a save with no attack before its damage — it decides it", () => {
    expect(actionTemplate({ name: "Thunderwave", damage: "2d8 thunder", save: "CON 13" }).split("\n").slice(1)).toEqual(
      ["d: CON save | d20= vs DC 13 ->", "d: Thunder damage | 2d8="]
    );
  });
});

describe("actionTemplate — what an action appends", () => {
  it("rolls an attack and its damage against a target", () => {
    expect(actionTemplate({ name: "Mining Pick", hit: "5", damage: "6 (1d6 + 3) piercing" }).split("\n")).toEqual([
      "@({{actor}}) Mining Pick → {{target}}",
      "d: Attack | d20+5= vs AC {{target_ac}} ->",
      "d: Piercing damage | 1d6+3=",
    ]);
  });

  it("has the target roll a forced save", () => {
    expect(actionTemplate({ name: "Lantern Splash", save: "DEX 12", damage: "2d4 fire" }).split("\n")).toEqual([
      "@({{actor}}) Lantern Splash → {{target}}",
      "d: DEX save | d20= vs DC 12 ->",
      "d: Fire damage | 2d4=",
    ]);
  });

  it("just records an action with nothing to roll", () => {
    expect(actionTemplate({ name: "Dodge" })).toBe("@({{actor}}) Dodge");
  });
});

describe("sessionActionCards", () => {
  it("puts rolls-to-hit in the attack stack and the rest in their bucket, by rank", () => {
    const cards = sessionActionCards(
      [
        { name: "Dash", bucket: "action" },
        { name: "Shortsword", hit: "+6", damage: "1d6+4 piercing", rank: 1 },
      ],
      "Talon",
      "pc"
    );
    expect(cards.map((c) => [c.name, c.bucket])).toEqual([
      ["Shortsword", "attack"],
      ["Dash", "action"],
    ]);
    expect(cards[0].summary).toBe("Shortsword: attack at +6, 1d6+4 piercing damage.");
  });
});

describe("default summaries", () => {
  it("does not double the period after a range like `5 ft.`", () => {
    const [card] = sessionActionCards(
      [{ name: "Dagger", hit: "4", damage: "1d4+2 piercing", range: "reach 5 ft." }],
      "Kobold",
      "foe"
    );
    expect(card.summary).toBe("Dagger: attack at +4, 1d4+2 piercing damage, reach 5 ft.");
  });
});

describe("skill-pick actions — Study, Search, Influence", () => {
  it("reads like a hand-written check: intent, roll with skill and DC, outcome", () => {
    expect(actionTemplate({ name: "Search", skills: ["Perception", "Insight"] }).split("\n")).toEqual([
      "@({{actor}}) {{what_you_do}}",
      "d: d20+[[{{skill:Perception|Insight}}]]= vs DC {{dc}} ->",
      "=> {{outcome?}}",
    ]);
  });

  it("fills into exactly the block a player writes by hand", () => {
    const text = resolveLogTemplate(actionTemplate({ name: "Search", skills: ["Perception", "Insight"] }), {
      actor: "Talon",
      what_you_do: "Checking if the Kobold is lying",
      skill: "Insight",
      dc: "10",
      outcome: "I watched him. Scared, yes. But honest.",
    });
    expect(text).toBe(
      "@(Talon) Checking if the Kobold is lying\nd: d20+[[Insight]]= vs DC 10 ->\n=> I watched him. Scared, yes. But honest."
    );
  });
});

describe("Improvise — a free-form action", () => {
  const tpl = actionTemplate({ name: "Improvise", freeform: true });

  it("asks what happens, then optionally how it turns out", () => {
    expect(tpl.split("\n")).toEqual(["@({{actor}}) {{what_happens}}", "=> {{outcome?}}"]);
  });

  it("fills into the hand-written block, dropping an outcome left blank", () => {
    expect(
      resolveLogTemplate(tpl, {
        actor: "Talon",
        what_happens: "Received [[Kowyn's Bag]] from Kobold.",
        outcome: "And I began to think of what we might gain by keeping him close.",
      })
    ).toBe(
      "@(Talon) Received [[Kowyn's Bag]] from Kobold.\n=> And I began to think of what we might gain by keeping him close."
    );
    expect(resolveLogTemplate(tpl, { actor: "Talon", what_happens: "Waits." })).toBe("@(Talon) Waits.");
  });
});

describe("an action written as a call on its actor's page", () => {
  it("names the action on the actor's page, labelled as the log knows the actor", () => {
    expect(actionTemplate({ name: "Mining Pick", hit: "+5" }, { page: "Kobold, Elite" }).split("\n")[0]).toBe(
      '@({{actor}}) @[[Kobold, Elite]].action("Mining Pick") → {{target}}'
    );
    expect(actionTemplate({ name: "Dash" }, { page: "Talon Pallton", label: "Talon" })).toBe(
      '@({{actor}}) @[[Talon Pallton|Talon]].action("Dash")'
    );
    expect(
      actionTemplate({ name: "Lantern Splash (Recharge 5-6)", save: "DEX 13" }, { page: "Kobold, Elite" }).split(
        "\n"
      )[0]
    ).toContain('.action("Lantern Splash (Recharge 5-6)") → {{target}}');
  });

  it("writes the plain name when no page is known", () => {
    expect(actionTemplate({ name: "Shove" })).toBe("@({{actor}}) Shove");
  });

  it("still reads as an attack on its target", () => {
    const items = buildSidebarItems(
      groupIntoProse(
        parseLonelog('@(Kobold, Elite) @[[Kobold, Elite]].action("Mining Pick") → Kowyn\nd: Attack | d20+5=18')
      )
    );
    expect(items[0].rows[0].content).toContain("→ Kowyn");
  });
});

describe("actionTemplate — ammunition", () => {
  it("spends a piece of ammunition each shot, from where it's carried", () => {
    const t = actionTemplate({
      name: "Longbow",
      hit: "+5",
      damage: "1d8+3 piercing",
      ammo: { item: "Arrows", path: ["Quiver"] },
    });
    expect(t.split("\n").pop()).toBe("=> [Inv:{{actor}}/Quiver/[[Arrows]]-1]");
  });
});
