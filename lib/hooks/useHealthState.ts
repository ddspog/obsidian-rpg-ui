/**
 * useHealthState hook
 * Manages all health state logic and event handlers for the health card component
 */

import { useState } from "react";
import type { HealthState } from "lib/types";
import {
	isMultiHitDiceState,
	isSingleHitDiceState,
} from "lib/domains/healthpoints";
import {
	calculateHealing,
	calculateDamage,
	calculateTempHP,
} from "lib/domains/health-utils";
import {
	calculateNewUsedCount,
	updateDeathSaveSuccesses,
	updateDeathSaveFailures,
} from "lib/domains/death-save-utils";

export function useHealthState(
	state: HealthState,
	maxHealth: number,
	onStateChange: (newState: HealthState) => void
) {
	const [inputValue, setInputValue] = useState("1");

	// Handle healing action
	const handleHeal = () => {
		const value = parseInt(inputValue) || 0;
		const { newCurrent, resetDeathSaves } = calculateHealing(
			state.current,
			value,
			maxHealth
		);

		if (newCurrent === state.current && !resetDeathSaves) return;

		const newState: HealthState = {
			...state,
			current: newCurrent,
		};

		// Reset death saves if healing from 0 HP
		if (resetDeathSaves) {
			newState.deathSaveSuccesses = 0;
			newState.deathSaveFailures = 0;
		}

		onStateChange(newState);
		setInputValue("1");
	};

	// Handle damage action
	const handleDamage = () => {
		const value = parseInt(inputValue) || 0;
		const { newCurrent, newTemporary } = calculateDamage(
			state.current,
			state.temporary,
			value
		);

		if (newCurrent === state.current && newTemporary === state.temporary) return;

		onStateChange({
			...state,
			current: newCurrent,
			temporary: newTemporary,
		});
		setInputValue("1");
	};

	// Handle temporary HP action
	const handleTempHP = () => {
		const value = parseInt(inputValue) || 0;
		const newTemp = calculateTempHP(state.temporary, value);

		if (newTemp === state.temporary) return;

		onStateChange({
			...state,
			temporary: newTemp,
		});
		setInputValue("1");
	};

	// Handle hit die toggle
	const toggleHitDie = (diceType: string | null, index: number) => {
		if (!diceType && isSingleHitDiceState(state)) {
			// Legacy single dice type
			const newHitDiceUsed = calculateNewUsedCount(
				state.hitdiceUsed,
				index
			);

			onStateChange({
				...state,
				hitdiceUsed: newHitDiceUsed,
			});
		} else if (diceType && isMultiHitDiceState(state)) {
			// Multiple dice types
			const currentUsed = state.hitdiceUsed[diceType] || 0;
			const newUsed = calculateNewUsedCount(currentUsed, index);

			onStateChange({
				...state,
				hitdiceUsed: {
					...(state.hitdiceUsed as Record<string, number>),
					[diceType]: newUsed,
				},
			});
		}
	};

	// Handle death save toggle
	const toggleDeathSave = (type: "success" | "failure", index: number) => {
		const newState = { ...state };

		if (type === "success") {
			newState.deathSaveSuccesses = updateDeathSaveSuccesses(
				state.deathSaveSuccesses,
				index
			);
		} else {
			newState.deathSaveFailures = updateDeathSaveFailures(
				state.deathSaveFailures,
				index
			);
		}

		onStateChange(newState);
	};

	return {
		inputValue,
		setInputValue,
		handleHeal,
		handleDamage,
		handleTempHP,
		toggleHitDie,
		toggleDeathSave,
	};
}
