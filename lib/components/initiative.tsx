import type { InitiativeBlock, InitiativeConsumable, ParsedConsumableBlock } from "lib/types";
import type { InitiativeState } from "lib/domains/initiative";
import { getSortedInitiativeItems, itemHashKey } from "lib/domains/initiative";
import { useInitiativeState } from "lib/hooks/useInitiativeState";
import { InitiativeControls } from "lib/components/initiative-controls";
import { InitiativeList } from "lib/components/initiative-list";
import { MultiConsumableCheckboxes } from "lib/components/multi-consumable-checkboxes";
import { ConsumableState } from "lib/domains/consumables";

export type InitiativeProps = {
	static: InitiativeBlock;
	state: InitiativeState;
	onStateChange: (newState: InitiativeState) => void;
};

// Convert InitiativeConsumable to ParsedConsumableBlock format for ConsumableCheckboxes
function adaptInitiativeConsumable(
	consumable: InitiativeConsumable
): ParsedConsumableBlock {
	return {
		label: consumable.label,
		state_key: consumable.state_key,
		uses: consumable.uses,
		reset_on: consumable.reset_on_round
			? [{ event: "round", amount: undefined }]
			: undefined,
	};
}

export function Initiative(props: InitiativeProps) {
	const sortedItems = getSortedInitiativeItems(
		props.static.items,
		props.state.initiatives
	);

	const {
		inputValue,
		setInputValue,
		handleSetInitiative,
		handleDamage,
		handleNext,
		handlePrev,
		handleReset,
		handleConsumableStateChange,
	} = useInitiativeState(props.static, props.state, props.onStateChange);

	return (
		<div className="initiative-tracker">
			<InitiativeControls
				round={props.state.round}
				onPrev={handlePrev}
				onNext={handleNext}
				onReset={handleReset}
			/>

			{/* Consumables Section */}
			{props.static.consumables &&
				props.static.consumables.length > 0 && (
					<MultiConsumableCheckboxes
						consumables={props.static.consumables.map(
							adaptInitiativeConsumable
						)}
						states={Object.fromEntries(
							props.static.consumables.map((consumable) => [
								consumable.state_key,
								{
									value:
										props.state.consumables?.[
											consumable.state_key
										] || 0,
								},
							])
						)}
						onStateChange={handleConsumableStateChange}
					/>
				)}

			<InitiativeList
				block={props.static}
				state={props.state}
				sortedItems={sortedItems}
				inputValue={inputValue}
				onInitiativeChange={(index, value) =>
					handleSetInitiative(
						props.static.items[index],
						value
					)
				}
				onInputChange={setInputValue}
				onDamage={(itemIndex, monsterKey) =>
					handleDamage(
						props.static.items[itemIndex],
						monsterKey,
						inputValue
					)
				}
				onHeal={(itemIndex, monsterKey) =>
					handleDamage(
						props.static.items[itemIndex],
						monsterKey,
						inputValue,
						"heal"
					)
				}
			/>
		</div>
	);
}
