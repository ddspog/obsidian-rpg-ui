/**
 * Lonelog Parser Tests
 * Comprehensive tests for all Lonelog notation syntax
 */

import { describe, it, expect } from "vitest";
import { parseLonelog, extractTags } from "./parser";
import type { LonelogEntry, PersistentTag } from "./types";

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
      expect(result[0]).toEqual({
        type: "roll",
        roll: "d20+5=17 vs DC 15",
        result: "Success",
        success: true,
      });
    });

    it("should parse failed rolls", () => {
      const result = parseLonelog("d: d20+2=8 vs DC 15 -> Fail");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "roll",
        roll: "d20+2=8 vs DC 15",
        result: "Fail",
        success: false,
      });
    });

    it("should parse consequences (=>)", () => {
      const result = parseLonelog("=> She slips between the trees");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "consequence",
        text: "She slips between the trees",
        tags: [],
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
        text: "Halt! Who goes there?",
      });
    });

    it("should parse PC dialogue", () => {
      const result = parseLonelog('PC: "I mean no harm"');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "dialogue",
        speaker: "PC",
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
        text: "This was a close call",
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
      const tags = extractTags(
        "=> Combat ends. [N:Goblin Boss|dead] [PC:Elara|HP-5] [Clock:Alarm 3/6]",
      );
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
          entry.type === "consequence" &&
          entry.tags.some((tag) => tag.kind === "npc" && tag.name === "Goblin Lookout"),
      );
      expect(consequenceWithDeath).toBeDefined();

      // Check for PC healing tag
      const consequenceWithHeal = result.find(
        (entry) =>
          entry.type === "consequence" &&
          entry.tags.some((tag) => tag.kind === "pc" && tag.name === "Elara"),
      );
      expect(consequenceWithHeal).toBeDefined();
    });
  });
});
