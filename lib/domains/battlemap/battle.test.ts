import { describe, it, expect } from "vitest";
import { parseLonelog, extractTags } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import { foldBattles, frameAt } from "./battle";

const battles = (lines: string[]) => foldBattles(groupIntoProse(parseLonelog(lines.join("\n"))));

describe("map tags", () => {
  it("reads placements and moves", () => {
    expect(extractTags("[Pos: Talon c4; [[Kobold, Elite]] H2]")).toEqual([
      {
        kind: "position",
        entries: [
          { name: "Talon", at: "C4" },
          { name: "[[Kobold, Elite]]", at: "H2" },
        ],
      },
    ]);
    expect(extractTags("[Mv: G4>F4 > E4]")).toEqual([{ kind: "move", path: ["G4", "F4", "E4"] }]);
    expect(extractTags("[Mv: Lilith D5]")).toEqual([{ kind: "move", who: "Lilith", path: ["D5"] }]);
  });

  it("binds a map to the fight", () => {
    const [entry] = parseLonelog("[COMBAT: [[Kobold Ambush]]]");
    expect(entry).toEqual({ type: "combat_marker", state: "open", map: "[[Kobold Ambush]]" });
  });

  it("lifts a move off the action line's text", () => {
    const [entry] = parseLonelog("@(Talon) Dash behind the rocks [Mv: E3]");
    expect(entry).toMatchObject({
      type: "action",
      actor: "Talon",
      text: "Dash behind the rocks",
      tags: [{ kind: "move", path: ["E3"] }],
    });
  });
});

describe("foldBattles — the fight, entry by entry", () => {
  const log = [
    "[COMBAT: [[Kobold Ambush]]]",
    "R1",
    "[Pos: Talon C4; Lilith D4; [[Kobold, Elite]] H2]",
    "@(Talon) Dash behind the rocks [Mv: E3]",
    "@(Kobold, Elite) [Mv: G4>F4>E4] Mining Pick → Lilith",
    "R2",
    "@(Lilith) Shoves the kobold",
    "=> It stumbles back. [Mv: [[Kobold, Elite]] F4]",
    "[/COMBAT]",
    "@(Talon) Rests",
  ];

  it("binds the map and keeps one frame per entry in the fight", () => {
    const [b] = battles(log);
    expect(b.map).toBe("[[Kobold Ambush]]");
    expect(b.frames.map((f) => [f.round, f.actor ?? "-"])).toEqual([
      [1, "-"],
      [1, "-"],
      [1, "Talon"],
      [1, "Kobold, Elite"],
      [2, "-"],
      [2, "Lilith"],
    ]);
  });

  it("moves the actor, drawing its route from where it stood", () => {
    const [b] = battles(log);
    const elite = b.frames[3];
    expect(elite.moves).toEqual([
      {
        name: "[[Kobold, Elite]]",
        path: [
          { col: 7, row: 1 },
          { col: 6, row: 3 },
          { col: 5, row: 3 },
          { col: 4, row: 3 },
        ],
      },
    ]);
    // Struck from where its route ended (E4), at Lilith where she stood (D4).
    expect(elite.attacks).toEqual([
      { from: "Kobold, Elite", to: "Lilith", id: elite.id, fromAt: { col: 4, row: 3 }, toAt: { col: 3, row: 3 } },
    ]);
    expect(elite.placements.find((p) => p.name === "Talon")?.at).toEqual({ col: 4, row: 2 });
  });

  it("moves someone else when the tag names them", () => {
    const [b] = battles(log);
    const last = b.frames[b.frames.length - 1];
    expect(last.placements.find((p) => p.name === "[[Kobold, Elite]]")?.at).toEqual({ col: 5, row: 3 });
  });

  it("finds the frame for any entry, and ignores fights with no map", () => {
    const [b] = battles(log);
    expect(frameAt(b, 4)?.actor).toBe("Kobold, Elite");
    expect(battles(["[COMBAT]", "@(Talon) Hit [Mv: B2]"])).toEqual([]);
  });
});

describe("conditions on the map — PCs and foes alike", () => {
  it("gives a condition with + and lifts it with -", () => {
    const [b] = battles([
      "[COMBAT: [[Kobold Ambush]]]",
      "[Pos: Lilith G6; [[Kobold, Elite]] H5]",
      "@(Kobold, Elite) Lantern Splash → Lilith",
      "=> She dives to smother the flames. [PC:Lilith|+prone] [F:[[Kobold, Elite]]|+surprised]",
      "@(Lilith) Gets up",
      "=> Back on her feet. [PC:Lilith|-prone]",
    ]);
    expect(b.frames[1].conditions).toEqual({ lilith: ["prone"], "kobold, elite": ["surprised"] });
    expect(b.frames[2].conditions).toEqual({ "kobold, elite": ["surprised"] });
  });
});

describe("starting squares in the initiative list", () => {
  const lines = [
    "[Init: [[Kobold, Elite]] d20+[[Initiative]]=20 @N5; Talon d20+[[Initiative]]=14 @j14; Lilith 2]",
    "[COMBAT: Clearing]",
  ];

  it("reads @square after each entry's roll", () => {
    const tag = extractTags(lines[0]).find((t) => t.kind === "initiative");
    expect(tag && "entries" in tag ? tag.entries : []).toEqual([
      { name: "[[Kobold, Elite]]", value: 20, roll: "d20+[[Initiative]]=", at: "N5" },
      { name: "Talon", value: 14, roll: "d20+[[Initiative]]=", at: "J14" },
      { name: "Lilith", value: 2 },
    ]);
  });

  it("opens the fight with everyone there — before anyone acts", () => {
    const [battle] = battles(lines);
    expect(battle.opening).toEqual([
      { name: "[[Kobold, Elite]]", at: { col: 13, row: 4 } },
      { name: "Talon", at: { col: 9, row: 13 } },
    ]);
  });

  it("carries them into the turns, where moves take over", () => {
    const [battle] = battles([...lines, "T1", "@(Talon) Dash [Mv: K12]"]);
    const last = battle.frames[battle.frames.length - 1];
    expect(last.placements.find((p) => p.name === "Talon")?.at).toEqual({ col: 10, row: 11 });
    expect(last.placements.find((p) => p.name === "[[Kobold, Elite]]")?.at).toEqual({ col: 13, row: 4 });
  });
});

describe("token emoji in the initiative list", () => {
  it("reads an emoji after an entry, before or after its square", () => {
    const tag = extractTags(
      "[Init: Fat [[Kobold, A]] 9 @F7 🐸; Thin [[Kobold, A]] 18 🐀 @R8; Talon 14 ⚔️; Lilith 2]"
    ).find((t) => t.kind === "initiative");
    expect(tag && "entries" in tag ? tag.entries : []).toEqual([
      { name: "Fat [[Kobold, A]]", value: 9, at: "F7", icon: "🐸" },
      { name: "Thin [[Kobold, A]]", value: 18, at: "R8", icon: "🐀" },
      { name: "Talon", value: 14, icon: "⚔️" },
      { name: "Lilith", value: 2 },
    ]);
  });

  it("keeps them on the fight, by combatant", () => {
    const [battle] = battles(["[Init: Fat [[Kobold, A]] 9 @F7 🐸; Talon 14 @J14]", "[COMBAT: Clearing]", "T1"]);
    expect(battle.icons).toEqual({ "fat kobold, a": "🐸" });
  });
});

describe("moving before an action, and after it", () => {
  it("reads which by where the move sits on the action line", () => {
    const [entry] = parseLonelog("@(Talon) [Mv: K11] Shortsword → Kobold [Mv: J14]");
    expect(entry.type === "action" && entry.tags).toEqual([
      { kind: "move", path: ["K11"] },
      { kind: "move", path: ["J14"], after: true },
    ]);
    expect(entry.type === "action" && entry.text).toBe("Shortsword → Kobold");
  });

  it("strikes from where the move before it ended, then moves on", () => {
    const [b] = battles([
      "[Init: Talon 14 @J14; [[Kobold, Elite]] 12 @L10]",
      "[COMBAT: Clearing]",
      "T1",
      "@(Talon) [Mv: K11] Shortsword → Kobold, Elite [Mv: J14]",
      "=> I struck and slipped back into cover.",
    ]);
    const f = b.frames[b.frames.length - 1];
    expect(f.moves).toEqual([
      {
        name: "Talon",
        path: [
          { col: 9, row: 13 },
          { col: 10, row: 10 },
        ],
      },
      {
        name: "Talon",
        path: [
          { col: 10, row: 10 },
          { col: 9, row: 13 },
        ],
        after: true,
      },
    ]);
    expect(f.attacks[0]).toMatchObject({ fromAt: { col: 10, row: 10 }, toAt: { col: 11, row: 9 } });
    expect(f.placements.find((p) => p.name === "Talon")?.at).toEqual({ col: 9, row: 13 });
  });
});
