/**
 * Change Parser
 * Parses change strings into typed StateChange objects
 */

import type { StateChange } from "../types";

/**
 * Known status keywords for parsing
 */
const STATUS_KEYWORDS = [
	"dead",
	"unconscious",
	"wounded",
	"hostile",
	"alert",
	"distracted",
	"prone",
	"stunned",
	"paralyzed",
	"frightened",
	"charmed",
	"blinded",
	"deafened",
	"invisible",
	"poisoned",
	"grappled",
	"restrained",
	"incapacitated",
	"petrified",
];

/**
 * Parse a change string into a StateChange
 * Examples:
 * - "HP-9" -> HP change of -9
 * - "HP+3" -> HP change of +3
 * - "Stress-1" -> Stat change of -1
 * - "dead" -> Status change to "dead"
 * - "alert→unconscious" -> Status transition
 * - "+captured" -> Add tag
 * - "-wounded" -> Remove tag
 */
export function parseChange(change: string): StateChange | null {
	// HP change: HP+X or HP-X
	const hpMatch = change.match(/^HP([+-])(\d+)$/);
	if (hpMatch) {
		return parseHPChange(hpMatch);
	}

	// Stat change: StatName+X or StatName-X
	const statMatch = change.match(/^([A-Za-z]+)([+-])(\d+)$/);
	if (statMatch) {
		return parseStatChange(statMatch);
	}

	// Status transition: from→to
	const transitionMatch = change.match(/^(.+?)→(.+)$/);
	if (transitionMatch) {
		return parseStatusTransition(transitionMatch);
	}

	// Tag addition: +tag
	if (change.startsWith("+")) {
		return { type: "tag_add", tag: change.slice(1) };
	}

	// Tag removal: -tag
	if (change.startsWith("-")) {
		return { type: "tag_remove", tag: change.slice(1) };
	}

	// Simple status (only known status words)
	if (STATUS_KEYWORDS.includes(change.toLowerCase())) {
		return { type: "status", from: null, to: change };
	}

	// Unknown format
	return null;
}

/**
 * Parse HP change from regex match
 */
function parseHPChange(
	match: RegExpMatchArray
): { type: "hp"; delta: number } {
	const sign = match[1] === "+" ? 1 : -1;
	const amount = parseInt(match[2], 10);
	return { type: "hp", delta: sign * amount };
}

/**
 * Parse stat change from regex match
 */
function parseStatChange(
	match: RegExpMatchArray
): { type: "stat"; stat: string; delta: number } {
	const stat = match[1];
	const sign = match[2] === "+" ? 1 : -1;
	const amount = parseInt(match[3], 10);
	return { type: "stat", stat, delta: sign * amount };
}

/**
 * Parse status transition from regex match
 */
function parseStatusTransition(
	match: RegExpMatchArray
): { type: "status"; from: string; to: string } {
	return { type: "status", from: match[1], to: match[2] };
}

/**
 * Calculate total HP change from changes
 */
export function calculateTotalHPChange(changes: StateChange[]): number {
	return changes
		.filter((c): c is { type: "hp"; delta: number } => c.type === "hp")
		.reduce((total, c) => total + c.delta, 0);
}

/**
 * Get final status from changes
 */
export function getFinalStatus(changes: StateChange[]): string | null {
	const statusChanges = changes.filter(
		(c): c is { type: "status"; from: string | null; to: string } =>
			c.type === "status"
	);

	if (statusChanges.length === 0) return null;
	return statusChanges[statusChanges.length - 1].to;
}

/**
 * Get active tags from changes
 */
export function getActiveTags(changes: StateChange[]): Set<string> {
	const tags = new Set<string>();

	for (const change of changes) {
		if (change.type === "tag_add") {
			tags.add(change.tag);
		} else if (change.type === "tag_remove") {
			tags.delete(change.tag);
		}
	}

	return tags;
}
