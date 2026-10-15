import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { actorLabel, assembleProse, buildSidebarItems } from "./prose-model";
import { combatClock } from "./turns";

const segments = (lines: string[]) => groupIntoProse(parseLonelog(lines.join("\n")));
const init = "[Init: [[Kobold, Elite]] 20; Thin [[Kobold, A]] 18; Talon 14; Lilith 2]";

describe("T1 and R(Name) — the table's turns and rounds", () => {
  it("reads T1 as a turn (a pass through the order), as Lonelog's R1", () => {
    for (const marker of ["T2", "R2"]) {
      const item = buildSidebarItems(segments(["[COMBAT]", marker])).find((i) => i.kind === "round");
      expect(item?.rows[0].content).toBe("Turn 2");
    }
  });

  it("reads R(Talon) as Talon's round in it", () => {
    const segs = segments(["[COMBAT]", "T1", "R(Talon)"]);
    expect(segs.some((s) => s.type === "turn" && s.actor === "Talon")).toBe(true);
    const item = buildSidebarItems(segs).find((i) => i.kind === "turn");
    expect(item?.rows[0].content).toBe("Talon's round");
  });
});

describe("combatClock", () => {
  it("is null outside a fight", () => {
    expect(combatClock(segments(["@(Talon) Walks"]))).toBeNull();
    expect(combatClock(segments(["[COMBAT]", "R1", "[/COMBAT]"]))).toBeNull();
  });

  it("counts the turn, and starts the order at the top of a new one", () => {
    const clock = combatClock(segments([init, "[COMBAT]", "T2"]));
    expect(clock).toEqual({ round: 2, next: ["Kobold, Elite", "Thin Kobold, A", "Talon", "Lilith"] });
  });

  it("puts whoever follows the last to act first — by action or by R(Name)", () => {
    expect(combatClock(segments([init, "[COMBAT]", "R1", "@(Kobold, Elite) Strikes"]))?.next[0]).toBe("Thin Kobold, A");
    expect(combatClock(segments([init, "[COMBAT]", "T1", "R(Talon)"]))?.next).toEqual([
      "Lilith",
      "Kobold, Elite",
      "Thin Kobold, A",
      "Talon",
    ]);
  });

  it("skips those out of the fight, and is empty with no initiative", () => {
    const clock = combatClock(segments([init, "[COMBAT]", "R1"]), (n) => n === "Thin Kobold, A");
    expect(clock?.next).toEqual(["Kobold, Elite", "Talon", "Lilith"]);
    expect(combatClock(segments(["[COMBAT]", "R1"]))?.next).toEqual([]);
  });
});

describe("a fight in the prose", () => {
  it("is a section of its own: turns, and each action told beside its actor", () => {
    const scenes = assembleProse(
      segments([
        "=> We were surrounded.",
        "[COMBAT: Clearing]",
        "T1",
        "@(Kobold, Tinkerer) Parts-Filled Sling → Talon",
        "d: Attack | d20+4=18 vs AC 17 ->",
        "=> A tin canister burst in the air.",
        "@(Talon) Shortsword → Kobold, Elite",
        "=> I found the gap in its leather.",
        "T2",
        "[/COMBAT]",
        "=> Quiet again.",
      ])
    );
    const nodes = scenes[0].nodes;
    expect(nodes.map((n) => n.kind)).toEqual(["paragraph", "combat", "paragraph"]);
    const fight = nodes[1] as Extract<(typeof nodes)[number], { kind: "combat" }>;
    expect(
      fight.nodes.map((n) =>
        n.kind === "beat" ? `${n.actor}: ${n.fragments[0].text}` : n.kind === "turn" ? `Turn ${n.number}` : n.kind
      )
    ).toEqual([
      "Turn 1",
      "Kobold, Tinkerer: A tin canister burst in the air.",
      "Talon: I found the gap in its leather.",
      "Turn 2",
    ]);
  });

  it("opens at the first turn — what's said before it stays the story", () => {
    const scenes = assembleProse(
      segments([
        "[COMBAT: Clearing]",
        'N(K. Leader): "You can\'t run forever, traitor."',
        "T1",
        "@(Kobold, Tinkerer) Parts-Filled Sling → Talon",
        "=> A tin canister burst in the air.",
      ])
    );
    expect(scenes[0].nodes.map((n) => n.kind)).toEqual(["dialogue", "combat"]);
  });

  it("tells a round beside its creature, its actions' outcomes as one", () => {
    const scenes = assembleProse(
      segments([
        "[COMBAT: Clearing]",
        "T1",
        "R(Kobold, Tinkerer)",
        "@(Kobold, Tinkerer) Parts-Filled Sling → Jacqui",
        "=> The canister burst in the air.",
        "@(Kobold, Tinkerer) Parts-Filled Sling → Talon",
        "=> Scrap sliced through Talon and Jacqui alike.",
        "R(Kobold, Elite)",
        "@(Kobold, Elite) Mining Pick → Kowyn",
        "=> The pick bit the turf.",
      ])
    );
    const fight = scenes[0].nodes[0] as Extract<(typeof scenes)[0]["nodes"][number], { kind: "combat" }>;
    const beats = fight.nodes.filter((n) => n.kind === "beat") as Array<{
      actor: string;
      fragments: Array<{ text: string }>;
    }>;
    expect(beats.map((b) => [b.actor, b.fragments.map((f) => f.text)])).toEqual([
      ["Kobold, Tinkerer", ["The canister burst in the air.", "Scrap sliced through Talon and Jacqui alike."]],
      ["Kobold, Elite", ["The pick bit the turf."]],
    ]);
  });

  it("opens at the first action when the fight marks no turns", () => {
    const scenes = assembleProse(
      segments(["[COMBAT]", "=> They circled us.", "@(Talon) Shortsword → Kobold", "=> I struck first."])
    );
    expect(scenes[0].nodes.map((n) => n.kind)).toEqual(["paragraph", "combat"]);
  });

  it("shortens a statblock's name for the margin", () => {
    expect(actorLabel("Kobold, Tinkerer")).toBe("K. Tinkerer");
    expect(actorLabel("[[Kobold, Elite]]")).toBe("K. Elite");
    expect(actorLabel("Thin Kobold, A")).toBe("T. Kobold");
    expect(actorLabel("Fat [[Kobold, A]]")).toBe("F. Kobold");
    expect(actorLabel("Kobold, A")).toBe("Kobold, A");
    expect(actorLabel("Talon")).toBe("Talon");
  });
});
