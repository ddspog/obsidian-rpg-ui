/**
 * Death save utilities module
 * Contains death save tracking logic
 */

/**
 * Calculate new used count based on checkbox toggle (used for hit dice and death saves)
 * If item is currently used, uncheck it and all after it
 * If item is not used, check it and all before it
 */
export function calculateNewUsedCount(currentUsed: number, index: number): number {
	const isUsed = index < currentUsed;
	if (isUsed) {
		// Uncheck this die and all dice after it
		return index;
	} else {
		// Check this die and all dice before it
		return index + 1;
	}
}

/**
 * Update death save successes based on toggle
 */
export function updateDeathSaveSuccesses(
	currentSuccesses: number,
	index: number
): number {
	return calculateNewUsedCount(currentSuccesses, index);
}

/**
 * Update death save failures based on toggle
 */
export function updateDeathSaveFailures(
	currentFailures: number,
	index: number
): number {
	return calculateNewUsedCount(currentFailures, index);
}

/**
 * Check if character is dead (3 failures without 3 successes)
 */
export function isDead(successes: number, failures: number): boolean {
	return failures >= 3 && successes < 3;
}

/**
 * Check if death saves are complete
 */
export function isDeathSavesComplete(successes: number, failures: number): boolean {
	return successes >= 3 || failures >= 3;
}

/**
 * Check if character should be showing death saves UI
 */
export function shouldShowDeathSaves(currentHP: number): boolean {
	return currentHP <= 0;
}
