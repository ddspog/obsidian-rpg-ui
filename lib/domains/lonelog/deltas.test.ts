/**
 * Delta Tracker Tests
 */

import { describe, it, expect } from "vitest";
import { parseLonelog } from "./parser";
import {
  extractDeltas,
  accumulateDeltas,
  calculateTotalHPChange,
  getFinalStatus,
  getActiveTags,
} from "./deltas";

describe("Delta Tracker", () => {
  describe("extractDeltas", () => {
    it("should extract HP changes from PC tags", () => {
      const log = `=> [PC:Elara|HP-9]`;
      const entries = parseLonelog(log);
      const { entityDeltas } = extractDeltas(entries);

      expect(entityDeltas).toHaveLength(1);
      expect(entityDeltas[0]).toEqual({
        entity: "Elara",
        entityType: "pc",
        changes: [{ type: "hp", delta: -9 }],
      });
    });

    it("should extract HP healing from PC tags", () => {
      const log = `=> [PC:Thorne|HP+7]`;
      const entries = parseLonelog(log);
      const { entityDeltas } = extractDeltas(entries);

      expect(entityDeltas).toHaveLength(1);
      expect(entityDeltas[0].changes).toContainEqual({
        type: "hp",
        delta: 7,
      });
    });

    it("should extract multiple stat changes from PC tags", () => {
      const log = `=> [PC:Elara|HP-5|Stress+2]`;
      const entries = parseLonelog(log);
      const { entityDeltas } = extractDeltas(entries);

      expect(entityDeltas).toHaveLength(1);
      expect(entityDeltas[0].changes).toHaveLength(2);
      expect(entityDeltas[0].changes).toContainEqual({
        type: "hp",
        delta: -5,
      });
      expect(entityDeltas[0].changes).toContainEqual({
        type: "stat",
        stat: "Stress",
        delta: 2,
      });
    });

    it("should extract status changes from NPC tags", () => {
      const log = `=> [N:Goblin Lookout|dead]`;
      const entries = parseLonelog(log);
      const { entityDeltas } = extractDeltas(entries);

      expect(entityDeltas).toHaveLength(1);
      expect(entityDeltas[0]).toEqual({
        entity: "Goblin Lookout",
        entityType: "npc",
        changes: [{ type: "status", from: null, to: "dead" }],
      });
    });

    it("should extract status transitions from NPC tags", () => {
      const log = `=> [N:Guard|alert→unconscious]`;
      const entries = parseLonelog(log);
      const { entityDeltas } = extractDeltas(entries);

      expect(entityDeltas).toHaveLength(1);
      expect(entityDeltas[0].changes).toContainEqual({
        type: "status",
        from: "alert",
        to: "unconscious",
      });
    });

    it("should extract tag additions and removals", () => {
      const log = `=> [N:Guard|+captured|-wounded]`;
      const entries = parseLonelog(log);
      const { entityDeltas } = extractDeltas(entries);

      expect(entityDeltas).toHaveLength(1);
      expect(entityDeltas[0].changes).toHaveLength(2);
      expect(entityDeltas[0].changes).toContainEqual({
        type: "tag_add",
        tag: "captured",
      });
      expect(entityDeltas[0].changes).toContainEqual({
        type: "tag_remove",
        tag: "wounded",
      });
    });

    it("should extract clock progress changes", () => {
      const log = `=> [Clock:Reinforcements 3/6]`;
      const entries = parseLonelog(log);
      const { progressChanges } = extractDeltas(entries);

      expect(progressChanges).toHaveLength(1);
      expect(progressChanges[0]).toEqual({
        name: "Reinforcements",
        kind: "clock",
        current: 3,
        max: 6,
      });
    });

    it("should extract track progress changes", () => {
      const log = `=> [Track:Escape 5/8]`;
      const entries = parseLonelog(log);
      const { progressChanges } = extractDeltas(entries);

      expect(progressChanges).toHaveLength(1);
      expect(progressChanges[0]).toEqual({
        name: "Escape",
        kind: "track",
        current: 5,
        max: 8,
      });
    });

    it("should extract timer changes", () => {
      const log = `=> [Timer:Dawn 2]`;
      const entries = parseLonelog(log);
      const { progressChanges } = extractDeltas(entries);

      expect(progressChanges).toHaveLength(1);
      expect(progressChanges[0]).toEqual({
        name: "Dawn",
        kind: "timer",
        current: 2,
      });
    });

    it("should extract thread state changes", () => {
      const log = `=> [Thread:Find Sister|Closed]`;
      const entries = parseLonelog(log);
      const { threadChanges } = extractDeltas(entries);

      expect(threadChanges).toHaveLength(1);
      expect(threadChanges[0]).toEqual({
        name: "Find Sister",
        from: null,
        to: "Closed",
      });
    });

    it("should extract multiple changes from a single line", () => {
      const log = `=> Combat ends. [N:Goblin Boss|dead] [PC:Elara|HP-5] [Clock:Alarm 3/6]`;
      const entries = parseLonelog(log);
      const { entityDeltas, progressChanges } = extractDeltas(entries);

      expect(entityDeltas).toHaveLength(2);
      expect(progressChanges).toHaveLength(1);

      // Check NPC delta
      const npcDelta = entityDeltas.find((d) => d.entity === "Goblin Boss");
      expect(npcDelta).toBeDefined();
      expect(npcDelta?.changes).toContainEqual({
        type: "status",
        from: null,
        to: "dead",
      });

      // Check PC delta
      const pcDelta = entityDeltas.find((d) => d.entity === "Elara");
      expect(pcDelta).toBeDefined();
      expect(pcDelta?.changes).toContainEqual({ type: "hp", delta: -5 });

      // Check clock progress
      expect(progressChanges[0]).toEqual({
        name: "Alarm",
        kind: "clock",
        current: 3,
        max: 6,
      });
    });

    it("should accumulate changes across multiple entries", () => {
      const log = `@ Elara attacks
=> [PC:Elara|HP-2]

@ Thorne heals Elara
=> [PC:Elara|HP+5]`;

      const entries = parseLonelog(log);
      const { entityDeltas } = extractDeltas(entries);

      expect(entityDeltas).toHaveLength(1);
      expect(entityDeltas[0].changes).toHaveLength(2);
      expect(entityDeltas[0].changes).toContainEqual({ type: "hp", delta: -2 });
      expect(entityDeltas[0].changes).toContainEqual({ type: "hp", delta: 5 });
    });
  });

  describe("accumulateDeltas", () => {
    it("should merge deltas for the same entity", () => {
      const deltas = [
        {
          entity: "Elara",
          entityType: "pc" as const,
          changes: [{ type: "hp" as const, delta: -5 }],
        },
        {
          entity: "Elara",
          entityType: "pc" as const,
          changes: [{ type: "hp" as const, delta: 3 }],
        },
      ];

      const accumulated = accumulateDeltas(deltas);
      expect(accumulated.size).toBe(1);

      const elaraDelta = accumulated.get("pc:Elara");
      expect(elaraDelta).toBeDefined();
      expect(elaraDelta?.changes).toHaveLength(2);
    });

    it("should keep separate deltas for different entities", () => {
      const deltas = [
        {
          entity: "Elara",
          entityType: "pc" as const,
          changes: [{ type: "hp" as const, delta: -5 }],
        },
        {
          entity: "Thorne",
          entityType: "pc" as const,
          changes: [{ type: "hp" as const, delta: -3 }],
        },
      ];

      const accumulated = accumulateDeltas(deltas);
      expect(accumulated.size).toBe(2);
    });
  });

  describe("calculateTotalHPChange", () => {
    it("should sum up HP changes", () => {
      const changes = [
        { type: "hp" as const, delta: -5 },
        { type: "hp" as const, delta: 3 },
        { type: "hp" as const, delta: -2 },
      ];

      const total = calculateTotalHPChange(changes);
      expect(total).toBe(-4);
    });

    it("should ignore non-HP changes", () => {
      const changes = [
        { type: "hp" as const, delta: -5 },
        { type: "stat" as const, stat: "Stress", delta: 2 },
        { type: "hp" as const, delta: 3 },
      ];

      const total = calculateTotalHPChange(changes);
      expect(total).toBe(-2);
    });

    it("should return 0 for no HP changes", () => {
      const changes = [{ type: "stat" as const, stat: "Stress", delta: 2 }];

      const total = calculateTotalHPChange(changes);
      expect(total).toBe(0);
    });
  });

  describe("getFinalStatus", () => {
    it("should return the most recent status", () => {
      const changes = [
        { type: "status" as const, from: null, to: "wounded" },
        { type: "status" as const, from: "wounded", to: "unconscious" },
        { type: "status" as const, from: "unconscious", to: "dead" },
      ];

      const status = getFinalStatus(changes);
      expect(status).toBe("dead");
    });

    it("should return null if no status changes", () => {
      const changes = [{ type: "hp" as const, delta: -5 }];

      const status = getFinalStatus(changes);
      expect(status).toBeNull();
    });
  });

  describe("getActiveTags", () => {
    it("should track tag additions and removals", () => {
      const changes = [
        { type: "tag_add" as const, tag: "wounded" },
        { type: "tag_add" as const, tag: "poisoned" },
        { type: "tag_remove" as const, tag: "wounded" },
        { type: "tag_add" as const, tag: "frightened" },
      ];

      const tags = getActiveTags(changes);
      expect(tags.has("wounded")).toBe(false);
      expect(tags.has("poisoned")).toBe(true);
      expect(tags.has("frightened")).toBe(true);
    });

    it("should return empty set if no tag changes", () => {
      const changes = [{ type: "hp" as const, delta: -5 }];

      const tags = getActiveTags(changes);
      expect(tags.size).toBe(0);
    });
  });

  describe("Complex scenario", () => {
    it("should extract all deltas from a full combat log", () => {
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

@ Goblin attacks Elara
=> [PC:Elara|HP-5|+wounded]

@ Elara drinks potion
=> [PC:Elara|HP+8|-wounded]`;

      const entries = parseLonelog(log);
      const { entityDeltas, progressChanges } = extractDeltas(entries);

      // Check entity deltas
      expect(entityDeltas.length).toBeGreaterThan(0);

      const elaraDelta = entityDeltas.find((d) => d.entity === "Elara");
      expect(elaraDelta).toBeDefined();
      expect(elaraDelta?.entityType).toBe("pc");

      const totalHP = calculateTotalHPChange(elaraDelta?.changes || []);
      expect(totalHP).toBe(10); // +7 - 5 + 8

      const tags = getActiveTags(elaraDelta?.changes || []);
      expect(tags.has("wounded")).toBe(false); // Added then removed

      // Check progress changes
      const clockChange = progressChanges.find(
        (p) => p.name === "Reinforcements",
      );
      expect(clockChange).toBeDefined();
      expect(clockChange?.current).toBe(1);
      expect(clockChange?.max).toBe(4);
    });
  });
});
