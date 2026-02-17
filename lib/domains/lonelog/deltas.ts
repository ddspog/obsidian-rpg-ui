/**
 * Delta Tracker
 * Extracts state mutations from parsed Lonelog tags
 * Uses strategy pattern for tag processing via TagProcessorRegistry
 */

import type {
	LonelogEntry,
	PersistentTag,
	EntityDelta,
	StateChange,
	ProgressChange,
	ThreadChange,
} from "./types";
import {
	TagProcessorRegistry,
	PCTagProcessor,
	NPCTagProcessor,
	ProgressTagProcessor,
	ThreadTagProcessor,
	parseChange,
} from "./tagging";

/**
 * Initialize tag processor registry with all processors
 */
function createProcessorRegistry(): TagProcessorRegistry {
	const registry = new TagProcessorRegistry();
	registry.register("pc", new PCTagProcessor());
	registry.register("npc", new NPCTagProcessor());
	registry.register("clock", new ProgressTagProcessor());
	registry.register("track", new ProgressTagProcessor());
	registry.register("event", new ProgressTagProcessor());
	registry.register("timer", new ProgressTagProcessor());
	registry.register("thread", new ThreadTagProcessor());
	return registry;
}

/**
 * Extract all deltas from a list of Lonelog entries
 */
export function extractDeltas(entries: LonelogEntry[]): {
	entityDeltas: EntityDelta[];
	progressChanges: ProgressChange[];
	threadChanges: ThreadChange[];
} {
	const entityDeltas: Map<string, EntityDelta> = new Map();
	const progressChanges: ProgressChange[] = [];
	const threadChanges: ThreadChange[] = [];
	const registry = createProcessorRegistry();

	for (const entry of entries) {
		if (entry.type === "consequence") {
			processConsequenceTags(
				entry.tags,
				registry,
				entityDeltas,
				progressChanges,
				threadChanges
			);
		}
	}

	return {
		entityDeltas: Array.from(entityDeltas.values()),
		progressChanges,
		threadChanges,
	};
}

/**
 * Process tags from a consequence entry using registry
 */
function processConsequenceTags(
	tags: PersistentTag[],
	registry: TagProcessorRegistry,
	entityDeltas: Map<string, EntityDelta>,
	progressChanges: ProgressChange[],
	threadChanges: ThreadChange[]
): void {
	for (const tag of tags) {
		registry.process(
			tag,
			entityDeltas,
			progressChanges,
			threadChanges
		);
	}
}

/**
 * Accumulate deltas across multiple entries
 * This is useful for computing the total change over a session
 */
export function accumulateDeltas(
	allDeltas: EntityDelta[]
): Map<string, EntityDelta> {
	const accumulated = new Map<string, EntityDelta>();

	for (const delta of allDeltas) {
		const key = `${delta.entityType}:${delta.entity}`;
		let acc = accumulated.get(key);

		if (!acc) {
			acc = {
				entity: delta.entity,
				entityType: delta.entityType,
				changes: [],
			};
			accumulated.set(key, acc);
		}

		// Accumulate changes
		acc.changes.push(...delta.changes);
	}

	return accumulated;
}

/**
 * Calculate total HP change for an entity
 * Re-exported from tagging module
 */
export { calculateTotalHPChange } from "./tagging";

/**
 * Get the final status of an entity
 * Re-exported from tagging module
 */
export { getFinalStatus } from "./tagging";

/**
 * Get all active tags for an entity
 * Re-exported from tagging module
 */
export { getActiveTags } from "./tagging";
