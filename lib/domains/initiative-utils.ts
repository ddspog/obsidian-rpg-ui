/**
 * Initiative turn management utilities
 * Handles round progression and turn navigation
 */

/**
 * Calculate next active turn in initiative
 * Returns next active index and whether a new round started
 */
export function calculateNextTurn(
	sortedItems: Array<{ index: number }>,
	currentActiveIndex: number,
	currentRound: number
): {
	nextActiveIndex: number;
	newRound: number;
	roundIncremented: boolean;
} {
	if (sortedItems.length === 0) {
		return {
			nextActiveIndex: -1,
			newRound: currentRound,
			roundIncremented: false,
		};
	}

	const currentActiveItemIndex = sortedItems.findIndex(
		(item) => item.index === currentActiveIndex
	);

	let nextActiveIndex = -1;
	let newRound = currentRound;
	let roundIncremented = false;

	if (
		currentActiveItemIndex === -1 ||
		currentActiveItemIndex === sortedItems.length - 1
	) {
		// At the end or no active turn - go to first item and increment round
		nextActiveIndex = sortedItems[0].index;
		if (currentActiveItemIndex !== -1) {
			newRound = currentRound + 1;
			roundIncremented = true;
		}
	} else {
		// Go to next item in sequence
		nextActiveIndex = sortedItems[currentActiveItemIndex + 1].index;
	}

	return { nextActiveIndex, newRound, roundIncremented };
}

/**
 * Calculate previous active turn in initiative
 */
export function calculatePreviousTurn(
	sortedItems: Array<{ index: number }>,
	currentActiveIndex: number,
	currentRound: number
): {
	prevActiveIndex: number;
	newRound: number;
} {
	if (sortedItems.length === 0) {
		return {
			prevActiveIndex: -1,
			newRound: currentRound,
		};
	}

	const currentActiveItemIndex = sortedItems.findIndex(
		(item) => item.index === currentActiveIndex
	);

	let prevActiveIndex = -1;
	let newRound = currentRound;

	if (currentActiveItemIndex === -1 || currentActiveItemIndex === 0) {
		// At the beginning or no active turn - go to last item
		prevActiveIndex = sortedItems[sortedItems.length - 1].index;
		// Decrement round when cycling backward
		if (currentActiveItemIndex !== -1 && currentRound > 1) {
			newRound = currentRound - 1;
		}
	} else {
		// Go to previous item
		prevActiveIndex = sortedItems[currentActiveItemIndex - 1].index;
	}

	return { prevActiveIndex, newRound };
}

/**
 * Calculate health status class based on current HP
 */
export function getHealthStatusClass(currentHp: number, maxHp: number): string {
	if (currentHp <= 0) return "monster-status-dead";

	const healthPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
	if (healthPercent <= 33) return "monster-status-injured";
	if (healthPercent >= 90) return "monster-status-healthy";

	return "";
}
