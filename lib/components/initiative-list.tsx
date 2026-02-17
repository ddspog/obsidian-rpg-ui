/**
 * InitiativeList component
 * Displays sorted list of initiative combatants
 */

import type { InitiativeBlock } from "lib/types";
import type { InitiativeState } from "lib/domains/initiative";
import { InitiativeRow } from "lib/components/initiative-row";

export interface SortedInitiativeItem {
	item: any;
	index: number;
	initiative: number;
}

export interface InitiativeListProps {
	block: InitiativeBlock;
	state: InitiativeState;
	sortedItems: SortedInitiativeItem[];
	inputValue: string;
	onInitiativeChange: (index: number, value: string) => void;
	onInputChange: (value: string) => void;
	onDamage: (itemIndex: number, monsterKey: string) => void;
	onHeal: (itemIndex: number, monsterKey: string) => void;
}

export function InitiativeList(props: InitiativeListProps) {
	if (props.sortedItems.length === 0) {
		return (
			<div className="initiative-list">
				<div className="initiative-empty-state">
					No combatants added
				</div>
			</div>
		);
	}

	return (
		<div className="initiative-list">
			<div className="initiative-items">
				{props.sortedItems.map(
					({ item, index, initiative }) => (
						<InitiativeRow
							key={index}
							item={item}
							index={index}
							initiative={initiative}
							isActive={
								index ===
								props.state.activeIndex
							}
							state={props.state}
							inputValue={props.inputValue}
							onInitiativeChange={(
								value
							) =>
								props.onInitiativeChange(
									index,
									value
								)
							}
							onInputChange={
								props.onInputChange
							}
							onDamage={(
								monsterKey
							) =>
								props.onDamage(
									index,
									monsterKey
								)
							}
							onHeal={(
								monsterKey
							) =>
								props.onHeal(
									index,
									monsterKey
								)
							}
						/>
					)
				)}
			</div>
		</div>
	);
}
