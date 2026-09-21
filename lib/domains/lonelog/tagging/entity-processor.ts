/**
 * Entity Tag Processors
 * Handles PC and NPC tag processing with a generic base
 */

import type { PCTag, NPCTag, PersistentTag, DialOpTag } from "../types";
import type { TagProcessor } from "./processor";
import type { EntityDelta, ProgressChange, ThreadChange } from "../types";
import { parseChange } from "./change-parser";

/**
 * Base processor for entity tags (PC/NPC)
 */
abstract class BaseEntityTagProcessor implements TagProcessor {
  abstract getEntityType(): "pc" | "npc";
  abstract getChanges(tag: PersistentTag): string[];

  process(
    tag: PersistentTag,
    entityDeltas: Map<string, EntityDelta>,
    _progressChanges: ProgressChange[],
    _threadChanges: ThreadChange[]
  ): boolean {
    const entityType = this.getEntityType();
    const entityTag = tag as PCTag | NPCTag;
    const key = `${entityType}:${entityTag.name}`;

    let delta = entityDeltas.get(key);
    if (!delta) {
      delta = {
        entity: entityTag.name,
        entityType,
        changes: [],
      };
      entityDeltas.set(key, delta);
    }

    // Parse each change string
    const changes = this.getChanges(tag);
    for (const change of changes) {
      const stateChange = parseChange(change);
      if (stateChange) {
        delta.changes.push(stateChange);
      }
    }

    return true;
  }
}

/**
 * PC Tag Processor
 * Handles PC character state changes
 */
export class PCTagProcessor extends BaseEntityTagProcessor {
  getEntityType(): "pc" {
    return "pc";
  }

  getChanges(tag: PersistentTag): string[] {
    const pcTag = tag as PCTag;
    return pcTag.changes || [];
  }
}

/**
 * NPC Tag Processor
 * Handles NPC character state changes
 */
export class NPCTagProcessor extends BaseEntityTagProcessor {
  getEntityType(): "npc" {
    return "npc";
  }

  getChanges(tag: PersistentTag): string[] {
    const npcTag = tag as NPCTag;
    return npcTag.tags || [];
  }
}

/**
 * Dial-op Tag Processor
 *
 * A PC-scoped resource op (`[Talon/Mystic Mark-1]`) becomes a stat change on
 * that character, so charge / track adjustments surface in the PC delta tracker
 * alongside `[PC:Name|…]` changes. `inc` / `dec` map to a signed stat delta;
 * `set` (`=n`) and `inspect` (`?`) record nothing (an absolute set has no delta;
 * inspect is read-only). SESSION ops (`[CF+1]`, no `pc`) are left to the
 * running-value display path (see dial-ops.ts) — not a PC delta.
 */
export class DialOpTagProcessor implements TagProcessor {
  process(
    tag: PersistentTag,
    entityDeltas: Map<string, EntityDelta>,
    _progressChanges: ProgressChange[],
    _threadChanges: ThreadChange[]
  ): boolean {
    const op = tag as DialOpTag;
    if (!op.pc || !op.name) return false; // session op — not a PC delta
    if (op.op !== "inc" && op.op !== "dec") return false; // set / inspect record nothing
    const amount = op.amount ?? 0;
    if (amount === 0) return false;
    const delta = op.op === "inc" ? amount : -amount;

    const key = `pc:${op.pc}`;
    let entry = entityDeltas.get(key);
    if (!entry) {
      entry = { entity: op.pc, entityType: "pc", changes: [] };
      entityDeltas.set(key, entry);
    }
    entry.changes.push({ type: "stat", stat: op.name, delta });
    return true;
  }
}
