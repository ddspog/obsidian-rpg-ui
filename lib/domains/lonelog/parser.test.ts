/**
 * Lonelog Parser Tests
 * Comprehensive tests for all Lonelog notation syntax
 */

import { describe, it, expect } from "vitest";
import { parseLonelog, extractTags, parseSceneMarker } from "./parser";

describe("Lonelog Parser", () => {
  describe("Scene markers", () => {
    it("should parse sequential scene markers", () => {
      const result = parseLonelog("S1 Dark forest clearing");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "scene",
        number: "S1",
        context: "Dark forest clearing",
      });
    });

    it("should parse scene markers with asterisks", () => {
      const result = parseLonelog("S1 *Dark forest clearing*");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "scene",
        number: "S1",
        context: "Dark forest clearing",
      });
    });

    it("should parse flashback scene markers", () => {
      const result = parseLonelog("S5a Earlier that morning");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "scene",
        number: "S5a",
        context: "Earlier that morning",
      });
    });

    it("should parse parallel thread markers", () => {
      const result = parseLonelog("T1-S1 Meanwhile, at the castle");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "scene",
        number: "T1-S1",
        context: "Meanwhile, at the castle",
      });
    });

    it("should parse montage markers", () => {
      const result = parseLonelog("S7.1 Training montage begins");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "scene",
        number: "S7.1",
        context: "Training montage begins",
      });
    });
  });

  describe("Core symbols", () => {
    it("should parse action lines (@)", () => {
      const result = parseLonelog("@ Elara sneaks toward the camp");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "action",
        text: "Elara sneaks toward the camp",
      });
    });

    it("should parse oracle questions (?)", () => {
      const result = parseLonelog("? Is anyone inside?");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "oracle_question",
        text: "Is anyone inside?",
      });
    });

    it("should parse oracle answers (->)", () => {
      const result = parseLonelog("-> Yes, but...");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "oracle_answer",
        text: "Yes, but...",
        roll: undefined,
      });
    });

    it("should parse oracle answers with dice rolls", () => {
      const result = parseLonelog("-> Yes, but... (d6=3)");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "oracle_answer",
        text: "Yes, but...",
        roll: "d6=3",
      });
    });

    it("should parse rolls (d:)", () => {
      const result = parseLonelog("d: d20+5=17 vs DC 15 -> Success");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "roll",
        roll: "d20+5=17 vs DC 15",
        result: "Success",
        success: true,
        total: 17,
        vsTarget: "DC 15",
      });
    });

    it("should parse failed rolls", () => {
      const result = parseLonelog("d: d20+2=8 vs DC 15 -> Fail");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "roll",
        roll: "d20+2=8 vs DC 15",
        result: "Fail",
        success: false,
        total: 8,
        vsTarget: "DC 15",
      });
    });

    it("should parse consequences (=>)", () => {
      const result = parseLonelog("=> She slips between the trees");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "consequence",
        text: "She slips between the trees",
        tags: [],
        conclusion: "She slips between the trees",
      });
    });
  });

  describe("Dialogue", () => {
    it("should parse NPC dialogue", () => {
      const result = parseLonelog('N (Guard): "Halt! Who goes there?"');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "dialogue",
        speaker: "Guard",
        speakerType: "npc",
        text: "Halt! Who goes there?",
      });
    });

    it("should parse PC dialogue", () => {
      const result = parseLonelog('PC: "I mean no harm"');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "dialogue",
        speaker: "PC",
        speakerType: "pc",
        text: "I mean no harm",
      });
    });
  });

  describe("Table and generator results", () => {
    it("should parse table rolls", () => {
      const result = parseLonelog("tbl: WeatherTable d6=4 Heavy Rain");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "table_roll",
        source: "WeatherTable",
        roll: "d6=4",
        result: "Heavy Rain",
      });
    });

    it("should parse generator results", () => {
      const result = parseLonelog("gen: NameGenerator Thorin Ironshield");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "generator",
        source: "NameGenerator",
        result: "Thorin Ironshield",
      });
    });
  });

  describe("Meta notes", () => {
    it("should parse meta notes", () => {
      const result = parseLonelog("(note: This was a close call)");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "meta_note",
        text: "note: This was a close call",
      });
    });
  });

  describe("Narrative prose", () => {
    it("should parse narrative text", () => {
      const result = parseLonelog("The wind howls through the trees.");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "narrative",
        text: "The wind howls through the trees.",
      });
    });
  });

  describe("Tag extraction", () => {
    it("should extract NPC tags", () => {
      const tags = extractTags("[N:Goblin Lookout|distracted]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "npc",
        name: "Goblin Lookout",
        tags: ["distracted"],
        ref: false,
      });
    });

    it("should extract NPC reference tags", () => {
      const tags = extractTags("[#N:Goblin Lookout]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "npc",
        name: "Goblin Lookout",
        tags: [],
        ref: true,
      });
    });

    it("should extract NPC tags with multiple states", () => {
      const tags = extractTags("[N:Guard|wounded|hostile]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "npc",
        name: "Guard",
        tags: ["wounded", "hostile"],
        ref: false,
      });
    });

    it("should extract location tags", () => {
      const tags = extractTags("[L:Goblin Camp|dark|dangerous]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "location",
        name: "Goblin Camp",
        tags: ["dark", "dangerous"],
      });
    });

    it("should extract event progress tags", () => {
      const tags = extractTags("[E:AlertClock 2/6]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "event",
        name: "AlertClock",
        current: 2,
        max: 6,
      });
    });

    it("should extract clock tags", () => {
      const tags = extractTags("[Clock:Reinforcements 1/4]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "clock",
        name: "Reinforcements",
        current: 1,
        max: 4,
      });
    });

    it("should extract clock tags with alternate format", () => {
      const tags = extractTags("[Clock:4/12]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "clock",
        name: "Clock",
        current: 4,
        max: 12,
      });
    });

    it("should extract dial tags", () => {
      const tags = extractTags("[Dial:Chaos Factor|5|1-9]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "dial",
        name: "Chaos Factor",
        current: 5,
        min: 1,
        max: 9,
      });
    });

    it("ignores a malformed dial (missing range)", () => {
      expect(extractTags("[Dial:Chaos Factor|5]")).toHaveLength(0);
    });

    it("should extract track tags", () => {
      const tags = extractTags("[Track:Escape 3/8]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "track",
        name: "Escape",
        current: 3,
        max: 8,
      });
    });

    it("should extract timer tags", () => {
      const tags = extractTags("[Timer:Dawn 3]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "timer",
        name: "Dawn",
        value: 3,
      });
    });

    it("should extract timer tags with numeric name", () => {
      const tags = extractTags("[Timer:5]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "timer",
        name: "Timer",
        value: 5,
      });
    });

    it("should extract thread tags", () => {
      const tags = extractTags("[Thread:Find Sister|Open]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "thread",
        name: "Find Sister",
        state: "Open",
      });
    });

    it("should extract thread tags with default state", () => {
      const tags = extractTags("[Thread:Investigate Cult]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "thread",
        name: "Investigate Cult",
        state: "Open",
      });
    });

    it("should extract PC tags with stat changes", () => {
      const tags = extractTags("[PC:Elara|HP-9|Stress+1]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "pc",
        name: "Elara",
        changes: ["HP-9", "Stress+1"],
      });
    });

    it("should extract multiple tags from a line", () => {
      const tags = extractTags("=> Combat ends. [N:Goblin Boss|dead] [PC:Elara|HP-5] [Clock:Alarm 3/6]");
      expect(tags).toHaveLength(3);
      expect(tags[0]).toEqual({
        kind: "npc",
        name: "Goblin Boss",
        tags: ["dead"],
        ref: false,
      });
      expect(tags[1]).toEqual({
        kind: "pc",
        name: "Elara",
        changes: ["HP-5"],
      });
      expect(tags[2]).toEqual({
        kind: "clock",
        name: "Alarm",
        current: 3,
        max: 6,
      });
    });
  });

  describe("Multi-line parsing", () => {
    it("should parse multiple entries", () => {
      const log = `S1 Dark forest clearing
@ Elara sneaks forward
d: Stealth d20+5=18 vs DC 14 -> Success
=> She remains undetected`;

      const result = parseLonelog(log);
      expect(result).toHaveLength(4);
      expect(result[0].type).toBe("scene");
      expect(result[1].type).toBe("action");
      expect(result[2].type).toBe("roll");
      expect(result[3].type).toBe("consequence");
    });

    it("should skip empty lines", () => {
      const log = `@ Action one

@ Action two`;

      const result = parseLonelog(log);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("action");
      expect(result[1].type).toBe("action");
    });
  });

  describe("Complex scenario", () => {
    it("should parse a full combat sequence", () => {
      const log = `S1 *Goblin ambush*
@ Elara attacks Goblin Lookout
d: d20+7=19 vs AC 15 -> Hit
d: 1d8+4=9 slashing damage
=> [N:Goblin Lookout|HP-9|dead]

? Do the other goblins flee?
-> No, and... (d6=2)
=> They call for reinforcements. [Clock:Reinforcements 1/4]

@ Thorne casts Healing Word on Elara
=> [PC:Elara|HP+7]
(note: Used 1st level spell slot)`;

      const result = parseLonelog(log);
      expect(result.length).toBeGreaterThan(0);

      // Check scene
      expect(result[0]).toEqual({
        type: "scene",
        number: "S1",
        context: "Goblin ambush",
      });

      // Check for NPC death tag in consequence
      const consequenceWithDeath = result.find(
        (entry) =>
          entry.type === "consequence" && entry.tags.some((tag) => tag.kind === "npc" && tag.name === "Goblin Lookout")
      );
      expect(consequenceWithDeath).toBeDefined();

      // Check for PC healing tag
      const consequenceWithHeal = result.find(
        (entry) => entry.type === "consequence" && entry.tags.some((tag) => tag.kind === "pc" && tag.name === "Elara")
      );
      expect(consequenceWithHeal).toBeDefined();
    });
  });

  describe("Partylog extensions", () => {
    it("should parse attributed actions @(Name)", () => {
      const result = parseLonelog("@(Kael) Pick the lock on the cellar door");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "action",
        actor: "Kael",
        text: "Pick the lock on the cellar door",
      });
    });

    it("should parse collaborative actions @(A > B)", () => {
      const result = parseLonelog("@(Mira > Kael) Mira assists Kael in climbing");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "action",
        actor: "Mira",
        assist: "Kael",
        text: "Mira assists Kael in climbing",
      });
    });

    it("should parse group actions @(A+B)", () => {
      const result = parseLonelog("@(Kael+Mira) Force open the heavy door");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "action",
        actor: "Kael+Mira",
        text: "Force open the heavy door",
      });
    });

    it("should parse world events !", () => {
      const result = parseLonelog("! The ceiling begins to crack");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "world_event",
        text: "The ceiling begins to crack",
        tags: [],
      });
    });

    it("should extract tags from world events", () => {
      const result = parseLonelog("! Orcs arrive [F:Orc×3|HP 11 each]");
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("world_event");
      if (result[0].type === "world_event") {
        expect(result[0].tags).toHaveLength(1);
        expect(result[0].tags[0]).toEqual({ kind: "foe", name: "Orc×3", tags: ["HP 11 each"] });
      }
    });

    it("should parse attributed rolls d(Name):", () => {
      const result = parseLonelog("d(Kael): Stealth d20+7=21 -> Success");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "roll",
        actor: "Kael",
        roll: "Stealth d20+7=21",
        result: "Success",
        success: true,
        label: "Stealth",
        total: 21,
      });
    });

    it("should parse Partylog dialogue PC(Name):", () => {
      const result = parseLonelog('PC(Kael): "I don\'t trust him."');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "dialogue",
        speaker: "Kael",
        speakerType: "pc",
        text: "I don't trust him.",
      });
    });

    it("should parse NPC dialogue N(Name):", () => {
      const result = parseLonelog('N(Baron): "You\'ll do as I say."');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "dialogue",
        speaker: "Baron",
        speakerType: "npc",
        text: "You'll do as I say.",
      });
    });

    it("should parse combat markers", () => {
      const result = parseLonelog("[COMBAT]\nR1\n@(Mira) Attack\n[/COMBAT]");
      expect(result[0]).toEqual({ type: "combat_marker", state: "open" });
      expect(result[1]).toEqual({ type: "round_marker", round: 1 });
      expect(result[2].type).toBe("action");
      expect(result[3]).toEqual({ type: "combat_marker", state: "close" });
    });

    it("should parse round markers", () => {
      const result = parseLonelog("R1\nR2\nR10");
      expect(result).toEqual([
        { type: "round_marker", round: 1 },
        { type: "round_marker", round: 2 },
        { type: "round_marker", round: 10 },
      ]);
    });

    it("should parse oracle with attribution ?(Name)", () => {
      const result = parseLonelog("?(Sable) Is the ruin inhabited?");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "oracle_question",
        actor: "Sable",
        text: "Is the ruin inhabited?",
      });
    });

    it("should parse foe tags [F:Enemy|stats]", () => {
      const tags = extractTags("[F:Bandit Leader|HP 27|Close]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "foe",
        name: "Bandit Leader",
        tags: ["HP 27", "Close"],
      });
    });

    it("should parse meta note variants (rule:, post:, hook:)", () => {
      const r1 = parseLonelog("(rule: Flanking gives +2)");
      expect(r1[0]).toEqual({ type: "meta_note", text: "rule: Flanking gives +2" });

      const r2 = parseLonelog("(hook: scout the temple before the shipment)");
      expect(r2[0]).toEqual({ type: "meta_note", text: "hook: scout the temple before the shipment" });
    });

    it("should handle bare @ as legacy unattributed action", () => {
      const result = parseLonelog("@ Elara sneaks forward");
      expect(result[0]).toEqual({ type: "action", text: "Elara sneaks forward" });
    });

    it("should parse [RESOURCES] block markers", () => {
      const result = parseLonelog("[RESOURCES]\n[Inv:Torch|3]\n[/RESOURCES]");
      expect(result[0]).toEqual({ type: "resource_marker", state: "open" });
      expect(result[1].type).toBe("consequence");
      expect(result[2]).toEqual({ type: "resource_marker", state: "close" });
    });

    it("should parse standalone [Inv:] lines as consequences with tags", () => {
      const result = parseLonelog("[Inv:Torch-1]");
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("consequence");
      if (result[0].type === "consequence") {
        expect(result[0].tags).toHaveLength(1);
        expect(result[0].tags[0]).toEqual({
          kind: "inventory",
          name: "Torch",
          ref: false,
          delta: -1,
          props: [],
        });
      }
    });

    it("should parse [Inv:] with quantity and props", () => {
      const tags = extractTags("[Inv:Healing Potion|2|magical|restores d8 HP]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "inventory",
        name: "Healing Potion",
        ref: false,
        quantity: 2,
        props: ["magical", "restores d8 HP"],
      });
    });

    it("should parse [Inv:] transitions", () => {
      const tags = extractTags("[Inv:Torch|3→2]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "inventory",
        name: "Torch",
        ref: false,
        transition: { from: 3, to: 2 },
        props: [],
      });
    });

    it("should parse [Inv:] depleted state", () => {
      const tags = extractTags("[Inv:Oil Flask|depleted]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "inventory",
        name: "Oil Flask",
        ref: false,
        depleted: true,
        props: [],
      });
    });

    it("should parse [Inv:] reference", () => {
      const tags = extractTags("[#Inv:Bone Amulet]");
      expect(tags).toHaveLength(1);
      if (tags[0].kind === "inventory") {
        expect(tags[0].ref).toBe(true);
        expect(tags[0].name).toBe("Bone Amulet");
      }
    });

    it("should parse [Wealth:] absolute amounts", () => {
      const tags = extractTags("[Wealth:Gold 45|Silver 12]");
      expect(tags).toHaveLength(2);
      expect(tags[0]).toEqual({ kind: "wealth", currency: "Gold", amount: 45 });
      expect(tags[1]).toEqual({ kind: "wealth", currency: "Silver", amount: 12 });
    });

    it("should parse [Wealth:] deltas", () => {
      const tags = extractTags("[Wealth:Gold+15]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({ kind: "wealth", currency: "Gold", delta: 15 });

      const tags2 = extractTags("[Wealth:Gold-8]");
      expect(tags2[0]).toEqual({ kind: "wealth", currency: "Gold", delta: -8 });
    });

    it("should parse [R:] room tags with status", () => {
      const tags = extractTags("[R:3|cleared]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({ kind: "room", id: "3", ref: false, status: "cleared" });
    });

    it("should parse [R:] room tags with status and description", () => {
      const tags = extractTags("[R:4|active|storage room, dusty shelves]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "room",
        id: "4",
        ref: false,
        status: "active",
        description: "storage room, dusty shelves",
      });
    });

    it("should parse [R:] room tags with exits", () => {
      const tags = extractTags("[R:1|cleared|guard room|exits N:R2, E:R3]");
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        kind: "room",
        id: "1",
        ref: false,
        status: "cleared",
        description: "guard room",
        exits: ["N:R2", "E:R3"],
      });
    });

    it("should parse [#R:] room reference tags", () => {
      const tags = extractTags("[#R:3]");
      expect(tags).toHaveLength(1);
      if (tags[0].kind === "room") {
        expect(tags[0].ref).toBe(true);
        expect(tags[0].id).toBe("3");
      }
    });

    it("should parse [DUNGEON STATUS] block markers", () => {
      const result = parseLonelog("[DUNGEON STATUS]\n[R:1|cleared]\n[/DUNGEON STATUS]");
      expect(result[0]).toEqual({ type: "dungeon_status_marker", state: "open" });
      expect(result[1].type).toBe("consequence");
      expect(result[2]).toEqual({ type: "dungeon_status_marker", state: "close" });
    });
  });

  describe("Prose-mode extensions", () => {
    it("derives a tag-stripped conclusion from a consequence", () => {
      const result = parseLonelog("=> She slips past unseen. [N:Goblin Lookout|distracted] [Clock:Alarm 1/4]");
      expect(result).toHaveLength(1);
      const entry = result[0];
      expect(entry.type).toBe("consequence");
      if (entry.type === "consequence") {
        expect(entry.conclusion).toBe("She slips past unseen.");
        expect(entry.tags).toHaveLength(2);
      }
    });

    it("leaves an empty conclusion for tag-only consequence lines", () => {
      const result = parseLonelog("[PC:Elara|HP-5]");
      const entry = result[0];
      expect(entry.type).toBe("consequence");
      if (entry.type === "consequence") {
        expect(entry.conclusion).toBe("");
      }
    });

    it("parses a bare ++ as a concat marker", () => {
      const result = parseLonelog("=> First.\n++\n=> Second.");
      expect(result.map((e) => e.type)).toEqual(["consequence", "concat", "consequence"]);
    });

    it("extracts a [CF:n] chaos factor from an oracle question", () => {
      const result = parseLonelog("? [CF:5] Does the scene occur?");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "oracle_question",
        text: "Does the scene occur?",
        actor: undefined,
        chaosFactor: 5,
      });
    });

    it("extracts both attribution and chaos factor", () => {
      const result = parseLonelog("?(Sable) [CF:3] Is the ruin inhabited?");
      expect(result[0]).toEqual({
        type: "oracle_question",
        actor: "Sable",
        chaosFactor: 3,
        text: "Is the ruin inhabited?",
      });
    });

    it("treats indented plain-prose lines as continuations of the previous entry", () => {
      const log = [
        "gen: Testing the Expected Scene",
        "  Alterations: d10=8 vs CF 5 -> Expected Scene",
        "=> S01 After the Landslide",
      ].join("\n");
      const result = parseLonelog(log);
      expect(result.map((e) => e.type)).toEqual(["generator", "continuation", "consequence"]);
      const cont = result[1];
      if (cont.type === "continuation") {
        expect(cont.text).toBe("Alterations: d10=8 vs CF 5 -> Expected Scene");
      }
    });

    it("does not treat a leading indented line (no previous entry) as a continuation", () => {
      const result = parseLonelog("  The mist settles over the valley.");
      expect(result[0].type).toBe("narrative");
    });

    it("keeps an indented semantic marker as its real type (not a continuation)", () => {
      const result = parseLonelog("=> Setup [Clock:Boss 0/4]\n  => Final blow [Clock:Boss 4/4]");
      expect(result.map((e) => e.type)).toEqual(["consequence", "consequence"]);
      const second = result[1];
      if (second.type === "consequence") {
        expect(second.tags).toHaveLength(1);
        expect(second.conclusion).toBe("Final blow");
      }
    });

    it("recognizes scene-shaped consequence text via parseSceneMarker", () => {
      expect(parseSceneMarker("S01 After the Landslide")).toEqual({
        number: "S01",
        context: "After the Landslide",
      });
      expect(parseSceneMarker("Just some prose.")).toBeNull();
    });
  });
});

describe("dial-op tokens", () => {
  it("classifies a bare dial-op line as a mechanical consequence with empty conclusion", () => {
    const [entry] = parseLonelog("[CF+1]");
    expect(entry.type).toBe("consequence");
    if (entry.type === "consequence") {
      expect(entry.conclusion).toBe(""); // strips to nothing → excluded from prose
      expect(entry.tags).toEqual([{ kind: "dial-op", abbr: "CF", op: "inc", amount: 1 }]);
    }
  });

  it("parses set / dec / inspect forms", () => {
    expect(extractTags("[CF=5]")).toEqual([{ kind: "dial-op", abbr: "CF", op: "set", amount: 5 }]);
    expect(extractTags("[CF:5]")).toEqual([{ kind: "dial-op", abbr: "CF", op: "set", amount: 5 }]);
    expect(extractTags("[CF-2]")).toEqual([{ kind: "dial-op", abbr: "CF", op: "dec", amount: 2 }]);
    expect(extractTags("[CF?]")).toEqual([{ kind: "dial-op", abbr: "CF", op: "inspect" }]);
  });

  it("extracts an inline dial-op and strips it from the conclusion", () => {
    const [entry] = parseLonelog("=> The tension rises. [CF+1]");
    expect(entry.type).toBe("consequence");
    if (entry.type === "consequence") {
      expect(entry.conclusion).toBe("The tension rises.");
      expect(entry.tags).toContainEqual({ kind: "dial-op", abbr: "CF", op: "inc", amount: 1 });
    }
  });

  it("does not treat a [[wikilink]] or a [Dial:…] tag as a dial-op", () => {
    expect(extractTags("[[Some Page]]").filter((t) => t.kind === "dial-op")).toEqual([]);
    const dial = extractTags("[Dial:Chaos Factor|5|1-9]");
    expect(dial).toContainEqual({ kind: "dial", name: "Chaos Factor", current: 5, min: 1, max: 9 });
    expect(dial.filter((t) => t.kind === "dial-op")).toEqual([]);
  });

  it("keeps the inline [CF:n] on an oracle `?` line as a chaosFactor snapshot", () => {
    const [entry] = parseLonelog("? [CF:5] Does the door open?");
    expect(entry.type).toBe("oracle_question");
    if (entry.type === "oracle_question") expect(entry.chaosFactor).toBe(5);
  });

  it("parses a PC resource op `[Character/Resource op]` (name may contain spaces)", () => {
    expect(extractTags("[Talon/Mystic Mark-1]")).toEqual([
      { kind: "dial-op", pc: "Talon", name: "Mystic Mark", op: "dec", amount: 1 },
    ]);
    expect(extractTags("[Talon/Mystic Mark=3]")).toEqual([
      { kind: "dial-op", pc: "Talon", name: "Mystic Mark", op: "set", amount: 3 },
    ]);
    expect(extractTags("[Talon/Mystic Mark?]")).toEqual([
      { kind: "dial-op", pc: "Talon", name: "Mystic Mark", op: "inspect" },
    ]);
  });

  it("classifies a bare PC-op line as a mechanical consequence, stripped from prose", () => {
    const [entry] = parseLonelog("[Talon/Mystic Mark-1]");
    expect(entry.type).toBe("consequence");
    if (entry.type === "consequence") {
      expect(entry.conclusion).toBe("");
      expect(entry.tags).toContainEqual({ kind: "dial-op", pc: "Talon", name: "Mystic Mark", op: "dec", amount: 1 });
    }
    const [inline] = parseLonelog("=> Talon marks the target. [Talon/Mystic Mark-1]");
    if (inline.type === "consequence") expect(inline.conclusion).toBe("Talon marks the target.");
  });

  it("does NOT mistake wikilinks, [PC:…] deltas, or date-like tokens for PC ops", () => {
    const pcOps = (s: string) => extractTags(s).filter((t) => t.kind === "dial-op" && "pc" in t && t.pc);
    expect(pcOps("[[Some/Page]]")).toEqual([]); // wikilink with a slash
    expect(pcOps("[PC:Talon|Mystic Mark-1]")).toEqual([]); // existing PC delta form (colon)
    expect(pcOps("Met at [2026/06/30] near noon.")).toEqual([]); // date-like, two slashes, no op
    expect(pcOps("[Inv:Rope/2]")).toEqual([]); // kind:content
  });
});

describe("parseLonelog — hard-wrapped prose", () => {
  it("joins soft-wrapped narrative lines into one paragraph", () => {
    const out = parseLonelog(["Imported by the [[Scene Check]] when its roll", "lands on Interrupt."].join("\n"));
    expect(out).toEqual([
      { type: "narrative", text: "Imported by the [[Scene Check]] when its roll lands on Interrupt." },
    ]);
  });

  it("breaks the paragraph on a blank line", () => {
    const out = parseLonelog(["First para line one", "line two", "", "Second para"].join("\n"));
    expect(out.map((e) => (e as { text: string }).text)).toEqual(["First para line one line two", "Second para"]);
  });

  it("never joins across a mechanical line", () => {
    const out = parseLonelog(["Prose before", "? A question", "Prose after"].join("\n"));
    expect(out.map((e) => e.type)).toEqual(["narrative", "oracle_question", "narrative"]);
  });
});

describe("list ops — `[Name+ entry]` / `[Name- entry]` / `[Name?]` / `[Name@]`", () => {
  const tagsOf = (line: string) => {
    const e = parseLonelog(line)[0];
    return e.type === "consequence" || e.type === "world_event"
      ? e.tags
      : e.type === "oracle_question"
        ? (e.dialOps ?? [])
        : [];
  };

  it("parses add / remove / inspect / roll, keeping multi-word entries intact", () => {
    expect(tagsOf("=> A new ally. [Characters+ Bertha the Angry Avian]")).toEqual([
      { kind: "list-op", name: "Characters", op: "add", entry: "Bertha the Angry Avian" },
    ]);
    expect(tagsOf("=> Resolved. [Threads- Find the mystical stone]")).toEqual([
      { kind: "list-op", name: "Threads", op: "remove", entry: "Find the mystical stone" },
    ]);
    // `?` INSPECTS the whole list; `@` ROLLS one entry off the sheet.
    expect(tagsOf("? Who acts? [Characters?]")).toEqual([{ kind: "list-op", name: "Characters", op: "inspect" }]);
    expect(tagsOf("? Who acts? [Characters@]")).toEqual([{ kind: "list-op", name: "Characters", op: "roll" }]);
    expect(tagsOf("? Who acts? [Characters@ r1=3 r2=7]")).toEqual([
      { kind: "list-op", name: "Characters", op: "roll", rolled: true, rolls: [3, 7] },
    ]);
  });

  it("strips the op from the narration", () => {
    const e = parseLonelog("=> A new ally. [Characters+ Bertha]")[0];
    expect(e.type === "consequence" && e.conclusion).toBe("A new ally.");
  });

  it("stays disjoint from resource ops and other tag kinds", () => {
    // ALLCAPS abbr → resource, not a list (Title Case is the list discriminator).
    expect(tagsOf("=> Chaos rises. [CF+1]")).toEqual([{ kind: "dial-op", abbr: "CF", op: "inc", amount: 1 }]);
    expect(tagsOf("=> Mark spent. [Talon/Mystic Mark-1]")[0].kind).toBe("dial-op");
    expect(tagsOf("=> An NPC. [N:Bertha|hostile]")[0].kind).toBe("npc");
    expect(tagsOf("=> A thread. [Thread:Find the stone|Open]")[0].kind).toBe("thread");
  });

  it("leaves wikilinks alone", () => {
    const e = parseLonelog("=> A link [[Some Note]] stays.")[0];
    expect(e.type === "consequence" && e.tags).toEqual([]);
    expect(e.type === "consequence" && e.conclusion).toBe("A link [[Some Note]] stays.");
  });
});
