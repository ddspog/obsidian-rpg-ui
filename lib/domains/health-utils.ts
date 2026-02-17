/**
 * Health utilities module
 * Contains health calculation logic and event handler logic
 */

/**
 * Calculate healing amount with max HP cap
 */
export function calculateHealing(
	currentHP: number,
	healAmount: number,
	maxHealth: number
): { newCurrent: number; resetDeathSaves: boolean } {
	if (healAmount <= 0) {
		return { newCurrent: currentHP, resetDeathSaves: false };
	}

	const newCurrent = Math.min(currentHP + healAmount, maxHealth);
	// Reset death saves if going from 0 or below to above 0
	const resetDeathSaves = currentHP <= 0 && newCurrent > 0;

	return { newCurrent, resetDeathSaves };
}

/**
 * Apply damage with temporary HP absorption
 */
export function calculateDamage(
	currentHP: number,
	tempHP: number,
	damageAmount: number
): { newCurrent: number; newTemporary: number } {
	if (damageAmount <= 0) {
		return { newCurrent: currentHP, newTemporary: tempHP };
	}

	let remainingDamage = damageAmount;
	let newTemp = tempHP;
	let newCurrent = currentHP;

	// Apply damage to temporary HP first
	if (newTemp > 0) {
		if (damageAmount <= newTemp) {
			newTemp -= damageAmount;
			remainingDamage = 0;
		} else {
			remainingDamage = damageAmount - newTemp;
			newTemp = 0;
		}
	}

	// Apply remaining damage to actual HP
	if (remainingDamage > 0) {
		newCurrent = Math.max(0, currentHP - remainingDamage);
	}

	return { newCurrent, newTemporary: newTemp };
}

/**
 * Apply temporary HP (only replace if new value is higher)
 */
export function calculateTempHP(currentTemp: number, newTempAmount: number): number {
	if (newTempAmount <= 0) {
		return currentTemp;
	}
	return Math.max(currentTemp, newTempAmount);
}

/**
 * Calculate health percentage for progress bar display
 */
export function calculateHealthPercentage(current: number, max: number): number {
	return Math.max(0, Math.min(100, (current / max) * 100));
}
