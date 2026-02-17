/**
 * Thread Tag Processor
 * Handles thread state tracking
 */

import type { PersistentTag } from "../types";
import type { TagProcessor } from "./processor";
import type {
	EntityDelta,
	ProgressChange,
	ThreadChange,
} from "../types";

/**
 * Thread Tag Processor
 * Extracts thread state changes
 */
export class ThreadTagProcessor implements TagProcessor {
	process(
		tag: PersistentTag,
		_entityDeltas: Map<string, EntityDelta>,
		_progressChanges: ProgressChange[],
		threadChanges: ThreadChange[]
	): boolean {
		if (tag.kind !== "thread") {
			return false;
		}

		const threadTag = tag as any;
		threadChanges.push({
			name: threadTag.name,
			from: null, // We don't track previous state yet
			to: threadTag.state,
		});

		return true;
	}
}
