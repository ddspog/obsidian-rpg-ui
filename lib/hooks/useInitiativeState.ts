/**
 * useInitiativeState hook
 * Manages all initiative state logic and event handlers
 */

import { useState } from "react";
import type {
	InitiativeBlock,
	InitiativeItem,
} from "lib/types";
import type { InitiativeState } from "lib/domains/initiative";
import {
	getSortedInitiativeItems,
	getMaxHp,
	itemHashKey,
} from "lib/domains/initiative";
import { ConsumableState } from "lib/domains/consumables";
import {
	calculateNextTurn,
	calculatePreviousTurn,
} from "lib/domains/initiative-utils";

export function useInitiativeState(
	static_: InitiativeBlock,
	state: InitiativeState,
	onStateChange: (newState: InitiativeState) => void
) {
	const [inputValue, setInputValue] = useState<string>("1");
	const sortedItems = getSortedInitiativeItems(
		static_.items,
		state.initiatives
	);

	// Handle setting initiative roll value
	const handleSetInitiative = (item: InitiativeItem, value: string) => {
		const itemHash = itemHashKey(item);
		const initiativeValue = parseInt(value) || 0;
		const newInitiatives = { ...state.initiatives };

		newInitiatives[itemHash] = initiativeValue;
		onStateChange({
			...state,
			initiatives: newInitiatives,
		});
	};

	// Handle damage/healing on initiative items
	const handleDamage = (
		item: InitiativeItem,
		monsterKey: string,
		value: string,
		type: "damage" | "heal" = "damage"
	) => {
		const parsedValue = parseInt(value) || 0;
		if (parsedValue <= 0) return;

		const itemHash = itemHashKey(item);
		const newHp = { ...state.hp };
		if (!newHp[itemHash]) {
			newHp[itemHash] = {};
		}

		const currentHp = newHp[itemHash][monsterKey] || 0;
		let applyValue = 0;

		if (type === "damage") {
			applyValue = Math.max(0, currentHp - parsedValue);
		} else {
			const maxHp = getMaxHp(item, monsterKey);
			applyValue = Math.min(maxHp, currentHp + parsedValue);
		}

		newHp[itemHash] = {
			...newHp[itemHash],
			[monsterKey]: applyValue,
		};

		onStateChange({ ...state, hp: newHp });
	};

	// Handle moving to next turn
	const handleNext = () => {
		if (sortedItems.length === 0) return;

		const { nextActiveIndex, newRound, roundIncremented } =
			calculateNextTurn(sortedItems, state.activeIndex, state.round);

		const newConsumables = {
			...(state.consumables || {}),
		};

		// Reset consumables that have reset_on_round if round was incremented
		if (roundIncremented && static_.consumables) {
			static_.consumables.forEach((consumable) => {
				if (consumable.reset_on_round) {
					newConsumables[consumable.state_key] = 0;
				}
			});
		}

		onStateChange({
			...state,
			activeIndex: nextActiveIndex,
			round: newRound,
			consumables: newConsumables,
		});
	};

	// Handle moving to previous turn
	const handlePrev = () => {
		if (sortedItems.length === 0) return;

		const { prevActiveIndex, newRound } = calculatePreviousTurn(
			sortedItems,
			state.activeIndex,
			state.round
		);

		onStateChange({
			...state,
			activeIndex: prevActiveIndex,
			round: newRound,
		});
	};

	// Handle reset
	const handleReset = () => {
		const newInitiatives: Record<string, number> = {};
		const newHp: Record<string, Record<string, number>> = {};
		const newConsumables: Record<string, number> = {};

		static_.items.forEach((item) => {
			const indexStr = itemHashKey(item);
			newInitiatives[indexStr] = 0;
			newHp[indexStr] = {};

			if (typeof item.hp === "number") {
				newHp[indexStr]["main"] = item.hp;
			} else if (item.hp && typeof item.hp === "object") {
				Object.entries(item.hp).forEach(([key, value]) => {
					newHp[indexStr][key] = value as number;
				});
			}
		});

		if (static_.consumables) {
			static_.consumables.forEach((consumable) => {
				newConsumables[consumable.state_key] = 0;
			});
		}

		onStateChange({
			...state,
			activeIndex: -1,
			initiatives: newInitiatives,
			hp: newHp,
			round: 1,
			consumables: newConsumables,
		});
	};

	// Handle consumable state change
	const handleConsumableStateChange = (
		stateKey: string,
		newState: ConsumableState
	) => {
		const newConsumables = { ...(state.consumables || {}) };
		newConsumables[stateKey] = newState.value;

		onStateChange({
			...state,
			consumables: newConsumables,
		});
	};

	return {
		inputValue,
		setInputValue,
		sortedItems,
		handleSetInitiative,
		handleDamage,
		handleNext,
		handlePrev,
		handleReset,
		handleConsumableStateChange,
	};
}
