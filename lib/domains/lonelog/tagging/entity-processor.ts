/**
 * Entity Tag Processors
 * Handles PC and NPC tag processing with a generic base
 */

import type { PCTag, NPCTag, PersistentTag } from "../types";
import type { TagProcessor } from "./processor";
import type {
	EntityDelta,
	ProgressChange,
	ThreadChange,
} from "../types";
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
