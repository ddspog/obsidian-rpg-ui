/**
 * Progress Tag Processor
 * Handles clock, track, event, and timer tags
 */

import type { PersistentTag } from "../types";
import type { TagProcessor } from "./processor";
import type {
	EntityDelta,
	ProgressChange,
	ThreadChange,
} from "../types";

/**
 * Progress Tag Processor
 * Extracts progress tracking changes (clocks, tracks, events, timers)
 */
export class ProgressTagProcessor implements TagProcessor {
	process(
		tag: PersistentTag,
		_entityDeltas: Map<string, EntityDelta>,
		progressChanges: ProgressChange[],
		_threadChanges: ThreadChange[]
	): boolean {
		const { kind } = tag;

		switch (kind) {
			case "clock":
			case "track":
			case "event":
				progressChanges.push({
					name: tag.name,
					kind,
					current: (tag as any).current,
					max: (tag as any).max,
				});
				return true;

			case "timer":
				progressChanges.push({
					name: tag.name,
					kind,
					current: (tag as any).value,
				});
				return true;

			default:
				return false;
		}
	}
}
