/**
 * Tag Processor Interface
 * Strategy pattern for handling different tag kinds
 */

import type {
	PersistentTag,
	EntityDelta,
	ProgressChange,
	ThreadChange,
} from "../types";

export interface TagProcessor {
	/**
	 * Process a tag and extract deltas
	 * Returns true if the tag was handled by this processor
	 */
	process(
		tag: PersistentTag,
		entityDeltas: Map<string, EntityDelta>,
		progressChanges: ProgressChange[],
		threadChanges: ThreadChange[]
	): boolean;
}

/**
 * Tag processor registry
 * Maps tag kinds to their processors
 */
export class TagProcessorRegistry {
	private processors: Map<string, TagProcessor> = new Map();

	register(kind: string, processor: TagProcessor): void {
		this.processors.set(kind, processor);
	}

	getProcessor(kind: string): TagProcessor | undefined {
		return this.processors.get(kind);
	}

	process(
		tag: PersistentTag,
		entityDeltas: Map<string, EntityDelta>,
		progressChanges: ProgressChange[],
		threadChanges: ThreadChange[]
	): boolean {
		const processor = this.getProcessor(tag.kind);
		if (!processor) return false;

		return processor.process(
			tag,
			entityDeltas,
			progressChanges,
			threadChanges
		);
	}
}
