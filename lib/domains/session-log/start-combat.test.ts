import { describe, it, expect } from "vitest";
import { parseFoeList, startCombatText, SURPRISE_OPENINGS } from "./start-combat";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { buildSidebarItems } from "./prose-model";
import { foldBattles } from "lib/domains/battlemap/battle";

describe("startCombatText — the block a combat opens with", () => {
  const combatants = [
    { name: "Talon", modifier: 4, face: 10 },
    { name: "[[Kobold, Elite]]", foe: true, modifier: 3, hp: 26, face: 17 },
    { name: "Fat [[Kobold, A]]", foe: true, modifier: 4, hp: 9, face: 5 },
    { name: "Lilith", modifier: 1, face: 1 },
  ];

  it("adds the foes with their HP, rolls everyone, and opens the combat", () => {
    expect(
      startCombatText({
        question: "Combat begins with no one surprised.",
        narration: "We were surrounded.",
        combatants,
      }).split("\n")
    ).toEqual([
      "? Combat begins with no one surprised. [F:[[Kobold, Elite]]|HP 26] [F:Fat [[Kobold, A]]|HP 9]",
      "=> We were surrounded.",
      "[Init: [[Kobold, Elite]] d20+[[Initiative]]=20; Talon d20+[[Initiative]]=14; Fat [[Kobold, A]] d20+[[Initiative]]=9; Lilith d20+[[Initiative]]=2]",
      "[COMBAT]",
      "T1",
    ]);
  });

  it("leaves out narration left blank, and rolls a bare d20 without a known modifier", () => {
    const text = startCombatText({ question: "Combat begins.", combatants: [{ name: "Marcel", face: 12 }] });
    expect(text.split("\n")).toEqual(["? Combat begins.", "[Init: Marcel d20=12]", "[COMBAT]", "T1"]);
  });

  it("reads back in the Log as the foes, the initiative order, and round 1", () => {
    const items = buildSidebarItems(
      groupIntoProse(parseLonelog(startCombatText({ question: "Combat begins.", combatants })))
    );
    const rows = items.flatMap((i) => i.rows.map((r) => (r.label ? `${r.label} ` : "") + r.content));
    expect(rows).toContain("[[Kobold, Elite]]");
    expect(rows).toContain("Initiative");
    expect(rows.filter((r) => r.includes("d20+[[Initiative]]")).map((r) => r.split(" d20")[0])).toEqual([
      "Kobold, Elite",
      "Talon",
      "Fat Kobold, A",
      "Lilith",
    ]);
    expect(rows).toContain("Turn 1");
  });
});

describe("parseFoeList", () => {
  it("reads one foe per line, with the statblock each links to", () => {
    expect(parseFoeList("[[Kobold, Elite]]\n- Fat [[Kobold, A]]\n\nA bandit")).toEqual([
      { name: "[[Kobold, Elite]]", link: "Kobold, Elite" },
      { name: "Fat [[Kobold, A]]", link: "Kobold, A" },
      { name: "A bandit" },
    ]);
  });
});

describe("surprise", () => {
  const combatants = [
    { name: "Talon", modifier: 4, face: 10 },
    { name: "Lilith", modifier: 1, face: 1 },
    { name: "[[Kobold, Elite]]", foe: true, modifier: 3, hp: 26, face: 17 },
  ];

  it("gives each surprised PC the condition with `+surprised`, after the narration", () => {
    const lines = startCombatText({
      question: SURPRISE_OPENINGS.party,
      narration: "They came from the rocks.",
      combatants,
      surprise: "party",
    }).split("\n");
    expect(lines.slice(0, 3)).toEqual([
      "? Combat begins — the party is caught off guard. [F:[[Kobold, Elite]]|HP 26]",
      "=> They came from the rocks.",
      "=> The party is surprised. [PC:Talon|+surprised] [PC:Lilith|+surprised]",
    ]);
  });

  it("tags each surprised foe", () => {
    const lines = startCombatText({ question: SURPRISE_OPENINGS.foes, combatants, surprise: "foes" }).split("\n");
    expect(lines[1]).toBe("=> The foes are surprised. [F:[[Kobold, Elite]]|+surprised]");
  });

  it("adds nothing when no one is surprised", () => {
    const text = startCombatText({ question: SURPRISE_OPENINGS.none, combatants, surprise: "none" });
    expect(text.split("\n")[0]).toBe("? Combat begins with no one surprised. [F:[[Kobold, Elite]]|HP 26]");
    expect(text).not.toContain("surprised]");
  });

  it("still lists the surprised foe once, with its HP, in the Log", () => {
    const items = buildSidebarItems(
      groupIntoProse(parseLonelog(startCombatText({ question: "Combat begins.", combatants, surprise: "foes" })))
    );
    const foeRows = items.flatMap((i) => i.rows).filter((r) => r.foe);
    expect(foeRows.map((r) => [r.content, r.foe?.current])).toEqual([["[[Kobold, Elite]]", 26]]);
  });
});

describe("a fight on a battle map", () => {
  it("binds the map and places everyone in the initiative list", () => {
    const text = startCombatText({
      question: "Combat begins.",
      map: "[[Kobold Ambush]]",
      combatants: [
        { name: "Talon", modifier: 4, face: 10, at: "c4" },
        { name: "[[Kobold, Elite]]", foe: true, hp: 26, modifier: 3, face: 17, at: "H2" },
        { name: "Lilith", modifier: 1, face: 1 },
      ],
    });
    expect(text.split("\n").slice(-3)).toEqual([
      "[Init: [[Kobold, Elite]] d20+[[Initiative]]=20 @H2; Talon d20+[[Initiative]]=14 @C4; Lilith d20+[[Initiative]]=2]",
      "[COMBAT: [[Kobold Ambush]]]",
      "T1",
    ]);
  });

  it("names a map the log keeps in its header plainly", () => {
    const text = startCombatText({ question: "Combat begins.", map: "Clearing", combatants: [] });
    expect(text.split("\n").slice(-2)).toEqual(["[COMBAT: Clearing]", "T1"]);
  });

  it("reads back as a battle with everyone placed", () => {
    const text = startCombatText({
      question: "Combat begins.",
      map: "[[Kobold Ambush]]",
      combatants: [{ name: "Talon", modifier: 4, face: 10, at: "C4" }],
    });
    const [battle] = foldBattles(groupIntoProse(parseLonelog(text)));
    expect(battle.map).toBe("[[Kobold Ambush]]");
    expect(battle.frames[0].placements).toEqual([{ name: "Talon", at: { col: 2, row: 3 } }]);
  });
});
