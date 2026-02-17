/**
 * Tagging Module
 * Strategy pattern implementation for tag processing
 */

export type { TagProcessor } from "./processor";
export { TagProcessorRegistry } from "./processor";
export {
	parseChange,
	calculateTotalHPChange,
	getFinalStatus,
	getActiveTags,
} from "./change-parser";
export { PCTagProcessor, NPCTagProcessor } from "./entity-processor";
export { ProgressTagProcessor } from "./progress-processor";
export { ThreadTagProcessor } from "./thread-processor";
